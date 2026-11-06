import { Suspense } from "react";
import InvestigationLab from "@/components/investigation-lab";
import { LearningLoading } from "@/components/locale-provider";
import { localizedMetadata, type LocalePageProps } from "@/lib/metadata";

export async function generateMetadata(props: LocalePageProps) {
  return localizedMetadata(props, "Режим расследования · Tomorrow School", "Предскажите результат, проверьте гипотезу, станьте наставником и примените понимание в новой задаче.");
}

export default function InvestigationPage() {
  return <Suspense fallback={<LearningLoading />}><InvestigationLab /></Suspense>;
}
