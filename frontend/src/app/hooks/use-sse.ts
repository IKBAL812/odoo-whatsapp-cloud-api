import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./use-auth";

export type SSEUpdate = {
  type: "threads" | "messages" | "heartbeat";
  data?: {
    threads?: unknown[];
    messages?: unknown[];
    threadId?: string;
  };
  timestamp: number;
};

export type SSECallbacks = {
  onThreadsUpdate?: (threads: unknown[]) => void;
  onMessagesUpdate?: (messages: unknown[], threadId: string) => void;
  onHeartbeat?: (timestamp: number) => void;
  onError?: (error: Event) => void;
  onReconnect?: () => void;
};

export type SSEOptions = {
  threadId?: string | null;
  enabled?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
};

export const useSSE = (callbacks: SSECallbacks, options: SSEOptions = {}) => {
  const {
    threadId = null,
    enabled = true,
    reconnectInterval = 10000, // Increased from 5s to 10s
    maxReconnectAttempts = 3,  // Reduced from 5 to 3
  } = options;

  const { sessionId } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const callbacksRef = useRef(callbacks);
  
  // Update callbacks ref when callbacks change
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const connect = useCallback(() => {
    if (!enabled || !sessionId) {
      return;
    }

    // Prevent multiple simultaneous connections
    if (eventSourceRef.current) {
      const state = eventSourceRef.current.readyState;
      if (state === EventSource.CONNECTING || state === EventSource.OPEN) {
        return;
      }
    }

    // Close existing connection properly
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      // Build SSE URL
      const url = new URL("/api/events", window.location.origin);
      if (threadId) {
        url.searchParams.set("threadId", threadId);
      }

      // Create EventSource with custom headers (Note: EventSource doesn't support custom headers directly)
      // We'll use a workaround by passing sessionId as a query parameter for now
      url.searchParams.set("sessionId", sessionId);

      const eventSource = new EventSource(url.toString());
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        setReconnectCount(0);
        callbacksRef.current.onReconnect?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const update: SSEUpdate = JSON.parse(event.data);

          switch (update.type) {
            case "threads":
              if (update.data?.threads) {
                callbacksRef.current.onThreadsUpdate?.(update.data.threads);
              }
              break;
            case "messages":
              if (update.data?.messages && update.data?.threadId) {
                callbacksRef.current.onMessagesUpdate?.(update.data.messages, update.data.threadId);
              }
              break;
            case "heartbeat":
              callbacksRef.current.onHeartbeat?.(update.timestamp);
              break;
          }
        } catch {
          // Failed to parse SSE message
        }
      };

      eventSource.onerror = (error) => {
        setIsConnected(false);
        callbacksRef.current.onError?.(error);

        // Close the failed connection
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt reconnection if within limits and still enabled
        if (enabled && sessionId && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          setReconnectCount(reconnectAttemptsRef.current);

          // Clear any existing timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval * reconnectAttemptsRef.current); // Exponential backoff
        }
      };

    } catch {
      setIsConnected(false);
    }
  }, [enabled, sessionId, threadId, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
    setReconnectCount(0);
  }, []);

  // Connect/disconnect based on dependencies
  useEffect(() => {
    if (enabled && sessionId) {
      connect();
    } else {
      disconnect();
    }

    // Cleanup: disconnect when dependencies change or component unmounts
    return () => {
      disconnect();
    };
  }, [enabled, sessionId, threadId, connect, disconnect]);

  return {
    isConnected,
    reconnectCount,
    connect,
    disconnect,
  };
};