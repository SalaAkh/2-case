"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="fatal-error"><h1>Не удалось открыть рабочее пространство</h1><p>Локальная история сохраняется в этом браузере.</p><button className="ui-button button-primary button-default" onClick={reset}>Попробовать снова</button></main>;
}
