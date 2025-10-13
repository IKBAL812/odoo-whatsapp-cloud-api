import { describe, expect, it } from "vitest";
import {
  buildMessageNotificationKey,
  findUnnotifiedIncomingMessages,
  shouldPlayNotificationAudio,
} from "../current-chat-provider";
import type { Message } from "../chats-provider";

const baseMessage = (overrides: Partial<Message> = {}): Message => ({
  contactId: "1",
  message: "Hello",
  timestamp: Date.now(),
  isSentFromUser: false,
  ...overrides,
});

describe("buildMessageNotificationKey", () => {
  it("returns message id when present", () => {
    const message = baseMessage({ id: "abc", timestamp: 100 });
    expect(buildMessageNotificationKey(message)).toBe("abc");
  });

  it("builds fallback key when id missing", () => {
    const message = baseMessage({ timestamp: 123, message: "Hi", contactId: "2" });
    expect(buildMessageNotificationKey(message)).toBe("2-123-Hi");
  });
});

describe("findUnnotifiedIncomingMessages", () => {
  it("returns only new incoming messages and updates set", () => {
    const notified = new Set<string>();
    const messages: Message[] = [
      baseMessage({ id: "1", isSentFromUser: false }),
      baseMessage({ id: "2", isSentFromUser: true }),
      baseMessage({ id: "3", isSentFromUser: false }),
    ];

    const { incoming, next } = findUnnotifiedIncomingMessages(messages, notified);

    expect(incoming.map((msg) => msg.id)).toEqual(["1", "3"]);
    expect(next.has("1")).toBe(true);
    expect(next.has("2")).toBe(true);
    expect(next.has("3")).toBe(true);
  });

  it("ignores messages already notified", () => {
    const notified = new Set<string>(["1"]);
    const messages: Message[] = [
      baseMessage({ id: "1", isSentFromUser: false }),
      baseMessage({ id: "2", isSentFromUser: false }),
    ];

    const { incoming, next } = findUnnotifiedIncomingMessages(messages, notified);

    expect(incoming.map((msg) => msg.id)).toEqual(["2"]);
    expect(next.size).toBe(2);
  });

  it("de-duplicates messages without ids using fallback keys", () => {
    const notified = new Set<string>();
    const timestamp = Date.now();
    const messages: Message[] = [
      baseMessage({ id: undefined, timestamp, message: "Ping" }),
    ];

    const first = findUnnotifiedIncomingMessages(messages, notified);
    expect(first.incoming).toHaveLength(1);

    const second = findUnnotifiedIncomingMessages(messages, first.next);
    expect(second.incoming).toHaveLength(0);
  });
});

describe("shouldPlayNotificationAudio", () => {
  it("returns false when tab is visible", () => {
    expect(shouldPlayNotificationAudio("visible")).toBe(false);
  });

  it("returns true when tab is hidden or prerender", () => {
    expect(shouldPlayNotificationAudio("hidden")).toBe(true);
    expect(shouldPlayNotificationAudio("prerender")).toBe(true);
    expect(shouldPlayNotificationAudio(undefined)).toBe(true);
  });
});
