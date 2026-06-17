import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  label: string;
  value: string | number;
}

export default function StatCard({ icon, label, value }: Props) {
  return (
    <div className="sx-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          {label}
        </p>
        <div style={{ color: "var(--accent)" }}>{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-bold" style={{ color: "var(--accent)" }}>
        {value}
      </p>
    </div>
  );
}
