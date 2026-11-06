import { readFile } from "node:fs/promises";
import { z } from "zod";

const recordSchema = z.object({
  format: z.literal("zero-spoiler-pilot-v1"), protocol: z.literal("1"), consent: z.literal(true),
  attemptId: z.string().min(1).max(80), lessonId: z.enum(["index", "condition", "loop"]),
  baselineFirstCorrect: z.boolean(), transferFirstCorrect: z.boolean(),
  transferAttempts: z.number().int().min(1).max(20),
  elapsedSeconds: z.number().nonnegative(), predictions: z.array(z.boolean()).length(3),
  roleChecks: z.array(z.object({ attempts: z.number().int().min(1).max(20), firstCorrect: z.boolean() })).length(2),
});
const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node scripts/summarize-pilot.mjs records/*.json\nПринимаются только добровольно экспортированные файлы пилота.");
  process.exit(1);
}
const seen = new Map();
const groups = {};
let duplicates = 0;
// Validate every input before emitting a report; never silently drop invalid records.
for (const file of files) {
  let record;
  try { record = recordSchema.parse(JSON.parse(await readFile(file, "utf8"))); }
  catch { console.error(`Не удалось проверить файл: ${file}. Отчёт не сформирован.`); process.exit(1); }
  if (seen.has(record.attemptId)) {
    if (JSON.stringify(seen.get(record.attemptId)) !== JSON.stringify(record)) {
      console.error("Один номер попытки содержит разные данные. Проверьте файлы. Отчёт не сформирован."); process.exit(1);
    }
    duplicates++; continue;
  }
  seen.set(record.attemptId, record);
  const group = groups[record.lessonId] ??= { completedAttempts: 0, baselineFirstCorrect: 0, transferFirstCorrect: 0, transferAttempts: [], elapsedSeconds: [] };
  group.completedAttempts++;
  group.baselineFirstCorrect += Number(record.baselineFirstCorrect);
  group.transferFirstCorrect += Number(record.transferFirstCorrect);
  group.transferAttempts.push(record.transferAttempts);
  group.elapsedSeconds.push(record.elapsedSeconds);
}
console.log(JSON.stringify({
  format: "zero-spoiler-pilot-summary-v1", completedAttempts: seen.size, duplicateFilesExcluded: duplicates, byLesson: groups,
  limitations: ["Число попыток не равно числу уникальных участников; повторные проходы исключает организатор.", "Незавершённые сессии не экспортируются: учитывайте их вручную.", "Вопросы до и после различаются, контрольной группы нет. Причинный эффект обучения не установлен.", "Не объединяйте разные сценарии в единый показатель эффективности."],
}, null, 2));
