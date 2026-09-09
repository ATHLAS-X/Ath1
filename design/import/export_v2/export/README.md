# ATHLASX — Onboarding Export

## Contents

    academy-onboarding-v3.html   +  academy-onboarding-v3.css
    coach-onboarding.html        +  coach-onboarding.css

Each page's CSS has been extracted into its own stylesheet and linked from the
HTML via <link rel="stylesheet">. Keep each .html next to its .css — open the
.html directly in any browser, no build step or server needed.

The inline <script> block stays inside each HTML file: it drives step navigation,
validation, conditional reveals and the chip/optcard/stepper state. Removing it
leaves the markup styled but inert.

## Academy Onboarding (5 steps)
  1 Account          — phone + 6-box OTP
  2 Academy Identity — name, city/district/state, year, type optcards, contact, logo upload
  3 Facilities & Staff — ground chips, nets stepper, bowling machine, head coach, ex-pro reveal
  4 Programs         — age groups, formats, timings, fee range, BCCI/state affiliation reveals
  5 Go Live          — invite coaches, create first batch
  Opens on Step 2 as the hero state.

## Coach Onboarding (4 steps)
  1 Account         — name, mobile, email, city, headshot
  2 Experience      — role optcards, specialisation chips, years stepper, playing-history reveal
  3 Certifications  — BCCI level cards, verified cert card, upload zone, review callout
  4 Join Academy    — invite code, browse academies, independent option
  Opens on Step 3 as the hero state.

## Design tokens (identical in both stylesheets)

    --bg:#0D0D0D            --bg-soft:#141312
    --text:#F5F5F0          --text-dim:rgba(245,245,240,0.62)
    --text-faint:rgba(245,245,240,0.4)
    --accent:#FF8A1E        --accent-bright:#FFA64D
    --ov08 / --ov14 / --ov22   amber overlays at 0.08 / 0.14 / 0.22
    --card-border:rgba(245,245,240,0.14)
    --field-bg:rgba(245,245,240,0.06)
    --ok:#38d39f            --bad:#ff5a4d
    --phi2:2.618rem         golden-ratio spacing unit
    --ease:cubic-bezier(0.22,1,0.36,1)

Fonts (Google, loaded via <link> in each HTML head):
  Anton                     display headings — uppercase, 400, line-height 0.92
  Barlow Semi Condensed 700 labels, chips, buttons, badges — uppercase, tracked
  Barlow 400-600            body copy, inputs

Layout shell: .ob { display:grid; grid-template-columns:1fr 2fr; } — rail : form.
Both pages collapse the rail above the form at 900px and go single-column at 560px,
and both honour prefers-reduced-motion.

## Note
There is no "Association" page in this project yet. The closest existing flows are
Academy (above) and the Scout flow inside "AthlasX Onboarding.html". Ask and a
State/Cricket-Association onboarding can be built on these same tokens.
