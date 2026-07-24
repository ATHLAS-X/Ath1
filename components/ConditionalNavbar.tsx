"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

/* Dashboards with their own full sidebar/topbar — Navbar would duplicate
   navigation. /dashboard belongs here too: PlayerDashboardClient (and the
   coach/scout/academy equivalents) each render their own logo+bell+avatar
   topbar, so the global Navbar above it was a second, redundant nav bar. */
const HIDE_PREFIXES = ["/scout", "/admin", "/verify", "/workflow", "/academy", "/dashboard"];

export default function ConditionalNavbar() {
  const pathname = usePathname() ?? "";
  if (HIDE_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return <Navbar />;
}
