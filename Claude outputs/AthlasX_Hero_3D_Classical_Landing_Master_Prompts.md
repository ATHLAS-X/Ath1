# AthlasX — 3D/Spatial Classical Hero + Scroll-Helix Landing Page (Master Prompts)

Moodboard read as two clusters: "ancient" (Berlin '36 + Helsinki '40 Olympic
posters, the Greek pankration illustration, the Greek-relief "Meet the World
in Greece" grid) and "collage" (sun-head mixed-media piece, basketball x
Michelangelo, the three F1 fan posters, the Ziwe Fumugoh "Browser History
2020" piece). The ancient set is flat illustration/relief — good for motif,
not for staging. Of the collage set, only the Ziwe piece is actually
3D/spatial (a built classical environment — columns, pediment, cloud
volumes, marble busts at real depth — with a photographic figure standing
inside it, not pasted on top); the rest (F1 posters, basketball/Michelangelo)
are genuine flat photo-cutout collage, which is explicitly what's being
avoided here.

**Do not feed the moodboard images themselves into either prompt as
buildable assets.** The Ziwe piece and the three F1 posters are named
third-party editorial/fan work (one watermarked "do not repost") — they're
referenced below only as structural/mood description, never to be
reproduced, traced, or closely imitated compositionally. Nothing in this
doc should result in AthlasX's hero looking like a re-skin of any specific
one of them.

Concept translated for AthlasX: a real 3D classical space (columns +
pediment fragment + drifting cloud volume, rebuilt from scratch, not
photographed) that a player figure stands inside with genuine parallax
depth, threaded by a golden helix ribbon (echoes the sun-rays / discus arc
from the ancient set) whose position animates as the visitor scrolls the
whole landing page, not just the hero panel.

Known open gap this runs into: per Planning Notes, no real hero
photo/art asset has ever arrived — this batch does not solve that. Build
with procedural/placeholder geometry and materials, real code, clearly
labeled as a placeholder pending actual commissioned assets — do not block
on missing art, and do not silently treat placeholder geometry as final.

## DESIGN-1 — Creative direction + handoff spec (no code)

```
Produce a full visual/handoff spec (not code) for a new AthlasX landing-page
Hero + a page-wide scroll motif, replacing the current hero panel.

Read first: docs/design.md and the existing `ax.*` Tailwind token set
(docs/AthlasX_Dashboard_Design_Handoff_Spec.md has the full token table) —
extend that system, don't invent a parallel palette/type scale.

Concept: "elevate a real athlete into a built classical space," staged with
actual depth, not collage. Reference points to study for STRUCTURE only,
never to reproduce or closely imitate: a 3D classical environment (marble
columns, a pediment fragment, drifting cloud volume, small relief/bust
details at varying depth) that a real subject stands inside, lit from one
consistent source, foreground/midground/background separated by real
parallax — as opposed to flat cutout collage (photo layers stacked with
grain/halftone and no true depth), which this explicitly rejects.

Motif to design: a single continuous golden helix ribbon that begins in the
hero (winding between the columns) and continues down the page as the
visitor scrolls, its position/rotation tied to scroll progress, marking
milestones at each subsequent section (e.g. one "node" lights up per section
entered) rather than existing only in the hero.

Deliver, in the Handoff Spec format (Overview / Layout / Design Tokens Used
/ Components / States and Interactions / Responsive Behavior / Edge Cases /
Animation-Motion / Accessibility):

1. Palette and type: extended from `ax.*` tokens, not replacing them —
   specify exactly which existing tokens carry over and which (if any) new
   tokens this needs, with a one-line justification for each new one.
2. Spatial staging: a depth map of the hero (which elements sit at which
   z-depth/parallax speed), described precisely enough that a build session
   can implement it without guessing (e.g. "column layer: -40% scroll
   speed relative to viewport, cloud layer: -70%, ribbon: pinned to scroll
   progress 1:1").
3. Helix ribbon spec: path shape, thickness, glow/gradient, easing, how it
   reads on mobile portrait vs desktop wide, and what happens to it at the
   page's non-hero sections (does it thin out, go monochrome, disappear
   between sections and reappear, etc. — pick one and justify it).
4. Player-figure treatment: since no real hero photo/art exists yet
   (flagged, don't solve it here) — specify what a PLACEHOLDER version
   should look like (silhouette, low-poly stylized form, or negative-space
   cutout) so a build session has something concrete and not a blank canvas,
   and specify what the real asset (photo or commissioned art) needs to
   satisfy geometrically/lighting-wise to drop in later without a rebuild.
5. Reduced-motion / low-end fallback: an explicit static (non-WebGL,
   non-scroll-tied) version of the hero for `prefers-reduced-motion` and for
   low-end/low-bandwidth mobile — describe it as a real deliverable, not an
   afterthought, since a meaningful share of guardian users are on
   budget Android devices per the existing DPDP/onboarding context.
6. Explicitly confirm: nothing in this spec asks for or resembles any of
   the specific third-party moodboard pieces (name them and state how this
   diverges from each) — this is a compliance/copyright check on the spec
   itself before it goes anywhere near implementation.
```

## CODE-1 — Implementation (Claude Code, local repo)

```
Build the Hero + page-wide scroll-helix from DESIGN-1's spec (wait for that
spec before starting — if it doesn't exist yet, stop and ask, don't
improvise the visual design yourself). This is a client-side UI change only
— no schema, no API, no data model touched. Standard rule still applies:
don't fix unrelated pre-existing issues you notice along the way, report
them instead.

1. Read docs/design.md and the current landing page hero implementation
   first. Confirm which `ax.*` tokens exist today before touching anything.
2. Recommended default (confirm before deep implementation, don't assume
   final): react-three-fiber + drei for the classical
   columns/pediment/cloud-volume layer, driven by scroll progress via
   Framer Motion's `useScroll` (or GSAP ScrollTrigger if that's already a
   dependency — check package.json first, don't add a second animation
   library if one's already in use). Mount the 3D canvas client-only
   (`dynamic(..., { ssr: false })`), never server-rendered.
3. Build the helix ribbon as its own component that lives above/alongside
   the rest of the landing page's sections (not nested only inside the
   Hero component), reading a single shared scroll-progress value so its
   position stays continuous as the visitor scrolls past the hero into the
   rest of the page.
4. Player-figure placeholder: implement exactly what DESIGN-1 specifies for
   the placeholder treatment (silhouette/low-poly/negative-space) — real
   code, not a static image import of anything from this conversation's
   moodboard. State plainly in your report that this is a placeholder
   pending real commissioned art/photo, same open item as the Planning
   Notes' unresolved hero-image gap.
5. Implement the `prefers-reduced-motion` and low-end-mobile fallback from
   DESIGN-1 as a real, testable code path — not a CSS media query left
   empty. Confirm what triggers the fallback (a media query, a device/perf
   check, or both) and report which.
6. No image or asset from this conversation's attachments gets imported
   into the repo, directly or as a traced/re-derived asset. All classical
   geometry (columns, pediment, relief detail) is procedurally built
   (primitives + materials/shaders) or left as an explicit TODO hook for a
   real commissioned glTF/model — never a copy of the referenced posters/
   collage pieces.
7. Test at 375/768/1280px (matches this engagement's existing responsive-
   audit convention). Run a Lighthouse/bundle-size check specifically for
   whatever 3D/animation library gets added and report the actual number —
   this is a marketing-facing landing page, first-load cost matters.
8. Report explicitly: which tech was actually used (and why, if it
   diverged from the recommendation above), the bundle-size delta, confirmed
   reduced-motion/low-end fallback behavior (with how you tested it, not
   just "should work"), and whether placeholder or real assets ended up in
   the final build.
```
