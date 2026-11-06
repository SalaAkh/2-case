import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Tomorrow School · Zero-Spoiler Debugger",
  description: "Тренажёр самостоятельного мышления Tomorrow School: прогнозируйте выполнение кода, исследуйте ошибки, объясняйте новичку и проверяйте понимание на новой задаче.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#101112" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" suppressHydrationWarning><body>{children}</body></html>;
}
