// /api/owner/reset-demo-data
// Owner-only demo cleanup. Uses SUPABASE_SERVICE_ROLE_KEY only on the server.
// It never deletes auth.users, profiles, organizations, subscriptions, or
// tenant_workspace_settings; those identity/billing/settings records are the
// stable shell a demo reset must preserve.

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createServiceRoleAdmin,
  verifyOwnerBearer,
  writeOwnerAuditLog,
} from "@/lib/api/ownerServerCommon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRESERVED_TABLES = [
  "auth.users",
  "profiles",
  "organizations",
  "subscriptions",
  "tenant_workspace_settings",
] as const;

const RESET_TABLES = [
  "notifications",
  "activities",
  "automations",
  "executive_office_room_mappings",
  "employee_relations",
  "tasks",
  "transactions",
  "projects",
  "invoices",
  "clients",
  "teams",
  "positions",
  "departments",
] as const;

function isMissingOptionalTable(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not find the table") ||
    m.includes("could not find") ||
    m.includes("schema cache")
  );
}

async function deleteOrgRows(
  admin: SupabaseClient,
  table: string,
  organizationId: string,
): Promise<{ table: string; deleted: number | null; skipped?: boolean; error?: string }> {
  const { data, error } = await admin
    .from(table)
    .delete()
    .eq("organization_id", organizationId)
    .select("id");

  if (error) {
    if (isMissingOptionalTable(error.message)) {
      return { table, deleted: null, skipped: true };
    }
    return { table, deleted: null, error: error.message };
  }

  return { table, deleted: Array.isArray(data) ? data.length : null };
}

async function deleteEmployeesExceptManager(
  admin: SupabaseClient,
  organizationId: string,
  managerEmail: string | null,
): Promise<{ table: string; deleted: number | null; skipped?: boolean; error?: string }> {
  let query = admin
    .from("employees")
    .delete()
    .eq("organization_id", organizationId);

  if (managerEmail) {
    query = query.neq("email", managerEmail);
  }

  const { data, error } = await query.select("id");
  if (error) {
    if (isMissingOptionalTable(error.message)) {
      return { table: "employees", deleted: null, skipped: true };
    }
    return { table: "employees", deleted: null, error: error.message };
  }
  return { table: "employees", deleted: Array.isArray(data) ? data.length : null };
}

export async function POST(req: NextRequest) {
  try {
    const svc = createServiceRoleAdmin();
    if ("error" in svc) {
      return NextResponse.json({ success: false, error: svc.error }, { status: 500 });
    }
    const { admin } = svc;

    const ownerCheck = await verifyOwnerBearer(req, admin);
    if (!ownerCheck.ok) {
      return NextResponse.json(
        { success: false, error: ownerCheck.error },
        { status: ownerCheck.status },
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : "";
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "معرف المنشأة مطلوب" }, { status: 400 });
    }

    const orgResp = await admin
      .from("organizations")
      .select("id, name, owner_email, is_internal")
      .eq("id", organizationId)
      .maybeSingle();

    if (orgResp.error) {
      return NextResponse.json({ success: false, error: "تعذر قراءة بيانات المنشأة" }, { status: 500 });
    }
    if (!orgResp.data) {
      return NextResponse.json({ success: false, error: "المنشأة غير موجودة" }, { status: 404 });
    }
    if (orgResp.data.is_internal === true) {
      return NextResponse.json(
        { success: false, error: "إعادة ضبط بيانات العرض مخصصة لمنشآت العملاء فقط" },
        { status: 400 },
      );
    }

    const managerEmail = ((orgResp.data.owner_email as string | null) ?? "").trim().toLowerCase() || null;
    const results = [];

    for (const table of RESET_TABLES) {
      results.push(await deleteOrgRows(admin, table, organizationId));
    }
    results.push(await deleteEmployeesExceptManager(admin, organizationId, managerEmail));

    const failed = results.filter((r) => r.error);
    if (failed.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "تعذر إكمال إعادة الضبط لبعض الجداول",
          results,
          preserved: PRESERVED_TABLES,
        },
        { status: 500 },
      );
    }

    await writeOwnerAuditLog(admin, {
      owner_email: ownerCheck.callerEmail,
      action: "reset_demo_data",
      target_type: "organization",
      target_id: organizationId,
      metadata: {
        organization_name: orgResp.data.name,
        preserved: PRESERVED_TABLES,
        manager_email: managerEmail,
        results,
      },
    });

    return NextResponse.json({
      success: true,
      results,
      preserved: PRESERVED_TABLES,
      managerEmail,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[RESET_DEMO_DATA_FATAL]", error);
    return NextResponse.json(
      { success: false, error: msg || "تعذر إعادة ضبط بيانات العرض" },
      { status: 500 },
    );
  }
}
