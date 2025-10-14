import { NextRequest } from "next/server";
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

type SSEUpdate = {
  type: "threads" | "messages" | "heartbeat";
  data?: {
    threads?: unknown[];
    messages?: unknown[];
    threadId?: string;
  };
  timestamp: number;
};

const CHECK_INTERVAL_MS = 5000; // 5 seconds (reduced frequency)
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const MAX_CONSECUTIVE_ERRORS = 5;

// Simple rate limiting - in production use Redis or proper rate limiting
const activeConnections = new Map<string, number>();

export async function GET(request: NextRequest) {
  try {
    ensureEnv();
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Server configuration error",
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  // Get URL parameters
  const url = new URL(request.url);
  const sessionId = request.headers.get("x-session-id") || url.searchParams.get("sessionId");
  
  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "Missing Odoo session id" }),
      { 
        status: 401,
        headers: { "Content-Type": "application/json" }
      }
    );
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
        headers: { "Content-Type": "application/json" }
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
  
  // Simple connection limiting
  const connectionKey = `${sessionId}-${threadId || 'global'}`;
  const currentConnections = activeConnections.get(connectionKey) || 0;
  
  if (currentConnections >= 3) { // Max 3 connections per session+thread
    return new Response(
      JSON.stringify({ error: "Too many active connections for this session" }),
      { 
        status: 429,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  
  // Track connection
  activeConnections.set(connectionKey, currentConnections + 1);
  
  // Odoo format: YYYY-MM-DD HH:MM:SS
  const formatOdooDateTime = (date: Date) => {
    return date.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
  };
  
  // Start checking from 1 minute ago to catch any recent messages
  const startTime = new Date(Date.now() - 60000); // 1 minute buffer
  let lastThreadsCheck = formatOdooDateTime(startTime);
  let lastMessagesCheck = formatOdooDateTime(startTime);
  let lastHeartbeat = Date.now();
  let consecutiveErrors = 0;
  let intervalId: NodeJS.Timeout;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const sendSSEMessage = (update: SSEUpdate) => {
        const message = `data: ${JSON.stringify(update)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial heartbeat
      sendSSEMessage({ type: "heartbeat", timestamp: Date.now() });

      const checkForUpdates = async () => {
        try {
          const now = Date.now();

          // Check for new threads (every check)
          try {
            const threadsResponse = await sessionClient.searchRead(
              "whatsapp.thread",
              [["last_message_date", ">", lastThreadsCheck]],
              {
                limit: 50,
                select: [
                  "name",
                  "last_message_date", 
                  "last_message_preview",
                  "phone_number",
                  "backend_id",
                  "write_date",
                ],
                order: "last_message_date desc"
              }
            );

            if (Array.isArray(threadsResponse) && threadsResponse.length > 0) {
              sendSSEMessage({
                type: "threads",
                data: { threads: threadsResponse },
                timestamp: now
              });
              
              // Update timestamp to the latest message date from the response
              const latestThread = threadsResponse[0]; // Already sorted by last_message_date desc
              if (latestThread.last_message_date) {
                lastThreadsCheck = latestThread.last_message_date;
              } else {
                lastThreadsCheck = formatOdooDateTime(new Date());
              }
            } else {
              // No updates, just advance the timestamp slightly to avoid re-checking same data
              lastThreadsCheck = formatOdooDateTime(new Date());
            }
            consecutiveErrors = 0; // Reset error counter on success
          } catch (error) {
            console.error("Error checking threads:", error);
            consecutiveErrors++;
            
            // If connection refused or network error, stop checking to avoid spamming logs
            const err = error as any;
            if (err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('fetch failed')) {
              console.error("Backend connection refused, stopping SSE updates");
              clearInterval(intervalId);
              controller.close();
              return;
            }
          }

          // Check for new messages (only if threadId specified)
          if (threadId) {
            try {
              const messagesResponse = await sessionClient.searchRead(
                "whatsapp.message",
                [
                  ["thread_id", "=", parseInt(threadId)],
                  ["write_date", ">", lastMessagesCheck]
                ],
                {
                  limit: 50,
                  select: [
                    "body",
                    "status",
                    "direction",
                    "attachment_id",
                    "message_id",
                    "replied_message_id",
                    "create_date",
                    "create_uid",
                    "write_date",
                    "timestamp",
                  ],
                }
              );

              // Always update timestamp, regardless of results
              const currentMessageCheckTime = formatOdooDateTime(new Date());

              if (Array.isArray(messagesResponse) && messagesResponse.length > 0) {
                sendSSEMessage({
                  type: "messages",
                  data: { 
                    messages: messagesResponse,
                    threadId: threadId 
                  },
                  timestamp: now
                });
              }
              
              // Update timestamp after successful check
              lastMessagesCheck = currentMessageCheckTime;
              consecutiveErrors = 0; // Reset error counter on success
            } catch (error) {
              console.error("Error checking messages:", error);
              consecutiveErrors++;
              
              // If connection refused or network error, stop checking to avoid spamming logs
              const err = error as any;
              if (err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('fetch failed')) {
                console.error("Backend connection refused, stopping SSE updates");
                clearInterval(intervalId);
                controller.close();
                return;
              }
            }
          }

          // Send heartbeat every 30 seconds
          if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
            sendSSEMessage({ type: "heartbeat", timestamp: now });
            lastHeartbeat = now;
          }

        } catch (error) {
          console.error("SSE update check error:", error);
          consecutiveErrors++;
          
          // If too many consecutive errors, slow down the checks
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.warn(`Too many consecutive SSE errors (${consecutiveErrors}), slowing down checks`);
            // Could implement exponential backoff here
          }
        }
      };

      // Initial check
      checkForUpdates();

      // Set up interval
      intervalId = setInterval(checkForUpdates, CHECK_INTERVAL_MS);

      // Cleanup on connection close
      const cleanup = () => {
        clearInterval(intervalId);
        
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

      // Don't add process listeners for each connection to prevent memory leaks
      // These should be handled globally if needed
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control, x-session-id",
    },
  });
}