import type { PropsWithChildren } from "react";
import { useIsFetching } from "@tanstack/react-query";

import { ToastViewport } from "@/components/ui/toast";

export function App({ children }: PropsWithChildren) {
  const isFetching = useIsFetching();

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-50 h-px overflow-hidden bg-transparent"
        aria-hidden="true"
      >
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: isFetching > 0 ? "100%" : "0%" }}
        />
      </div>
      {children}
      <ToastViewport />
    </>
  );
}
