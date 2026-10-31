import { useCallback, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useAccessibleDialog } from "@/hooks/useAccessibleDialog";
import {
  ConfirmDialogContext,
  type ConfirmFunction,
  type ConfirmOptions,
} from "./confirm-dialog.context";

function ConfirmDialog({
  options,
  onClose,
}: {
  options: ConfirmOptions;
  onClose: (confirmed: boolean) => void;
}) {
  const closeWithoutConfirming = useCallback(() => onClose(false), [onClose]);
  const dialogRef = useAccessibleDialog(closeWithoutConfirming);
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-warning" />
          <div>
            <h2 id="confirm-dialog-title" className="text-lg font-bold">
              {options.title ?? "Xác nhận thao tác"}
            </h2>
            <p
              id="confirm-dialog-description"
              className="mt-2 text-sm text-muted-foreground"
            >
              {options.message}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-xl border border-border px-4 py-2 font-semibold hover:bg-muted"
          >
            {options.cancelLabel ?? "Hủy"}
          </button>
          <button
            type="button"
            onClick={() => onClose(true)}
            className={`rounded-xl px-4 py-2 font-semibold text-white ${
              options.tone === "danger" ? "bg-danger" : "bg-primary"
            }`}
          >
            {options.confirmLabel ?? "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const close = useCallback((confirmed = false) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setOptions(null);
  }, []);
  const confirm = useCallback<ConfirmFunction>((nextOptions) => {
    resolver.current?.(false);
    setOptions(nextOptions);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {options && <ConfirmDialog options={options} onClose={close} />}
    </ConfirmDialogContext.Provider>
  );
}
