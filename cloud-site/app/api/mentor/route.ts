import { createMentorHandler } from "@/lib/server/service";
import { generate, review } from "@/lib/server/openai";
import { RateLimiter } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 45;
const parsedLimit = Number(process.env.RATE_LIMIT_PER_MINUTE || 30);
const globalWithLimiter = globalThis as typeof globalThis & { mentorLimiter?: RateLimiter };
const limiter = globalWithLimiter.mentorLimiter ??= new RateLimiter(Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : 30);
export const POST = createMentorHandler({
  liveAvailable: () => Boolean(process.env.OPENAI_API_KEY?.trim()),
  demoAvailable: () => process.env.ENABLE_DEMO !== "false",
  generate, review, limiter,
});
