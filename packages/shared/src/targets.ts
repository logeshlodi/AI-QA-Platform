/** A public demo application or API that specs run against. */
export interface Target {
  readonly baseUrl: string;
  /** Path that answers quickly when the target is healthy. */
  readonly healthPath: string;
  readonly okStatus: readonly number[];
}

export const targets = {
  saucedemo: { baseUrl: 'https://www.saucedemo.com', healthPath: '/', okStatus: [200] },
  restfulBooker: { baseUrl: 'https://restful-booker.herokuapp.com', healthPath: '/ping', okStatus: [201] },
  theInternet: {
    baseUrl: 'https://the-internet.herokuapp.com',
    healthPath: '/status_codes/200',
    okStatus: [200],
  },
  uiPlayground: { baseUrl: 'http://www.uitestingplayground.com', healthPath: '/', okStatus: [200] },
  todomvc: { baseUrl: 'https://demo.playwright.dev/todomvc', healthPath: '/', okStatus: [200] },
  apiMocking: { baseUrl: 'https://demo.playwright.dev/api-mocking', healthPath: '/', okStatus: [200] },
  countries: {
    baseUrl: 'https://countries.trevorblades.com',
    healthPath: '/?query=%7B__typename%7D',
    okStatus: [200],
  },
  soapCalculator: { baseUrl: 'http://www.dneonline.com', healthPath: '/calculator.asmx', okStatus: [200] },
} as const satisfies Record<string, Target>;

export type TargetName = keyof typeof targets;
export const targetNames = Object.keys(targets) as TargetName[];

const envKey = (name: string) => `TARGET_${name.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}_URL`;

/**
 * Resolve a target, letting an environment variable replace the hosted URL
 * (e.g. TARGET_SAUCEDEMO_URL=http://localhost:3000 for a local copy).
 */
export function resolveTarget(
  name: TargetName,
  source: Record<string, string | undefined> = process.env,
): Target {
  const override = source[envKey(name)];
  const target: Target = targets[name];
  return override ? { ...target, baseUrl: override.replace(/\/$/, '') } : target;
}

export const targetUrl = (name: TargetName, path = ''): string => `${resolveTarget(name).baseUrl}${path}`;
