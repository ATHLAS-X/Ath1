"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

/* Dashboards with their own full sidebar — Navbar would duplicate navigation */
const HIDE_PREFIXES = ["/scout", "/admin", "/verify", "/workflow", "/academy", "/onboarding"];

export default function ConditionalNavbar() {
  const pathname = usePathname() ?? "";
  if (HIDE_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return <Navbar />;
}
