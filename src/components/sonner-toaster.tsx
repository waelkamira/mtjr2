"use client";

import { Toaster } from "sonner";

export default function SonnerToaster() {
  return (
    <Toaster
      className="clay-toaster"
      closeButton
      duration={4000}
      position="bottom-right"
      richColors
      theme="light"
      toastOptions={{
        className: "clay-toast",
        classNames: {
          title: "clay-toast-title",
          description: "clay-toast-description"
        }
      }}
      visibleToasts={4}
    />
  );
}
