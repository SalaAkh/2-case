"use client";
import { useI18n, LanguageSwitcher } from "@/components/locale-provider";

import { LocalizedLink as Link } from "./locale-provider";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Asterisk, Check, CheckCheck, ChevronDown, ChevronRight, Download, FileText, FlaskConical, GraduationCap, Lightbulb, Moon, Printer, RotateCcw, ShieldCheck, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { advanceInvestigation, createInvestigation, lessonExample, lessonIds, getLessons, makePassport, makePilotRecord, restoreInvestigation, roleProgress, stageLabels, stages, STUDY_KEY, type Investigation, type InvestigationAction, type LessonId, type StudyMode } from "@/lib/investigation";
import { localize, translateAuthored } from "@/lib/i18n";
import "./investigation-lab.css";

const modeLabels = { practice: "Самостоятельная практика", jury: "Демонстрация для жюри", pilot: "Добровольный пилот" };
const keyFor = (id: LessonId, mode: StudyMode) => `${STUDY_KEY}.${mode}.${id}`;
const enough = (text: string) => text.trim().length >= 10;

function CodeCard({ code, line, caption }: { code: string; line?: number; caption: string }) {
  const { t } = useI18n();

  return <div className="lab-code"><div className="lab-code-caption"><FileText size={14} /><span>{caption}</span><span>READ ONLY</span></div><pre aria-label={caption}>{code.trimEnd().split("\n").map((text, index) => <span className={cn("lab-code-line", line === index + 1 && "lab-code-current")} key={index}><span aria-hidden="true">{index + 1}</span><code>{text || " "}</code>{line === index + 1 && <span className="sr-only"> {t("— текущая строка")}</span>}</span>)}</pre></div>;
}
function Choices({ title, options, value, onChange, disabled = false }: { title: string; options: string[]; value: number | null; onChange: (value: number) => void; disabled?: boolean }) {
  return <fieldset className="lab-choices" disabled={disabled}><legend>{title}</legend>{options.map((option, index) => <label className={cn(value === index && "lab-choice-selected")} key={option}><input type="radio" name="lab-answer" checked={value === index} onChange={() => onChange(index)} /><span className="lab-choice-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span>{option}</span></label>)}</fieldset>;
}
function TextField({ label, value, onChange, placeholder, max = 1000 }: { label: string; value: string; onChange: (text: string) => void; placeholder: string; max?: number }) {
  const { t } = useI18n();

  return <label className="lab-text-field"><span>{label}</span><textarea aria-label={label} value={value} onChange={event => onChange(event.target.value)} maxLength={max} rows={3} placeholder={placeholder} /><small>{t("Запишите свою мысль: от 10 символов ·")}{" "}{value.length}/{max}</small></label>;
}
function Feedback({ children, positive = false }: { children: ReactNode; positive?: boolean }) {
  return <div className={cn("lab-feedback", positive && "lab-feedback-positive")} role="status">{positive ? <CheckCheck size={17} /> : <Lightbulb size={17} />}<div>{children}</div></div>;
}
function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function InvestigationLab() {
  const { t, locale } = useI18n();
  const lessons = getLessons(locale);

  const params = useSearchParams();
  const query = new URLSearchParams({ mode: params.get("mode") ?? "practice", case: params.get("case") ?? "index" }).toString();
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<StudyMode>("practice");
  const [lessonId, setLessonId] = useState<LessonId>("index");
  const [run, setRun] = useState<Investigation | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [draft, setDraft] = useState({ hypothesis: "", explanation: "", conclusion: "", reason: "" });
  const [consent, setConsent] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const focusTarget = useRef<HTMLHeadingElement>(null);
  const lesson = lessons[lessonId];
  const example = lessonExample(lessonId, locale);
  const phase = run ? stages.indexOf(run.stage) : -1;
  const roleIndex = run ? roleProgress(run) : 0;

  useEffect(() => {
    // Browser storage and URL state must be read after the deterministic server render.
    /* eslint-disable react-hooks/set-state-in-effect */
    const params = new URLSearchParams(query);
    const requestedMode = params.get("mode");
    const nextMode: StudyMode = requestedMode === "jury" || requestedMode === "pilot" ? requestedMode : "practice";
    const requestedCase = params.get("case");
    const id = lessonIds.find(id => id === requestedCase) ?? "index";
    setMode(nextMode); setLessonId(id); setRun(null); setChoice(null); setConsent(false); setNotice("");
    setDraft({ hypothesis: "", explanation: "", conclusion: "", reason: "" });
    try {
      const saved = restoreInvestigation(localStorage.getItem(keyFor(id, nextMode)), id, nextMode);
      setRun(saved);
      setDraft({ hypothesis: saved?.hypothesis ?? "", explanation: saved?.explanation ?? "", conclusion: saved?.conclusion ?? "", reason: saved?.transferReason ?? "" });
      const storedTheme = localStorage.getItem(`${STUDY_KEY}.theme`);
      if (storedTheme === "light") setTheme("light");
    } catch { setStorageError(true); }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [query]);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(`${STUDY_KEY}.theme`, theme);
      if (run) localStorage.setItem(keyFor(run.lessonId, run.mode), JSON.stringify(run));
    } catch { queueMicrotask(() => setStorageError(true)); }
  }, [ready, run, theme]);
  useEffect(() => { focusTarget.current?.focus(); }, [ready, run?.stage, run?.traceCursor, run?.baseline]);

  function selectLesson(id: LessonId) {
    let saved: Investigation | null = null;
    try { saved = restoreInvestigation(localStorage.getItem(keyFor(id, mode)), id, mode); }
    catch { setStorageError(true); }
    setLessonId(id); setRun(saved); setChoice(null); setNotice("");
    setDraft({ hypothesis: saved?.hypothesis ?? "", explanation: saved?.explanation ?? "", conclusion: saved?.conclusion ?? "", reason: saved?.transferReason ?? "" });
    window.history.replaceState(null, "", `/investigation?mode=${mode}&case=${id}&lang=${locale}`);
  }
  function start() {
    if (mode === "pilot" && !consent) return;
    setRun(createInvestigation(lessonId, mode, consent, crypto.randomUUID(), Date.now()));
  }
  function submit(action: InvestigationAction) {
    if (!run) return;
    const next = advanceInvestigation(run, action);
    if (next !== run) { setRun(next); setChoice(null); setNotice(""); }
  }
  function restart() {
    if (!window.confirm(t("Начать новую попытку этого сценария? Текущую сначала можно сохранить из паспорта. Попытки других сценариев останутся."))) return;
    try { localStorage.removeItem(keyFor(lessonId, mode)); } catch { setStorageError(true); }
    setRun(null); setChoice(null); setDraft({ hypothesis: "", explanation: "", conclusion: "", reason: "" }); setConsent(false); setNotice("");
  }
  function exportFile(pilot = false) {
    if (!run) return;
    try {
      const data = pilot ? localize(makePilotRecord(run), locale) : makePassport(run, locale);
      if (!data) return;
      downloadJson(`zero-spoiler-${pilot ? "pilot" : "passport"}-${lessonId}-${run.id.slice(0, 8)}.json`, data);
      setNotice(pilot ? t("Выгружены только ответы и счётчики. Свободный текст в пилот не включён.") : t("Паспорт сохранён. Файл содержит ваши собственные объяснения."));
    } catch { setNotice(t("Не удалось скачать файл. Используйте «Сохранить PDF» или разрешите скачивания в браузере.")); }
  }

  return <div className={cn("lab-page", run && "lab-active-session", mode === "jury" && "lab-jury-mode")}>
    <a className="skip-link" href="#lab-content">{t("К учебному пути")}</a>
    <header className="lab-header"><Link href="/" className="lab-brand"><span className="brand-mark"><ArrowUpRight size={23} strokeWidth={2.5} /></span><span>tomorrow<span className="lab-brand-dot">.</span><small>SCHOOL / ZERO-SPOILER</small></span></Link><nav aria-label={t("Разделы")}><LanguageSwitcher /><Link href="/" className="lab-back"><ArrowLeft size={15} />{t("Свободный разбор")}</Link><Link href="/pilot">{t("Для преподавателя")}</Link><button className="lab-theme" aria-label={theme === "dark" ? t("Включить светлую тему") : t("Включить тёмную тему")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button></nav></header>
    <main id="lab-content" className="lab-main">
      <div className="lab-page-intro"><div><div className="eyebrow"><span />LEARNING BY EXPLAINING</div><h1>{t("От догадки")}<br /><span>{t("к пониманию.")}</span></h1><p>{t("Исследуйте код. Объясните открытие новичку.")}<br />{t("Примените его в новой ситуации.")}</p></div><div className="lab-mode"><FlaskConical size={18} /><span>{t(modeLabels[mode])}<small>{t("Три сценария · без API-ключа")}</small></span></div></div>
      {mode === "jury" && !run && <div className="lab-jury"><span className="lab-jury-time">{t("≈ 2 МИН")}</span><p>{t("Пройдите путь от первой догадки до объяснения новичку. В конце — новая задача и паспорт понимания. Темп — ваш.")}</p><Link href="/investigation?mode=practice">{t("Обычная практика")}<ArrowRight size={14} /></Link></div>}
      {mode === "pilot" && <div className="lab-jury"><ShieldCheck size={20} /><p>{t("Участие добровольное. Ответы остаются в этом браузере. Передать организатору можно только файл, который вы сами скачаете в конце. Имя и email не запрашиваются.")}</p><Link href="/pilot">{t("Протокол пилота")}<ArrowRight size={14} /></Link></div>}
      <div className="lab-case-tabs" aria-label={t("Учебные сценарии")}>{lessonIds.map((id, index) => <button aria-pressed={lessonId === id} className={cn(lessonId === id && "lab-case-active")} key={id} disabled={!ready} onClick={() => selectLesson(id)}><span>0{index + 1}</span><span>{lessonExample(id, locale).title}<small>{lessons[id].concept}</small></span><ChevronRight size={16} /></button>)}</div>
      {(run || mode === "jury") && <label className="lab-case-select">{t("Сценарий")}<select value={lessonId} onChange={event => selectLesson(event.target.value as LessonId)}>{lessonIds.map(id => <option value={id} key={id}>{lessonExample(id, locale).title}</option>)}</select></label>}
      {!ready ? <div className="lab-loading" role="status">{t("Восстанавливаем учебный путь…")}</div> : !run ? <section className="lab-launch">
        <div><span className="lab-section-kicker">{t("РАССЛЕДОВАНИЕ /")}{" "}{lesson.concept}</span><h2>{t("Сначала исследователь.")}<br /><span>{t("Потом — наставник.")}</span></h2><p>{t("Предскажите поведение программы до проверки. Найдите объяснение, которое сможете передать другому человеку.")}</p><ol className="lab-launch-path"><li><span>01</span>{t("Ваша гипотеза и вопрос до практики")}</li><li><span>02</span>{t("Три прогноза и пошаговые наблюдения")}</li><li><span>03</span>{t("Вы объясняете — новичок уточняет")}</li><li><span>04</span>{t("Новая задача и паспорт понимания")}</li></ol>
          {mode === "pilot" && <label className="lab-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>{t("Я добровольно участвую в пилоте. Решение о передаче обезличенного файла приму после прохождения.")}</span></label>}
          <Button className="lab-primary" disabled={mode === "pilot" && !consent} onClick={start}>{t("Начать расследование")}<ArrowRight size={17} /></Button><small className="lab-save-note">{t("Завершённые шаги сохраняются на этом устройстве. Введённый текст фиксируется при отправке шага.")}</small>
        </div><div className="lab-launch-art"><div className="lab-art-grid" /><Asterisk size={145} strokeWidth={1} /><span>THINK → TEST → TEACH</span><p>{t("Сможете объяснить?")}<br /><strong>{t("Значит, можно проверить.")}</strong></p></div>
      </section> : <>
        <ol className="lab-stepper" aria-label={t("Этапы расследования")}>{stageLabels.map((label, index) => <li className={cn(index < phase && "lab-step-done", index === phase && "lab-step-current")} aria-current={index === phase ? "step" : undefined} key={label}><span>{index < phase ? <Check size={14} /> : `0${index + 1}`}</span>{t(label)}</li>)}</ol>
        {run.stage === "hypothesis" && run.baseline === null && <section className="lab-stage lab-two-columns">
          <div><span className="lab-section-kicker">{t("01 / ПЕРЕД ИССЛЕДОВАНИЕМ")}</span><h2 tabIndex={-1} ref={focusTarget}>{t("С чего начинаем?")}</h2><p className="lab-description">{t("Короткий независимый вопрос до просмотра разбираемой ошибки. Зафиксируем первый ответ; проверку покажем в паспорте.")}</p><CodeCard code={lesson.baseline.code} caption={t("Вопрос до практики")} /></div>
          <div className="lab-task-card"><Choices title={lesson.baseline.prompt} options={lesson.baseline.choices} value={choice} onChange={setChoice} /><Button className="lab-primary" disabled={choice === null} onClick={() => { if (choice !== null) submit({ type: "baseline", answer: choice }); }}>{t("Зафиксировать первый ответ")}<ArrowRight size={17} /></Button><small>{t("Можно предположить ответ. Здесь важна исходная мысль, а не оценка.")}</small></div>
        </section>}
        {run.stage === "hypothesis" && run.baseline !== null && <section className="lab-stage lab-two-columns"><div><div className="lab-section-kicker">{t("01 / СФОРМУЛИРУЙТЕ ДОГАДКУ")}</div><h2 tabIndex={-1} ref={focusTarget}>{t("Что здесь происходит?")}</h2><p className="lab-description">{example.problem}</p><CodeCard code={example.code} caption={example.language === "python" ? t("main.py · исходный пример") : t("main.js · исходный пример")} /><div className="lab-authored"><ShieldCheck size={14} />{t("Учебный сценарий: показываем подготовленные наблюдения. Произвольный код здесь не выполняется.")}</div></div><form className="lab-task-card" onSubmit={event => { event.preventDefault(); submit({ type: "hypothesis", text: draft.hypothesis }); }}><Feedback positive>{t("Первый ответ зафиксирован. Теперь сформулируйте свою гипотезу по основному примеру.")}</Feedback><TextField label={t("Моя гипотеза")} value={draft.hypothesis} onChange={hypothesis => setDraft({ ...draft, hypothesis })} placeholder={t("Я предполагаю, что ошибка связана с… Проверить это можно, если…")} /><Button className="lab-primary" type="submit" disabled={!enough(draft.hypothesis)}>{t("Зафиксировать и проверить")}<ArrowRight size={17} /></Button><small>{t("Гипотеза не обязана быть верной. Важно, что вы сможете её проверить.")}</small></form></section>}
        {run.stage === "trace" && (() => {
          const step = lesson.steps[run.traceCursor];
          const revealed = run.predictions.length > run.traceCursor;
          const answer = run.predictions[run.traceCursor];
          return <section className="lab-stage lab-two-columns"><div><span className="lab-section-kicker">{t("02 / НАБЛЮДЕНИЕ")}{" "}{run.traceCursor + 1} {t("ИЗ")}{" "}{lesson.steps.length}</span><h2 tabIndex={-1} ref={focusTarget}>{step.title}</h2><CodeCard code={example.code} line={step.line} caption={t("Ключевой шаг программы")} /><div className="lab-snapshot"><h3>{t("Состояние программы")}</h3>{revealed ? <><dl>{step.variables.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><h4>{t("Вывод")}</h4><pre>{step.output}</pre></> : <p>{t("Сначала сделайте прогноз. После него здесь появятся значения переменных и вывод.")}</p>}</div></div><div className="lab-task-card"><span className="lab-section-kicker">{t("ПРЕДСКАЖИТЕ → НАБЛЮДАЙТЕ")}</span><Choices title={step.prompt} options={step.choices} value={revealed ? answer : choice} onChange={setChoice} disabled={revealed} />{!revealed ? <Button className="lab-primary" disabled={choice === null} onClick={() => { if (choice !== null) submit({ type: "predict", answer: choice }); }}>{t("Зафиксировать прогноз")}<FlaskConical size={17} /></Button> : <><Feedback positive={answer === step.answer}><strong>{answer === step.answer ? t("Прогноз совпал с наблюдением.") : t("Прогноз и наблюдение различаются.")}</strong><p>{step.observation}</p></Feedback><p className="lab-microcopy">{t("Ваш первый прогноз сохранён. Расхождение — полезное свидетельство, а не штраф.")}</p><Button className="lab-primary" onClick={() => submit({ type: "next-step" })}>{run.traceCursor === lesson.steps.length - 1 ? t("Теперь я — наставник") : t("Следующее наблюдение")}<ArrowRight size={17} /></Button></>}<blockquote className="lab-hypothesis"><span>{t("ВАША ГИПОТЕЗА")}</span>{run.hypothesis}</blockquote></div></section>;
        })()}
        {run.stage === "teach" && <section className="lab-stage lab-two-columns"><div><span className="lab-section-kicker">{t("03 / ТЕПЕРЬ ВЫ — НАСТАВНИК")}</span><h2 tabIndex={-1} ref={focusTarget}>{t("Поймайте ошибку")}<br /><span>{t("в рассуждении.")}</span></h2><p className="lab-description">{t("Объясните наблюдение так, чтобы другой человек смог применить его самостоятельно.")}</p><div className="lab-novice"><span className="lab-novice-avatar"><GraduationCap size={26} /></span><div><span className="lab-section-kicker">{t("ВИРТУАЛЬНЫЙ НОВИЧОК")}</span><blockquote>«{lesson.misconception}»</blockquote></div></div><p className="lab-authored"><ShieldCheck size={14} />{t("Это подготовленная учебная роль с намеренной ошибкой. Ответы не генерируются ИИ.")}</p><details className="lab-evidence"><summary>{t("Ваши наблюдения")}<span>{t("3 шага")}</span><ChevronDown size={16} /></summary>{run.predictions.map((answer, index) => <p key={index}><span>0{index + 1}</span>{lesson.steps[index].observation}<small>{answer === lesson.steps[index].answer ? t("Прогноз совпал") : t("Прогноз отличался")}</small></p>)}</details></div><div className="lab-task-card">{roleIndex < 2 ? <><TextField label={t("Моё объяснение новичку")} value={draft.explanation} onChange={explanation => setDraft({ ...draft, explanation })} placeholder={t("В твоём рассуждении есть предположение… Наш эксперимент показал… Проверь на примере…")} max={1500} /><span className="lab-section-kicker">{t("УТОЧНЕНИЕ НОВИЧКА")}{" "}{roleIndex + 1} / 2</span><Choices title={lesson.roleChecks[roleIndex].prompt} options={lesson.roleChecks[roleIndex].choices} value={choice} onChange={setChoice} />{run.roleAnswers[roleIndex].length > 0 && <Feedback>{lesson.roleChecks[roleIndex].nudge}</Feedback>}<Button className="lab-primary" disabled={!enough(draft.explanation) || choice === null || run.roleAnswers[roleIndex].length >= 20} onClick={() => { if (choice !== null) submit({ type: "teach", text: draft.explanation, answer: choice }); }}>{t("Ответить новичку")}<ArrowRight size={17} /></Button>{roleIndex === 1 && <p className="lab-microcopy">{t("Первый контрольный вопрос пройден. Проверим правило на другом значении.")}</p>}{run.roleAnswers[roleIndex].length >= 20 && <Feedback>{t("Достигнут предел 20 попыток. Перечитайте наблюдения и начните новую попытку кнопкой внизу.")}</Feedback>}</> : <><Feedback positive>{t("Оба контрольных вопроса пройдены. Ваше свободное объяснение сохранено для самостоятельного обсуждения с преподавателем; автоматической оценки текста нет.")}</Feedback><TextField label={t("Моё открытие")} value={draft.conclusion} onChange={conclusion => setDraft({ ...draft, conclusion })} placeholder={t("Сначала я думал… Теперь я могу объяснить, почему…")} /><Button className="lab-primary" disabled={!enough(draft.conclusion)} onClick={() => submit({ type: "conclude", text: draft.conclusion })}>{t("Проверить на новой задаче")}<ArrowRight size={17} /></Button></>}</div></section>}
        {run.stage === "transfer" && <section className="lab-stage lab-two-columns"><div><span className="lab-section-kicker">{t("04 / ПРИМЕНИТЕ ОТКРЫТИЕ")}</span><h2 tabIndex={-1} ref={focusTarget}>{t("Новый код.")}<br /><span>{t("Знакомый принцип.")}</span></h2><p className="lab-description">{t("Проверьте правило в другой ситуации. Первый ответ сохранится, даже если понадобятся повторные попытки.")}</p><CodeCard code={lesson.transfer.code} caption={t("Задача на перенос понимания")} /><blockquote className="lab-hypothesis"><span>{t("ВАШЕ ОТКРЫТИЕ")}</span>{run.conclusion}</blockquote></div><div className="lab-task-card"><Choices title={lesson.transfer.prompt} options={lesson.transfer.choices} value={choice} onChange={setChoice} /><TextField label={t("Почему я так думаю")} value={draft.reason} onChange={reason => setDraft({ ...draft, reason })} placeholder={t("Я применяю правило… В этом примере… Поэтому результат…")} />{run.transferAnswers.length > 0 && <Feedback>{lesson.transfer.nudge}<p>{t("Попыток:")}{" "}{run.transferAnswers.length}{t(". Первая уже зафиксирована.")}</p></Feedback>}<Button className="lab-primary" disabled={choice === null || !enough(draft.reason) || run.transferAnswers.length >= 20} onClick={() => { if (choice !== null) submit({ type: "transfer", answer: choice, reason: draft.reason, now: Date.now() }); }}>{t("Проверить перенос")}<ArrowRight size={17} /></Button>{run.transferAnswers.length >= 20 && <Feedback>{t("Достигнут предел 20 попыток. Можно начать новое расследование кнопкой внизу.")}</Feedback>}</div></section>}
        {run.stage === "passport" && <section className="lab-passport" aria-label={t("Паспорт понимания")}>
          <div className="lab-passport-head"><div><span className="lab-section-kicker">{t("05 / КАРТА ВАШЕГО ОТКРЫТИЯ")}</span><h2 tabIndex={-1} ref={focusTarget}>{t("Вы исследовали.")}<br /><span>{t("Вы объяснили.")}</span></h2><p>{lesson.concept} · {example.title}</p></div><div className="lab-passport-seal"><CheckCheck size={36} /><span>{t("УЧЕБНЫЙ ПУТЬ")}<br />{t("ЗАВЕРШЁН")}</span></div></div>
          <div className="lab-passport-story">{[["01", t("Я предполагал"), run.hypothesis], ["02", t("Я проверил"), lesson.steps.map((step, i) => `${i + 1}. ${step.observation}`).join("\n")], ["03", t("Я объяснил новичку"), run.explanation], ["04", t("Моё открытие"), run.conclusion], ["05", t("Я применил"), run.transferReason]].map(([number, title, text]) => <div key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div>
          <div className="lab-results"><div><span>{t("До практики")}</span><strong>{run.baseline === lesson.baseline.answer ? t("Верный ответ") : t("Ответ отличался")}</strong><small>{t("Ваш выбор:")}{" "}{lesson.baseline.choices[run.baseline!]}<br />{t("По условию:")}{" "}{lesson.baseline.choices[lesson.baseline.answer]}</small></div><div><span>{t("Прогнозы")}</span><strong>{run.predictions.filter((answer, i) => answer === lesson.steps[i].answer).length} {t("/ 3 совпали")}</strong><small>{t("Зафиксированы до наблюдений")}</small></div><div><span>{t("Новая задача")}</span><strong>{run.transferAnswers.length === 1 ? t("С первой попытки") : t("Попыток: {0}", {"0": run.transferAnswers.length})}</strong><small>{t("Первый ответ:")}{" "}{run.transferAnswers[0] === lesson.transfer.answer ? t("верный") : t("отличался от результата")}</small></div></div>
          <p className="lab-passport-disclaimer">{t("Это карта ваших рассуждений и результатов учебных вопросов, а не сертификат освоения навыка. Свободные объяснения не оценивались ИИ. До и после заданы разные вопросы; один проход не доказывает эффект обучения.")}</p>
          <div className="lab-passport-actions"><Button onClick={() => window.print()}><Printer size={16} />{t("Сохранить PDF")}</Button><Button variant="outline" onClick={() => exportFile()}><Download size={16} />{t("Паспорт JSON")}</Button>{mode === "pilot" && run.consent && <Button variant="outline" onClick={() => exportFile(true)}><FlaskConical size={16} />{t("Выгрузить данные пилота")}</Button>}<Button variant="ghost" onClick={() => selectLesson(lessonIds[(lessonIds.indexOf(lessonId) + 1) % lessonIds.length])}>{t("Следующий сценарий")}<ArrowRight size={16} /></Button></div>
          {mode === "pilot" && <p className="lab-microcopy">{t("В файл пилота попадут только случайный номер попытки, ответы, число попыток и длительность с учётом пауз. Ваш свободный текст не включается. Передайте файл организатору только по собственному решению.")}</p>}
        </section>}
        <div className="lab-session-footer"><span><ShieldCheck size={14} />{storageError ? t("Хранение недоступно: сохраните паспорт перед закрытием") : t("Завершённые шаги хранятся в этом браузере")}</span><button onClick={restart}><RotateCcw size={14} />{t("Начать заново")}</button></div>
      </>}
      {storageError && <Feedback>{t("Браузер не разрешает сохранять прогресс. До закрытия страницы можно продолжить, затем скачать паспорт или сохранить PDF.")}</Feedback>}
      {notice && <p className="lab-notice" role="status">{translateAuthored(locale, notice)}</p>}
      <footer className="lab-footer"><span>TOMORROW SCHOOL / THINK. TEST. TEACH.</span><div><Link href="/investigation?mode=jury">{t("Демо для жюри")}</Link><Link href="/pilot">{t("Пилот и методика")}</Link><Link href="/">{t("Свободный разбор")}</Link></div></footer>
    </main>
  </div>;
}
