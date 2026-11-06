"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Asterisk, Check, CheckCheck, ChevronDown, ChevronRight, Download, FileText, FlaskConical, GraduationCap, Lightbulb, Moon, Printer, RotateCcw, ShieldCheck, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { advanceInvestigation, createInvestigation, lessonExample, lessonIds, lessons, makePassport, makePilotRecord, restoreInvestigation, roleProgress, stageLabels, stages, STUDY_KEY, type Investigation, type InvestigationAction, type LessonId, type StudyMode } from "@/lib/investigation";
import "./investigation-lab.css";

const modeLabels = { practice: "Самостоятельная практика", jury: "Демонстрация для жюри", pilot: "Добровольный пилот" };
const keyFor = (id: LessonId, mode: StudyMode) => `${STUDY_KEY}.${mode}.${id}`;
const enough = (text: string) => text.trim().length >= 10;

function CodeCard({ code, line, caption }: { code: string; line?: number; caption: string }) {
  return <div className="lab-code"><div className="lab-code-caption"><FileText size={14} /><span>{caption}</span><span>READ ONLY</span></div><pre aria-label={caption}>{code.trimEnd().split("\n").map((text, index) => <span className={cn("lab-code-line", line === index + 1 && "lab-code-current")} key={index}><span aria-hidden="true">{index + 1}</span><code>{text || " "}</code>{line === index + 1 && <span className="sr-only"> — текущая строка</span>}</span>)}</pre></div>;
}
function Choices({ title, options, value, onChange, disabled = false }: { title: string; options: string[]; value: number | null; onChange: (value: number) => void; disabled?: boolean }) {
  return <fieldset className="lab-choices" disabled={disabled}><legend>{title}</legend>{options.map((option, index) => <label className={cn(value === index && "lab-choice-selected")} key={option}><input type="radio" name="lab-answer" checked={value === index} onChange={() => onChange(index)} /><span className="lab-choice-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span>{option}</span></label>)}</fieldset>;
}
function TextField({ label, value, onChange, placeholder, max = 1000 }: { label: string; value: string; onChange: (text: string) => void; placeholder: string; max?: number }) {
  return <label className="lab-text-field"><span>{label}</span><textarea aria-label={label} value={value} onChange={event => onChange(event.target.value)} maxLength={max} rows={3} placeholder={placeholder} /><small>Запишите свою мысль: от 10 символов · {value.length}/{max}</small></label>;
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
  const query = useSearchParams().toString();
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
  const example = lessonExample(lessonId);
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
    window.history.replaceState(null, "", `/investigation?mode=${mode}&case=${id}`);
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
    if (!window.confirm("Начать новую попытку этого сценария? Текущую сначала можно сохранить из паспорта. Попытки других сценариев останутся.")) return;
    try { localStorage.removeItem(keyFor(lessonId, mode)); } catch { setStorageError(true); }
    setRun(null); setChoice(null); setDraft({ hypothesis: "", explanation: "", conclusion: "", reason: "" }); setConsent(false); setNotice("");
  }
  function exportFile(pilot = false) {
    if (!run) return;
    try {
      const data = pilot ? makePilotRecord(run) : makePassport(run);
      if (!data) return;
      downloadJson(`zero-spoiler-${pilot ? "pilot" : "passport"}-${lessonId}-${run.id.slice(0, 8)}.json`, data);
      setNotice(pilot ? "Выгружены только ответы и счётчики. Свободный текст в пилот не включён." : "Паспорт сохранён. Файл содержит ваши собственные объяснения.");
    } catch { setNotice("Не удалось скачать файл. Используйте «Сохранить PDF» или разрешите скачивания в браузере."); }
  }

  return <div className={cn("lab-page", run && "lab-active-session", mode === "jury" && "lab-jury-mode")}>
    <a className="skip-link" href="#lab-content">К учебному пути</a>
    <header className="lab-header"><Link href="/" className="lab-brand"><span className="brand-mark"><ArrowUpRight size={23} strokeWidth={2.5} /></span><span>tomorrow<span className="lab-brand-dot">.</span><small>SCHOOL / ZERO-SPOILER</small></span></Link><nav aria-label="Разделы"><Link href="/" className="lab-back"><ArrowLeft size={15} />Свободный разбор</Link><Link href="/pilot">Для преподавателя</Link><button className="lab-theme" aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button></nav></header>
    <main id="lab-content" className="lab-main">
      <div className="lab-page-intro"><div><div className="eyebrow"><span />LEARNING BY EXPLAINING</div><h1>От догадки<br /><span>к пониманию.</span></h1><p>Исследуйте код. Объясните открытие новичку.<br />Примените его в новой ситуации.</p></div><div className="lab-mode"><FlaskConical size={18} /><span>{modeLabels[mode]}<small>Три сценария · без API-ключа</small></span></div></div>
      {mode === "jury" && !run && <div className="lab-jury"><span className="lab-jury-time">≈ 2 МИН</span><p>Пройдите путь от первой догадки до объяснения новичку. В конце — новая задача и паспорт понимания. Темп — ваш.</p><Link href="/investigation?mode=practice">Обычная практика<ArrowRight size={14} /></Link></div>}
      {mode === "pilot" && <div className="lab-jury"><ShieldCheck size={20} /><p>Участие добровольное. Ответы остаются в этом браузере. Передать организатору можно только файл, который вы сами скачаете в конце. Имя и email не запрашиваются.</p><Link href="/pilot">Протокол пилота<ArrowRight size={14} /></Link></div>}
      <div className="lab-case-tabs" aria-label="Учебные сценарии">{lessonIds.map((id, index) => <button aria-pressed={lessonId === id} className={cn(lessonId === id && "lab-case-active")} key={id} disabled={!ready} onClick={() => selectLesson(id)}><span>0{index + 1}</span><span>{lessonExample(id).title}<small>{lessons[id].concept}</small></span><ChevronRight size={16} /></button>)}</div>
      {(run || mode === "jury") && <label className="lab-case-select">Сценарий<select value={lessonId} onChange={event => selectLesson(event.target.value as LessonId)}>{lessonIds.map(id => <option value={id} key={id}>{lessonExample(id).title}</option>)}</select></label>}
      {!ready ? <div className="lab-loading" role="status">Восстанавливаем учебный путь…</div> : !run ? <section className="lab-launch">
        <div><span className="lab-section-kicker">РАССЛЕДОВАНИЕ / {lesson.concept}</span><h2>Сначала исследователь.<br /><span>Потом — наставник.</span></h2><p>Предскажите поведение программы до проверки. Найдите объяснение, которое сможете передать другому человеку.</p><ol className="lab-launch-path"><li><span>01</span>Ваша гипотеза и вопрос до практики</li><li><span>02</span>Три прогноза и пошаговые наблюдения</li><li><span>03</span>Вы объясняете — новичок уточняет</li><li><span>04</span>Новая задача и паспорт понимания</li></ol>
          {mode === "pilot" && <label className="lab-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>Я добровольно участвую в пилоте. Решение о передаче обезличенного файла приму после прохождения.</span></label>}
          <Button className="lab-primary" disabled={mode === "pilot" && !consent} onClick={start}>Начать расследование<ArrowRight size={17} /></Button><small className="lab-save-note">Завершённые шаги сохраняются на этом устройстве. Введённый текст фиксируется при отправке шага.</small>
        </div><div className="lab-launch-art"><div className="lab-art-grid" /><Asterisk size={145} strokeWidth={1} /><span>THINK → TEST → TEACH</span><p>Сможете объяснить?<br /><strong>Значит, можно проверить.</strong></p></div>
      </section> : <>
        <ol className="lab-stepper" aria-label="Этапы расследования">{stageLabels.map((label, index) => <li className={cn(index < phase && "lab-step-done", index === phase && "lab-step-current")} aria-current={index === phase ? "step" : undefined} key={label}><span>{index < phase ? <Check size={14} /> : `0${index + 1}`}</span>{label}</li>)}</ol>
        {run.stage === "hypothesis" && run.baseline === null && <section className="lab-stage lab-two-columns">
          <div><span className="lab-section-kicker">01 / ПЕРЕД ИССЛЕДОВАНИЕМ</span><h2 tabIndex={-1} ref={focusTarget}>С чего начинаем?</h2><p className="lab-description">Короткий независимый вопрос до просмотра разбираемой ошибки. Зафиксируем первый ответ; проверку покажем в паспорте.</p><CodeCard code={lesson.baseline.code} caption="Вопрос до практики" /></div>
          <div className="lab-task-card"><Choices title={lesson.baseline.prompt} options={lesson.baseline.choices} value={choice} onChange={setChoice} /><Button className="lab-primary" disabled={choice === null} onClick={() => { if (choice !== null) submit({ type: "baseline", answer: choice }); }}>Зафиксировать первый ответ<ArrowRight size={17} /></Button><small>Можно предположить ответ. Здесь важна исходная мысль, а не оценка.</small></div>
        </section>}
        {run.stage === "hypothesis" && run.baseline !== null && <section className="lab-stage lab-two-columns"><div><div className="lab-section-kicker">01 / СФОРМУЛИРУЙТЕ ДОГАДКУ</div><h2 tabIndex={-1} ref={focusTarget}>Что здесь происходит?</h2><p className="lab-description">{example.problem}</p><CodeCard code={example.code} caption={example.language === "python" ? "main.py · исходный пример" : "main.js · исходный пример"} /><div className="lab-authored"><ShieldCheck size={14} />Учебный сценарий: показываем подготовленные наблюдения. Произвольный код здесь не выполняется.</div></div><form className="lab-task-card" onSubmit={event => { event.preventDefault(); submit({ type: "hypothesis", text: draft.hypothesis }); }}><Feedback positive>Первый ответ зафиксирован. Теперь сформулируйте свою гипотезу по основному примеру.</Feedback><TextField label="Моя гипотеза" value={draft.hypothesis} onChange={hypothesis => setDraft({ ...draft, hypothesis })} placeholder="Я предполагаю, что ошибка связана с… Проверить это можно, если…" /><Button className="lab-primary" type="submit" disabled={!enough(draft.hypothesis)}>Зафиксировать и проверить<ArrowRight size={17} /></Button><small>Гипотеза не обязана быть верной. Важно, что вы сможете её проверить.</small></form></section>}
        {run.stage === "trace" && (() => {
          const step = lesson.steps[run.traceCursor];
          const revealed = run.predictions.length > run.traceCursor;
          const answer = run.predictions[run.traceCursor];
          return <section className="lab-stage lab-two-columns"><div><span className="lab-section-kicker">02 / НАБЛЮДЕНИЕ {run.traceCursor + 1} ИЗ {lesson.steps.length}</span><h2 tabIndex={-1} ref={focusTarget}>{step.title}</h2><CodeCard code={example.code} line={step.line} caption="Ключевой шаг программы" /><div className="lab-snapshot"><h3>Состояние программы</h3>{revealed ? <><dl>{step.variables.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><h4>Вывод</h4><pre>{step.output}</pre></> : <p>Сначала сделайте прогноз. После него здесь появятся значения переменных и вывод.</p>}</div></div><div className="lab-task-card"><span className="lab-section-kicker">ПРЕДСКАЖИТЕ → НАБЛЮДАЙТЕ</span><Choices title={step.prompt} options={step.choices} value={revealed ? answer : choice} onChange={setChoice} disabled={revealed} />{!revealed ? <Button className="lab-primary" disabled={choice === null} onClick={() => { if (choice !== null) submit({ type: "predict", answer: choice }); }}>Зафиксировать прогноз<FlaskConical size={17} /></Button> : <><Feedback positive={answer === step.answer}><strong>{answer === step.answer ? "Прогноз совпал с наблюдением." : "Прогноз и наблюдение различаются."}</strong><p>{step.observation}</p></Feedback><p className="lab-microcopy">Ваш первый прогноз сохранён. Расхождение — полезное свидетельство, а не штраф.</p><Button className="lab-primary" onClick={() => submit({ type: "next-step" })}>{run.traceCursor === lesson.steps.length - 1 ? "Теперь я — наставник" : "Следующее наблюдение"}<ArrowRight size={17} /></Button></>}<blockquote className="lab-hypothesis"><span>ВАША ГИПОТЕЗА</span>{run.hypothesis}</blockquote></div></section>;
        })()}
        {run.stage === "teach" && <section className="lab-stage lab-two-columns"><div><span className="lab-section-kicker">03 / ТЕПЕРЬ ВЫ — НАСТАВНИК</span><h2 tabIndex={-1} ref={focusTarget}>Поймайте ошибку<br /><span>в рассуждении.</span></h2><p className="lab-description">Объясните наблюдение так, чтобы другой человек смог применить его самостоятельно.</p><div className="lab-novice"><span className="lab-novice-avatar"><GraduationCap size={26} /></span><div><span className="lab-section-kicker">ВИРТУАЛЬНЫЙ НОВИЧОК</span><blockquote>«{lesson.misconception}»</blockquote></div></div><p className="lab-authored"><ShieldCheck size={14} />Это подготовленная учебная роль с намеренной ошибкой. Ответы не генерируются ИИ.</p><details className="lab-evidence"><summary>Ваши наблюдения<span>3 шага</span><ChevronDown size={16} /></summary>{run.predictions.map((answer, index) => <p key={index}><span>0{index + 1}</span>{lesson.steps[index].observation}<small>{answer === lesson.steps[index].answer ? "Прогноз совпал" : "Прогноз отличался"}</small></p>)}</details></div><div className="lab-task-card">{roleIndex < 2 ? <><TextField label="Моё объяснение новичку" value={draft.explanation} onChange={explanation => setDraft({ ...draft, explanation })} placeholder="В твоём рассуждении есть предположение… Наш эксперимент показал… Проверь на примере…" max={1500} /><span className="lab-section-kicker">УТОЧНЕНИЕ НОВИЧКА {roleIndex + 1} / 2</span><Choices title={lesson.roleChecks[roleIndex].prompt} options={lesson.roleChecks[roleIndex].choices} value={choice} onChange={setChoice} />{run.roleAnswers[roleIndex].length > 0 && <Feedback>{lesson.roleChecks[roleIndex].nudge}</Feedback>}<Button className="lab-primary" disabled={!enough(draft.explanation) || choice === null || run.roleAnswers[roleIndex].length >= 20} onClick={() => { if (choice !== null) submit({ type: "teach", text: draft.explanation, answer: choice }); }}>Ответить новичку<ArrowRight size={17} /></Button>{roleIndex === 1 && <p className="lab-microcopy">Первый контрольный вопрос пройден. Проверим правило на другом значении.</p>}{run.roleAnswers[roleIndex].length >= 20 && <Feedback>Достигнут предел 20 попыток. Перечитайте наблюдения и начните новую попытку кнопкой внизу.</Feedback>}</> : <><Feedback positive>Оба контрольных вопроса пройдены. Ваше свободное объяснение сохранено для самостоятельного обсуждения с преподавателем; автоматической оценки текста нет.</Feedback><TextField label="Моё открытие" value={draft.conclusion} onChange={conclusion => setDraft({ ...draft, conclusion })} placeholder="Сначала я думал… Теперь я могу объяснить, почему…" /><Button className="lab-primary" disabled={!enough(draft.conclusion)} onClick={() => submit({ type: "conclude", text: draft.conclusion })}>Проверить на новой задаче<ArrowRight size={17} /></Button></>}</div></section>}
        {run.stage === "transfer" && <section className="lab-stage lab-two-columns"><div><span className="lab-section-kicker">04 / ПРИМЕНИТЕ ОТКРЫТИЕ</span><h2 tabIndex={-1} ref={focusTarget}>Новый код.<br /><span>Знакомый принцип.</span></h2><p className="lab-description">Проверьте правило в другой ситуации. Первый ответ сохранится, даже если понадобятся повторные попытки.</p><CodeCard code={lesson.transfer.code} caption="Задача на перенос понимания" /><blockquote className="lab-hypothesis"><span>ВАШЕ ОТКРЫТИЕ</span>{run.conclusion}</blockquote></div><div className="lab-task-card"><Choices title={lesson.transfer.prompt} options={lesson.transfer.choices} value={choice} onChange={setChoice} /><TextField label="Почему я так думаю" value={draft.reason} onChange={reason => setDraft({ ...draft, reason })} placeholder="Я применяю правило… В этом примере… Поэтому результат…" />{run.transferAnswers.length > 0 && <Feedback>{lesson.transfer.nudge}<p>Попыток: {run.transferAnswers.length}. Первая уже зафиксирована.</p></Feedback>}<Button className="lab-primary" disabled={choice === null || !enough(draft.reason) || run.transferAnswers.length >= 20} onClick={() => { if (choice !== null) submit({ type: "transfer", answer: choice, reason: draft.reason, now: Date.now() }); }}>Проверить перенос<ArrowRight size={17} /></Button>{run.transferAnswers.length >= 20 && <Feedback>Достигнут предел 20 попыток. Можно начать новое расследование кнопкой внизу.</Feedback>}</div></section>}
        {run.stage === "passport" && <section className="lab-passport" aria-label="Паспорт понимания">
          <div className="lab-passport-head"><div><span className="lab-section-kicker">05 / КАРТА ВАШЕГО ОТКРЫТИЯ</span><h2 tabIndex={-1} ref={focusTarget}>Вы исследовали.<br /><span>Вы объяснили.</span></h2><p>{lesson.concept} · {example.title}</p></div><div className="lab-passport-seal"><CheckCheck size={36} /><span>УЧЕБНЫЙ ПУТЬ<br />ЗАВЕРШЁН</span></div></div>
          <div className="lab-passport-story">{[["01", "Я предполагал", run.hypothesis], ["02", "Я проверил", lesson.steps.map((step, i) => `${i + 1}. ${step.observation}`).join("\n")], ["03", "Я объяснил новичку", run.explanation], ["04", "Моё открытие", run.conclusion], ["05", "Я применил", run.transferReason]].map(([number, title, text]) => <div key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div>
          <div className="lab-results"><div><span>До практики</span><strong>{run.baseline === lesson.baseline.answer ? "Верный ответ" : "Ответ отличался"}</strong><small>Ваш выбор: {lesson.baseline.choices[run.baseline!]}<br />По условию: {lesson.baseline.choices[lesson.baseline.answer]}</small></div><div><span>Прогнозы</span><strong>{run.predictions.filter((answer, i) => answer === lesson.steps[i].answer).length} / 3 совпали</strong><small>Зафиксированы до наблюдений</small></div><div><span>Новая задача</span><strong>{run.transferAnswers.length === 1 ? "С первой попытки" : `Попыток: ${run.transferAnswers.length}`}</strong><small>Первый ответ: {run.transferAnswers[0] === lesson.transfer.answer ? "верный" : "отличался от результата"}</small></div></div>
          <p className="lab-passport-disclaimer">Это карта ваших рассуждений и результатов учебных вопросов, а не сертификат освоения навыка. Свободные объяснения не оценивались ИИ. До и после заданы разные вопросы; один проход не доказывает эффект обучения.</p>
          <div className="lab-passport-actions"><Button onClick={() => window.print()}><Printer size={16} />Сохранить PDF</Button><Button variant="outline" onClick={() => exportFile()}><Download size={16} />Паспорт JSON</Button>{mode === "pilot" && run.consent && <Button variant="outline" onClick={() => exportFile(true)}><FlaskConical size={16} />Выгрузить данные пилота</Button>}<Button variant="ghost" onClick={() => selectLesson(lessonIds[(lessonIds.indexOf(lessonId) + 1) % lessonIds.length])}>Следующий сценарий<ArrowRight size={16} /></Button></div>
          {mode === "pilot" && <p className="lab-microcopy">В файл пилота попадут только случайный номер попытки, ответы, число попыток и длительность с учётом пауз. Ваш свободный текст не включается. Передайте файл организатору только по собственному решению.</p>}
        </section>}
        <div className="lab-session-footer"><span><ShieldCheck size={14} />{storageError ? "Хранение недоступно: сохраните паспорт перед закрытием" : "Завершённые шаги хранятся в этом браузере"}</span><button onClick={restart}><RotateCcw size={14} />Начать заново</button></div>
      </>}
      {storageError && <Feedback>Браузер не разрешает сохранять прогресс. До закрытия страницы можно продолжить, затем скачать паспорт или сохранить PDF.</Feedback>}
      {notice && <p className="lab-notice" role="status">{notice}</p>}
      <footer className="lab-footer"><span>TOMORROW SCHOOL / THINK. TEST. TEACH.</span><div><Link href="/investigation?mode=jury">Демо для жюри</Link><Link href="/pilot">Пилот и методика</Link><Link href="/">Свободный разбор</Link></div></footer>
    </main>
  </div>;
}
