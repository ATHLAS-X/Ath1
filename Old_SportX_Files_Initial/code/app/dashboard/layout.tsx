import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard | AthlasX" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
