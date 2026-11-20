// k6 load test of the order service: place orders over HTTP and time each one end to end, from
// POST /orders until GET /orders/:id says "confirmed", through Kafka, Postgres and MongoDB.
//
// Runs in k6's own Docker image (pnpm perf:load). Load the order service only, never a public site.
//
// PROFILE=smoke (default) | load | stress   ORDER_SERVICE_URL=http://order-service:8080
// AUTH_TOKEN_URL: when set (the Docker stack has Keycloak), setup() gets a catalog-admin token for the
// product writes. Placing and reading orders need none, so the load itself is unauthenticated.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE = __ENV.ORDER_SERVICE_URL || 'http://localhost:8088';
const PROFILE = __ENV.PROFILE || 'smoke';

// Arrival-rate executors start new orders at a fixed pace whatever the response times are, as real
// customers do. A closed model (a fixed number of looping users) slows down with the system and
// hides how bad it gets.
const PROFILES = {
  // Is everything wired up? A trickle of orders for 30 seconds.
  smoke: {
    executor: 'constant-arrival-rate',
    rate: 2,
    timeUnit: '1s',
    duration: '30s',
    preAllocatedVUs: 5,
    maxVUs: 20,
  },
  // Expected busy-hour traffic: ramp to 20 orders a second, hold, ramp down.
  load: {
    executor: 'ramping-arrival-rate',
    startRate: 2,
    timeUnit: '1s',
    preAllocatedVUs: 20,
    maxVUs: 200,
    stages: [
      { target: 20, duration: '1m' },
      { target: 20, duration: '2m' },
      { target: 0, duration: '30s' },
    ],
  },
  // Where does it break? Keeps climbing; expect the thresholds to fail and read where.
  stress: {
    executor: 'ramping-arrival-rate',
    startRate: 10,
    timeUnit: '1s',
    preAllocatedVUs: 50,
    maxVUs: 500,
    stages: [
      { target: 50, duration: '1m' },
      { target: 100, duration: '1m' },
      { target: 150, duration: '1m' },
      { target: 0, duration: '30s' },
    ],
  },
};
if (!PROFILES[PROFILE])
  throw new Error(`Unknown PROFILE "${PROFILE}". Use one of: ${Object.keys(PROFILES).join(', ')}`);

/** From POST /orders until the order reads "confirmed": what a customer waits for. */
const endToEnd = new Trend('order_end_to_end', true);
/** Share of accepted orders that ended confirmed within the polling window. */
const confirmed = new Rate('orders_confirmed');
/** Readings thrown away because the clock went backwards (seen in Docker's VM under heavy load). */
const clockJumps = new Counter('clock_jumps');

export const options = {
  scenarios: { orders: PROFILES[PROFILE] },
  // Any breach makes k6 exit with code 99, which fails the build.
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:POST /orders}': ['p(95)<300'],
    'http_req_duration{name:GET /orders/:id}': ['p(95)<200'],
    order_end_to_end: ['p(95)<2000'],
    orders_confirmed: ['rate>0.99'],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const PRODUCTS = 20;
const json = { headers: { 'Content-Type': 'application/json' } };

/** A catalog-admin token from the local test realm (OAuth 2.0 client credentials), or none. */
function adminHeaders() {
  const tokenUrl = __ENV.AUTH_TOKEN_URL;
  if (!tokenUrl) return json.headers;
  const res = http.post(tokenUrl, {
    grant_type: 'client_credentials',
    client_id: 'catalog-admin-cli',
    client_secret: 'dev-only-catalog-admin-cli-secret', // the realm's fixed, published, dev-only secret
  });
  if (res.status !== 200) throw new Error(`no token from ${tokenUrl}: ${res.status} ${res.body}`);
  return { ...json.headers, Authorization: `Bearer ${res.json('access_token')}` };
}

/** Runs once before the load: stocks the shop with plenty of everything, so no order fails on stock. */
export function setup() {
  const headers = adminHeaders();
  const products = [];
  for (let i = 1; i <= PRODUCTS; i++) {
    const product = { sku: `LOAD-${String(i).padStart(3, '0')}`, priceCents: 500 + i * 125 };
    const res = http.put(
      `${BASE}/products/${product.sku}`,
      JSON.stringify({ name: `Load test product ${i}`, priceCents: product.priceCents, stock: 100_000_000 }),
      { headers, tags: { name: 'PUT /products/:sku' } },
    );
    if (res.status !== 200 && res.status !== 201)
      throw new Error(`stocking ${product.sku} failed: ${res.status} ${res.body}`);
    products.push(product);
  }
  return { products };
}

/** One order: one to three different products, one to three of each. */
function anOrder(products) {
  const count = 1 + Math.floor(Math.random() * 3);
  const picked = [...products].sort(() => Math.random() - 0.5).slice(0, count);
  const lines = picked.map((p) => ({
    sku: p.sku,
    quantity: 1 + Math.floor(Math.random() * 3),
    unitPriceCents: p.priceCents,
  }));
  return {
    id: crypto.randomUUID(),
    customerId: crypto.randomUUID(),
    currency: 'USD',
    totalCents: lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0),
    lines,
  };
}

export default function ({ products }) {
  const order = anOrder(products);
  const started = Date.now();
  const placed = http.post(`${BASE}/orders`, JSON.stringify(order), {
    ...json,
    tags: { name: 'POST /orders' },
  });
  if (!check(placed, { 'order accepted (202)': (r) => r.status === 202 })) {
    confirmed.add(false);
    return;
  }

  // The outcome is asynchronous: poll until the order is stored. 404 means "not yet", not an error.
  // First after 25 ms, then 1.5 times longer each time up to 500 ms, for at most 10 s: fine-grained
  // when the service is fast, without flooding it with reads when it falls behind. (A fixed 25 ms
  // step sent 1,600 reads a second in the stress run and slowed the very endpoint it was timing.)
  let status;
  let wait = 0.025;
  for (let waited = 0; waited < 10 && !status; waited += wait, wait = Math.min(wait * 1.5, 0.5)) {
    sleep(wait);
    const res = http.get(`${BASE}/orders/${order.id}`, {
      tags: { name: 'GET /orders/:id' },
      responseCallback: http.expectedStatuses(200, 404),
    });
    if (res.status === 200) status = res.json('status');
  }
  const elapsed = Date.now() - started;
  if (elapsed >= 0) endToEnd.add(elapsed);
  else clockJumps.add(1);
  confirmed.add(status === 'confirmed');
  check(status, { 'order confirmed': (s) => s === 'confirmed' });
}
