-- Who each processor customer is (server/billing_api.py). Stripe's subscription
-- events (cancelled, trial ending) carry only a customer id, so the checkout
-- that created the customer records it here: their email, which plan they
-- bought, and their seat once there is one. A Residency payment has no seat
-- until Aden enrolls it, so slug may stay empty. Additive; safe to re-run.

CREATE TABLE IF NOT EXISTS billing_customers (
  customer TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'complete',
  slug TEXT NOT NULL DEFAULT '',
  trial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_customers_email ON billing_customers (lower(email));
