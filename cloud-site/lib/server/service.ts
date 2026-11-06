import { isLocale, translate, type Locale } from "../i18n";
import { mentorRequestSchema, renderDraft, type MentorDraft, type MentorRequest, type MentorResponse } from "../contracts";
import { demoReply } from "./demo";
import { isSafeDraft, safeFallback } from "./guard";
import { RateLimiter } from "./rate-limit";

export type MentorDependencies = {
  liveAvailable: () => boolean;
  demoAvailable: () => boolean;
  generate: (input: MentorRequest, hintLevel: number, signal: AbortSignal) => Promise<MentorDraft | null>;
  review: (input: MentorRequest, draft: MentorDraft, signal: AbortSignal) => Promise<boolean>;
  limiter: RateLimiter;
};

class PayloadError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new PayloadError(415, "Ожидается запрос в формате JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new PayloadError(400, "Пустой запрос.");
  let bytes = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 100_000) {
        await reader.cancel();
        throw new PayloadError(413, "Слишком большой запрос. Сократите код или начните новый диалог.");
      }
      parts.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const part of parts) { body.set(part, offset); offset += part.byteLength; }
    try { return JSON.parse(new TextDecoder().decode(body)); }
    catch { throw new PayloadError(400, "Не удалось прочитать JSON запроса."); }
  } finally { reader.releaseLock(); }
}

function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
export function createMentorHandler(deps: MentorDependencies) {
  return async function POST(request: Request): Promise<Response> {
    const requestedLocale = request.headers.get("x-zero-spoiler-language");
    let locale: Locale = isLocale(requestedLocale) ? requestedLocale : "ru";
    const reply = (data: { error: string } | MentorResponse, status = 200, headers?: Record<string, string>) => json("error" in data ? { error: translate(locale, data.error) } : data, status, headers);
    const origin = request.headers.get("origin");
    // Next may construct request.url with its internal hostname. The browser's
    // Host is authoritative for same-origin checks and cannot be set by page JS.
    const requestHost = request.headers.get("host") || new URL(request.url).host;
    let originAllowed = !origin;
    if (origin) {
      try {
        const parsedOrigin = new URL(origin);
        originAllowed = ["http:", "https:"].includes(parsedOrigin.protocol) && parsedOrigin.host === requestHost;
      } catch { originAllowed = false; }
    }
    if (!originAllowed || request.headers.get("sec-fetch-site") === "cross-site") {
      return reply({ error: "Запрос разрешён только из приложения." }, 403);
    }
    const budget = deps.limiter.consume();
    if (!budget.allowed) return reply({ error: translate(locale, "Слишком много запросов. Попробуйте через {0} сек.", { "0": budget.retryAfter }) }, 429, { "Retry-After": String(budget.retryAfter) });
    try {
      const parsed = mentorRequestSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message;
        return reply({ error: message && /[А-Яа-яЁё]/.test(message) ? message : "Проверьте данные запроса." }, 400);
      }
      const input = parsed.data;
      locale = input.locale ?? locale;
      input.locale = locale;
      const hintLevel = input.action === "hint" ? Math.min(3, input.hintLevel + 1) : input.hintLevel;
      if (input.action === "hint" && input.hintLevel === 3) return reply({ error: "Вы уже на третьем уровне. Продолжите диалог с наставником." }, 400);
      if (input.mode === "demo") {
        if (!deps.demoAvailable()) return reply({ error: "Демонстрационный режим отключён на сервере." }, 503);
        const result: MentorResponse = { message: demoReply(input, hintLevel), mode: "demo", hintLevel, guarded: false, source: "scripted-demo" };
        return reply(result);
      }
      if (!deps.liveAvailable()) return reply({ error: "OpenAI не подключён. Добавьте OPENAI_API_KEY в .env.local и перезапустите сервер. Можно выбрать деморежим." }, 503);
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(35_000)]);
      const candidate = await deps.generate(input, hintLevel, signal);
      let approved = false;
      if (isSafeDraft(candidate)) {
        try { approved = await deps.review(input, candidate, signal); }
        catch { approved = false; } // Verification failure is fail-closed.
      }
      const result: MentorResponse = {
        message: approved && candidate ? renderDraft(candidate) : safeFallback(input, hintLevel),
        mode: "live", hintLevel, guarded: !approved,
        source: approved ? "openai" : "safety-fallback",
      };
      return reply(result);
    } catch (error) {
      if (error instanceof PayloadError) return reply({ error: error.message }, error.status);
      // Never forward SDK messages, request bodies or upstream response details.
      if (error instanceof Error && /abort|timeout/i.test(error.name)) return reply({ error: "Наставник не успел ответить. Попробуйте ещё раз." }, 504);
      return reply({ error: "Не удалось связаться с OpenAI. Проверьте ключ, доступ к модели и баланс API, затем повторите запрос." }, 502);
    }
  };
}
