import Workspace from "@/components/workspace";
import { localizedMetadata, type LocalePageProps } from "@/lib/metadata";
export async function generateMetadata(props: LocalePageProps) {
  return localizedMetadata(props, "Tomorrow School · Zero-Spoiler Debugger", "Тренажёр самостоятельного мышления Tomorrow School: прогнозируйте выполнение кода, исследуйте ошибки, объясняйте новичку и проверяйте понимание на новой задаче.");
}
export default function Home() { return <Workspace />; }
