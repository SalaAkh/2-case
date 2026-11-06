import { describe, expect, it } from "vitest";
import { advanceInvestigation, createInvestigation, lessonExample, lessonIds, lessons, makePassport, makePilotRecord, restoreInvestigation, roleProgress, type Investigation, type LessonId } from "../src/lib/investigation";

function untilTeach(id: LessonId) {
  let run = createInvestigation(id, "practice", false, "test-attempt", 1000);
  run = advanceInvestigation(run, { type: "baseline", answer: 0 });
  run = advanceInvestigation(run, { type: "hypothesis", text: "Я проверю своё предположение на границе." });
  for (const step of lessons[id].steps) {
    run = advanceInvestigation(run, { type: "predict", answer: step.answer });
    run = advanceInvestigation(run, { type: "next-step" });
  }
  return run;
}
function untilTransfer(id: LessonId) {
  let run = untilTeach(id);
  for (const check of lessons[id].roleChecks) run = advanceInvestigation(run, { type: "teach", text: "Рассмотрим наблюдения и проверим правило на примере.", answer: check.answer });
  return advanceInvestigation(run, { type: "conclude", text: "Теперь я могу объяснить правило своими словами." });
}
function complete(run: Investigation) {
  return advanceInvestigation(run, { type: "transfer", answer: lessons[run.lessonId].transfer.answer, reason: "Я применил правило к новым значениям и проверил вывод.", now: 61000 });
}

describe.each(lessonIds)("расследование %s", id => {
  it("проходит все этапы и восстанавливает завершённый паспорт", () => {
    const run = complete(untilTransfer(id));
    expect(run.stage).toBe("passport");
    expect(roleProgress(run)).toBe(2);
    expect(restoreInvestigation(JSON.stringify(run), id, "practice")).toEqual(run);
    expect(makePassport(run)).toMatchObject({ completed: true, elapsedSeconds: 60, transfer: { firstCorrect: true, attempts: 1 } });
  });
  it("не открывает наблюдение до прогноза и не позволяет переписать прогноз", () => {
    let run = createInvestigation(id, "practice", false, "id", 0);
    expect(advanceInvestigation(run, { type: "next-step" })).toBe(run);
    run = advanceInvestigation(run, { type: "baseline", answer: 0 });
    expect(advanceInvestigation(run, { type: "baseline", answer: 1 })).toBe(run);
    run = advanceInvestigation(run, { type: "hypothesis", text: "Я хочу проверить своё предположение." });
    expect(advanceInvestigation(run, { type: "next-step" })).toBe(run);
    run = advanceInvestigation(run, { type: "predict", answer: 0 });
    expect(advanceInvestigation(run, { type: "predict", answer: 1 })).toBe(run);
    expect(advanceInvestigation(run, { type: "transfer", answer: lessons[id].transfer.answer, reason: "Попробую перескочить все этапы.", now: 10 })).toBe(run);
  });
  it("ошибка новичка требует исправления, а первые попытки не стираются", () => {
    let run = untilTeach(id);
    expect(advanceInvestigation(run, { type: "conclude", text: "Попытаюсь перейти дальше без проверки." })).toBe(run);
    const wrong = (lessons[id].roleChecks[0].answer + 1) % lessons[id].roleChecks[0].choices.length;
    run = advanceInvestigation(run, { type: "teach", answer: wrong, text: "Вот моё объяснение для виртуального новичка." });
    expect(roleProgress(run)).toBe(0);
    run = advanceInvestigation(run, { type: "teach", answer: lessons[id].roleChecks[0].answer, text: "Я пересмотрел объяснение по наблюдениям." });
    expect(run.roleAnswers[0]).toEqual([wrong, lessons[id].roleChecks[0].answer]);
    expect(roleProgress(run)).toBe(1);
  });
  it("не завершает путь при неверном переносе и честно отмечает повторную попытку", () => {
    let run = untilTransfer(id);
    const wrong = (lessons[id].transfer.answer + 1) % lessons[id].transfer.choices.length;
    run = advanceInvestigation(run, { type: "transfer", answer: wrong, reason: "Проверяю новое применение изученного правила.", now: 2000 });
    expect(run.stage).toBe("transfer");
    expect(run.completedAt).toBeNull();
    run = complete(run);
    expect(makePassport(run).transfer).toMatchObject({ firstCorrect: false, solved: true, attempts: 2 });
  });
  it("снимки указывают на существующие строки канонического примера", () => {
    const lines = lessonExample(id).code.trimEnd().split("\n");
    expect(lessons[id].steps).toHaveLength(3);
    for (const step of lessons[id].steps) {
      expect(lines[step.line - 1]?.trim().length).toBeGreaterThan(0);
      expect(step.choices[step.answer]).toBeTruthy();
    }
  });
});

it("отвергает повреждённое хранилище и паспорт без пройденных этапов", () => {
  const fresh = createInvestigation("index", "practice", false, "id", 0);
  for (const raw of [null, "{bad", JSON.stringify({ ...fresh, stage: "passport" }), JSON.stringify({ ...fresh, predictions: [99] }), JSON.stringify({ ...fresh, version: 2 })]) {
    expect(restoreInvestigation(raw, "index", "practice")).toBeNull();
  }
  expect(restoreInvestigation(JSON.stringify(fresh), "loop", "practice")).toBeNull();
  expect(restoreInvestigation(JSON.stringify(fresh), "index", "jury")).toBeNull();
});
it("пилот экспортируется только добровольно после завершения и без свободных текстов", () => {
  const regular = complete(untilTransfer("index"));
  expect(makePilotRecord(regular)).toBeNull();
  expect(makePilotRecord({ ...regular, mode: "pilot", consent: false })).toBeNull();
  expect(makePilotRecord({ ...regular, mode: "pilot", consent: true, stage: "transfer" })).toBeNull();
  const pilot = makePilotRecord({ ...regular, mode: "pilot", consent: true });
  expect(pilot).toMatchObject({ consent: true, baselineFirstCorrect: false, transferFirstCorrect: true });
  for (const text of [regular.hypothesis, regular.explanation, regular.conclusion, regular.transferReason]) expect(JSON.stringify(pilot)).not.toContain(text);
});
it("пустые объяснения и недопустимые варианты не продвигают пользователя", () => {
  const run = createInvestigation("index", "practice", false, "id", 0);
  expect(advanceInvestigation(run, { type: "hypothesis", text: " " })).toBe(run);
  expect(advanceInvestigation(run, { type: "baseline", answer: 99 })).toBe(run);
  expect(advanceInvestigation(run, { type: "hypothesis", text: "Без исходного ответа перейти нельзя." })).toBe(run);
  const transfer = untilTransfer("index");
  expect(advanceInvestigation(transfer, { type: "transfer", answer: lessons.index.transfer.answer, reason: " ", now: 2000 })).toBe(transfer);
});
