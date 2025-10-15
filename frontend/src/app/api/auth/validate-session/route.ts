import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
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

  const { sessionId } = await request.json();

  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return NextResponse.json(
      { error: "Session ID is required" },
      { status: 400 }
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

  try {
    // Create a session client with the provided session ID
    const session = odooClient.createSession(sessionId.trim());

    // Validate the session by making a simple call to get session info
    const sessionInfo = await session.call<{
      uid?: number;
      username?: string;
      name?: string;
      user_context?: Record<string, unknown>;
      [key: string]: unknown;
    }>(
      "res.users",
      "get_session_info",
      [],
      {},
      false
    );

    if (!sessionInfo || !sessionInfo.uid) {
      return NextResponse.json(
        { error: "Invalid or expired session ID" },
        { status: 401 }
      );
    }

    // Try to initialize WhatsApp backend
    let backend = null;
    try {
      backend = await session.call(
        "whatsapp.backend",
        "initialize_web",
        [[]],
        {},
        false
      );
    } catch (initError) {
      // Failed to initialize WhatsApp backend - not critical
    }

    return NextResponse.json({
      user: sessionInfo,
      backend,
    });
  } catch (error) {
    const err = error as Error & {
      code?: number;
      data?: { name?: string; message?: string };
    };

    const status =
      err.data?.name === "odoo.exceptions.AccessDenied" ? 401 : 500;
    const message =
      err.message || err.data?.message || "Unable to validate session ID";

    return NextResponse.json({ error: message }, { status });
  }
}
