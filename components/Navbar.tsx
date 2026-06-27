"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LayoutDashboard, User, Video, Upload, LogOut, Menu, X } from "lucide-react";
import AthlasXLogo from "@/components/AthlasXLogo";

const HIDDEN_PATHS = new Set(["/", "/auth/login", "/auth/signup"]);

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { href: "/profile/setup", label: "My Profile", icon: <User size={16} /> },
  { href: "/videos", label: "My Videos", icon: <Video size={16} /> },
  { href: "/videos/upload", label: "Upload Video", icon: <Upload size={16} /> },
];

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  if (HIDDEN_PATHS.has(pathname)) return null;
  if (pathname.startsWith("/onboarding")) return null;
  /* Scout/Admin dashboards have their own full sidebars — ConditionalNavbar handles those.
     Profile pages KEEP the Navbar (it has the user's account menu / logout). */
  // Only hide for unauthenticated users — still show while session is loading.
  if (status === "unauthenticated") return null;

  const name = session?.user?.name ?? "Player";
  const initial = name.trim().charAt(0).toUpperCase() || "P";

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      className="hx-tokens sticky top-0 z-40 border-b backdrop-blur"
      style={{ background: "rgba(13,13,13,0.85)", borderColor: "var(--hx-card-border)" }}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Wordmark */}
        <Link href="/dashboard" className="flex items-center">
          <AthlasXLogo />
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
              style={{
                color: isActive(item.href) ? "var(--hx-accent-bright)" : "var(--hx-text-dim)",
                background: isActive(item.href) ? "var(--hx-overlay-accent-14)" : "transparent",
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right cluster */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background: "var(--hx-accent)", color: "#1a0e02" }}
            >
              {initial}
            </div>
            <span className="text-sm max-w-[120px] truncate" style={{ color: "var(--hx-text)" }} title={name}>{name}</span>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm"
            style={{ width: "auto", border: "1px solid rgba(248,113,113,0.35)", color: "#F87171", background: "transparent" }}
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden p-2 rounded-md"
          style={{ color: "var(--hx-accent-bright)" }}
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t" style={{ borderColor: "var(--hx-card-border)", background: "var(--hx-bg-soft)" }}>
          <div className="px-4 py-3 space-y-1">
            <div className="flex items-center gap-2 pb-3 mb-2 border-b" style={{ borderColor: "var(--hx-card-border)" }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                style={{ background: "var(--hx-accent)", color: "#1a0e02" }}
              >
                {initial}
              </div>
              <span className="text-sm truncate" style={{ color: "var(--hx-text)" }} title={name}>{name}</span>
            </div>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
                style={{
                  color: isActive(item.href) ? "var(--hx-accent-bright)" : "var(--hx-text-dim)",
                  background: isActive(item.href) ? "var(--hx-overlay-accent-14)" : "transparent",
                }}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/" });
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm mt-2"
              style={{ border: "1px solid rgba(248,113,113,0.35)", color: "#F87171", background: "transparent" }}
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
