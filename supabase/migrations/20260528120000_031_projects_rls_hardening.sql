-- ============================================================
-- 031 — PROJECTS RLS HARDENING (DB-FOUNDATION-2)
-- Restores org-scoped policies on public.projects when RLS is enabled
-- but policies were dropped (e.g. migration 030 without 015 policies).
-- Idempotent. SELECT-only verification SQL at bottom (comments).
-- Does NOT touch data, Auth, org_units, or indexes.
-- ============================================================

DO $$
BEGIN
  IF to_regprocedure('public.current_org_id()') IS NULL THEN
    RAISE EXCEPTION '031 requires public.current_org_id() — apply migration 011 first';
  END IF;
  IF to_regprocedure('public.is_owner()') IS NULL THEN
    RAISE EXCEPTION '031 requires public.is_owner() — apply migration 009 first';
  END IF;
  IF to_regprocedure('public.get_my_role()') IS NULL THEN
    RAISE EXCEPTION '031 requires public.get_my_role() — apply migration 008 first';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.projects') IS NULL THEN
    RAISE NOTICE '031: public.projects not found — skipped';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'organization_id'
  ) THEN
    RAISE NOTICE '031: projects.organization_id missing — skipped (apply migration 011)';
    RETURN;
  END IF;

  ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "projects: org select" ON public.projects;
  DROP POLICY IF EXISTS "projects: org insert" ON public.projects;
  DROP POLICY IF EXISTS "projects: org update" ON public.projects;
  DROP POLICY IF EXISTS "projects: org delete" ON public.projects;

  -- Legacy permissive names (safe if already removed by 030)
  DROP POLICY IF EXISTS "projects: read" ON public.projects;
  DROP POLICY IF EXISTS "projects: write" ON public.projects;
  DROP POLICY IF EXISTS "projects: authenticated read" ON public.projects;

  CREATE POLICY "projects: org select"
    ON public.projects FOR SELECT
    USING (
      organization_id = public.current_org_id()
      OR public.is_owner()
      OR public.get_my_role() = 'super_admin'
    );

  CREATE POLICY "projects: org insert"
    ON public.projects FOR INSERT
    WITH CHECK (
      public.is_owner()
      OR public.get_my_role() = 'super_admin'
      OR (
        organization_id = public.current_org_id()
        AND public.get_my_role() IN (
          'board_member',
          'attack_manager',
          'defense_manager',
          'organization_manager'
        )
      )
    );

  CREATE POLICY "projects: org update"
    ON public.projects FOR UPDATE
    USING (
      public.is_owner()
      OR public.get_my_role() = 'super_admin'
      OR (
        organization_id = public.current_org_id()
        AND public.get_my_role() IN (
          'board_member',
          'attack_manager',
          'defense_manager',
          'organization_manager'
        )
      )
    )
    WITH CHECK (
      public.is_owner()
      OR public.get_my_role() = 'super_admin'
      OR (
        organization_id = public.current_org_id()
        AND public.get_my_role() IN (
          'board_member',
          'attack_manager',
          'defense_manager',
          'organization_manager'
        )
      )
    );

  -- Tenant delete: same role gate as 015 (managers + organization_manager).
  CREATE POLICY "projects: org delete"
    ON public.projects FOR DELETE
    USING (
      public.is_owner()
      OR public.get_my_role() = 'super_admin'
      OR (
        organization_id = public.current_org_id()
        AND public.get_my_role() IN (
          'board_member',
          'attack_manager',
          'defense_manager',
          'organization_manager'
        )
      )
    );
END $$;

-- ============================================================
-- ROLLBACK (manual — run only if reverting DB-FOUNDATION-2)
-- ------------------------------------------------------------
-- DROP POLICY IF EXISTS "projects: org select"  ON public.projects;
-- DROP POLICY IF EXISTS "projects: org insert"  ON public.projects;
-- DROP POLICY IF EXISTS "projects: org update"  ON public.projects;
-- DROP POLICY IF EXISTS "projects: org delete"  ON public.projects;
-- ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
-- (Leaves RLS on with zero policies = deny-all until 031 re-applied or 015 re-run)
-- ============================================================

-- ============================================================
-- POST-MIGRATION INSPECTION (read-only — run in SQL Editor)
-- ------------------------------------------------------------
-- SELECT c.relname, c.relrowsecurity, COUNT(p.polname) AS policy_count
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- LEFT JOIN pg_policy p ON p.polrelid = c.oid
-- WHERE n.nspname = 'public' AND c.relname = 'projects'
-- GROUP BY c.relname, c.relrowsecurity;
--
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'projects'
-- ORDER BY policyname;
--
-- Expect: rls_enabled = true, policy_count = 4, no qual/with_check = 'true'
-- ============================================================
