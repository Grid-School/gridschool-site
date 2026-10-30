-- Payment safety (server/billing.py, billing_api.py, gifts_api.py). Additive; safe to re-run.
--
-- Failed payments (invoice.payment_failed): the seat or gift is marked past due while Stripe's Smart Retries
--   keep trying. past_due_at is when the first try of the unpaid invoice failed, past_due_invoice which invoice
--   (so the payer is emailed once per invoice, not once per retry), past_due_attempts Stripe's attempt count.
--   A later invoice.paid clears all three. Access never changes here: when Stripe gives up and cancels, the
--   existing customer.subscription.deleted path pauses the seat.
ALTER TABLE billing_seats ADD COLUMN IF NOT EXISTS past_due_at TIMESTAMPTZ;
ALTER TABLE billing_seats ADD COLUMN IF NOT EXISTS past_due_invoice TEXT NOT NULL DEFAULT '';
ALTER TABLE billing_seats ADD COLUMN IF NOT EXISTS past_due_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS past_due_at TIMESTAMPTZ;
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS past_due_invoice TEXT NOT NULL DEFAULT '';
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS past_due_attempts INT NOT NULL DEFAULT 0;

-- A customer's subscription, from its checkout: what a repeat trial ends (STRIPE_RESTRICTED_KEY) or links to.
ALTER TABLE billing_customers ADD COLUMN IF NOT EXISTS subscription TEXT NOT NULL DEFAULT '';

-- Which charge was whose, so a dispute (which carries only its charge and payment intent) can name the buyer.
-- ref is a payment intent (pi_), charge (ch_) or invoice (in_) id, from the checkout or a paid invoice.
CREATE TABLE IF NOT EXISTS billing_payments (
  ref TEXT PRIMARY KEY,
  customer TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Disputes (charge.dispute.created / .closed): recorded and told to Aden at once. Nothing is paused: Aden decides.
CREATE TABLE IF NOT EXISTS billing_disputes (
  id TEXT PRIMARY KEY,
  charge TEXT NOT NULL DEFAULT '',
  payment_intent TEXT NOT NULL DEFAULT '',
  customer TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  amount INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  due_by TIMESTAMPTZ,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- Card fingerprints per customer (payment_method.attached): the same card behind a second free trial.
-- A fingerprint is Stripe's hash of the card number, the same across customers; never the number itself.
CREATE TABLE IF NOT EXISTS billing_fingerprints (
  fingerprint TEXT NOT NULL,
  customer TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  last4 TEXT NOT NULL DEFAULT '',
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (fingerprint, customer)
);
CREATE INDEX IF NOT EXISTS billing_fingerprints_customer ON billing_fingerprints (customer);

-- A trial flagged as a repeat, once: whichever of its checkout and its card arrives second raises it.
-- action: 'ended' (STRIPE_RESTRICTED_KEY ended the trial now), 'alerted' (Aden ends it in the Dashboard),
-- or 'end failed' (the key was set and Stripe said no; Aden ends it by hand).
CREATE TABLE IF NOT EXISTS billing_trial_flags (
  customer TEXT PRIMARY KEY,
  subscription TEXT NOT NULL DEFAULT '',
  earlier TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each Complete checkout's session (cs_...), so a buyer who typed the wrong email can fix it from begin/:
-- the session id in the after-payment link is the proof they paid. corrections counts fixes (a few at most).
CREATE TABLE IF NOT EXISTS billing_checkouts (
  session TEXT PRIMARY KEY,
  event_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  customer TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  amount INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  trial BOOLEAN NOT NULL DEFAULT false,
  checked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  corrections INT NOT NULL DEFAULT 0,
  corrected_at TIMESTAMPTZ
);
