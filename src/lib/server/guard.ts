import { mentorDraftSchema, renderDraft, type MentorDraft, type MentorRequest } from "../contracts";

const unsafePatterns = [
  /`|~~~|<\/?(?:script|code|pre)\b/i,
  /(?:^|\n)\s*(?:diff\b|@@|\+\+\+|---\s+[ab]\/|[+-]\s*(?:for|if|return|const|let|def)\b)/im,
  /(?:^|[\s.,:;!])(?:замени(?:те)?|убери(?:те)?|удали(?:те)?|исправь(?:те)?|добавь(?:те)?|поменяй(?:те)?|используй(?:те)?)\s+[^?\n]{0,95}(?:строк|оператор|символ|услови|вместо|на\s|\+\s*1|присваив|инкремент)/iu,
  /(?:replace|remove|delete|change|insert|use|set|add)\s+[^?\n]{0,90}(?:with|instead|line|operator|condition|increment|assignment|\+\s*1)/i,
  /(?:правильн[а-яё]*|исправленн[а-яё]*|готов[а-яё]*)\s+(?:код|решени|вариант|строк|услови|выражени)/iu,
  /(?:correct|fixed|working|complete)\s+(?:code|solution|patch|implementation)/i,
  /(?:^|\n)\s*(?:(?:const|let|var|def|fn|func|return|import|from)\s+\w|(?:for|while|if)\s*\(|\w+\s*(?:\+=|-=|=(?!=))\s*[^?\n]+)/im,
  /\b(?:range|print|console\.log|len|canEnter)\s*\(/i,
  /(?:\+=|-=|\+\+|--|=>|>=|<=|===|!==)/,
  /(?:строк[аеуи]|line)\s*\d+\s*[:—-]/iu,
];

export function isSafeDraft(value: unknown): value is MentorDraft {
  const parsed = mentorDraftSchema.safeParse(value);
  if (!parsed.success) return false;
  const text = renderDraft(parsed.data);
  if (text.length < 12 || text.length > 1600 || !parsed.data.question.trim().endsWith("?")) return false;
  return !unsafePatterns.some(pattern => pattern.test(text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "")));
}

const safeQuestions = [
  "Какое поведение ты ожидаешь и в какой момент результат впервые отличается от ожидания?",
  "Какие значения переменных ты ожидаешь увидеть непосредственно перед этим моментом?",
  "Как меняется состояние программы после одного прохода этого участка?",
  "Какой небольшой пример поможет проверить твою гипотезу о поведении программы?",
  "Что произойдёт на граничном случае и совпадает ли это с твоим ожиданием?",
  "Какое наблюдение помогло бы различить две возможные причины этого поведения?",
];
export function safeFallback(input: MentorRequest, hintLevel: number): string {
  const used = new Set(input.history.filter(m => m.role === "assistant").map(m => m.content));
  const start = (input.history.filter(m => m.role === "user").length + hintLevel) % safeQuestions.length;
  for (let offset = 0; offset < safeQuestions.length; offset++) {
    const candidate = safeQuestions[(start + offset) % safeQuestions.length];
    if (![...used].some(text => text.includes(candidate))) return candidate;
  }
  return `Если взять другой входной пример, какое предположение из твоего последнего ответа стоит проверить первым?`;
}
