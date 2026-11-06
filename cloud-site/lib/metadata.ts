import type { Metadata } from "next";
import { isLocale, translate } from "./i18n";

export type LocalePageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function localizedMetadata(props: LocalePageProps, title: string, description?: string): Promise<Metadata> {
  const { lang } = await props.searchParams;
  const locale = isLocale(lang) ? lang : "ru";
  return { title: translate(locale, title), ...(description ? { description: translate(locale, description) } : {}) };
}
