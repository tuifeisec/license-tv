import { create } from "zustand";

type ToastTone = "default" | "success" | "warning" | "destructive";

export interface ToastRecord {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
}

interface UiState {
  toasts: ToastRecord[];
  pushToast: (toast: Omit<ToastRecord, "id">) => void;
  removeToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  pushToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: crypto.randomUUID(),
          ...toast,
        },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((item) => item.id !== id),
    })),
}));

export function notify(options: Omit<ToastRecord, "id">) {
  useUiStore.getState().pushToast(options);
}
