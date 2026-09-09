'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { Settings, LogOut, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { chromeIdentity, pageTitleForPath } from '@/lib/chrome'

/**
 * Shared dashboard top bar — wordmark + page title/breadcrumb on the
 * left, account menu on the right. No role-switcher pills (there never
 * was one in this codebase's actual dashboard — the account menu here
 * fully replaces that space). Sits alongside DashboardSidebar in
 * src/app/(dashboard)/layout.tsx, not inside it — a separate component
 * since the sidebar's own bottom "user row" is being removed in favor of
 * this top bar's account menu owning that responsibility.
 */
export default function DashboardTopBar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const identity = chromeIdentity(session?.user)
  const initials = identity.email.slice(0, 2).toUpperCase()
  const title = pageTitleForPath(session?.user?.role ?? '', pathname)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <header className="h-14 flex items-center justify-between gap-4 px-4 sm:px-6 border-b border-ax-cardBorder bg-ax-bgSoft lg:ml-60">
      <div className="flex items-center gap-4 min-w-0">
        <Link href="/" className="hidden sm:flex items-center gap-1 shrink-0 font-barlow-semi uppercase tracking-[0.18em] font-bold text-sm text-ax-text">
          Athlas<span className="text-ax-accent">X</span>
        </Link>
        <span className="hidden sm:block w-px h-5 bg-ax-cardBorder shrink-0" />
        <h1 className="font-anton uppercase text-base sm:text-lg text-ax-text truncate">{title}</h1>
      </div>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-ax-cardBorder hover:border-white/30 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-[rgba(255,138,30,0.16)] border-[1.5px] border-ax-accent flex items-center justify-center text-xs font-bold text-ax-accentBright shrink-0">
            {initials || '—'}
          </div>
          <ChevronDown className={cn('w-3.5 h-3.5 text-ax-textFaint transition-transform', menuOpen && 'rotate-180')} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-[calc(100%+0.5rem)] w-56 rounded-ax-md border border-ax-cardBorder bg-ax-bg shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)] overflow-hidden z-40">
            <div className="px-3.5 py-3 border-b border-ax-cardBorder">
              <p className="text-xs font-bold text-ax-text truncate">{identity.email || 'Not signed in'}</p>
              <p className="text-[11px] text-ax-textFaint truncate">{identity.roleLabel}</p>
            </div>
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ax-textDim hover:text-ax-text hover:bg-white/[0.04] transition-colors"
            >
              <Settings className="w-4 h-4" /> Settings
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/api/auth/signin' })}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ax-textDim hover:text-ax-bad hover:bg-white/[0.04] transition-colors text-left"
            >
              <LogOut className="w-4 h-4" /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
