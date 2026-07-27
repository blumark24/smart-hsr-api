-- ============================================================
-- 031 — HOTFIX-DB-1: organization_manager workspace write access
-- Restores INSERT/UPDATE on clients, tasks, transactions for
-- organization_manager within their own organization only.
--
-- WHY
--   Production applied tenant isolation (012) but not the 015
--   write-policy refresh. organization_manager can read org data
--   but RLS blocks INSERT/UPDATE on CRM/finance tables.
--
-- SCOPE (this migration only)
--   • public.clients   — org insert / org update
--   • public.tasks     — org insert / org update
--   • public.transactions — org insert / org update
--
-- NOT TOUCHED
--   • SELECT policies (isolation unchanged)
--   • DELETE policies (unchanged)
--   • employees, departments, owner tables, auth, UI
--
-- Idempotent: DROP IF EXISTS + CREATE for named policies only.
-- ============================================================

DO $$
BEGIN
  IF to_regprocedure('public.current_org_id()') IS NULL THEN
    RAISE EXCEPTION '031 requires public.current_org_id() — apply migration 011 first';
  END IF;
  IF to_regprocedure('public.get_my_role()') IS NULL THEN
    RAISE EXCEPTION '031 requires public.get_my_role() — apply migration 008 first';
  END IF;
  IF to_regprocedure('public.is_owner()') IS NULL THEN
    RAISE EXCEPTION '031 requires public.is_owner() — apply migration 009 first';
  END IF;
END $$;

-- ---- CLIENTS: org insert / org update ------------------------------------
DO $$ BEGIN
  IF to_regclass('public.clients') IS NULL THEN
    RAISE NOTICE '031: public.clients not found — skipped';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'organization_id'
  ) THEN
    RAISE NOTICE '031: clients.organization_id missing — skipped';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "clients: org insert" ON public.clients;
  DROP POLICY IF EXISTS "clients: org update" ON public.clients;

  CREATE POLICY "clients: org insert" ON public.clients FOR INSERT
    WITH CHECK (
      public.is_owner()
      OR public.get_my_role() = 'super_admin'
      OR (
        organization_id = public.current_org_id()
        AND public.get_my_role() IN ('board_member', 'attack_manager', 'organization_manager')
      )
    );

  CREATE POLICY "clients: org update" ON public.clients FOR UPDATE
    USING (
      public.is_owner()
      OR public.get_my_role() = 'super_admin'
      OR (
        organization_id = public.current_org_id()
        AND public.get_my_role() IN ('board_member', 'attack_manager', 'organization_manager')
      )
    )
    WITH CHECK (
      public.is_owner()
      OR public.get_my_role() = 'super_admin'
      OR (
        organization_id = public.current_org_id()
        AND public.get_my_role() IN ('board_member', 'attack_manager', 'organization_manager')
      )
    );
END $$;

-- ---- TASKS: org insert / org update (employee own-task unchanged) --------
DO $$ BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE NOTICE '031: public.tasks not found — skipped';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'organization_id'
  ) THEN
    RAISE NOTICE '031: tasks.organization_id missing — skipped';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "tasks: org insert" ON public.tasks;
  DROP POLICY IF EXISTS "tasks: org update" ON public.tasks;

  CREATE POLICY "tasks: org insert" ON public.tasks FOR INSERT
    WITH CHECK (
      public.is_owner()
      OR public.get_my_role() = 'super_admin'
      OR (
        organization_id = public.current_org_id()
        AND (
          public.get_my_role() IN (
            'board_member', 'defense_manager', 'attack_manager',
            'finance_manager', 'organization_manager'
          )
          OR (public.get_my_role() = 'employee' AND assignee_id = auth.uid()::text)
        )
      )
    );

  CREATE POLICY "tasks: org update" ON public.tasks FOR UPDATE
    USING (
      public.is_owner()
      OR public.get_my_role() = 'super_admin'
      OR (
        organization_id = public.current_org_id()
        AND (
          public.get_my_role() IN (
            'board_member', 'defense_manager', 'attack_manager',
            'finance_manager', 'organization_manager'
          )
          OR (public.get_my_role() = 'employee' AND assignee_id = auth.uid()::text)
        )
      )
    )
    WITH CHECK (
      public.is_owner()
      OR public.get_my_role() = 'super_admin'
      OR (
        organization_id = public.current_org_id()
        AND (
          public.get_my_role() IN (
            'board_member', 'defense_manager', 'attack_manager',
            'finance_manager', 'organization_manager'
          )
          OR (public.get_my_role() = 'employee' AND assignee_id = auth.uid()::text)
        )
      )
    );
END $$;

-- ---- TRANSACTIONS: org insert / org update (finance_manager unchanged) ----
DO $$ BEGIN
  IF to_regclass('public.transactions') IS NULL THEN
    RAISE NOTICE '031: public.transactions not found — skipped';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'organization_id'
  ) THEN
    RAISE NOTICE '031: transactions.organization_id missing — skipped';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "transactions: org insert" ON public.transactions;
  DROP POLICY IF EXISTS "transactions: org update" ON public.transactions;

  CREATE POLICY "transactions: org insert" ON public.transactions FOR INSERT
    WITH CHECK (
      public.is_owner()
      OR public.get_my_role() = 'super_admin'
      OR (
        organization_id = public.current_org_id()
        AND public.get_my_role() IN (
          'board_member', 'finance_manager', 'organization_manager'
        )
      )
    );

  CREATE POLICY "transactions: org update" ON public.transactions FOR UPDATE
    USING (
      public.is_owner()
      OR public.get_my_role() = 'super_admin'
      OR (
        organization_id = public.current_org_id()
        AND public.get_my_role() IN (
          'board_member', 'finance_manager', 'organization_manager'
        )
      )
    )
    WITH CHECK (
      public.is_owner()
      OR public.get_my_role() = 'super_admin'
      OR (
        organization_id = public.current_org_id()
        AND public.get_my_role() IN (
          'board_member', 'finance_manager', 'organization_manager'
        )
      )
    );
END $$;

-- ============================================================
-- VALIDATION (run after apply)
-- ------------------------------------------------------------
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('clients', 'tasks', 'transactions')
--   AND cmd IN ('INSERT', 'UPDATE')
-- ORDER BY tablename, policyname;
--
-- Expect 'organization_manager' in with_check / qual for all six policies.
-- ============================================================
-- ROLLBACK (manual — restores pre-031 / migration-012 write gates)
-- ------------------------------------------------------------
-- DROP POLICY IF EXISTS "clients: org insert" ON public.clients;
-- DROP POLICY IF EXISTS "clients: org update" ON public.clients;
-- CREATE POLICY "clients: org insert" ON public.clients FOR INSERT
--   WITH CHECK (
--     public.is_owner() OR public.get_my_role() = 'super_admin'
--     OR (organization_id = public.current_org_id()
--         AND public.get_my_role() IN ('board_member', 'attack_manager'))
--   );
-- CREATE POLICY "clients: org update" ON public.clients FOR UPDATE
--   USING (
--     public.is_owner() OR public.get_my_role() = 'super_admin'
--     OR (organization_id = public.current_org_id()
--         AND public.get_my_role() IN ('board_member', 'attack_manager'))
--   )
--   WITH CHECK (
--     public.is_owner() OR public.get_my_role() = 'super_admin'
--     OR (organization_id = public.current_org_id()
--         AND public.get_my_role() IN ('board_member', 'attack_manager'))
--   );
--
-- DROP POLICY IF EXISTS "tasks: org insert" ON public.tasks;
-- DROP POLICY IF EXISTS "tasks: org update" ON public.tasks;
-- CREATE POLICY "tasks: org insert" ON public.tasks FOR INSERT
--   WITH CHECK (
--     public.is_owner() OR public.get_my_role() = 'super_admin'
--     OR (organization_id = public.current_org_id()
--         AND (public.get_my_role() IN ('board_member','defense_manager','attack_manager','finance_manager')
--              OR (public.get_my_role() = 'employee' AND assignee_id = auth.uid()::text)))
--   );
-- CREATE POLICY "tasks: org update" ON public.tasks FOR UPDATE
--   USING (
--     public.is_owner() OR public.get_my_role() = 'super_admin'
--     OR (organization_id = public.current_org_id()
--         AND (public.get_my_role() IN ('board_member','defense_manager','attack_manager','finance_manager')
--              OR (public.get_my_role() = 'employee' AND assignee_id = auth.uid()::text)))
--   )
--   WITH CHECK (
--     public.is_owner() OR public.get_my_role() = 'super_admin'
--     OR (organization_id = public.current_org_id()
--         AND (public.get_my_role() IN ('board_member','defense_manager','attack_manager','finance_manager')
--              OR (public.get_my_role() = 'employee' AND assignee_id = auth.uid()::text)))
--   );
--
-- DROP POLICY IF EXISTS "transactions: org insert" ON public.transactions;
-- DROP POLICY IF EXISTS "transactions: org update" ON public.transactions;
-- CREATE POLICY "transactions: org insert" ON public.transactions FOR INSERT
--   WITH CHECK (
--     public.is_owner() OR public.get_my_role() = 'super_admin'
--     OR (organization_id = public.current_org_id()
--         AND public.get_my_role() IN ('board_member', 'finance_manager'))
--   );
-- CREATE POLICY "transactions: org update" ON public.transactions FOR UPDATE
--   USING (
--     public.is_owner() OR public.get_my_role() = 'super_admin'
--     OR (organization_id = public.current_org_id()
--         AND public.get_my_role() IN ('board_member', 'finance_manager'))
--   )
--   WITH CHECK (
--     public.is_owner() OR public.get_my_role() = 'super_admin'
--     OR (organization_id = public.current_org_id()
--         AND public.get_my_role() IN ('board_member', 'finance_manager'))
--   );
-- ============================================================
