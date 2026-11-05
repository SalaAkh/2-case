// One shared bucket per Node process: forwarding headers cannot bypass it.
// A distributed gateway is needed before scaling this MVP to multiple instances.
export class RateLimiter {
  private timestamps: number[] = [];
  constructor(private readonly limit = 30, private readonly windowMs = 60_000) {}
  consume(now = Date.now()): { allowed: boolean; retryAfter: number } {
    this.timestamps = this.timestamps.filter(time => now - time < this.windowMs);
    if (this.timestamps.length >= this.limit) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((this.timestamps[0] + this.windowMs - now) / 1000)) };
    }
    this.timestamps.push(now);
    return { allowed: true, retryAfter: 0 };
  }
}
