import { createContext, useContext } from "react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
}

export type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmDialogContext = createContext<ConfirmFunction | null>(null);

export function useConfirmDialog(): ConfirmFunction {
  const context = useContext(ConfirmDialogContext);
  if (!context)
    throw new Error(
      "useConfirmDialog must be used inside ConfirmDialogProvider",
    );
  return context;
}
