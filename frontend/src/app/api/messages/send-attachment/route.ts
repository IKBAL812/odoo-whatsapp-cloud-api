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

export async function POST(request: NextRequest) {
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { threadId, phoneNumber, backendId, attachmentId, caption, method } = payload as {
    threadId?: number | string;
    phoneNumber?: string;
    backendId?: number;
    attachmentId?: number;
    caption?: string;
    method?: string;
  };

  const parsedThreadId =
    typeof threadId === "string" ? Number(threadId) : threadId;
  if (typeof parsedThreadId !== "number" || Number.isNaN(parsedThreadId)) {
    return NextResponse.json(
      { error: "threadId must be a valid number" },
      { status: 400 }
    );
  }

  if (!phoneNumber || typeof phoneNumber !== "string") {
    return NextResponse.json(
      { error: "phoneNumber is required" },
      { status: 400 }
    );
  }

  if (typeof attachmentId !== "number") {
    return NextResponse.json(
      { error: "attachmentId is required and must be a number" },
      { status: 400 }
    );
  }

  const resolvedBackendId =
    typeof backendId === "number"
      ? backendId
      : process.env.ODOO_WHATSAPP_BACKEND_ID
        ? Number(process.env.ODOO_WHATSAPP_BACKEND_ID)
        : undefined;

  if (
    typeof resolvedBackendId !== "number" ||
    Number.isNaN(resolvedBackendId) ||
    resolvedBackendId <= 0
  ) {
    return NextResponse.json(
      { error: "A valid backend id is required to send attachments" },
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
    // Call the appropriate send method based on file type
    const sendMethod = method || "send_image_message";

    // Build kwargs
    const kwargs: { attachment: number; caption?: string } = {
      attachment: attachmentId,
    };

    if (caption) {
      kwargs.caption = caption;
    }

    const result = await sessionClient.call(
      "whatsapp.backend",
      sendMethod,
      [resolvedBackendId, phoneNumber],
      kwargs,
      false
    );

    return NextResponse.json({
      result,
      threadId: parsedThreadId,
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || "Failed to send attachment via Odoo" },
      { status: 500 }
    );
  }
}
