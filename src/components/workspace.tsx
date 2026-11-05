"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight, ArrowUp, ArrowUpRight, Asterisk, BookOpen, Check, CheckCheck, ChevronDown, ChevronRight,
  Code2, Copy, CornerDownLeft, FileCode2, History, Lightbulb, Loader2, MessageSquare,
  Moon, PanelLeftClose, Plus, RotateCcw, ShieldCheck, Sparkles, Square, Sun, Terminal,
  Trash2, X, CircleHelp, Command, CircleAlert, ExternalLink,
} from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { extensions, languageLabels, languages, mentorResponseSchema, type ChatMessage, type MentorRequest } from "@/lib/contracts";
import { examples, findDemoExample, type Example } from "@/lib/examples";
import { initialWorkspace, newSession, restoreWorkspace, STORAGE_KEY, type Session, type WorkspaceState } from "@/lib/storage";
import { cn } from "@/lib/utils";

const CodeEditor = dynamic(() => import("./code-editor"), { ssr: false, loading: () => <div className="editor-loading"><Loader2 size={18} className="spin" /> Загружаем редактор…</div> });
type Busy = { action: MentorRequest["action"]; userText?: string; sessionId: string };
type ApiStatus = { liveAvailable: boolean; demoAvailable: boolean };

function Mark({ small = false }: { small?: boolean }) {
  return <span className={cn("brand-mark", small && "brand-mark-small")} aria-hidden="true"><ArrowUp size={small ? 19 : 25} strokeWidth={2.8} className="brand-arrow" /></span>;
}
function SessionIcon({ session }: { session: Session }) {
  return session.messages.length ? <MessageSquare size={15} /> : <FileCode2 size={15} />;
}
function CopyMessage({ content, onError }: { content: string; onError: () => void }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <button className="copy-message" aria-label={copied ? "Сообщение скопировано" : "Копировать сообщение"} title="Копировать" onClick={async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true); clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch { onError(); }
  }}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>;
}

export default function Workspace() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(initialWorkspace);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<"examples" | "help" | "history" | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"code" | "mentor">("code");
  const controller = useRef<AbortController | null>(null);
  const requestInFlight = useRef(false);
  const feed = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const active = workspace.sessions.find(s => s.id === workspace.activeId) ?? workspace.sessions[0];
  const started = active.messages.length > 0;
  const questionCount = active.messages.filter(m => m.role === "assistant").length;
  const sample = findDemoExample(active.code, active.language);
  const canRequest = hydrated && !busy && Boolean(status) && (active.mode === "demo" ? status!.demoAvailable : status!.liveAvailable);

  useEffect(() => {
    try {
      const stored = restoreWorkspace(localStorage.getItem(STORAGE_KEY));
      // Hydration must follow the server render; local browser data is read once.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setWorkspace(stored);
    } catch { setStorageError(true); }
    setHydrated(true);
    return () => controller.current?.abort();
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/status", { signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error("status");
      const data: ApiStatus = await response.json();
      setStatus(data);
      if (data.liveAvailable && !data.demoAvailable) setWorkspace(w => ({ ...w, sessions: w.sessions.map(s => ({ ...s, mode: "live" })) }));
    }).catch(err => { if (err.name !== "AbortError") setStatusError(true); });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = workspace.theme;
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); }
    catch { queueMicrotask(() => setStorageError(true)); }
  }, [workspace, hydrated]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (feed.current) feed.current.scrollTo({ top: feed.current.scrollHeight, behavior: "smooth" });
  }, [active.messages.length, busy]);

  const updateActive = useCallback((update: Partial<Session> | ((session: Session) => Session)) => {
    setWorkspace(w => ({ ...w, sessions: w.sessions.map(s => s.id === w.activeId ? {
      ...(typeof update === "function" ? update(s) : { ...s, ...update }), updatedAt: Date.now(),
    } : s) }));
  }, []);

  function addSession(session: Session) {
    if (requestInFlight.current) return;
    setWorkspace(w => ({ ...w, activeId: session.id, sessions: [session, ...w.sessions].slice(0, 12) }));
    setDraft(""); setError(null); setModal(null); setSidebarOpen(false); setMobilePanel("code");
  }
  function selectSession(session: Session) {
    if (requestInFlight.current) return;
    setWorkspace(w => ({ ...w, activeId: session.id }));
    setDraft(""); setError(null); setModal(null); setSidebarOpen(false);
  }
  function loadExample(example: Example) { addSession(newSession(example, active.mode)); }
  function restart() {
    addSession({ ...newSession(undefined, active.mode), code: active.code, problem: active.problem, language: active.language, title: active.title });
  }
  function switchMode(mode: "demo" | "live") {
    if (active.mode === mode || busy) return;
    if (started) addSession({ ...newSession(undefined, mode), code: active.code, problem: active.problem, language: active.language, title: active.title });
    else updateActive({ mode });
  }

  const requestMentor = useCallback(async (action: MentorRequest["action"], studentText?: string) => {
    if (requestInFlight.current || !status) return;
    if (!active.code.trim()) { setError("Добавьте код, который хотите исследовать."); setMobilePanel("code"); return; }
    if (!active.problem.trim()) { setError("Опишите, что произошло и какого результата вы ожидали."); setMobilePanel("code"); return; }
    if (action === "message" && !studentText?.trim()) return;
    if (action !== "start" && active.messages.length >= 58) { setError("Этот диалог достиг лимита. Начните новый разбор, чтобы продолжить."); return; }
    const userMessage: ChatMessage | null = action === "message" ? { role: "user", content: studentText!.trim(), kind: "answer" } : null;
    const history = action === "start" ? [] : [...active.messages, ...(userMessage ? [userMessage] : [])];
    const abort = new AbortController(); controller.current = abort;
    requestInFlight.current = true;
    setBusy({ action, userText: userMessage?.content, sessionId: active.id }); setError(null); setMobilePanel("mentor");
    try {
      const response = await fetch("/api/mentor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(45_000)]),
        body: JSON.stringify({ action, mode: active.mode, code: active.code, problem: active.problem, language: active.language, history, hintLevel: action === "start" ? 0 : active.hintLevel }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const errorText = data && typeof data === "object" && "error" in data ? data.error : null;
        throw new Error(typeof errorText === "string" ? errorText : "Не удалось получить ответ. Попробуйте снова.");
      }
      const parsedResponse = mentorResponseSchema.safeParse(data);
      if (!parsedResponse.success) throw new Error("Наставник вернул некорректный ответ. Попробуйте снова.");
      const result = parsedResponse.data;
      const assistant: ChatMessage = { role: "assistant", content: result.message, kind: action === "hint" ? "hint" : "question", hintLevel: result.hintLevel };
      setWorkspace(w => ({ ...w, sessions: w.sessions.map(s => s.id === active.id ? {
        ...s, messages: [...history, assistant], hintLevel: result.hintLevel,
        hints: action === "start" ? 0 : s.hints + (action === "hint" ? 1 : 0),
        title: s.title === "Новый разбор" ? s.problem.slice(0, 45) : s.title, updatedAt: Date.now(),
      } : s) }));
      if (action === "message") setDraft("");
      if (result.guarded) setToast("Проверка Zero-Spoiler выбрала безопасный вопрос.");
      if (active.mode === "live") setTimeout(() => composer.current?.focus(), 50);
    } catch (err) {
      if (abort.signal.aborted) setToast("Запрос остановлен. Можно продолжить диалог.");
      else if (err instanceof Error && err.name === "TimeoutError") setError("Ответ занимает слишком много времени. Попробуйте ещё раз.");
      else setError(err instanceof Error ? err.message : "Ошибка соединения. Повторите запрос.");
    } finally { requestInFlight.current = false; setBusy(null); controller.current = null; }
  }, [active, status]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !started) {
        event.preventDefault(); void requestMentor("start");
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [requestMentor, started]);

  const sidebar = <>
    <div className="school-wordmark" aria-label="Tomorrow School"><span>tomorrow<span className="wordmark-dot">.</span></span><small>SCHOOL / LEARNING LAB</small></div><div className="sidebar-heading"><span>РАБОЧЕЕ ПРОСТРАНСТВО</span><button aria-label="Закрыть боковую панель" className="sidebar-collapse" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={15} /></button></div>
    <Button variant="outline" className="new-session" disabled={!!busy} onClick={() => addSession(newSession(undefined, active.mode))}><Plus size={16} />Новый разбор<span className="shortcut">N</span></Button>
    <div className="section-label">ВАШИ РАЗБОРЫ <span>{workspace.sessions.length.toString().padStart(2, "0")}</span></div>
    <div className="session-list">
      {workspace.sessions.slice(0, 7).map(session => <button key={session.id} disabled={!!busy} className={cn("session-item", session.id === active.id && "is-active")} onClick={() => selectSession(session)}>
        <SessionIcon session={session} /><span>{session.title}</span>{session.id === active.id && <span className="active-dot" />}
      </button>)}
    </div>
    <button className="all-history" onClick={() => setModal("history")}><History size={13} />Вся история<ChevronRight size={12} /></button>
    <div className="sidebar-divider" />
    <div className="section-label">РАЗМИНКА <span className="tiny-new">3 ЗАДАЧИ</span></div>
    <p className="practice-caption">Начните с маленького открытия.</p>
    <div className="practice-list">{examples.map((example, index) => <button disabled={!!busy} key={example.id} onClick={() => loadExample(example)} className="practice-item">
      <span className="practice-number">0{index + 1}</span><span><strong>{example.title}</strong><small>{example.subtitle}</small></span><ChevronRight size={13} />
    </button>)}</div>
    <div className="sidebar-bottom">
      <div className="philosophy"><span className="quote-symbol">“</span><p>Понимание остаётся.<br />Готовый ответ — нет.</p><span>TOMORROW SCHOOL</span></div>
      <button className="sidebar-help" onClick={() => setModal("help")}><CircleHelp size={15} />Как это работает<ExternalLink size={12} /></button>
      <div className="local-caption"><span className={cn("status-dot", storageError && "warning-dot")} />{storageError ? "Хранение недоступно" : "История на этом устройстве"}</div>
    </div>
  </>;

  return <div className="app-shell">
    <a href="#main-content" className="skip-link">К рабочему пространству</a>
    <aside className="rail" aria-label="Основная навигация">
      <button className="rail-brand" aria-label="Открыть рабочее пространство" onClick={() => { setModal(null); setMobilePanel("code"); }}><Mark /></button>
      <div className="rail-nav">
        <button className={cn("rail-button", !modal && "rail-active")} aria-label="Рабочее пространство" title="Рабочее пространство" onClick={() => { setModal(null); setSidebarOpen(s => !s); }}><Terminal size={20} /></button>
        <button className={cn("rail-button", modal === "history" && "rail-active")} aria-label="История разборов" title="История" onClick={() => setModal("history")}><History size={20} /></button>
        <button className={cn("rail-button", modal === "examples" && "rail-active")} aria-label="Учебные примеры" title="Примеры" onClick={() => setModal("examples")}><BookOpen size={20} /></button>
      </div>
      <div className="rail-bottom">
        <button className="rail-button" aria-label={workspace.theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"} title="Переключить тему" onClick={() => setWorkspace(w => ({ ...w, theme: w.theme === "dark" ? "light" : "dark" }))}>{workspace.theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</button>
        <button className="rail-button" aria-label="Помощь" title="Помощь" onClick={() => setModal("help")}><CircleHelp size={20} /></button>
        <span className="profile-avatar" title="Локальное рабочее пространство">S<span /></span>
      </div>
    </aside>
    {sidebarOpen && <button className="sidebar-backdrop" aria-label="Закрыть меню" onClick={() => setSidebarOpen(false)} />}
    <aside className={cn("sidebar", sidebarOpen && "sidebar-open")} aria-label="Разборы и учебные задачи">{sidebar}</aside>
    <div className="workspace-shell">
      <header className="topbar">
        <div className="breadcrumb"><span className="school-symbol" aria-hidden="true"><ArrowUpRight size={23} strokeWidth={2.5} /></span><span className="topbar-school">Tomorrow School</span><span className="breadcrumb-slash">/</span><strong>Zero-Spoiler</strong><span className="beta-tag">LEARNING LAB</span></div>
        <div className="topbar-right"><span className="private-label"><ShieldCheck size={13} />Ваше пространство</span><button className="help-top" onClick={() => setModal("help")}><BookOpen size={14} /><span>Руководство</span><ArrowRight size={12} /></button></div>
      </header>
      <main id="main-content" className="main-content">
        <div className="workspace-intro">
          <div><div className="eyebrow"><span />TOMORROW SCHOOL <span className="eyebrow-divider">/</span> ZERO-SPOILER DEBUGGER</div><h1>Думайте смелее.<br /><span>Решение — за вами.</span></h1><p>Ваш код, ваши открытия. Наставник поможет найти ошибку<br className="intro-break" /> через вопросы, а не готовые ответы.</p></div>
          <button className="zero-badge" onClick={() => setModal("help")}><span className="method-number">01—03</span><span>От вопроса к решению<span>Три уровня подсказок</span></span><ArrowRight size={18} /></button>
        </div>
        <div className={cn("mode-banner", active.mode === "live" && "live-banner")}>
          <div><span className="banner-dot" /><strong>{active.mode === "demo" ? "Деморежим" : "OpenAI"}</strong><span className="banner-description">{active.mode === "demo" ? "Подготовленные диалоги для трёх учебных примеров. Это не ответы ИИ." : "Наставник учитывает ваш код и весь текущий диалог."}</span></div>
          <div className="mode-switch" aria-label="Режим наставника"><button className={active.mode === "demo" ? "selected" : ""} aria-pressed={active.mode === "demo"} disabled={!!busy || !status?.demoAvailable} onClick={() => switchMode("demo")}>Демо</button><button className={active.mode === "live" ? "selected" : ""} aria-pressed={active.mode === "live"} disabled={!!busy || !status?.liveAvailable} title={status?.liveAvailable ? "Разбор с OpenAI" : "Добавьте OPENAI_API_KEY в .env.local и перезапустите сервер"} onClick={() => switchMode("live")}><Sparkles size={11} />OpenAI{!status?.liveAvailable && <span className="not-connected-dot" />}</button></div>
        </div>
        <div className="mobile-tabs"><button className={mobilePanel === "code" ? "selected" : ""} onClick={() => setMobilePanel("code")}><Code2 size={15} />Код</button><button className={mobilePanel === "mentor" ? "selected" : ""} onClick={() => setMobilePanel("mentor")}><Sparkles size={15} />Наставник{started && <span>{questionCount}</span>}</button></div>
        <div className="workbench">
          <section className={cn("editor-panel panel", mobilePanel !== "code" && "mobile-hidden")} aria-label="Редактор кода">
            <div className="panel-heading"><div className="panel-title"><Code2 size={17} /><h2>Код для разбора</h2></div><button className="text-button" disabled={!!busy} onClick={() => setModal("examples")}><BookOpen size={13} />Загрузить пример<ChevronDown size={12} /></button></div>
            <div className="editor-toolbar"><div className="file-tab"><FileCode2 size={14} /><span>main.{extensions[active.language]}</span><span className="file-dot" /></div><label className="language-select"><span className="sr-only">Язык программирования</span><select value={active.language} disabled={!!busy} onChange={e => updateActive({ language: e.target.value as Session["language"] })}>{languages.map(language => <option key={language} value={language}>{languageLabels[language]}</option>)}</select><ChevronDown size={12} /></label></div>
            <div className="code-area"><CodeEditor code={active.code} language={active.language} theme={workspace.theme} onChange={code => updateActive({ code })} /></div>
            <div className="editor-status"><span><span className="status-dot" />{storageError ? "Только в памяти" : "Сохранено локально"}</span><span>UTF-8 <span className="status-separator">·</span>{active.code.split("\n").length} строк <span className="status-separator">·</span>{active.code.length.toLocaleString("ru")} / 20 000</span></div>
            <div className="problem-area"><label htmlFor="problem">Что пошло не так?<span>Контекст поможет найти хороший вопрос</span></label><textarea id="problem" placeholder="Что вы ожидали? Что произошло? Есть ли сообщение об ошибке?" value={active.problem} maxLength={2000} disabled={!!busy} onChange={e => updateActive({ problem: e.target.value })} /><div className="editor-actions"><Button variant="ghost" className="clear-button" disabled={!!busy} onClick={() => addSession(newSession(undefined, active.mode))}><Trash2 size={14} />Очистить</Button><Button className="start-button" disabled={!canRequest || !active.code.trim() || !active.problem.trim()} onClick={() => void requestMentor("start")}>{busy?.action === "start" ? <><Loader2 size={15} className="spin" />Изучаем код…</> : <><Sparkles size={15} />{started ? "Обновить разбор" : "Начать разбор"}<ArrowRight size={16} /></>}</Button></div></div>
            <div className="editor-footnote"><ShieldCheck size={12} />Код анализируется, но не запускается.<span><Command size={11} /><CornerDownLeft size={11} /></span></div>
          </section>

          <section className={cn("mentor-panel panel", mobilePanel !== "mentor" && "mobile-hidden")} aria-label="Диалог с наставником">
            <div className="panel-heading mentor-heading"><div className="mentor-heading-left"><span className="mentor-avatar"><Sparkles size={16} /></span><div><h2>Ваш наставник<span className="mentor-online" /></h2><p>{active.mode === "demo" ? "Учебный сценарий" : "Вопрос за вопросом — к пониманию"}</p></div></div><button className="restart-button" disabled={!!busy || !started} title="Начать диалог заново" aria-label="Начать диалог заново" onClick={restart}><RotateCcw size={15} /></button></div>
            <div className="conversation" ref={feed} role="log" aria-label="История диалога" aria-live="polite" aria-relevant="additions">
              {!started && !busy ? <div className="mentor-welcome"><div className="welcome-illustration" aria-hidden="true"><div className="learning-grid" /><span className="learning-bracket">[</span><Asterisk className="learning-asterisk" size={108} strokeWidth={1.2} /><span className="learning-bracket">]</span><span className="learning-caption">THINK. TRY. UNDERSTAND.</span></div><span className="welcome-kicker">ВАШ СЛЕДУЮЩИЙ ШАГ — ОТКРЫТИЕ</span><h3>Хорошие вопросы.<br /><span>Ваши решения.</span></h3><p>Я помогу разобраться в логике вашего кода.<br />Открытие — за вами.</p><div className="welcome-steps"><span><span>01</span>Добавьте код и опишите проблему</span><span><span>02</span>Исследуйте её через вопросы</span><span><span>03</span>Найдите решение самостоятельно</span></div><div className="welcome-note"><ShieldCheck size={13} />Никакого готового кода. Даже по просьбе.</div></div> : <div className="messages"><div className="conversation-start"><span />НАЧАЛО РАЗБОРА<span /></div>{active.messages.map((message, index) => <div key={`${active.id}-${index}`} className={cn("message", message.role === "user" && "user-message")}><span className={cn("message-avatar", message.role === "assistant" && "ai-avatar")}>{message.role === "assistant" ? <Sparkles size={14} /> : "S"}</span><div className="message-body"><div className="message-meta"><strong>{message.role === "assistant" ? "Наставник" : "Вы"}</strong>{message.kind === "hint" && <span className="hint-message-tag"><Lightbulb size={10} />Подсказка {message.hintLevel}/3</span>}{message.role === "assistant" && active.mode === "demo" && <span className="demo-message-tag">ДЕМО</span>}<CopyMessage content={message.content} onError={() => setToast("Не удалось скопировать. Выделите текст сообщения.")} /></div><div className="message-text">{message.content.split("\n\n").map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div></div></div>)}{busy?.userText && <div className="message user-message pending-message"><span className="message-avatar">S</span><div className="message-body"><div className="message-meta"><strong>Вы</strong><span>Отправляем…</span></div><div className="message-text"><p>{busy.userText}</p></div></div></div>}{busy && <div className="message"><span className="message-avatar ai-avatar"><Sparkles size={14} /></span><div className="thinking"><span /><span /><span /><small>{active.mode === "demo" ? "Готовим вопрос" : "Изучаем и проверяем ответ"}</small></div></div>}</div>}
            </div>
            {started && <div className="hint-area"><div className="hint-progress"><div><Lightbulb size={13} /><span>Глубина подсказки</span><strong>{active.hintLevel} / 3</strong></div><div className="hint-bars" aria-label={`Уровень помощи ${active.hintLevel} из 3`}>{[1, 2, 3].map(n => <span className={n <= active.hintLevel ? "filled" : ""} key={n} title={["Лёгкая", "Средняя", "Сильная"][n - 1]} />)}</div></div><Button variant="outline" size="sm" disabled={!canRequest || active.hintLevel >= 3} onClick={() => void requestMentor("hint")}><Lightbulb size={13} />{active.hintLevel >= 3 ? "Все подсказки открыты" : "Дай подсказку"}{active.hintLevel < 3 && <ChevronRight size={12} />}</Button></div>}
            <div className="composer-area"><form onSubmit={e => { e.preventDefault(); if (canRequest) void requestMentor("message", draft); }} className={cn("composer", !started && "composer-disabled")}><textarea ref={composer} aria-label="Ответ наставнику" placeholder={started ? "Поделитесь своими наблюдениями…" : "Начните разбор, чтобы задать вопрос…"} value={draft} disabled={!started || !!busy} maxLength={4000} rows={2} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canRequest) void requestMentor("message", draft); } }} />{busy ? <button type="button" className="send-button stop-button" aria-label="Остановить ответ" title="Остановить" onClick={() => controller.current?.abort()}><Square size={13} fill="currentColor" /></button> : <button type="submit" className="send-button" disabled={!started || !draft.trim() || !canRequest} aria-label="Отправить ответ" title="Отправить"><ArrowUp size={17} /></button>}</form><div className="composer-footnote"><span><ShieldCheck size={11} />Пространство для ваших мыслей</span><span>Enter <CornerDownLeft size={10} /></span></div></div>
          </section>
        </div>
        <div className="workspace-footer"><div><span className="footer-indicator" /><span>{started ? "Разбор в процессе" : "Готовы к первому открытию"}</span><span className="footer-divider">/</span><span><MessageSquare size={12} />{questionCount} вопросов</span><span><Lightbulb size={12} />{active.hints} подсказок</span></div><span className="footer-motto">Tomorrow starts with a question.<Sparkles size={12} /></span></div>
        {active.mode === "demo" && !sample && <div className="inline-notice"><CircleAlert size={15} /><span>Для этого кода деморежим задаёт общие вопросы. Откройте учебный пример для подготовленного диалога или подключите OpenAI.</span><button onClick={() => setModal("examples")}>Примеры<ArrowRight size={13} /></button></div>}
        {(error || statusError || (status && !status.liveAvailable && !status.demoAvailable)) && <div className="error-banner" role="alert"><CircleAlert size={17} /><p>{error || (statusError ? "Не удалось проверить подключение. Обновите страницу и убедитесь, что сервер запущен." : "Наставник не настроен. Подключите OpenAI на сервере или включите ENABLE_DEMO.")}</p><button aria-label="Закрыть сообщение об ошибке" onClick={() => { setError(null); setStatusError(false); }}><X size={15} /></button></div>}
        {storageError && <div className="inline-notice"><CircleAlert size={15} />Браузер не разрешает сохранение. Не закрывайте страницу, если хотите сохранить текущий диалог.</div>}
      </main>
    </div>

    <Dialog open={modal !== null} onOpenChange={open => { if (!open) setModal(null); }}><DialogContent className={modal === "help" ? "help-dialog" : ""}>
      {modal === "examples" && <><span className="dialog-eyebrow"><BookOpen size={15} />ПРАКТИКА БЕЗ СПОЙЛЕРОВ</span><DialogTitle>С маленькой ошибки<br /><span>начинается открытие.</span></DialogTitle><DialogDescription>Три ситуации, чтобы познакомиться с наставником. Пример откроется в новом разборе.</DialogDescription><div className="example-cards">{examples.map((example, index) => <button disabled={!!busy} key={example.id} onClick={() => loadExample(example)}><span className="example-card-number">0{index + 1}</span><div><span className="example-language">{languageLabels[example.language]}</span><h3>{example.title}</h3><p>{example.subtitle}</p></div><ArrowRight size={18} /></button>)}</div><div className="dialog-bottom-note"><ShieldCheck size={14} />В деморежиме используются заранее подготовленные вопросы.</div></>}
      {modal === "history" && <><span className="dialog-eyebrow"><History size={15} />ЛОКАЛЬНАЯ ИСТОРИЯ</span><DialogTitle>Ваш путь к пониманию.</DialogTitle><DialogDescription>Последние 12 разборов хранятся только в этом браузере.</DialogDescription><div className="history-list">{workspace.sessions.map(session => <button disabled={!!busy} key={session.id} onClick={() => selectSession(session)}><SessionIcon session={session} /><span><strong>{session.title}</strong><small>{languageLabels[session.language]} · {session.messages.filter(m => m.role === "assistant").length} вопросов · {session.mode === "demo" ? "Демо" : "OpenAI"}</small></span>{session.id === active.id ? <CheckCheck size={17} /> : <ArrowRight size={15} />}</button>)}</div></>}
      {modal === "help" && <><span className="dialog-eyebrow"><ShieldCheck size={15} />МЕТОД ZERO-SPOILER</span><DialogTitle>Не ответ.<br /><span>Путь к пониманию.</span></DialogTitle><DialogDescription>Наставник помогает исследовать поведение программы, а выводы и исправления остаются за вами.</DialogDescription><div className="help-steps"><div><Code2 size={19} /><span><strong>Покажите, что происходит</strong><p>Добавьте код, выберите язык, опишите ожидаемый и реальный результат. Код не запускается.</p></span></div><div><MessageSquare size={19} /><span><strong>Рассуждайте вслух</strong><p>Отвечайте на вопросы и делитесь наблюдениями. С OpenAI наставник учитывает текущий код и всю историю.</p></span></div><div><Lightbulb size={19} /><span><strong>Управляйте глубиной помощи</strong><p>Три уровня: направление, исследование состояния, объяснение концепции. Готового исправления не будет.</p></span></div></div><div className="help-demo"><span className="banner-dot" /><div><strong>{status?.liveAvailable ? "OpenAI подключён" : "Сейчас доступна демонстрация"}</strong><p>{status?.liveAvailable ? "Выберите OpenAI в переключателе над редактором для разбора своего кода." : "Демо содержит подготовленные диалоги для трёх примеров. Для анализа своего кода укажите OPENAI_API_KEY в .env.local и перезапустите сервер."}</p></div></div><div className="help-privacy"><ShieldCheck size={14} /><p>История сохраняется локально. В режиме OpenAI код, описание и диалог отправляются в OpenAI API. Не добавляйте секреты. Проверка ответов снижает риск спойлеров, но не даёт абсолютной гарантии.</p></div><Button className="help-done" onClick={() => setModal(null)}>Перейти к открытию<ArrowRight size={15} /></Button></>}
    </DialogContent></Dialog>
    {toast && <div className="toast" role="status"><Check size={16} />{toast}<button aria-label="Закрыть уведомление" onClick={() => setToast(null)}><X size={13} /></button></div>}
  </div>;
}
