/**
 * A storefront's client for the order service: the consumer in the HTTP contract. It is deliberately
 * written the way a separate team would write it, from what the storefront needs and nothing more, so
 * the contract records only the fields the storefront actually reads.
 */

export interface OrderLine {
  sku: string;
  quantity: number;
  unitPriceCents: number;
}

export interface NewOrder {
  id: string;
  customerId: string;
  currency: 'USD';
  totalCents: number;
  lines: OrderLine[];
}

export interface OrderSummary {
  id: string;
  status: 'confirmed' | 'rejected';
  totalCents: number;
  /** Why the order was rejected; null when it was confirmed. */
  rejectionReason: string | null;
  lines: OrderLine[];
}

export interface Product {
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
}

/** The order service said no to what was sent; `message` is its explanation. */
export class OrderRefusedError extends Error {
  override readonly name = 'OrderRefusedError';
}

export class StorefrontClient {
  constructor(private readonly baseUrl: string) {}

  /** Places an order. Resolves with its id once the service has accepted it for processing. */
  async placeOrder(order: NewOrder): Promise<{ orderId: string }> {
    const response = await this.send('POST', '/orders', order);
    if (response.status === 400)
      throw new OrderRefusedError(((await response.json()) as { error: string }).error);
    await this.expectStatus(response, 202);
    const { orderId } = (await response.json()) as { orderId: string };
    return { orderId };
  }

  /** The order and its outcome, or null when the service has no order with that id (yet). */
  async getOrder(id: string): Promise<OrderSummary | null> {
    const response = await this.send('GET', `/orders/${encodeURIComponent(id)}`);
    if (response.status === 404) return null;
    await this.expectStatus(response, 200);
    const order = (await response.json()) as OrderSummary;
    return {
      id: order.id,
      status: order.status,
      totalCents: order.totalCents,
      rejectionReason: order.rejectionReason,
      lines: order.lines,
    };
  }

  /** Sets a product's name, price and stock. */
  async saveProduct({ sku, ...fields }: Product): Promise<Product> {
    const response = await this.send('PUT', `/products/${encodeURIComponent(sku)}`, fields);
    if (response.status !== 200 && response.status !== 201) await this.expectStatus(response, 200);
    return (await response.json()) as Product;
  }

  private send(method: string, path: string, body?: unknown): Promise<Response> {
    return fetch(new URL(path, this.baseUrl), {
      method,
      headers:
        body === undefined
          ? { accept: 'application/json' }
          : { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private async expectStatus(response: Response, status: number): Promise<void> {
    if (response.status !== status) {
      throw new Error(
        `order service answered ${response.status}, expected ${status}: ${await response.text()}`,
      );
    }
  }
}
