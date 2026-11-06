import type { Metadata } from "next";
import { Suspense } from "react";
import InvestigationLab from "@/components/investigation-lab";

export const metadata: Metadata = {
  title: "Режим расследования · Tomorrow School",
  description: "Предскажите результат, проверьте гипотезу, станьте наставником и примените понимание в новой задаче.",
};

export default function InvestigationPage() {
  return <Suspense fallback={<p className="lab-loading" role="status">Открываем учебный путь…</p>}><InvestigationLab /></Suspense>;
}
