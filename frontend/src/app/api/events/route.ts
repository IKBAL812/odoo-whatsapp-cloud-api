import { NextRequest } from "next/server";
import { OdooClient } from "@/app/lib/odoo/jsonrpc";
import { eventBroadcaster } from "@/app/lib/events/broadcaster";

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

type SSEUpdate = {
  type: "threads" | "messages" | "heartbeat" | "sync_required";
  data?: {
    threads?: unknown[];
    messages?: unknown[];
    threadId?: string;
  };
  timestamp: number;
};

const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

// Simple rate limiting - in production use Redis or proper rate limiting
const activeConnections = new Map<string, number>();

export async function GET(request: NextRequest) {
  try {
    ensureEnv();
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Server configuration error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Get URL parameters
  const url = new URL(request.url);
  const sessionId =
    request.headers.get("x-session-id") || url.searchParams.get("sessionId");

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing Odoo session id" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const protocolEnv: "http" | "https" =
    process.env.ODOO_JSONRPC_PROTOCOL === "https" ? "https" : "http";
  const portEnv = process.env.ODOO_JSONRPC_PORT;
  const port = portEnv ? Number(portEnv) : undefined;

  if (typeof port !== "undefined" && Number.isNaN(port)) {
    return new Response(
      JSON.stringify({ error: "ODOO_JSONRPC_PORT must be a valid number" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const odooClient = new OdooClient({
    host: process.env.ODOO_JSONRPC_HOST as string,
    port,
    protocol: protocolEnv,
  });

  const sessionClient = odooClient.createSession(sessionId);
  const threadId = url.searchParams.get("threadId");

  // Fetch user's allowed backends for access control
  let allowedBackendIds: number[] = [];
  try {
    const sessionInfo = await sessionClient.call<{
      uid?: number;
    }>("ir.http", "session_info", [[]], {}, false);

    if (!sessionInfo || !sessionInfo.uid) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session ID" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Fetch backends where current user has access
    const backends = await sessionClient.searchRead(
      "whatsapp.backend",
      [["user_ids", "in", sessionInfo.uid]],
      {
        select: ["id"],
      }
    );

    if (!Array.isArray(backends) || backends.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No WhatsApp backends available for this user",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    allowedBackendIds = backends.map(
      (backend) => (backend as { id: number }).id
    );

    console.log(
      `[SSE] User has access to backends: [${allowedBackendIds.join(", ")}]`
    );
  } catch (error) {
    console.error(`[SSE] Failed to fetch user backends:`, error);
    return new Response(
      JSON.stringify({
        error: "Failed to verify backend access",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Simple connection limiting
  const connectionKey = `${sessionId}-${threadId || "global"}`;
  const currentConnections = activeConnections.get(connectionKey) || 0;

  if (currentConnections >= 3) {
    // Max 3 connections per session+thread
    return new Response(
      JSON.stringify({ error: "Too many active connections for this session" }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Track connection
  activeConnections.set(connectionKey, currentConnections + 1);

  const encoder = new TextEncoder();

  // Track last known write_date for drift detection
  let lastKnownWriteDate: string | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendSSEMessage = (update: SSEUpdate) => {
        const message = `data: ${JSON.stringify(update)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      console.log(
        `[SSE] Client connected: ${connectionKey} (total connections: ${activeConnections.get(connectionKey)})`
      );

      // Send initial heartbeat
      sendSSEMessage({ type: "heartbeat", timestamp: Date.now() });

      // Subscribe to webhook events via EventBroadcaster with backend access control
      const threadsChannel = "threads";
      const messagesChannel = threadId ? `messages:${threadId}` : "messages";

      const listenerMetadata = {
        allowedBackendIds,
        sessionId,
      };

      // Thread events listener
      const unsubscribeThreads = eventBroadcaster.subscribe(
        threadsChannel,
        (data) => {
          const update = data as SSEUpdate;
          sendSSEMessage(update);

          // Update last known write_date from thread data
          if (update.data?.threads && Array.isArray(update.data.threads)) {
            const latestThread = update.data.threads[0];
            if (latestThread && typeof latestThread === "object") {
              const threadData = latestThread as { write_date?: string };
              if (threadData.write_date) {
                lastKnownWriteDate = threadData.write_date;
              }
            }
          }
        },
        listenerMetadata
      );

      // Message events listener
      const unsubscribeMessages = eventBroadcaster.subscribe(
        messagesChannel,
        (data) => {
          const update = data as SSEUpdate;
          sendSSEMessage(update);
        },
        listenerMetadata
      );

      console.log(
        `[SSE] Subscribed to channels: ${threadsChannel}, ${messagesChannel}`
      );

      // Heartbeat with drift detection
      let lastHeartbeat = Date.now();

      const sendHeartbeatWithDriftCheck = async () => {
        const now = Date.now();

        // Send heartbeat
        if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
          sendSSEMessage({ type: "heartbeat", timestamp: now });
          lastHeartbeat = now;

          // Lightweight drift detection: check if latest write_date matches
          // Only perform check if we have a baseline write_date
          if (lastKnownWriteDate) {
            try {
              const latestThreads = await sessionClient.searchRead(
                "whatsapp.thread",
                [],
                {
                  limit: 1,
                  select: ["write_date"],
                  order: "write_date desc",
                }
              );

              if (Array.isArray(latestThreads) && latestThreads.length > 0) {
                const currentWriteDate = (
                  latestThreads[0] as { write_date?: string }
                ).write_date;

                if (
                  currentWriteDate &&
                  currentWriteDate !== lastKnownWriteDate
                ) {
                  // Drift detected - webhook may have been missed
                  console.warn(
                    `[SSE] Drift detected for ${connectionKey}: expected ${lastKnownWriteDate}, got ${currentWriteDate}`
                  );

                  // Send sync_required event to client
                  sendSSEMessage({
                    type: "sync_required",
                    timestamp: now,
                  });

                  // Update baseline
                  lastKnownWriteDate = currentWriteDate;
                }
              }
            } catch (error) {
              console.error(`[SSE] Drift check failed for ${connectionKey}:`, error);
              // Don't close connection on drift check failure
            }
          }
        }
      };

      // Start heartbeat interval
      const heartbeatIntervalId = setInterval(
        sendHeartbeatWithDriftCheck,
        HEARTBEAT_INTERVAL_MS
      );

      // Cleanup on connection close
      const cleanup = () => {
        console.log(`[SSE] Client disconnected: ${connectionKey}`);

        // Clear heartbeat interval
        clearInterval(heartbeatIntervalId);

        // Unsubscribe from webhook events
        unsubscribeThreads();
        unsubscribeMessages();

        // Decrement connection counter
        const connections = activeConnections.get(connectionKey) || 1;
        if (connections <= 1) {
          activeConnections.delete(connectionKey);
        } else {
          activeConnections.set(connectionKey, connections - 1);
        }

        try {
          controller.close();
        } catch {
          // Connection already closed
        }
      };

      // Handle client disconnect
      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control, x-session-id",
    },
  });
}
