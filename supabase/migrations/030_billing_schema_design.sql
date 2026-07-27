-- ============================================================
-- 030 — BILLING SCHEMA DESIGN (Stripe-ready, additive)
-- Tables for future payment provider integration. No Stripe keys here.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id   UUID        REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT        UNIQUE,
  amount            NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency          TEXT        NOT NULL DEFAULT 'SAR',
  status            TEXT        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','open','paid','void','uncollectible')),
  period_start      TIMESTAMPTZ,
  period_end        TIMESTAMPTZ,
  due_at            TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_org ON public.billing_invoices (organization_id);

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID        NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  stripe_payment_id   TEXT        UNIQUE,
  amount              NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency            TEXT        NOT NULL DEFAULT 'SAR',
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','succeeded','failed','refunded')),
  paid_at             TIMESTAMPTZ,
  metadata            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_invoices: owner all" ON public.billing_invoices;
CREATE POLICY "billing_invoices: owner all"
  ON public.billing_invoices FOR ALL
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "billing_payments: owner all" ON public.billing_payments;
CREATE POLICY "billing_payments: owner all"
  ON public.billing_payments FOR ALL
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "billing_invoices: tenant select own" ON public.billing_invoices;
CREATE POLICY "billing_invoices: tenant select own"
  ON public.billing_invoices FOR SELECT
  USING (organization_id = public.current_org_id());
