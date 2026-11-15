/** Public demo accounts printed on the SauceDemo login page. Not secrets. */
export const SAUCE_PASSWORD = 'secret_sauce';

export const sauceUsers = {
  standard: 'standard_user',
  lockedOut: 'locked_out_user',
  problem: 'problem_user',
  performanceGlitch: 'performance_glitch_user',
  error: 'error_user',
  visual: 'visual_user',
} as const;

export type SauceUser = keyof typeof sauceUsers;

export interface Customer {
  firstName: string;
  lastName: string;
  postalCode: string;
}

export const defaultCustomer: Customer = { firstName: 'Logesh', lastName: 'Tester', postalCode: '600001' };
