/**
 * In-memory sliding window rate limiter for AI endpoints.
 * Protects against accidental loops, runaway requests, and token exhaustion.
 */
interface RateLimitRecord {
  timestamps: number[];
}

export class InMemoryRateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 30, windowMs = 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Periodic cleanup of stale keys every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.records.entries()) {
        record.timestamps = record.timestamps.filter((t) => now - t < this.windowMs);
        if (record.timestamps.length === 0) {
          this.records.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  public check(identifier: string): { allowed: boolean; remaining: number; resetTimeMs: number } {
    const now = Date.now();
    let record = this.records.get(identifier);

    if (!record) {
      record = { timestamps: [] };
      this.records.set(identifier, record);
    }

    // Filter out timestamps outside window
    record.timestamps = record.timestamps.filter((t) => now - t < this.windowMs);

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0];
      const resetTimeMs = Math.max(0, this.windowMs - (now - oldest));
      return {
        allowed: false,
        remaining: 0,
        resetTimeMs,
      };
    }

    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - record.timestamps.length,
      resetTimeMs: this.windowMs,
    };
  }
}

export const aiRateLimiter = new InMemoryRateLimiter(30, 60 * 1000);
