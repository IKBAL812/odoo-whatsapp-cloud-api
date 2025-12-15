import { NextRequest, NextResponse } from "next/server";
import { OdooClient } from "@/app/lib/odoo/jsonrpc";

const REQUIRED_ENV_VARS = [
  "ODOO_JSONRPC_HOST",
  "ODOO_JSONRPC_DATABASE",
] as const;

const ensureEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

const THREAD_FIELDS = [
  "name",
  "last_message_date",
  "last_message_preview",
  "phone_number",
  "backend_id",
  "write_date",
  "unread_count",
  "partner_id",
  "has_avatar",
];

type ThreadRecord = {
  id: number;
  name: string;
  last_message_date: string | null;
  last_message_preview: string | null;
  phone_number: string | null;
  backend_id: number | [number, string] | null;
  write_date: string;
  unread_count: number;
  partner_id: number | [number, string] | null;
  has_avatar: boolean;
};

export async function GET(request: NextRequest) {
  try {
    ensureEnv();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Server configuration error",
      },
      { status: 500 }
    );
  }

  const sessionId = request.headers.get("x-session-id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing Odoo session id" },
      { status: 401 }
    );
  }

  // Optional: include a specific thread ID (for deep linking from Odoo)
  const includeThreadIdParam =
    request.nextUrl.searchParams.get("includeThreadId");
  const includeThreadId = includeThreadIdParam
    ? parseInt(includeThreadIdParam, 10)
    : null;

  const protocolEnv: "http" | "https" =
    process.env.ODOO_JSONRPC_PROTOCOL === "https" ? "https" : "http";
  const portEnv = process.env.ODOO_JSONRPC_PORT;
  const port = portEnv ? Number(portEnv) : undefined;

  if (typeof port !== "undefined" && Number.isNaN(port)) {
    return NextResponse.json(
      { error: "ODOO_JSONRPC_PORT must be a valid number" },
      { status: 500 }
    );
  }

  const odooClient = new OdooClient({
    host: process.env.ODOO_JSONRPC_HOST as string,
    port,
    protocol: protocolEnv,
  });

  const sessionClient = odooClient.createSession(sessionId);

  try {
    // Fetch recent threads
    const threads = await sessionClient.searchRead<ThreadRecord[]>(
      "whatsapp.thread",
      [],
      {
        limit: 30,
        select: THREAD_FIELDS,
        order: "write_date desc",
      }
    );

    // If a specific thread ID is requested and not in the results, fetch it separately
    if (
      includeThreadId &&
      !isNaN(includeThreadId) &&
      !threads.some((t) => t.id === includeThreadId)
    ) {
      const specificThread = await sessionClient.searchRead<ThreadRecord[]>(
        "whatsapp.thread",
        [["id", "=", includeThreadId]],
        {
          limit: 1,
          select: THREAD_FIELDS,
        }
      );

      if (specificThread && specificThread.length > 0) {
        // Add the specific thread at the beginning of the list
        threads.unshift(specificThread[0]);
      }
    }

    return NextResponse.json({ threads });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || "Failed to fetch threads from Odoo" },
      { status: 500 }
    );
  }
}
