# Billing Integration Design (Phase 5)

This document describes the intended Stripe integration path for Blumark24 OS. **No live Stripe keys or webhooks are wired in this phase.**

## Schema

Migration `030_billing_schema_design.sql` adds:

| Table | Purpose |
|-------|---------|
| `billing_invoices` | Platform invoices per organization (maps to Stripe Invoice IDs) |
| `billing_payments` | Payment records linked to invoices |

Existing tables remain the source of truth for **plan gating**:

- `plans`, `plan_limits`, `subscriptions`, `organizations`

## Recommended Stripe flow

1. **Checkout Session** (subscription mode) when owner activates a paid tenant — create Stripe Customer + Subscription, mirror rows in `subscriptions` + `billing_invoices`.
2. **Webhooks** (`invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`) update `billing_invoices.status` and `subscriptions.status`.
3. **Owner `/owner/billing`** reads `billing_invoices` joined to `organizations` (replace placeholder UI in a future phase).

## Security

- Webhook route must verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`.
- Use restricted API keys in server routes only; never expose secret key to the browser.
- Tenant users read only their org invoices via RLS (`organization_id = current_org_id()`).

## Settings integrations tab

Replace toast-only connect/disconnect with OAuth or API key forms **after** webhook infrastructure is deployed.

## Next steps (post Phase 0–4)

1. Apply migration `030` in Supabase.
2. Add `/api/stripe/webhook` route with signature verification.
3. Wire owner billing page to `billing_invoices` SELECT.
4. Optional: Stripe Customer Portal link for tenant self-service.
