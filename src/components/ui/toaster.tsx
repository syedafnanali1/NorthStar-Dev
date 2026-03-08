// src/components/ui/toaster.tsx
"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { cn } from "@/lib/utils";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  toast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 3500);
  }, [removeToast]);

  // Expose globally via custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ message: string; type: Toast["type"] }>;
      addToast(custom.detail.message, custom.detail.type);
    };
    window.addEventListener("northstar:toast", handler);
    return () => window.removeEventListener("northstar:toast", handler);
  }, [addToast]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9000] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "animate-slide-in px-5 py-3 rounded-full text-sm font-medium shadow-modal",
            "flex items-center gap-2 pointer-events-auto",
            "text-cream-paper",
            toast.type === "success" && "bg-ink",
            toast.type === "error" && "bg-rose text-white",
            toast.type === "info" && "bg-sky text-white"
          )}
        >
          {toast.type === "success" && <span>✓</span>}
          {toast.type === "error" && <span>✗</span>}
          {toast.message}
        </div>
      ))}
    </div>
  );
}

// Utility function to fire a toast from anywhere
export function toast(message: string, type: Toast["type"] = "success") {
  window.dispatchEvent(
    new CustomEvent("northstar:toast", { detail: { message, type } })
  );
}
