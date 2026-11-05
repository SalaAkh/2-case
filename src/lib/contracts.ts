import { z } from "zod";

export const languages = ["python", "javascript", "typescript", "go", "rust"] as const;
export type Language = (typeof languages)[number];
export const languageLabels: Record<Language, string> = {
  python: "Python", javascript: "JavaScript", typescript: "TypeScript", go: "Go", rust: "Rust",
};
export const extensions: Record<Language, string> = {
  python: "py", javascript: "js", typescript: "ts", go: "go", rust: "rs",
};
export const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
  kind: z.enum(["question", "answer", "hint"]).optional(),
  hintLevel: z.number().int().min(0).max(3).optional(),
}).strict();
export type ChatMessage = z.infer<typeof messageSchema>;

export const mentorRequestSchema = z.object({
  mode: z.enum(["demo", "live"]),
  action: z.enum(["start", "message", "hint"]),
  language: z.enum(languages),
  code: z.string().trim().min(1, "Добавьте код для разбора.").max(20000),
  problem: z.string().trim().min(1, "Опишите, что пошло не так.").max(2000),
  history: z.array(messageSchema).max(60),
  hintLevel: z.number().int().min(0).max(3),
}).strict().superRefine((data, ctx) => {
  const invalid = (message: string) => ctx.addIssue({ code: "custom", message, path: ["history"] });
  if (data.action === "start" && (data.history.length || data.hintLevel !== 0)) invalid("Начните новую историю с нулевого уровня.");
  if (data.action !== "start" && !data.history.length) invalid("Сначала начните разбор.");
  if (data.action === "message" && data.history.at(-1)?.role !== "user") invalid("Ожидается ответ студента.");
  if (data.action === "hint" && data.history.at(-1)?.role !== "assistant") invalid("Сначала дождитесь вопроса наставника.");
  if (data.history[0]?.role === "user") invalid("История должна начинаться с вопроса наставника.");
  if (data.history.reduce((sum, item) => sum + item.content.length, 0) > 45000) invalid("Диалог слишком длинный. Начните новый разбор.");
});
export type MentorRequest = z.infer<typeof mentorRequestSchema>;
export const mentorResponseSchema = z.object({
  message: z.string().min(1).max(4000),
  mode: z.enum(["demo", "live"]),
  hintLevel: z.number().int().min(0).max(3),
  guarded: z.boolean(),
  source: z.enum(["scripted-demo", "openai", "safety-fallback"]),
});
export type MentorResponse = z.infer<typeof mentorResponseSchema>;
export const mentorDraftSchema = z.object({
  acknowledgement: z.string(),
  concept: z.string(),
  question: z.string(),
}).strict();
export type MentorDraft = z.infer<typeof mentorDraftSchema>;
export function renderDraft(draft: MentorDraft) {
  return [draft.acknowledgement, draft.concept, draft.question].filter(Boolean).join("\n\n");
}
