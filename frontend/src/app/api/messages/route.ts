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

type OdooMessageRecord = {
  id: number;
  create_date: string;
  body: string | null;
  status: string | null;
  direction: "incoming" | "outgoing" | string;
  attachment_id: false | [number, string] | null;
  message_id?: string | null;
  replied_message_id?: false | [number, string] | null;
  timestamp: number;
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

  const threadIdParam = request.nextUrl.searchParams.get("threadId");
  if (!threadIdParam) {
    return NextResponse.json(
      { error: "threadId query parameter is required" },
      { status: 400 }
    );
  }

  const threadId = Number(threadIdParam);
  if (Number.isNaN(threadId) || threadId <= 0) {
    return NextResponse.json(
      { error: "threadId must be a valid positive number" },
      { status: 400 }
    );
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 30;
  if (Number.isNaN(limit) || limit <= 0) {
    return NextResponse.json(
      { error: "limit must be a valid positive number" },
      { status: 400 }
    );
  }

  const lastIdParam = request.nextUrl.searchParams.get("lastId");
  const lastId =
    lastIdParam && lastIdParam.length > 0 ? Number(lastIdParam) : undefined;

  if (typeof lastId !== "undefined" && Number.isNaN(lastId)) {
    return NextResponse.json(
      { error: "lastId must be a valid number" },
      { status: 400 }
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
    const domain: Array<[string, string, string | number]> = [
      ["thread_id", "=", threadId],
    ];

    if (typeof lastId === "number") {
      domain.push(["id", ">", lastId]);
    }

    const messages = await sessionClient.searchRead<OdooMessageRecord[]>(
      "whatsapp.message",
      domain,
      {
        limit,
        select: [
          "create_date",
          "body",
          "status",
          "direction",
          "attachment_id",
          "create_uid",
          "message_id",
          "replied_message_id",
          "write_date",
          "timestamp",
        ],
      }
    );

    return NextResponse.json({ threadId, messages });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || "Failed to fetch messages from Odoo" },
      { status: 500 }
    );
  }
}

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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { threadId, phoneNumber, message, backendId, replyToMessageId } =
    payload as {
      threadId?: number | string;
      phoneNumber?: string;
      message?: string;
      backendId?: number;
      replyToMessageId?: string;
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

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const trimmedMessage = message.trim();

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
      { error: "A valid backend id is required to send messages" },
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
    const result = await (replyToMessageId
      ? sessionClient.call(
          "whatsapp.backend",
          "send_reply_message",
          [resolvedBackendId, phoneNumber, trimmedMessage, replyToMessageId],
          {},
          false
        )
      : sessionClient.call(
          "whatsapp.backend",
          "send_text_message",
          [resolvedBackendId, phoneNumber, trimmedMessage],
          {},
          false
        ));

    return NextResponse.json({
      result,
      threadId: parsedThreadId,
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || "Failed to send message via Odoo" },
      { status: 500 }
    );
  }
}
