import en from "./i18n/en.json";
import kk from "./i18n/kk.json";

export const locales = ["ru", "kk", "en"] as const;
export type Locale = typeof locales[number];
export const localeNames: Record<Locale, string> = { ru: "Русский", kk: "Қазақша", en: "English" };
export const dictionaries: Record<Exclude<Locale, "ru">, Record<string, string>> = { en, kk };
export function isLocale(value: unknown): value is Locale { return locales.includes(value as Locale); }
export function translate(locale: Locale, source: string, values: Record<string, string | number> = {}): string {
  const dictionary = locale === "ru" ? undefined : dictionaries[locale];
  const lookup = (text: string) => dictionary && Object.hasOwn(dictionary, text) ? dictionary[text] : undefined;
  const translated = lookup(source) ?? source.split("\n\n").map(part => lookup(part) ?? part).join("\n\n");
  return translated.replace(/\{(\d+)\}/g, (match, key: string) => String(values[key] ?? match));
}
// Use only with authored lesson data, never with learner-written text or live AI replies.
export function localize<T>(value: T, locale: Locale): T {
  if (typeof value === "string") return translate(locale, value) as T;
  if (Array.isArray(value)) return value.map(item => localize(item, locale)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localize(item, locale)])) as T;
  return value;
}
const authoredSources = new Map<string, string>();
for (const dictionary of Object.values(dictionaries)) for (const [source, target] of Object.entries(dictionary)) authoredSources.set(target, source);
export function translateAuthored(locale: Locale, text: string): string {
  return text.split("\n\n").map(part => translate(locale, authoredSources.get(part) ?? part)).join("\n\n");
}
