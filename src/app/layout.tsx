import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Tomorrow School · Zero-Spoiler Debugger",
  description: "ИИ-наставник Tomorrow School. Исследуйте ошибки в коде через вопросы и приходите к решению самостоятельно.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#101112" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" suppressHydrationWarning><body>{children}</body></html>;
}
