import PilotContent from "@/components/pilot-content";
import { localizedMetadata, type LocalePageProps } from "@/lib/metadata";
export async function generateMetadata(props: LocalePageProps) { return localizedMetadata(props, "Пилот и методика · Zero-Spoiler", "Пройдите путь студента и посмотрите, как меняются его рассуждения."); }
export default function PilotPage() { return <PilotContent />; }
