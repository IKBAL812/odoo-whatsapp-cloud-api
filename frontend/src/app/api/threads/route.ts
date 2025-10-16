import { NextRequest, NextResponse } from "next/server";
import { OdooClient } from "@/app/lib/odoo/jsonrpc";

const REQUIRED_ENV_VARS = ["ODOO_JSONRPC_HOST", "ODOO_JSONRPC_DATABASE"] as const;

const ensureEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
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
    const threads = await sessionClient.searchRead(
      "whatsapp.thread",
      [],
      {
        limit: 30,
        select: [
          "name",
          "last_message_date",
          "last_message_preview",
          "phone_number",
          "backend_id",
          "write_date",
          "unread_count",  // NEW: Request unread count from backend
          "partner_id",    // Partner ID for opening in Odoo
        ],
        order: "write_date desc"
      }
    );

    return NextResponse.json({ threads });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || "Failed to fetch threads from Odoo" },
      { status: 500 }
    );
  }
}
