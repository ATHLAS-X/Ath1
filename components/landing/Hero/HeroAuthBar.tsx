import Link from "next/link";

/* The source spec's buttons were a non-functional demo (disable + "…" pulse
   for 900ms, no real destination) — replaced with real navigation to the
   same targets the old HeroOverlay used: /auth/login and /auth/signup. */
export default function HeroAuthBar() {
  return (
    <nav className="hx-auth" aria-label="Account">
      <Link href="/auth/login" className="hx-btn hx-btn-outline">
        Log In
      </Link>
      <Link href="/auth/signup" className="hx-btn hx-btn-fill">
        Sign In
      </Link>
    </nav>
  );
}
