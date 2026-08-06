"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmVariant = "primary",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "secondary" | "ghost" | "destructive";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={busy ? () => undefined : onClose} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={busy}>
          {busy ? "Procesando..." : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
