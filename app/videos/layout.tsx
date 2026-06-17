import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Videos | SportX" };

export default function VideosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
