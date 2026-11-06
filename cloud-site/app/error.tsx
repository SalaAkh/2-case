"use client";
import { useI18n } from "@/components/locale-provider";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useI18n();

  return <main className="fatal-error"><h1>{t("Не удалось открыть рабочее пространство")}</h1><p>{t("Локальная история сохраняется в этом браузере.")}</p><button className="ui-button button-primary button-default" onClick={reset}>{t("Попробовать снова")}</button></main>;
}
