/**
 * Unit — dashboard chrome policy (src/lib/chrome.ts)
 *
 * The existing shell used to show every nav section and a hardcoded
 * "Hritvik Garg / AthlasX Ops" identity. Ticket 07 makes that policy
 * honest: nav is filtered by the session role, the profile chrome shows
 * the session email and role, and an anonymous visit to / is sent to
 * NextAuth's built-in sign-in.
 */
import { describe, it, expect } from 'vitest'
import { chromeIdentity, navHrefsForRole, rootDestination } from '@/lib/chrome'

describe('navHrefsForRole', () => {
  it('does not show association ingest to a player', () => {
    const hrefs = navHrefsForRole('player')
    expect(hrefs).toContain('/record')
    expect(hrefs).not.toContain('/ingest')
  })

  it('does not show player-only items to a selector as if they were ops', () => {
    const hrefs = navHrefsForRole('selection_panel')
    expect(hrefs).toContain('/grading')
    expect(hrefs).not.toContain('/record')
    expect(hrefs).not.toContain('/profile')
    expect(hrefs).not.toContain('/ingest')
  })

  it('shows association ingest to association staff, not selection or player items', () => {
    const hrefs = navHrefsForRole('association')
    expect(hrefs).toContain('/ingest')
    expect(hrefs).toContain('/dashboard')
    expect(hrefs).not.toContain('/grading')
    expect(hrefs).not.toContain('/record')
  })

  it('shows season items to a coach, not association ingest', () => {
    const hrefs = navHrefsForRole('coach')
    expect(hrefs).toContain('/coach')
    expect(hrefs).toContain('/tracking')
    expect(hrefs).not.toContain('/ingest')
  })

  it('shows every section to athlasx_ops', () => {
    const hrefs = navHrefsForRole('athlasx_ops')
    expect(hrefs).toContain('/ingest')
    expect(hrefs).toContain('/grading')
    expect(hrefs).toContain('/coach')
    expect(hrefs).toContain('/record')
  })
})

describe('rootDestination', () => {
  it('sends an anonymous visit to NextAuth built-in sign-in', () => {
    expect(rootDestination(null)).toBe('/api/auth/signin?callbackUrl=/dashboard')
  })

  it('sends a signed-in visit with no role to the dashboard (fallback)', () => {
    expect(rootDestination({ user: { id: 'user-1' } })).toBe('/dashboard')
  })

  // Regression test: / used to redirect every signed-in user to /dashboard
  // regardless of role, but GET /api/dashboard's requireRole excludes
  // 'player' — a player's first authenticated page load 403'd. Each role
  // must land on its own home page instead.
  it("routes a player to their own record, not the association dashboard", () => {
    expect(rootDestination({ user: { id: 'p1', role: 'player' } })).toBe('/record')
  })

  it('routes a coach to /coach', () => {
    expect(rootDestination({ user: { id: 'c1', role: 'coach' } })).toBe('/coach')
  })

  it('routes a selector to the candidate pool', () => {
    expect(rootDestination({ user: { id: 's1', role: 'selection_panel' } })).toBe('/selection')
  })

  it('routes association staff and ops to the dashboard', () => {
    expect(rootDestination({ user: { id: 'a1', role: 'association' } })).toBe('/dashboard')
    expect(rootDestination({ user: { id: 'o1', role: 'athlasx_ops' } })).toBe('/dashboard')
  })
})

describe('chromeIdentity', () => {
  it('shows the session email and role, not a hardcoded name', () => {
    expect(chromeIdentity({ email: 'staff@test.local', role: 'association' })).toEqual({
      email: 'staff@test.local',
      roleLabel: 'Association',
    })
  })

  it('labels each platform role in the chrome', () => {
    expect(chromeIdentity({ email: 'p@test.local', role: 'player' }).roleLabel).toBe('Player')
    expect(chromeIdentity({ email: 's@test.local', role: 'selection_panel' }).roleLabel).toBe('Selection')
    expect(chromeIdentity({ email: 'c@test.local', role: 'coach' }).roleLabel).toBe('Coach')
    expect(chromeIdentity({ email: 'ops@test.local', role: 'athlasx_ops' }).roleLabel).toBe('AthlasX Ops')
  })
})
