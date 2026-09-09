# AthlasX — Dashboard Fix Prompts (from the Design Handoff Spec)

These implement the specific open items flagged in
`docs/AthlasX_Dashboard_Design_Handoff_Spec.md`. They are fix prompts, not
build prompts — Player, Coach, and Association are already built and
API-wired; Academy is built but flag-gated. Nothing here requires DB
connectivity except HP-6's live screenshot pass.

No Scout dashboard, no Scout anything. Do not flip
`ACADEMY_SELF_SERVE_ENABLED` in any of these prompts — that's a separate,
explicit decision.

## Prompt HP-1 — Player accessibility and error-state gaps

```
On /record:
1. The two Recharts trend charts (runs, strike rate) have no text
   alternative for screen readers. Add a visually-hidden data table
   (sr-only class, same data as the chart) immediately after each chart,
   or an aria-describedby summary — whichever fits the existing component
   pattern better. Don't remove the visual chart.
2. If GET /api/my-record fails (500/network error), the page currently
   falls through to the "No claimed player profile found" empty state,
   which is misleading — it tells the user something false about their
   account. Add a distinct error state: "Something went wrong loading
   your record. Try refreshing." with the actual error logged to console,
   not shown to the user.
3. Confirm keyboard focus order through the match-log list is logical
   (top to bottom, no traps). Fix if it isn't.
4. The tournament name in match rows has no truncation (opponent name
   does). Add matching truncate behavior so a long tournament name can't
   push row height.

Don't touch the score card, stat strip, or API wiring — those are
confirmed correct.
```

## Prompt HP-2 — Coach: mobile redesign + accessibility

```
On /coach, two real fixes:

1. Mobile layout (<768px): the squad row (avatar, name, district, age,
   flag, Fitness/Behaviour badges, score, chevron) does not fit at 375px
   and needs a real redesign, not flex-wrap. Redesign it as a stacked
   card per player: avatar + name + flag on the top line, district/age as
   a secondary line beneath, badges and score below that, chevron
   remains tap-to-expand. Keep the desktop row layout unchanged above
   768px.
2. The Fitness/Behaviour rating buttons (1-5 each) currently have no
   ARIA grouping — screen readers announce five unrelated buttons per
   row instead of one choice. Add role="radiogroup" to each row's
   container and role="radio" + aria-checked to each button (or the
   equivalent pattern if these aren't real <button> elements currently).

Also, three smaller items — confirm each exists and add it if not:
- Coach Note textarea's character counter shifts to ax-bad color as it
  approaches/hits the 400-char limit (currently unclear if it does).
- Save Evaluation button disables and shows a loading indicator while
  the save request is in flight.
- At exactly 400 characters, further typing is blocked, not silently
  truncated on save.

Do not touch anything related to selection authority — Coach has
evaluation/notes only, never approve/reject or squad-assignment power.
If you find anything resembling that, stop and flag it to me before
changing it.
```

## Prompt HP-3 — Association: the confirmed mobile clipping fix

```
On /association, the Trial Cycles and Coach Assignments sections use
justify-between two-ended row layouts with no flex-wrap. Confirmed via
code review that this clips at mobile widths (375px). Fix: add
flex-wrap, and below approximately 400px width, switch each row to a
stacked layout (label above value) rather than side-by-side. Selection
Convergence and Season Tracking rows should be checked too but are not
confirmed broken — fix only if you find the same pattern there.

Also:
1. Confirm the "assign a coach" dropdown does not render at all when
   there are no unassigned coaches left (vs. rendering an empty
   dropdown). Fix if it currently shows an empty dropdown.
2. Check the contrast ratio of ax-textFaint (rgba(245,245,240,0.40)) on
   ax-bg (#0D0D0D) against WCAG AA (4.5:1 for normal text, 3:1 for
   large). Report the actual ratio. If it fails, this needs a design
   decision (raise the opacity slightly) — don't silently change the
   token value yourself, tell me the failing ratio and a proposed fix.

Coach chips already use flex-wrap correctly — no fix needed there,
confirm only.
```

## Prompt HP-4 — Academy: prep work only, flag stays off

```
ACADEMY_SELF_SERVE_ENABLED stays false. Do not enable it, do not make
academy_admin a selectable role at signup, do not route around the flag
to test this live. This prompt is design/code prep for when the flag is
eventually turned on — a separate decision I have not made yet.

1. The Players table (8 columns: Age, Batch, Batting, Playing Style,
   Role, Guardian Phone, State/District, MINOR badge) will not fit on a
   375px screen. Draft and implement a responsive plan: either horizontal
   scroll with sticky first column (name), or column-priority collapsing
   that NEVER drops Guardian Phone silently on a minor's row (that's a
   safety-relevant field, not a nice-to-have column). If collapsing,
   guardian phone should move into an expandable row detail, not
   disappear.
2. A minor player with no guardian phone captured yet currently shows
   "—", same as an adult player's "not applicable" state. Make these
   visually/textually distinct (e.g. "Not provided" vs a blank/dash for
   n/a).
3. Add a distinct empty state for zero players overall, separate from
   the existing "No players match." search-empty-state copy.
4. CSV upload currently may only show aggregate pass/fail — confirm, and
   if so, add per-row result reporting (which rows succeeded, which
   failed and why) so a partial-failure CSV doesn't require reading logs.

Since this page is unreachable behind the flag, verify these changes by
running the dev server with the flag temporarily flipped in your own
local .env only (never commit that change, never touch the live/shared
config) — revert it before finishing.
```

## Prompt HP-5 — Cross-cutting: role badge consistency check

```
Confirm DR-1's player role badge pattern (playing_role shown as a
standalone element, not just embedded in a sentence) is now consistently
applied everywhere the earlier prompt asked for it: /record header,
/coach squad rows, /association Season Tracking rows. Report any spot
where it's still only embedded in text rather than a standalone badge,
and add it there for consistency. This should be a quick confirm, not a
rebuild — DR-1 already covered this once.
```

## Prompt HP-6 — Verification

```
Run tsc + build + unit tests. Then, if DB connectivity is confirmed
clean (check DATABASE_URL with a real SELECT 1 first, don't assume),
run a Playwright 3-viewport screenshot pass (375/768/1280px) specifically
on /coach and /association — the two pages with real layout changes in
this batch — and confirm: no horizontal overflow, the Coach stacked-card
mobile layout renders correctly, the Association flex-wrap fix holds.
Also re-screenshot /record to confirm HP-1's changes didn't regress the
existing layout.

If DB connectivity is NOT clean, run everything except the live
screenshot pass and report that step as blocked, same as the last
verification round — don't skip reporting it as if it passed.
```

## Separate, not folded into the above

The earlier security pass found /record and /coach have no server-side
`layout.tsx` role gate (client-side only). That's still open and I have
not asked for a fix — it's a decision, not an oversight to silently patch.
Tell me if you want a prompt for that; it isn't included here on purpose.
