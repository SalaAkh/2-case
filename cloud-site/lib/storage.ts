import { z } from "zod";
import { languages, messageSchema, type Language } from "./contracts";
import { examples, type Example } from "./examples";

export const STORAGE_KEY = "zero-spoiler.workspace.v1";
const sessionSchema = z.object({
  id: z.string().max(80), title: z.string().max(100),
  language: z.enum(languages), code: z.string().max(20000), problem: z.string().max(2000),
  messages: z.array(messageSchema).max(60),
  hintLevel: z.number().int().min(0).max(3), hints: z.number().int().min(0).max(3),
  mode: z.enum(["demo", "live"]), updatedAt: z.number(),
});
export type Session = z.infer<typeof sessionSchema>;
export const workspaceSchema = z.object({
  version: z.literal(1), sessions: z.array(sessionSchema).min(1).max(12), activeId: z.string(), theme: z.enum(["dark", "light"]),
});
export type WorkspaceState = z.infer<typeof workspaceSchema>;
export function newSession(example?: Example, mode: "demo" | "live" = "demo"): Session {
  return {
    id: crypto.randomUUID(), title: example?.title ?? "Новый разбор",
    language: example?.language ?? "python", code: example?.code ?? "", problem: example?.problem ?? "",
    messages: [], hintLevel: 0, hints: 0, mode, updatedAt: Date.now(),
  };
}
export const initialWorkspace: WorkspaceState = {
  version: 1, activeId: "welcome", theme: "dark",
  sessions: [{
    id: "welcome", title: examples[0].title, language: "python" as Language,
    code: examples[0].code, problem: examples[0].problem, messages: [], hintLevel: 0,
    hints: 0, mode: "demo", updatedAt: 0,
  }],
};
export function restoreWorkspace(raw: string | null): WorkspaceState | null {
  if (!raw) return null;
  try {
    const parsed = workspaceSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const data = parsed.data;
    if (!data.sessions.some(s => s.id === data.activeId)) data.activeId = data.sessions[0].id;
    return data;
  } catch { return null; }
}
