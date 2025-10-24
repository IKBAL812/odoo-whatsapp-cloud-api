import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./use-auth";

export type MessagePollerCallbacks = {
  onMessagesFound?: (messages: unknown[], threadId: string) => void;
  onError?: (error: Error) => void;
  onPollComplete?: () => void;
};

export type MessagePollerOptions = {
  threadId?: string | null;
  enabled?: boolean;
  interval?: number; // Polling interval in milliseconds
  lastMessageId?: number | null; // Track the latest message ID
};

/**
 * Hook for periodic message polling via REST API
 *
 * This serves as a fallback mechanism alongside SSE to ensure:
 * 1. Messages are not lost if webhooks fail silently
 * 2. Session stays active through periodic API calls
 * 3. Missing messages are recovered automatically
 *
 * Default interval: 10 minutes (600000ms) - 20 seconds for dev testing
 */
export const useMessagePoller = (
  callbacks: MessagePollerCallbacks,
  options: MessagePollerOptions = {}
) => {
  const {
    threadId = null,
    enabled = true,
    interval = 600000, // 10 minutes
    lastMessageId = null,
  } = options;

  const { sessionId } = useAuth();
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const callbacksRef = useRef(callbacks);
  const isPollingRef = useRef(false);
  const lastMessageIdRef = useRef(lastMessageId);

  // Update callbacks ref when callbacks change
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // Update lastMessageId ref when it changes
  useEffect(() => {
    lastMessageIdRef.current = lastMessageId;
  }, [lastMessageId]);

  const poll = useCallback(async () => {
    // Prevent concurrent polls
    if (isPollingRef.current) {
      return;
    }

    if (!enabled || !sessionId || !threadId) {
      return;
    }

    isPollingRef.current = true;
    setIsPolling(true);

    const pollStartTime = Date.now();

    try {
      // Fetch messages newer than lastMessageId
      const searchParams = new URLSearchParams({
        threadId,
        limit: "50", // Fetch last 50 messages to catch any missed ones
      });

      // If we have a lastMessageId, only fetch messages after it
      if (lastMessageIdRef.current !== null) {
        searchParams.set("lastId", String(lastMessageIdRef.current));
        searchParams.set("direction", "forward");
      }

      const response = await fetch(`/api/messages?${searchParams.toString()}`, {
        headers: {
          "x-session-id": sessionId,
        },
      });

      const pollDuration = Date.now() - pollStartTime;

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message =
          errorBody?.error ?? `Failed to poll messages (${response.status})`;
        console.error(
          `[MessagePoller] Poll failed (${pollDuration}ms) - Status: ${response.status}, Error: ${message}`
        );
        throw new Error(message);
      }

      const data = await response.json();
      const messages: unknown[] = Array.isArray(data?.messages)
        ? data.messages
        : [];

      // Only notify if we found new messages
      if (messages.length > 0) {
        callbacksRef.current.onMessagesFound?.(messages, threadId);
      }

      setLastPollTime(Date.now());
      callbacksRef.current.onPollComplete?.();
    } catch (error) {
      const pollDuration = Date.now() - pollStartTime;
      console.error(
        `[MessagePoller] Poll failed after ${pollDuration}ms:`,
        error
      );
      callbacksRef.current.onError?.(error as Error);
    } finally {
      isPollingRef.current = false;
      setIsPolling(false);
    }
  }, [enabled, sessionId, threadId]);

  // Start/stop polling based on dependencies
  useEffect(() => {
    if (!enabled || !sessionId || !threadId) {
      // Clear interval if conditions not met
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Perform initial poll immediately
    poll();

    // Set up interval for subsequent polls
    intervalRef.current = setInterval(() => {
      poll();
    }, interval);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, sessionId, threadId, interval, poll]);

  return {
    isPolling,
    lastPollTime,
    poll, // Allow manual poll trigger
  };
};
