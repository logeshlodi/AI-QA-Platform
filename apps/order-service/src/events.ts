import { z } from 'zod';
import type { PlacedOrder } from './contract';

/**
 * The events the service publishes, and the only code that builds them. main.ts publishes what these
 * functions return, and the Pact provider check calls the same functions, so a change to an event's
 * shape here is caught by the consumers' contracts before it ships.
 */
export const orderConfirmed = z.object({
  orderId: z.uuid(),
  totalCents: z.number().int().nonnegative(),
});

export const orderRejected = z.object({
  orderId: z.uuid(),
  reason: z.string().min(1),
});

export const orderDeadLettered = z.object({
  reason: z.string().min(1),
  payload: z.string().nullable(),
});

export type OrderConfirmed = z.infer<typeof orderConfirmed>;
export type OrderRejected = z.infer<typeof orderRejected>;
export type OrderDeadLettered = z.infer<typeof orderDeadLettered>;

export const confirmedEvent = (order: PlacedOrder): OrderConfirmed => ({
  orderId: order.id,
  totalCents: order.totalCents,
});

export const rejectedEvent = (order: PlacedOrder, reason: string): OrderRejected => ({
  orderId: order.id,
  reason,
});

export const deadLetterEvent = (reason: string, raw: string | undefined): OrderDeadLettered => ({
  reason,
  payload: raw ?? null,
});
