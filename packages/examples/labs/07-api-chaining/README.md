# Lab 07: the booking that was there yesterday

**Guide:** [API testing](../../../../docs/learning/04-api-testing.md), "A test owns its data".

## Symptom

`exercise.spec.ts` creates a booking on Restful-Booker, then reads it back to check the guest's name.
It reads booking `1`: the id the author's booking got on the day the test was written. Now it reads
somebody else's booking, or nothing at all, and fails.

## Your task

Read back the booking this test created, every time.

```bash
pnpm lab 07
```

## Hints

1. Look at the body the `POST /booking` call returns. What else is in it besides the booking?
2. Restful-Booker is public: other people create and delete bookings all day, and the site resets to
   ten records every ten minutes.

## What you should come away with

Each call in a chain takes what it needs from the call before (request chaining), and each test creates
the data it reads. Never assume an id, a row or a record exists because it did once. The framework's
`booking-crud.spec.ts` chains create, read, update, patch and delete on one booking this way.
