type ServiceRpcName =
  | "mydesk_mark_overdue_tasks"
  | "upsert_rate_limit"
  | "increment_rate_limit_blocked";

type ServiceTableName =
  | "automations"
  | "tasks"
  | "employees"
  | "clients"
  | "automation_logs";

type ServiceTableMethod = "GET" | "HEAD" | "PATCH" | "POST";
type ServiceTableParam = string | number | boolean | null | undefined;

export interface ServiceRpcError {
  status?: number;
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}

interface ServiceRpcResult<T> {
  data: T | null;
  error: ServiceRpcError | null;
  count?: number | null;
}

const ALLOWED_SERVICE_RPCS = new Set<ServiceRpcName>([
  "mydesk_mark_overdue_tasks",
  "upsert_rate_limit",
  "increment_rate_limit_blocked",
]);

const ALLOWED_SERVICE_TABLES = new Set<ServiceTableName>([
  "automations",
  "tasks",
  "employees",
  "clients",
  "automation_logs",
]);

function stringField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function responseStatusLabel(response: Response, operation: string): string {
  const statusText = response.statusText.trim();
  return statusText || `${operation} HTTP ${response.status}`;
}

/**
 * Server-only RPC transport for the new Supabase secret key contract.
 * The key is sent as `apikey` only; no Authorization header is synthesized.
 */
export async function callServerServiceRpc<T>(
  name: ServiceRpcName,
  args: Record<string, unknown>,
): Promise<ServiceRpcResult<T>> {
  if (!ALLOWED_SERVICE_RPCS.has(name)) {
    return { data: null, error: { message: "SERVICE_RPC_NOT_ALLOWED" } };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) {
    return { data: null, error: { message: "SERVICE_RPC_ENV_MISSING" } };
  }

  let response: Response;
  try {
    response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : "SERVICE_RPC_NETWORK_ERROR" },
    };
  }

  const rawBody = await response.text();
  let payload: unknown = null;
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const record = payload && typeof payload === "object"
      ? payload as Record<string, unknown>
      : {};
    return {
      data: null,
      error: {
        status: response.status,
        code: stringField(record.code),
        message: stringField(record.message)?.trim() || responseStatusLabel(response, "RPC request failed"),
        details: stringField(record.details),
        hint: stringField(record.hint),
      },
    };
  }

  return { data: payload as T, error: null };
}

/**
 * Restricted server-only table transport for the scheduled automation route.
 * It keeps the new secret in `apikey` and allowlists the tables needed by the
 * existing cron rules instead of constructing a Supabase SDK client with the
 * secret key.
 */
export async function callServerServiceTable<T>(
  table: ServiceTableName,
  options: {
    method?: ServiceTableMethod;
    params?: Record<string, ServiceTableParam | ServiceTableParam[]>;
    body?: unknown;
    prefer?: string;
  } = {},
): Promise<ServiceRpcResult<T>> {
  if (!ALLOWED_SERVICE_TABLES.has(table)) {
    return { data: null, error: { message: "SERVICE_TABLE_NOT_ALLOWED" } };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) {
    return { data: null, error: { message: "SERVICE_RPC_ENV_MISSING" } };
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(options.params ?? {})) {
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (item === null || item === undefined) continue;
      searchParams.append(key, typeof item === "string" ? item : item.toString());
    }
  }
  const query = searchParams.toString();
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${table}${query ? `?${query}` : ""}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: options.method ?? "GET",
      headers: {
        apikey: serviceKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.prefer ? { Prefer: options.prefer } : {}),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      cache: "no-store",
    });
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : "SERVICE_TABLE_NETWORK_ERROR" },
    };
  }

  const rawBody = options.method === "HEAD" ? "" : await response.text();
  let payload: unknown = null;
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      payload = null;
    }
  }

  const contentRange = response.headers.get("content-range");
  const countMatch = contentRange?.match(/\/(\d+)$/);
  const count = countMatch ? Number(countMatch[1]) : null;

  if (!response.ok) {
    const record = payload && typeof payload === "object"
      ? payload as Record<string, unknown>
      : {};
    return {
      data: null,
      count,
      error: {
        status: response.status,
        code: stringField(record.code),
        message: stringField(record.message)?.trim() || responseStatusLabel(response, "Table request failed"),
        details: stringField(record.details),
        hint: stringField(record.hint),
      },
    };
  }

  return { data: payload as T, count, error: null };
}
