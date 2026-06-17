"use client";

import { useEffect } from "react";

interface Props {
  message: string;
  onClose: () => void;
  durationMs?: number;
}

export default function Toast({ message, onClose, durationMs = 3000 }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [onClose, durationMs]);

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg border font-semibold"
      style={{
        background: "var(--card)",
        borderColor: "var(--accent)",
        color: "var(--accent)",
      }}
    >
      {message}
    </div>
  );
}
