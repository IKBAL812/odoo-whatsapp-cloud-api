/**
 * Server-side RAG suggestion cache
 *
 * Caches RAG-generated suggestions per thread/message context
 * to prevent duplicate LLM calls when multiple agents view the same thread.
 *
 * For production multi-instance deployments, replace with Redis.
 */

interface CachedSuggestion {
  threadId: string;
  lastMessageId: string;
  suggestions: string[];
  timestamp: number;
}

class RagSuggestionCache {
  private cache = new Map<string, CachedSuggestion>();
  private readonly TTL_MS = 60 * 60 * 1000; // 1 hour
  private cleanupIntervalId?: NodeJS.Timeout;

  constructor() {
    // Start cleanup interval (every 30 minutes)
    this.startCleanup();
  }

  /**
   * Build cache key from threadId and lastMessageId
   */
  private buildKey(threadId: string, lastMessageId: string): string {
    return `rag:${threadId}:${lastMessageId}`;
  }

  /**
   * Get cached suggestions for a thread/message context
   * Returns null if not found or expired
   */
  get(threadId: string, lastMessageId: string): string[] | null {
    const key = this.buildKey(threadId, lastMessageId);
    const data = this.cache.get(key);

    if (!data) {
      return null;
    }

    // Check if expired
    const age = Date.now() - data.timestamp;
    if (age > this.TTL_MS) {
      console.log(
        `[RagSuggestionCache] Entry expired for thread ${threadId} (age: ${Math.round(age / 1000 / 60)}min)`
      );
      this.cache.delete(key);
      return null;
    }

    console.log(
      `[RagSuggestionCache] Cache HIT for thread ${threadId}, message ${lastMessageId}`
    );
    return data.suggestions;
  }

  /**
   * Store suggestions for a thread/message context
   */
  set(threadId: string, lastMessageId: string, suggestions: string[]): void {
    const key = this.buildKey(threadId, lastMessageId);
    const timestamp = Date.now();

    this.cache.set(key, {
      threadId,
      lastMessageId,
      suggestions,
      timestamp,
    });

    console.log(
      `[RagSuggestionCache] Cached ${suggestions.length} suggestions for thread ${threadId}, message ${lastMessageId}`
    );
  }

  /**
   * Invalidate cache for a specific thread/message context
   */
  invalidate(threadId: string, lastMessageId: string): boolean {
    const key = this.buildKey(threadId, lastMessageId);
    const deleted = this.cache.delete(key);

    if (deleted) {
      console.log(
        `[RagSuggestionCache] Invalidated cache for thread ${threadId}, message ${lastMessageId}`
      );
    }

    return deleted;
  }

  /**
   * Invalidate ALL suggestions for a thread
   * Useful when thread context changes significantly
   */
  invalidateThread(threadId: string): number {
    const prefix = `rag:${threadId}:`;
    let count = 0;

    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    });

    if (count > 0) {
      console.log(
        `[RagSuggestionCache] Invalidated ${count} entries for thread ${threadId}`
      );
    }

    return count;
  }

  /**
   * Check if suggestions exist and are valid
   */
  has(threadId: string, lastMessageId: string): boolean {
    return this.get(threadId, lastMessageId) !== null;
  }

  /**
   * Get cache statistics
   */
  getStats(): { total: number; expired: number } {
    const now = Date.now();
    let expired = 0;

    this.cache.forEach((data) => {
      if (now - data.timestamp > this.TTL_MS) {
        expired++;
      }
    });

    return {
      total: this.cache.size,
      expired,
    };
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    if (this.cleanupIntervalId) {
      return;
    }

    const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpired();
    }, CLEANUP_INTERVAL_MS);

    console.log(
      `[RagSuggestionCache] Cleanup started (interval: ${CLEANUP_INTERVAL_MS / 1000 / 60}min, TTL: ${this.TTL_MS / 1000 / 60}min)`
    );
  }

  /**
   * Remove all expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let removed = 0;

    this.cache.forEach((data, key) => {
      if (now - data.timestamp > this.TTL_MS) {
        this.cache.delete(key);
        removed++;
      }
    });

    if (removed > 0) {
      console.log(
        `[RagSuggestionCache] Cleanup: removed ${removed} expired entries (remaining: ${this.cache.size})`
      );
    }
  }

  /**
   * Stop cleanup interval (for testing)
   */
  stopCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.cache.clear();
    console.log("[RagSuggestionCache] Cache cleared");
  }
}

// Singleton instance
export const ragSuggestionCache = new RagSuggestionCache();
