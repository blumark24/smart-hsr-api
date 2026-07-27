-- ============================================================
-- 032 — COMPOSITE TENANT INDEXES (DB-FOUNDATION-3)
-- Performance hardening for 1000+ organizations. Indexes only.
-- No RLS, data, Auth, or UI changes.
--
-- LIMITATION: Supabase migrations run in a transaction; CREATE INDEX
-- CONCURRENTLY cannot be used here. Indexes are created with
-- CREATE INDEX IF NOT EXISTS (brief write lock per index on apply).
-- For zero-downtime on very large tables, run equivalent CONCURRENTLY
-- statements manually outside the migration runner.
-- ============================================================

-- ── Helper: create index when table + all columns exist ─────────────────────
CREATE OR REPLACE FUNCTION pg_temp.dbf3_create_composite_index(
  p_index_name text,
  p_table_name text,
  p_index_def text,
  p_required_cols text[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  c text;
BEGIN
  IF to_regclass('public.' || p_table_name) IS NULL THEN
    RAISE NOTICE '032: skip % — table % missing', p_index_name, p_table_name;
    RETURN;
  END IF;

  FOREACH c IN ARRAY p_required_cols LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = p_table_name
        AND column_name = c
    ) THEN
      RAISE NOTICE '032: skip % — column %.%.% missing', p_index_name, p_table_name, c;
      RETURN;
    END IF;
  END LOOP;

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON public.%I %s',
    p_index_name,
    p_table_name,
    p_index_def
  );
  RAISE NOTICE '032: ensured index % on %', p_index_name, p_table_name;
END;
$$;

-- ── 1. tasks — dashboard lists, assignee boards, CRM-linked work ───────────
SELECT pg_temp.dbf3_create_composite_index(
  'idx_tasks_org_status',
  'tasks',
  '(organization_id, status)',
  ARRAY['organization_id', 'status']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_tasks_org_created_at',
  'tasks',
  '(organization_id, created_at DESC)',
  ARRAY['organization_id', 'created_at']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_tasks_org_assignee_id',
  'tasks',
  '(organization_id, assignee_id)',
  ARRAY['organization_id', 'assignee_id']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_tasks_org_client_id',
  'tasks',
  '(organization_id, client_id)',
  ARRAY['organization_id', 'client_id']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_tasks_org_due_date',
  'tasks',
  '(organization_id, due_date)',
  ARRAY['organization_id', 'due_date']
);

-- ── 2. clients — CRM pipelines and recent accounts ───────────────────────────
SELECT pg_temp.dbf3_create_composite_index(
  'idx_clients_org_status',
  'clients',
  '(organization_id, status)',
  ARRAY['organization_id', 'status']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_clients_org_created_at',
  'clients',
  '(organization_id, created_at DESC)',
  ARRAY['organization_id', 'created_at']
);

-- ── 3. transactions — finance timeline and filters ─────────────────────────
SELECT pg_temp.dbf3_create_composite_index(
  'idx_transactions_org_created_at',
  'transactions',
  '(organization_id, created_at DESC)',
  ARRAY['organization_id', 'created_at']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_transactions_org_type',
  'transactions',
  '(organization_id, type)',
  ARRAY['organization_id', 'type']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_transactions_org_category',
  'transactions',
  '(organization_id, category)',
  ARRAY['organization_id', 'category']
);

-- ── 4. projects — portfolio status and client rollups ───────────────────────
SELECT pg_temp.dbf3_create_composite_index(
  'idx_projects_org_status',
  'projects',
  '(organization_id, status)',
  ARRAY['organization_id', 'status']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_projects_org_created_at',
  'projects',
  '(organization_id, created_at DESC)',
  ARRAY['organization_id', 'created_at']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_projects_org_client_id',
  'projects',
  '(organization_id, client_id)',
  ARRAY['organization_id', 'client_id']
);

-- ── 5. departments — org chart hierarchy (structure_level: see duplicate note)
SELECT pg_temp.dbf3_create_composite_index(
  'idx_departments_org_parent_id',
  'departments',
  '(organization_id, parent_id)',
  ARRAY['organization_id', 'parent_id']
);
-- idx_departments_structure_level (026) already covers (organization_id, structure_level)

-- ── 6. teams — departments → teams navigation ───────────────────────────────
SELECT pg_temp.dbf3_create_composite_index(
  'idx_teams_org_department_id',
  'teams',
  '(organization_id, department_id)',
  ARRAY['organization_id', 'department_id']
);

-- ── 7. employee_relations — placement and reporting lookups ─────────────────
SELECT pg_temp.dbf3_create_composite_index(
  'idx_employee_relations_org_manager_id',
  'employee_relations',
  '(organization_id, manager_id)',
  ARRAY['organization_id', 'manager_id']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_employee_relations_org_department_id',
  'employee_relations',
  '(organization_id, department_id)',
  ARRAY['organization_id', 'department_id']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_employee_relations_org_team_id',
  'employee_relations',
  '(organization_id, team_id)',
  ARRAY['organization_id', 'team_id']
);

-- ── 8. employees — roster filters (optional columns) ────────────────────────
SELECT pg_temp.dbf3_create_composite_index(
  'idx_employees_org_status',
  'employees',
  '(organization_id, status)',
  ARRAY['organization_id', 'status']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_employees_org_department_id',
  'employees',
  '(organization_id, department_id)',
  ARRAY['organization_id', 'department_id']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_employees_org_team_id',
  'employees',
  '(organization_id, team_id)',
  ARRAY['organization_id', 'team_id']
);

-- ── 9. profiles — tenant user admin and active-user lists ───────────────────
SELECT pg_temp.dbf3_create_composite_index(
  'idx_profiles_org_role',
  'profiles',
  '(organization_id, role)',
  ARRAY['organization_id', 'role']
);
SELECT pg_temp.dbf3_create_composite_index(
  'idx_profiles_org_is_active',
  'profiles',
  '(organization_id, is_active)',
  ARRAY['organization_id', 'is_active']
);

-- ============================================================
-- DUPLICATE / EQUIVALENT INDEX NOTES (not recreated)
-- ------------------------------------------------------------
-- idx_<table>_organization_id (011) — single-column org; composites are additive
-- idx_departments_structure_level (026) — same as (organization_id, structure_level)
-- idx_departments_org / idx_teams_org / idx_employee_relations_org (019) — org only
-- idx_tasks_client_id, idx_projects_client_id (001) — client only, not org-prefixed
-- idx_teams_dept (019) — department_id only; idx_teams_org_department_id is composite
-- idx_departments_parent (019) — parent_id only; idx_departments_org_parent_id is composite
-- employee_relations UNIQUE (organization_id, employee_id) — different purpose
-- ============================================================

-- ============================================================
-- POST-MIGRATION INSPECTION (read-only)
-- ------------------------------------------------------------
-- SELECT tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%org%'
-- ORDER BY tablename, indexname;
-- ============================================================

-- ============================================================
-- ROLLBACK (manual — drops only indexes added by 032)
-- ------------------------------------------------------------
-- DROP INDEX IF EXISTS public.idx_tasks_org_status;
-- DROP INDEX IF EXISTS public.idx_tasks_org_created_at;
-- DROP INDEX IF EXISTS public.idx_tasks_org_assignee_id;
-- DROP INDEX IF EXISTS public.idx_tasks_org_client_id;
-- DROP INDEX IF EXISTS public.idx_tasks_org_due_date;
-- DROP INDEX IF EXISTS public.idx_clients_org_status;
-- DROP INDEX IF EXISTS public.idx_clients_org_created_at;
-- DROP INDEX IF EXISTS public.idx_transactions_org_created_at;
-- DROP INDEX IF EXISTS public.idx_transactions_org_type;
-- DROP INDEX IF EXISTS public.idx_transactions_org_category;
-- DROP INDEX IF EXISTS public.idx_projects_org_status;
-- DROP INDEX IF EXISTS public.idx_projects_org_created_at;
-- DROP INDEX IF EXISTS public.idx_projects_org_client_id;
-- DROP INDEX IF EXISTS public.idx_departments_org_parent_id;
-- DROP INDEX IF EXISTS public.idx_teams_org_department_id;
-- DROP INDEX IF EXISTS public.idx_employee_relations_org_manager_id;
-- DROP INDEX IF EXISTS public.idx_employee_relations_org_department_id;
-- DROP INDEX IF EXISTS public.idx_employee_relations_org_team_id;
-- DROP INDEX IF EXISTS public.idx_employees_org_status;
-- DROP INDEX IF EXISTS public.idx_employees_org_department_id;
-- DROP INDEX IF EXISTS public.idx_employees_org_team_id;
-- DROP INDEX IF EXISTS public.idx_profiles_org_role;
-- DROP INDEX IF EXISTS public.idx_profiles_org_is_active;
-- ============================================================
