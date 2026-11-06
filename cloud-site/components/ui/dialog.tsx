"use client";
import { useI18n } from "@/components/locale-provider";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { t } = useI18n();

  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="dialog-overlay" />
    <DialogPrimitive.Content className={cn("dialog-content", className)}>
      {children}
      <DialogPrimitive.Close className="dialog-close" aria-label={t("Закрыть окно")}><X size={18} /></DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>;
}
