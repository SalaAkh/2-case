"use client";
import Editor, { loader, type BeforeMount } from "@monaco-editor/react";
import { useEffect, useState } from "react";
import type { Language } from "@/lib/contracts";

loader.config({ paths: { vs: "/monaco/vs" } });
const configure: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("zero-dark", {
    base: "vs-dark", inherit: true,
    rules: [
      { token: "comment", foreground: "90939D", fontStyle: "italic" },
      { token: "keyword", foreground: "D3ADF7" },
      { token: "string", foreground: "C3D99B" },
      { token: "number", foreground: "EDBC83" },
      { token: "delimiter", foreground: "B0B9B4" },
    ],
    colors: {
      "editor.background": "#131416", "editor.foreground": "#F0F1F2",
      "editorLineNumber.foreground": "#666A75", "editorLineNumber.activeForeground": "#D3F950",
      "editor.lineHighlightBackground": "#1D1F24", "editor.selectionBackground": "#343F24",
      "editorCursor.foreground": "#D3F950", "editorIndentGuide.background1": "#292C32",
      "editorWidget.background": "#1D1F24", "editorWidget.border": "#35373C",
    },
  });
  monaco.editor.defineTheme("zero-light", { base: "vs", inherit: true, rules: [], colors: { "editor.background": "#FFFFFF" } });
};
export default function CodeEditor({ code, language, theme, onChange }: {
  code: string; language: Language; theme: "dark" | "light"; onChange: (value: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { loader.init().catch(() => setFailed(true)); }, []);
  const fallback = <textarea aria-label="Код программы" className="code-fallback" value={code} maxLength={20000} onChange={e => onChange(e.target.value)} spellCheck={false} />;
  if (failed) return <div className="editor-fallback-wrap"><span className="editor-notice">Редактор в базовом режиме</span>{fallback}</div>;
  return <Editor height="100%" language={language} path={`workspace.${language}`} value={code}
    theme={theme === "dark" ? "zero-dark" : "zero-light"} beforeMount={configure}
    onChange={value => onChange((value ?? "").slice(0, 20000))} loading={fallback}
    options={{
      ariaLabel: "Код программы", automaticLayout: true, minimap: { enabled: false },
      fontSize: 13, lineHeight: 25, fontFamily: "'Cascadia Code', Consolas, monospace",
      fontLigatures: true, padding: { top: 23, bottom: 24 }, scrollBeyondLastLine: false,
      lineNumbersMinChars: 3, glyphMargin: false, folding: true, renderLineHighlight: "line",
      overviewRulerLanes: 0, hideCursorInOverviewRuler: true, wordWrap: "on", tabSize: 4,
      scrollbar: { verticalScrollbarSize: 5, horizontalScrollbarSize: 5 },
      bracketPairColorization: { enabled: true }, smoothScrolling: true,
    }} />;
}
