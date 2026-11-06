"use client";
import { useI18n, LanguageSwitcher } from "@/components/locale-provider";

import dynamic from "next/dynamic";
import { LocalizedLink as Link } from "./locale-provider";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight, ArrowUp, ArrowUpRight, Asterisk, BookOpen, Check, CheckCheck, ChevronDown, ChevronRight,
  Code2, Copy, CornerDownLeft, FileCode2, History, Lightbulb, Loader2, MessageSquare,
  Moon, PanelLeftClose, Plus, RotateCcw, ShieldCheck, Sparkles, Square, Sun, Terminal,
  Trash2, X, CircleHelp, Command, CircleAlert, ExternalLink, FlaskConical,
} from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { extensions, languageLabels, languages, mentorResponseSchema, type ChatMessage, type MentorRequest } from "@/lib/contracts";
import { getExamples, findDemoExample, type Example } from "@/lib/examples";
import { initialWorkspace, newSession, restoreWorkspace, STORAGE_KEY, type Session, type WorkspaceState } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { translateAuthored, locales } from "@/lib/i18n";
import "./investigation-lab.css";

const CodeEditor = dynamic(() => import("./code-editor"), { ssr: false, loading: EditorLoading });
function EditorLoading() {
  const { t } = useI18n();
 return <div className="editor-loading"><Loader2 size={18} className="spin" /> {t("Загружаем редактор…")}</div>; }
type Busy = { action: MentorRequest["action"]; userText?: string; sessionId: string };
type ApiStatus = { liveAvailable: boolean; demoAvailable: boolean };

function Mark({ small = false }: { small?: boolean }) {
  return <span className={cn("brand-mark", small && "brand-mark-small")} aria-hidden="true"><ArrowUp size={small ? 19 : 25} strokeWidth={2.8} className="brand-arrow" /></span>;
}
function SessionIcon({ session }: { session: Session }) {
  return session.messages.length ? <MessageSquare size={15} /> : <FileCode2 size={15} />;
}
function CopyMessage({ content, onError }: { content: string; onError: () => void }) {
  const { t } = useI18n();

  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <button className="copy-message" aria-label={copied ? t("Сообщение скопировано") : t("Копировать сообщение")} title={t("Копировать")} onClick={async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true); clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch { onError(); }
  }}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>;
}

export default function Workspace() {
  const { t, locale } = useI18n();
  const examples = getExamples(locale);

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
  useEffect(() => {
    // Translate only untouched authored fields. Never translate a learner’s code or prose.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWorkspace(current => ({ ...current, sessions: current.sessions.map(session => {
      const original = findDemoExample(session.code, session.language);
      if (!original) return session;
      const variants = locales.map(lang => getExamples(lang).find(item => item.id === original.id)!);
      const target = getExamples(locale).find(item => item.id === original.id)!;
      return { ...session, code: target.code,
        title: variants.some(item => item.title === session.title) ? target.title : session.title,
        problem: variants.some(item => item.problem === session.problem) ? target.problem : session.problem };
    }) }));
  }, [locale]);
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
    if (!active.code.trim()) { setError(t("Добавьте код, который хотите исследовать.")); setMobilePanel("code"); return; }
    if (!active.problem.trim()) { setError(t("Опишите, что произошло и какого результата вы ожидали.")); setMobilePanel("code"); return; }
    if (action === "message" && !studentText?.trim()) return;
    if (action !== "start" && active.messages.length >= 58) { setError(t("Этот диалог достиг лимита. Начните новый разбор, чтобы продолжить.")); return; }
    const userMessage: ChatMessage | null = action === "message" ? { role: "user", content: studentText!.trim(), kind: "answer" } : null;
    const history = action === "start" ? [] : [...active.messages, ...(userMessage ? [userMessage] : [])];
    const abort = new AbortController(); controller.current = abort;
    requestInFlight.current = true;
    setBusy({ action, userText: userMessage?.content, sessionId: active.id }); setError(null); setMobilePanel("mentor");
    try {
      const response = await fetch("/api/mentor", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Zero-Spoiler-Language": locale },
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(45_000)]),
        body: JSON.stringify({ action, locale, mode: active.mode, code: active.code, problem: active.problem, language: active.language, history, hintLevel: action === "start" ? 0 : active.hintLevel }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const errorText = data && typeof data === "object" && "error" in data ? data.error : null;
        throw new Error(typeof errorText === "string" ? errorText : t("Не удалось получить ответ. Попробуйте снова."));
      }
      const parsedResponse = mentorResponseSchema.safeParse(data);
      if (!parsedResponse.success) throw new Error(t("Наставник вернул некорректный ответ. Попробуйте снова."));
      const result = parsedResponse.data;
      const assistant: ChatMessage = { role: "assistant", content: result.message, kind: action === "hint" ? "hint" : "question", hintLevel: result.hintLevel };
      setWorkspace(w => ({ ...w, sessions: w.sessions.map(s => s.id === active.id ? {
        ...s, messages: [...history, assistant], hintLevel: result.hintLevel,
        hints: action === "start" ? 0 : s.hints + (action === "hint" ? 1 : 0),
        title: translateAuthored("ru", s.title) === "Новый разбор" ? s.problem.slice(0, 45) : s.title, updatedAt: Date.now(),
      } : s) }));
      if (action === "message") setDraft("");
      if (result.guarded) setToast(t("Проверка Zero-Spoiler выбрала безопасный вопрос."));
      if (active.mode === "live") setTimeout(() => composer.current?.focus(), 50);
    } catch (err) {
      if (abort.signal.aborted) setToast(t("Запрос остановлен. Можно продолжить диалог."));
      else if (err instanceof Error && err.name === "TimeoutError") setError(t("Ответ занимает слишком много времени. Попробуйте ещё раз."));
      else setError(err instanceof Error ? err.message : t("Ошибка соединения. Повторите запрос."));
    } finally { requestInFlight.current = false; setBusy(null); controller.current = null; }
  }, [active, status, locale, t, setToast, setError, setMobilePanel, setBusy, setWorkspace, setDraft]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !started) {
        event.preventDefault(); void requestMentor("start");
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [requestMentor, started]);

  const sidebar = <>
    <div className="school-wordmark" aria-label="Tomorrow School"><span>tomorrow<span className="wordmark-dot">.</span></span><small>SCHOOL / LEARNING LAB</small></div><div className="sidebar-heading"><span>{t("РАБОЧЕЕ ПРОСТРАНСТВО")}</span><button aria-label={t("Закрыть боковую панель")} className="sidebar-collapse" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={15} /></button></div>
    <Button variant="outline" className="new-session" disabled={!!busy} onClick={() => addSession(newSession(undefined, active.mode))}><Plus size={16} />{t("Новый разбор")}<span className="shortcut">N</span></Button>
    <div className="section-label">{t("ВАШИ РАЗБОРЫ")}{" "}<span>{workspace.sessions.length.toString().padStart(2, "0")}</span></div>
    <div className="session-list">
      {workspace.sessions.slice(0, 7).map(session => <button key={session.id} disabled={!!busy} className={cn("session-item", session.id === active.id && "is-active")} onClick={() => selectSession(session)}>
        <SessionIcon session={session} /><span>{translateAuthored(locale, session.title)}</span>{session.id === active.id && <span className="active-dot" />}
      </button>)}
    </div>
    <button className="all-history" onClick={() => setModal("history")}><History size={13} />{t("Вся история")}<ChevronRight size={12} /></button>
    <div className="sidebar-divider" />
    <div className="section-label">{t("РАЗМИНКА")}{" "}<span className="tiny-new">{t("3 ЗАДАЧИ")}</span></div>
    <p className="practice-caption">{t("Начните с маленького открытия.")}</p>
    <div className="practice-list">{examples.map((example, index) => <button disabled={!!busy} key={example.id} onClick={() => loadExample(example)} className="practice-item">
      <span className="practice-number">0{index + 1}</span><span><strong>{example.title}</strong><small>{example.subtitle}</small></span><ChevronRight size={13} />
    </button>)}</div>
    <div className="sidebar-bottom">
      <div className="philosophy"><span className="quote-symbol">“</span><p>{t("Понимание остаётся.")}<br />{t("Готовый ответ — нет.")}</p><span>TOMORROW SCHOOL</span></div>
      <button className="sidebar-help" onClick={() => setModal("help")}><CircleHelp size={15} />{t("Как это работает")}<ExternalLink size={12} /></button>
      <div className="local-caption"><span className={cn("status-dot", storageError && "warning-dot")} />{storageError ? t("Хранение недоступно") : t("История на этом устройстве")}</div>
    </div>
  </>;

  return <div className="app-shell">
    <a href="#main-content" className="skip-link">{t("К рабочему пространству")}</a>
    <aside className="rail" aria-label={t("Основная навигация")}>
      <button className="rail-brand" aria-label={t("Открыть рабочее пространство")} onClick={() => { setModal(null); setMobilePanel("code"); }}><Mark /></button>
      <div className="rail-nav">
        <button className={cn("rail-button", !modal && "rail-active")} aria-label={t("Рабочее пространство")} aria-expanded={sidebarOpen} aria-controls="session-sidebar" title={t("Рабочее пространство")} onClick={() => { setModal(null); setSidebarOpen(s => !s); }}><Terminal size={20} /><span className="rail-mobile-label">{t("Разборы")}</span></button>
        <button className={cn("rail-button", modal === "history" && "rail-active")} aria-label={t("История разборов")} title={t("История")} onClick={() => setModal("history")}><History size={20} /><span className="rail-mobile-label">{t("История")}</span></button>
        <button className={cn("rail-button", modal === "examples" && "rail-active")} aria-label={t("Учебные примеры")} title={t("Примеры")} onClick={() => setModal("examples")}><BookOpen size={20} /><span className="rail-mobile-label">{t("Примеры")}</span></button>
      </div>
      <div className="rail-bottom">
        <button className="rail-button" aria-label={workspace.theme === "dark" ? t("Включить светлую тему") : t("Включить тёмную тему")} title={t("Переключить тему")} onClick={() => setWorkspace(w => ({ ...w, theme: w.theme === "dark" ? "light" : "dark" }))}>{workspace.theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}<span className="rail-mobile-label">{t("Тема")}</span></button>
        <button className="rail-button" aria-label={t("Помощь")} title={t("Помощь")} onClick={() => setModal("help")}><CircleHelp size={20} /><span className="rail-mobile-label">{t("Помощь")}</span></button>
        <span className="profile-avatar" title={t("Локальное рабочее пространство")}>S<span /></span>
      </div>
    </aside>
    {sidebarOpen && <button className="sidebar-backdrop" aria-label={t("Закрыть меню")} onClick={() => setSidebarOpen(false)} />}
    <aside id="session-sidebar" className={cn("sidebar", sidebarOpen && "sidebar-open")} aria-label={t("Разборы и учебные задачи")}>{sidebar}</aside>
    <div className="workspace-shell">
      <header className="topbar">
        <div className="breadcrumb"><span className="school-symbol" aria-hidden="true"><ArrowUpRight size={23} strokeWidth={2.5} /></span><span className="topbar-school">Tomorrow School</span><span className="breadcrumb-slash">/</span><strong>Zero-Spoiler</strong><span className="beta-tag">LEARNING LAB</span></div>
        <div className="topbar-right"><LanguageSwitcher /><span className="private-label"><ShieldCheck size={13} />{t("Ваше пространство")}</span><button className="help-top" onClick={() => setModal("help")}><BookOpen size={14} /><span>{t("Руководство")}</span><ArrowRight size={12} /></button></div>
      </header>
      <main id="main-content" className="main-content">
        <div className="workspace-intro">
          <div><div className="eyebrow"><span />TOMORROW SCHOOL <span className="eyebrow-divider">/</span> ZERO-SPOILER DEBUGGER</div><h1>{t("Думайте смелее.")}<br /><span>{t("Решение — за вами.")}</span></h1><p>{t("Ваш код, ваши открытия. Наставник поможет найти ошибку")}<br className="intro-break" /> {t("через вопросы, а не готовые ответы.")}</p></div>
          <button className="zero-badge" onClick={() => setModal("help")}><span className="method-number">01—03</span><span>{t("От вопроса к решению")}<span>{t("Три уровня подсказок")}</span></span><ArrowRight size={18} /></button>
        </div>
        <section className="workspace-lab-entry" aria-label={t("Новый учебный путь")}>
          <FlaskConical size={23} />
          <div><strong>{t("Найдите ошибку. А затем — станьте наставником.")}</strong><p>{t("Прогноз выполнения → эксперимент → объяснение новичку → новая задача. Три учебных сценария без API-ключа.")}</p></div>
          <div className="workspace-lab-actions"><Button asChild><Link href={`/investigation?case=${sample?.id ?? "index"}`}>{t("Начать расследование")}<ArrowRight size={15} /></Link></Button><Link href="/investigation?mode=jury">{t("Демо для жюри")}<ArrowUpRight size={13} /></Link></div>
        </section>
        <div className={cn("mode-banner", active.mode === "live" && "live-banner")}>
          <div><span className="banner-dot" /><strong>{active.mode === "demo" ? t("Деморежим") : "OpenAI"}</strong><span className="banner-description">{active.mode === "demo" ? t("Подготовленные диалоги для трёх учебных примеров. Это не ответы ИИ.") : t("Наставник учитывает ваш код и весь текущий диалог.")}</span></div>
          <div className="mode-switch" aria-label={t("Режим наставника")}><button className={active.mode === "demo" ? "selected" : ""} aria-pressed={active.mode === "demo"} disabled={!!busy || !status?.demoAvailable} onClick={() => switchMode("demo")}>{t("Демо")}</button><button className={active.mode === "live" ? "selected" : ""} aria-pressed={active.mode === "live"} disabled={!!busy || !status?.liveAvailable} title={status?.liveAvailable ? t("Разбор с OpenAI") : t("Добавьте OPENAI_API_KEY в .env.local и перезапустите сервер")} onClick={() => switchMode("live")}><Sparkles size={11} />OpenAI{!status?.liveAvailable && <span className="not-connected-dot" />}</button></div>
        </div>
        <div className="mobile-tabs"><button className={mobilePanel === "code" ? "selected" : ""} onClick={() => setMobilePanel("code")}><Code2 size={15} />{t("Код")}</button><button className={mobilePanel === "mentor" ? "selected" : ""} onClick={() => setMobilePanel("mentor")}><Sparkles size={15} />{t("Наставник")}{started && <span>{questionCount}</span>}</button></div>
        <div className="workbench">
          <section className={cn("editor-panel panel", mobilePanel !== "code" && "mobile-hidden")} aria-label={t("Редактор кода")}>
            <div className="panel-heading"><div className="panel-title"><Code2 size={17} /><h2>{t("Код для разбора")}</h2></div><button className="text-button" disabled={!!busy} onClick={() => setModal("examples")}><BookOpen size={13} />{t("Загрузить пример")}<ChevronDown size={12} /></button></div>
            <div className="editor-toolbar"><div className="file-tab"><FileCode2 size={14} /><span>main.{extensions[active.language]}</span><span className="file-dot" /></div><label className="language-select"><span className="sr-only">{t("Язык программирования")}</span><select value={active.language} disabled={!!busy} onChange={e => updateActive({ language: e.target.value as Session["language"] })}>{languages.map(language => <option key={language} value={language}>{languageLabels[language]}</option>)}</select><ChevronDown size={12} /></label></div>
            <div className="code-area"><CodeEditor code={active.code} language={active.language} theme={workspace.theme} onChange={code => updateActive({ code })} /></div>
            <div className="editor-status"><span><span className="status-dot" />{storageError ? t("Только в памяти") : t("Сохранено локально")}</span><span>UTF-8 <span className="status-separator">·</span>{active.code.split("\n").length} {t("строк")}{" "}<span className="status-separator">·</span>{active.code.length.toLocaleString("ru")} / 20 000</span></div>
            <div className="problem-area"><label htmlFor="problem">{t("Что пошло не так?")}<span>{t("Контекст поможет найти хороший вопрос")}</span></label><textarea id="problem" placeholder={t("Что вы ожидали? Что произошло? Есть ли сообщение об ошибке?")} value={active.problem} maxLength={2000} disabled={!!busy} onChange={e => updateActive({ problem: e.target.value })} /><div className="editor-actions"><Button variant="ghost" className="clear-button" disabled={!!busy} onClick={() => addSession(newSession(undefined, active.mode))}><Trash2 size={14} />{t("Очистить")}</Button><Button className="start-button" disabled={!canRequest || !active.code.trim() || !active.problem.trim()} onClick={() => void requestMentor("start")}>{busy?.action === "start" ? <><Loader2 size={15} className="spin" />{t("Изучаем код…")}</> : <><Sparkles size={15} />{started ? t("Обновить разбор") : t("Начать разбор")}<ArrowRight size={16} /></>}</Button></div></div>
            <div className="editor-footnote"><ShieldCheck size={12} />{t("Код анализируется, но не запускается.")}<span><Command size={11} /><CornerDownLeft size={11} /></span></div>
          </section>

          <section className={cn("mentor-panel panel", mobilePanel !== "mentor" && "mobile-hidden")} aria-label={t("Диалог с наставником")}>
            <div className="panel-heading mentor-heading"><div className="mentor-heading-left"><span className="mentor-avatar"><Sparkles size={16} /></span><div><h2>{t("Ваш наставник")}<span className="mentor-online" /></h2><p>{active.mode === "demo" ? t("Учебный сценарий") : t("Вопрос за вопросом — к пониманию")}</p></div></div><button className="restart-button" disabled={!!busy || !started} title={t("Начать диалог заново")} aria-label={t("Начать диалог заново")} onClick={restart}><RotateCcw size={15} /></button></div>
            <div className="conversation" ref={feed} role="log" aria-label={t("История диалога")} aria-live="polite" aria-relevant="additions">
              {!started && !busy ? <div className="mentor-welcome"><div className="welcome-illustration" aria-hidden="true"><div className="learning-grid" /><span className="learning-bracket">[</span><Asterisk className="learning-asterisk" size={108} strokeWidth={1.2} /><span className="learning-bracket">]</span><span className="learning-caption">THINK. TRY. UNDERSTAND.</span></div><span className="welcome-kicker">{t("ВАШ СЛЕДУЮЩИЙ ШАГ — ОТКРЫТИЕ")}</span><h3>{t("Хорошие вопросы.")}<br /><span>{t("Ваши решения.")}</span></h3><p>{t("Я помогу разобраться в логике вашего кода.")}<br />{t("Открытие — за вами.")}</p><div className="welcome-steps"><span><span>01</span>{t("Добавьте код и опишите проблему")}</span><span><span>02</span>{t("Исследуйте её через вопросы")}</span><span><span>03</span>{t("Найдите решение самостоятельно")}</span></div><div className="welcome-note"><ShieldCheck size={13} />{t("Никакого готового кода. Даже по просьбе.")}</div></div> : <div className="messages"><div className="conversation-start"><span />{t("НАЧАЛО РАЗБОРА")}<span /></div>{active.messages.map((message, index) => <div key={`${active.id}-${index}`} className={cn("message", message.role === "user" && "user-message")}><span className={cn("message-avatar", message.role === "assistant" && "ai-avatar")}>{message.role === "assistant" ? <Sparkles size={14} /> : "S"}</span><div className="message-body"><div className="message-meta"><strong>{message.role === "assistant" ? t("Наставник") : t("Вы")}</strong>{message.kind === "hint" && <span className="hint-message-tag"><Lightbulb size={10} />{t("Подсказка")}{" "}{message.hintLevel}/3</span>}{message.role === "assistant" && active.mode === "demo" && <span className="demo-message-tag">{t("ДЕМО")}</span>}<CopyMessage content={message.content} onError={() => setToast(t("Не удалось скопировать. Выделите текст сообщения."))} /></div><div className="message-text">{(active.mode === "demo" && message.role === "assistant" ? translateAuthored(locale, message.content) : message.content).split("\n\n").map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div></div></div>)}{busy?.userText && <div className="message user-message pending-message"><span className="message-avatar">S</span><div className="message-body"><div className="message-meta"><strong>{t("Вы")}</strong><span>{t("Отправляем…")}</span></div><div className="message-text"><p>{busy.userText}</p></div></div></div>}{busy && <div className="message"><span className="message-avatar ai-avatar"><Sparkles size={14} /></span><div className="thinking"><span /><span /><span /><small>{active.mode === "demo" ? t("Готовим вопрос") : t("Изучаем и проверяем ответ")}</small></div></div>}</div>}
            </div>
            {started && <div className="hint-area"><div className="hint-progress"><div><Lightbulb size={13} /><span>{t("Глубина подсказки")}</span><strong>{active.hintLevel} / 3</strong></div><div className="hint-bars" aria-label={t("Уровень помощи {0} из 3", {"0": active.hintLevel})}>{[1, 2, 3].map(n => <span className={n <= active.hintLevel ? "filled" : ""} key={n} title={[t("Лёгкая"), t("Средняя"), t("Сильная")][n - 1]} />)}</div></div><Button variant="outline" size="sm" disabled={!canRequest || active.hintLevel >= 3} onClick={() => void requestMentor("hint")}><Lightbulb size={13} />{active.hintLevel >= 3 ? t("Все подсказки открыты") : t("Дай подсказку")}{active.hintLevel < 3 && <ChevronRight size={12} />}</Button></div>}
            <div className="composer-area"><form onSubmit={e => { e.preventDefault(); if (canRequest) void requestMentor("message", draft); }} className={cn("composer", !started && "composer-disabled")}><textarea ref={composer} aria-label={t("Ответ наставнику")} placeholder={started ? t("Поделитесь своими наблюдениями…") : t("Начните разбор, чтобы задать вопрос…")} value={draft} disabled={!started || !!busy} maxLength={4000} rows={2} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canRequest) void requestMentor("message", draft); } }} />{busy ? <button type="button" className="send-button stop-button" aria-label={t("Остановить ответ")} title={t("Остановить")} onClick={() => controller.current?.abort()}><Square size={13} fill="currentColor" /></button> : <button type="submit" className="send-button" disabled={!started || !draft.trim() || !canRequest} aria-label={t("Отправить ответ")} title={t("Отправить")}><ArrowUp size={17} /></button>}</form><div className="composer-footnote"><span><ShieldCheck size={11} />{t("Пространство для ваших мыслей")}</span><span>Enter <CornerDownLeft size={10} /></span></div></div>
          </section>
        </div>
        <div className="workspace-footer"><div><span className="footer-indicator" /><span>{started ? t("Разбор в процессе") : t("Готовы к первому открытию")}</span><span className="footer-divider">/</span><span><MessageSquare size={12} />{questionCount} {t("вопросов")}</span><span><Lightbulb size={12} />{active.hints} {t("подсказок")}</span></div><span className="footer-motto">Tomorrow starts with a question.<Sparkles size={12} /></span></div>
        {active.mode === "demo" && !sample && <div className="inline-notice"><CircleAlert size={15} /><span>{t("Для этого кода деморежим задаёт общие вопросы. Откройте учебный пример для подготовленного диалога или подключите OpenAI.")}</span><button onClick={() => setModal("examples")}>{t("Примеры")}<ArrowRight size={13} /></button></div>}
        {(error || statusError || (status && !status.liveAvailable && !status.demoAvailable)) && <div className="error-banner" role="alert"><CircleAlert size={17} /><p>{error || (statusError ? t("Не удалось проверить подключение. Обновите страницу и убедитесь, что сервер запущен.") : t("Наставник не настроен. Подключите OpenAI на сервере или включите ENABLE_DEMO."))}</p><button aria-label={t("Закрыть сообщение об ошибке")} onClick={() => { setError(null); setStatusError(false); }}><X size={15} /></button></div>}
        {storageError && <div className="inline-notice"><CircleAlert size={15} />{t("Браузер не разрешает сохранение. Не закрывайте страницу, если хотите сохранить текущий диалог.")}</div>}
      </main>
    </div>

    <Dialog open={modal !== null} onOpenChange={open => { if (!open) setModal(null); }}><DialogContent className={modal === "help" ? "help-dialog" : ""}>
      {modal === "examples" && <><span className="dialog-eyebrow"><BookOpen size={15} />{t("ПРАКТИКА БЕЗ СПОЙЛЕРОВ")}</span><DialogTitle>{t("С маленькой ошибки")}<br /><span>{t("начинается открытие.")}</span></DialogTitle><DialogDescription>{t("Три ситуации, чтобы познакомиться с наставником. Пример откроется в новом разборе.")}</DialogDescription><div className="example-cards">{examples.map((example, index) => <button disabled={!!busy} key={example.id} onClick={() => loadExample(example)}><span className="example-card-number">0{index + 1}</span><div><span className="example-language">{languageLabels[example.language]}</span><h3>{example.title}</h3><p>{example.subtitle}</p></div><ArrowRight size={18} /></button>)}</div><div className="dialog-bottom-note"><ShieldCheck size={14} />{t("В деморежиме используются заранее подготовленные вопросы.")}</div></>}
      {modal === "history" && <><span className="dialog-eyebrow"><History size={15} />{t("ЛОКАЛЬНАЯ ИСТОРИЯ")}</span><DialogTitle>{t("Ваш путь к пониманию.")}</DialogTitle><DialogDescription>{t("Последние 12 разборов хранятся только в этом браузере.")}</DialogDescription><div className="history-list">{workspace.sessions.map(session => <button disabled={!!busy} key={session.id} onClick={() => selectSession(session)}><SessionIcon session={session} /><span><strong>{translateAuthored(locale, session.title)}</strong><small>{languageLabels[session.language]} · {session.messages.filter(m => m.role === "assistant").length} {t("вопросов ·")}{" "}{session.mode === "demo" ? t("Демо") : "OpenAI"}</small></span>{session.id === active.id ? <CheckCheck size={17} /> : <ArrowRight size={15} />}</button>)}</div></>}
      {modal === "help" && <><span className="dialog-eyebrow"><ShieldCheck size={15} />{t("МЕТОД ZERO-SPOILER")}</span><DialogTitle>{t("Не ответ.")}<br /><span>{t("Путь к пониманию.")}</span></DialogTitle><DialogDescription>{t("Наставник помогает исследовать поведение программы, а выводы и исправления остаются за вами.")}</DialogDescription><div className="help-steps"><div><Code2 size={19} /><span><strong>{t("Покажите, что происходит")}</strong><p>{t("Добавьте код, выберите язык, опишите ожидаемый и реальный результат. Код не запускается.")}</p></span></div><div><MessageSquare size={19} /><span><strong>{t("Рассуждайте вслух")}</strong><p>{t("Отвечайте на вопросы и делитесь наблюдениями. С OpenAI наставник учитывает текущий код и всю историю.")}</p></span></div><div><Lightbulb size={19} /><span><strong>{t("Управляйте глубиной помощи")}</strong><p>{t("Три уровня: направление, исследование состояния, объяснение концепции. Готового исправления не будет.")}</p></span></div></div><div className="help-demo"><span className="banner-dot" /><div><strong>{status?.liveAvailable ? t("OpenAI подключён") : t("Сейчас доступна демонстрация")}</strong><p>{status?.liveAvailable ? t("Выберите OpenAI в переключателе над редактором для разбора своего кода.") : t("Демо содержит подготовленные диалоги для трёх примеров. Для анализа своего кода укажите OPENAI_API_KEY в .env.local и перезапустите сервер.")}</p></div></div><div className="help-privacy"><ShieldCheck size={14} /><p>{t("История сохраняется локально. В режиме OpenAI код, описание и диалог отправляются в OpenAI API. Не добавляйте секреты. Проверка ответов снижает риск спойлеров, но не даёт абсолютной гарантии.")}</p></div><Button className="help-done" onClick={() => setModal(null)}>{t("Перейти к открытию")}<ArrowRight size={15} /></Button></>}
    </DialogContent></Dialog>
    {toast && <div className="toast" role="status"><Check size={16} />{toast && translateAuthored(locale, toast)}<button aria-label={t("Закрыть уведомление")} onClick={() => setToast(null)}><X size={13} /></button></div>}
  </div>;
}
