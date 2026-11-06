import { z } from "zod";
import { examples } from "./examples";

export const lessonIds = ["index", "condition", "loop"] as const;
export type LessonId = typeof lessonIds[number];
export type StudyMode = "practice" | "jury" | "pilot";
export const stages = ["hypothesis", "trace", "teach", "transfer", "passport"] as const;
export const stageLabels = ["Гипотеза", "Эксперимент", "Смена ролей", "Новая задача", "Паспорт"];
type Question = { prompt: string; choices: string[]; answer: number };
type TraceStep = Question & {
  title: string; line: number; variables: [string, string][]; output: string; observation: string;
};
type Lesson = {
  concept: string; baseline: Question & { code: string }; steps: TraceStep[];
  misconception: string; roleChecks: (Question & { nudge: string })[];
  transfer: Question & { code: string; nudge: string };
};

// Authored snapshots, not an interpreter. No arbitrary student code is executed.
export const lessons: Record<LessonId, Lesson> = {
  index: {
    concept: "Границы индексов",
    baseline: {
      code: 'letters = ["a", "b", "c"]\nprint(letters[3])',
      prompt: "До расследования: что произойдёт? Ответ сохраним, а результат покажем в паспорте.",
      choices: ['Напечатает "c"', "Возникнет IndexError", "Напечатает 3"], answer: 1,
    },
    steps: [
      { title: "Первая итерация", line: 5, prompt: "Что напечатает print(numbers[i]) при первом входе в цикл?", choices: ["0", "1", "IndexError"], answer: 1,
        variables: [["i", "0"], ["len(numbers)", "5"], ["numbers[i]", "1"]], output: "1", observation: "Первый доступ — по индексу 0. В этой позиции лежит число 1." },
      { title: "После промежуточных итераций", line: 5, prompt: "Теперь i = 4. Что произойдёт на этой строке?", choices: ["IndexError", "Напечатает 4", "Напечатает 5"], answer: 2,
        variables: [["i", "4"], ["len(numbers)", "5"], ["numbers[i]", "5"]], output: "1\n2\n3\n4\n5", observation: "Итерации с i = 1, 2, 3 пропущены на схеме. При i = 4 пятый элемент ещё доступен." },
      { title: "Следующая итерация", line: 5, prompt: "Цикл делает ещё один шаг: i = 5. Какой результат вы ожидаете?", choices: ["IndexError", "Напечатает 5", "Цикл уже завершился"], answer: 0,
        variables: [["i", "5"], ["len(numbers)", "5"], ["numbers[i]", "нет такого элемента"]], output: "1\n2\n3\n4\n5\nIndexError: list index out of range", observation: "range(6) допускает i = 5. Сопоставьте этот индекс с позициями пяти элементов." },
    ],
    misconception: "В списке пять элементов. Значит, индекс последнего элемента — пять. Я могу обратиться к numbers[5], верно?",
    roleChecks: [
      { prompt: "Какой пример вы предложите новичку, чтобы проверить его правило?", choices: ["Для списка из одного элемента проверить индекс 0 и индекс 1", "Поменять имя списка", "Повторить print пять раз"], answer: 0, nudge: "Возьмите самый маленький список и сопоставьте количество элементов с их позициями." },
      { prompt: "Новичок спрашивает: «А если элементов восемь?» Какой последний индекс вы назовёте?", choices: ["8", "9", "7"], answer: 2, nudge: "Перечислите восемь позиций, начиная с нуля." },
    ],
    transfer: { code: 'colors = ["red", "blue", "green", "white"]\nposition = len(colors) - 2\nprint(colors[position])', prompt: "Другая ситуация: что будет напечатано?", choices: ['"blue"', '"green"', '"white"', "IndexError"], answer: 1, nudge: "Сначала вычислите position, затем подпишите индексы элементов. Это другая задача — опирайтесь на правило, которое сформулировали." },
  },
  condition: {
    concept: "Граничные значения",
    baseline: { code: 'const score = 10;\nconsole.log(score > 10);', prompt: "До расследования: что выведет программа? Результат увидите в паспорте.", choices: ["true", "false", "10"], answer: 1 },
    steps: [
      { title: "Вызов функции", line: 9, prompt: "Какое значение получит параметр age в canEnter(18)?", choices: ["undefined", "19", "18"], answer: 2,
        variables: [["age", "18"]], output: "Пока нет вывода", observation: "Аргумент 18 передан параметру age. Теперь проследите именно этот граничный случай." },
      { title: "Проверка условия", line: 3, prompt: "Какое значение имеет выражение age > 18 при age = 18?", choices: ["false", "true", "undefined"], answer: 0,
        variables: [["age", "18"], ["age > 18", "false"]], output: "Пока нет вывода", observation: "Равные числа не удовлетворяют строгому сравнению «больше». Ветка внутри if пропускается." },
      { title: "Возврат и вывод", line: 9, prompt: "Что в итоге выведет console.log(canEnter(18))?", choices: ["true", "false", "18"], answer: 1,
        variables: [["age", "18"], ["строка возврата", "6"], ["результат", "false"]], output: "false", observation: "Выполняется return false на строке 6, затем console.log печатает результат. Сравните наблюдение с требованием «с 18 лет»." },
    ],
    misconception: "Условие age > 18 разрешает вход с 18 лет. Восемнадцать ведь находится на нужной границе?",
    roleChecks: [
      { prompt: "Какие входные данные лучше всего проверят это утверждение?", choices: ["Только 25", "17, 18 и 19", "Только 0"], answer: 1, nudge: "Проверьте точку границы и значения по обе стороны от неё." },
      { prompt: "Новичок пишет 100 > 100. Каким будет результат?", choices: ["true", "100", "false"], answer: 2, nudge: "Строгое сравнение проверяет, что левое число больше правого. Что происходит при равенстве?" },
    ],
    transfer: { code: 'function getsDiscount(total) {\n  return total > 500;\n}\nconsole.log(getsDiscount(500));\nconsole.log(getsDiscount(501));', prompt: "Скидка по требованию положена начиная с 500. Что выведет существующий код для двух покупок?", choices: ["true, true", "false, false", "false, true", "true, false"], answer: 2, nudge: "Отдельно вычислите каждое строгое сравнение. Требование и текущее поведение программы могут отличаться." },
  },
  loop: {
    concept: "Выражение и состояние",
    baseline: { code: 'value = 2\nvalue + 3\nprint(value)', prompt: "До расследования: какое число будет напечатано? Результат увидите в паспорте.", choices: ["5", "2", "3"], answer: 1 },
    steps: [
      { title: "Первый вход в цикл", line: 5, prompt: "count = 0, условие выполнено. Что напечатает эта строка?", choices: ["1", "5", "0"], answer: 2,
        variables: [["count", "0"], ["count < 5", "True"]], output: "0", observation: "В начале первой итерации count равен нулю." },
      { title: "Вычисление выражения", line: 6, prompt: "Чему равен count ПОСЛЕ выполнения строки count + 1?", choices: ["0", "1", "5"], answer: 0,
        variables: [["count + 1", "1"], ["count после строки", "0"]], output: "0", observation: "Выражение вычислилось в 1, но его результат не сохранён в count. Значение переменной осталось прежним." },
      { title: "Следующая проверка", line: 4, prompt: "Цикл вернулся к условию. Какое значение имеет count < 5?", choices: ["False — цикл остановится", "True — цикл продолжится", "Условие больше не проверяется"], answer: 1,
        variables: [["count", "0"], ["count < 5", "True"]], output: "0\nСледующая итерация снова напечатает 0…", observation: "Состояние не изменилось, поэтому условие остаётся истинным. Показаны только ключевые шаги; бесконечный цикл не запускается." },
    ],
    misconception: "Строка count + 1 увеличивает count. В следующем круге там уже будет единица. Разве вычисление не меняет переменную?",
    roleChecks: [
      { prompt: "Какой эксперимент отделит результат выражения от состояния переменной?", choices: ["Переименовать count", "Печатать count до и после count + 1", "Удалить комментарий"], answer: 1, nudge: "Нужно наблюдать значение самой переменной в двух моментах времени." },
      { prompt: "Пусть count = 3. Чему равны результат count + 1 и сам count после этого выражения?", choices: ["4 и 3", "4 и 4", "3 и 4"], answer: 0, nudge: "Разделите два вопроса: что вычислилось и что сохранилось." },
    ],
    transfer: { code: 'remaining = 3\nwhile remaining > 0:\n    print(remaining)\n    remaining - 1', prompt: "Какое значение будет у remaining после двух итераций? Код здесь не запускается.", choices: ["1", "0", "2", "3"], answer: 3, nudge: "Проследите, есть ли в теле цикла операция, сохраняющая новое значение remaining." },
  },
};

const choice = z.number().int().min(0).max(3);
const runSchema = z.object({
  version: z.literal(1), id: z.string().min(1).max(80), lessonId: z.enum(lessonIds),
  mode: z.enum(["practice", "jury", "pilot"]), consent: z.boolean(),
  stage: z.enum(stages), startedAt: z.number().nonnegative(), completedAt: z.number().nonnegative().nullable(),
  hypothesis: z.string().max(1000), baseline: choice.nullable(),
  predictions: z.array(choice).max(3), traceCursor: z.number().int().min(0).max(2),
  explanation: z.string().max(1500), roleAnswers: z.array(z.array(choice).max(20)).length(2),
  conclusion: z.string().max(1000), transferReason: z.string().max(1000), transferAnswers: z.array(choice).max(20),
});
export type Investigation = z.infer<typeof runSchema>;
export const STUDY_KEY = "zero-spoiler.investigation.v1";
export function createInvestigation(lessonId: LessonId, mode: StudyMode, consent: boolean, id: string, now: number): Investigation {
  return { version: 1, id, lessonId, mode, consent: mode === "pilot" && consent, stage: "hypothesis", startedAt: now, completedAt: null,
    hypothesis: "", baseline: null, predictions: [], traceCursor: 0, explanation: "", roleAnswers: [[], []], conclusion: "", transferReason: "", transferAnswers: [] };
}
export function roleProgress(run: Investigation): number {
  return lessons[run.lessonId].roleChecks.filter((check, i) => run.roleAnswers[i].at(-1) === check.answer).length;
}
function validChoice(value: number, question: Question) { return Number.isInteger(value) && value >= 0 && value < question.choices.length; }
const hasText = (value: string, max: number) => value.trim().length >= 10 && value.length <= max;
export type InvestigationAction =
  | { type: "baseline"; answer: number }
  | { type: "hypothesis"; text: string }
  | { type: "predict"; answer: number }
  | { type: "next-step" }
  | { type: "teach"; text: string; answer: number }
  | { type: "conclude"; text: string }
  | { type: "transfer"; answer: number; reason: string; now: number };

// Invalid or out-of-order events never unlock a stage. First attempts are retained.
export function advanceInvestigation(run: Investigation, action: InvestigationAction): Investigation {
  const lesson = lessons[run.lessonId];
  switch (action.type) {
    case "baseline":
      return run.stage === "hypothesis" && run.baseline === null && validChoice(action.answer, lesson.baseline)
        ? { ...run, baseline: action.answer } : run;
    case "hypothesis":
      return run.stage === "hypothesis" && run.baseline !== null && hasText(action.text, 1000)
        ? { ...run, hypothesis: action.text.trim(), stage: "trace" } : run;
    case "predict":
      return run.stage === "trace" && run.predictions.length === run.traceCursor && validChoice(action.answer, lesson.steps[run.traceCursor])
        ? { ...run, predictions: [...run.predictions, action.answer] } : run;
    case "next-step":
      if (run.stage !== "trace" || run.predictions.length !== run.traceCursor + 1) return run;
      return run.traceCursor === lesson.steps.length - 1 ? { ...run, stage: "teach" } : { ...run, traceCursor: run.traceCursor + 1 };
    case "teach": {
      const index = roleProgress(run);
      if (run.stage !== "teach" || index >= lesson.roleChecks.length || !hasText(action.text, 1500) || !validChoice(action.answer, lesson.roleChecks[index]) || run.roleAnswers[index].length >= 20) return run;
      return { ...run, explanation: action.text.trim(), roleAnswers: run.roleAnswers.map((answers, i) => i === index ? [...answers, action.answer] : answers) };
    }
    case "conclude":
      return run.stage === "teach" && roleProgress(run) === lesson.roleChecks.length && hasText(action.text, 1000)
        ? { ...run, conclusion: action.text.trim(), stage: "transfer" } : run;
    case "transfer":
      if (run.stage !== "transfer" || !hasText(action.reason, 1000) || !validChoice(action.answer, lesson.transfer) || run.transferAnswers.length >= 20 || action.now < run.startedAt) return run;
      return { ...run, transferReason: action.reason.trim(), transferAnswers: [...run.transferAnswers, action.answer],
        stage: action.answer === lesson.transfer.answer ? "passport" : "transfer", completedAt: action.answer === lesson.transfer.answer ? action.now : null };
  }
}

export function restoreInvestigation(raw: string | null, lessonId: LessonId, mode: StudyMode): Investigation | null {
  if (!raw || raw.length > 20000) return null;
  try {
    const parsed = runSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const run = parsed.data;
    const lesson = lessons[lessonId];
    const stage = stages.indexOf(run.stage);
    if (run.lessonId !== lessonId || run.mode !== mode || (mode === "pilot" && !run.consent)) return null;
    if (run.baseline !== null && !validChoice(run.baseline, lesson.baseline)) return null;
    if (run.predictions.some((p, i) => !validChoice(p, lesson.steps[i])) || run.roleAnswers.some((answers, i) => answers.some(a => !validChoice(a, lesson.roleChecks[i]))) || run.transferAnswers.some(a => !validChoice(a, lesson.transfer))) return null;
    if (stage === 0 && (run.predictions.length || run.traceCursor !== 0)) return null;
    if (stage < 2 && run.roleAnswers.some(answers => answers.length)) return null;
    if (stage < 3 && run.transferAnswers.length) return null;
    if (stage > 0 && (!hasText(run.hypothesis, 1000) || run.baseline === null)) return null;
    if (run.predictions.length < run.traceCursor || run.predictions.length > run.traceCursor + 1) return null;
    if (stage > 1 && (run.traceCursor !== 2 || run.predictions.length !== lesson.steps.length)) return null;
    if (run.roleAnswers[1].length && run.roleAnswers[0].at(-1) !== lesson.roleChecks[0].answer) return null;
    if (stage > 2 && (roleProgress(run) !== 2 || !hasText(run.explanation, 1500) || !hasText(run.conclusion, 1000))) return null;
    if (stage === 4 && (run.transferAnswers.at(-1) !== lesson.transfer.answer || !hasText(run.transferReason, 1000) || run.completedAt === null || run.completedAt < run.startedAt)) return null;
    if (stage < 4 && run.completedAt !== null) return null;
    return run;
  } catch { return null; }
}

export function makePassport(run: Investigation) {
  const lesson = lessons[run.lessonId];
  return {
    format: "zero-spoiler-passport-v1", attemptId: run.id, mode: run.mode, lesson: lesson.concept,
    completed: run.stage === "passport", hypothesis: run.hypothesis, explanation: run.explanation, conclusion: run.conclusion,
    baselineFirstCorrect: run.baseline === null ? null : run.baseline === lesson.baseline.answer,
    predictions: run.predictions.map((answer, i) => ({ question: lesson.steps[i].prompt, prediction: lesson.steps[i].choices[answer], correct: answer === lesson.steps[i].answer })),
    roleChecks: run.roleAnswers.map((answers, i) => ({ attempts: answers.length, firstCorrect: answers.length ? answers[0] === lesson.roleChecks[i].answer : null })),
    transfer: { reasoning: run.transferReason, attempts: run.transferAnswers.length, firstCorrect: run.transferAnswers.length ? run.transferAnswers[0] === lesson.transfer.answer : null, solved: run.transferAnswers.at(-1) === lesson.transfer.answer },
    elapsedSeconds: run.completedAt === null ? null : Math.max(0, Math.round((run.completedAt - run.startedAt) / 1000)),
    note: "Учебный самоотчёт и ответы на подготовленные вопросы. Свободное объяснение не оценивалось ИИ. Это не сертификат освоения навыка. Время включает паузы.",
  };
}
export function makePilotRecord(run: Investigation) {
  if (run.mode !== "pilot" || !run.consent || run.stage !== "passport") return null;
  const passport = makePassport(run);
  // Deliberately exclude free text, account details and device identifiers.
  return { format: "zero-spoiler-pilot-v1", protocol: "1", attemptId: run.id, lessonId: run.lessonId,
    consent: true,
    baselineFirstCorrect: passport.baselineFirstCorrect, transferFirstCorrect: passport.transfer.firstCorrect,
    transferAttempts: passport.transfer.attempts, roleChecks: passport.roleChecks,
    predictions: passport.predictions.map(p => p.correct), elapsedSeconds: passport.elapsedSeconds,
    limitation: "Разные вопросы до и после; повторные попытки и подсказки доступны. Один участник может экспортировать несколько попыток. Причинный эффект обучения не установлен." };
}

export function lessonExample(id: LessonId) { return examples.find(example => example.id === id)!; }
