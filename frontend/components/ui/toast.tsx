"use client";

import { toast as sonnerToast } from "sonner";

export interface ToastOptions {
  title?: string;
  description?: string;
  type?: "success" | "error" | "info" | "warning";
}

export function useToast() {
  const toast = ({ title, description, type }: ToastOptions) => {
    const message = title || description || "";
    const opts = title && description ? { description } : undefined;

    switch (type) {
      case "success":
        sonnerToast.success(message, opts);
        break;
      case "error":
        sonnerToast.error(message, opts);
        break;
      case "warning":
        sonnerToast.warning(message, opts);
        break;
      case "info":
      default:
        sonnerToast.info(message, opts);
        break;
    }
  };

  return { toast };
}

export { sonnerToast as toast };

