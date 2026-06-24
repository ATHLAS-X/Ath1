"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { Eye, EyeOff, Mail, Lock, User, Megaphone, Building2, Search } from "lucide-react";
import { anton, barlow, barlowSemiCondensed } from "@/components/landing/Hero/fonts";
import { heroStyles } from "@/components/landing/Hero/styles";
import HeroCorner from "@/components/landing/Hero/HeroCorner";
import { authStyles } from "./auth-styles";

/* Visual port of the standalone "AthlasX Auth.html" spec onto this real
   component — see Master 22. The static file's <script> was 100% fake demo
   logic (setTimeout, no network calls); none of it was ported. Every
   submit path below still goes through real next-auth / API calls. */

const ACCENT_RGB = "255, 138, 30"; // var(--hx-accent-rgb) — can't read a CSS var into a JS template string
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormFieldProps {
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ReactNode;
  showToggle?: boolean;
  onToggle?: () => void;
  showPassword?: boolean;
  autoComplete?: string;
}

const AnimatedFormField: React.FC<FormFieldProps> = ({
  type, placeholder, value, onChange, icon,
  showToggle, onToggle, showPassword, autoComplete,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  return (
    <div className="relative group">
      <div
        className="relative overflow-hidden rounded-lg border transition-all duration-300 ease-in-out"
        style={{
          background: "var(--hx-field-bg)",
          borderColor: isFocused ? "var(--hx-accent)" : "var(--hx-card-border)",
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200"
          style={{ color: isFocused ? "var(--hx-accent)" : "var(--hx-text-dim)" }}
        >
          {icon}
        </div>
        <input
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full bg-transparent pl-10 pr-12 pt-7 pb-2 focus:outline-none autofill-dark"
          style={{ color: "var(--hx-text)", fontSize: "0.875rem", lineHeight: 1.2 }}
        />
        <label
          className="absolute left-10 transition-all duration-200 ease-in-out pointer-events-none"
          style={{
            top: isFocused || value ? "0.3rem" : "50%",
            transform: isFocused || value ? "none" : "translateY(-50%)",
            fontSize: isFocused || value ? "0.65rem" : "0.85rem",
            lineHeight: 1.2,
            color: isFocused || value ? "var(--hx-accent)" : "var(--hx-text-dim)",
            fontWeight: isFocused || value ? 600 : 400,
          }}
        >
          {placeholder}
        </label>
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: "var(--hx-text-dim)" }}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
        {hovering && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(200px circle at ${mouse.x}px ${mouse.y}px, rgba(${ACCENT_RGB}, 0.18) 0%, transparent 70%)`,
            }}
          />
        )}
      </div>
    </div>
  );
};

/* Collage tiles for the left showcase column — same 5-sport subset and
   image-load/error fallback pattern as the Hero's collage (Master 20),
   reusing the Hero's own .hx-img/.hx-img--ready classes rather than a
   duplicate zoom-settle treatment. */
interface Tile {
  area: "ta" | "tb" | "tc" | "td" | "te";
  sport: string;
  src: string;
  alt: string;
  filter: string;
  focus?: string;
}
const TILES: Tile[] = [
  {
    area: "ta", sport: "motorsport", src: "/images/hero/motorsport.jpg",
    alt: "Motorsport driver standing on a single-seater race car under a vast sky",
    filter: "saturate(1.05) contrast(1.05) brightness(0.96)",
  },
  {
    area: "tb", sport: "badminton", src: "/images/hero/badminton.jpg",
    alt: "Badminton player roaring in triumph with racket raised, national flag behind",
    filter: "saturate(1.2) contrast(1.05) brightness(1.02)", focus: "50% 28%",
  },
  {
    area: "tc", sport: "tennis-2", src: "/images/hero/tennis-sunburst.jpg",
    alt: "Stylised tennis player against a radiating sunburst of warm colour",
    filter: "saturate(1.06) contrast(1.1) brightness(0.94)", focus: "50% 30%",
  },
  {
    area: "td", sport: "cricket", src: "/images/hero/cricket.jpg",
    alt: "Cricketer in national kit looking out over a smoke-coloured sky",
    filter: "saturate(1.18) contrast(1.12) brightness(0.98)", focus: "50% 30%",
  },
  {
    area: "te", sport: "volleyball", src: "/images/hero/volleyball.jpg",
    alt: "Volleyball player leaping to serve against a splash of blue and gold paint",
    filter: "saturate(1.24) contrast(1.05)", focus: "46% 30%",
  },
];

function AuthCollage() {
  const [errored, setErrored] = useState<Record<string, boolean>>({});
  const [isReady, setIsReady] = useState(false);

  return (
    <div className="ax-grid" aria-hidden="true">
      {TILES.map((t) => {
        const hasErrored = !!errored[t.sport];
        return (
          <figure
            key={t.area}
            className={`ax-tile ax-${t.area}`}
            style={{
              background: hasErrored
                ? "linear-gradient(135deg, rgba(255,138,30,0.22), rgba(13,13,13,0.9))"
                : undefined,
            }}
          >
            {!hasErrored && (
              <Image
                src={t.src}
                alt={t.alt}
                fill
                sizes="(max-width: 880px) 100vw, 33vw"
                className={`hx-img${isReady ? " hx-img--ready" : ""}`}
                style={{ objectFit: "cover", objectPosition: t.focus ?? "50% 35%", filter: t.filter }}
                onLoad={() => setIsReady(true)}
                onError={() => setErrored((prev) => ({ ...prev, [t.sport]: true }))}
              />
            )}
          </figure>
        );
      })}
    </div>
  );
}

/* The 4 onboarding paths reachable from this picker — deliberately excludes
   Parent and Tournament Organizer, matching the homepage's "what we do"
   role blurbs (Master 21). value is the real lib/auth.ts ROLES entry. */
const ROLE_PICKER = [
  { label: "Player", value: "player", sub: "Athlete profile", Icon: User },
  { label: "Coach", value: "coach", sub: "Train & track", Icon: Megaphone },
  { label: "Academy", value: "academy_admin", sub: "Manage talent", Icon: Building2 },
  { label: "Scout", value: "scout", sub: "Discover players", Icon: Search },
] as const;

interface ComponentProps {
  /** Which mode this instance starts in. User can toggle inline. */
  initialMode?: "signin" | "signup";
}

export const Component: React.FC<ComponentProps> = ({ initialMode = "signin" }) => {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session } = useSession();
  const fromParam = params.get("from") || "/dashboard";
  const registered = params.get("registered") === "1";
  /* Role comes from the landing-page CTA: /auth/signup?role=scout, etc.
     Defaults to player. Server validates against the allow-list. Clicking
     a role-picker button below overrides this for what actually submits. */
  const roleParam = (params.get("role") || "player").toLowerCase();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState(roleParam);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(initialMode === "signup");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const dest = fromParam && fromParam !== "/dashboard" ? fromParam : "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Inline validation
    if (isSignUp && (!name.trim() || name.trim().length < 2)) {
      setError("Enter your full name");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError("Enter a valid email");
      return;
    }
    if (!password || (isSignUp && password.length < 8)) {
      setError(isSignUp ? "Password must be at least 8 characters" : "Password is required");
      return;
    }

    setIsSubmitting(true);

    if (isSignUp) {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error ?? "Signup failed");
        setIsSubmitting(false);
        return;
      }
      /* Don't auto sign-in. Force the user through the explicit login screen
         so the auth boundary is always visible. The login page reads
         ?registered=1 and shows a "Account created — please sign in" banner. */
      router.push("/auth/login?registered=1");
    } else {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password");
        setIsSubmitting(false);
        return;
      }
      /* If the user came from a specific protected route, send them there.
         Otherwise let /dashboard handle role-based routing. */
      router.push(dest);
    }
  };

  function applyMode(next: boolean) {
    setIsSignUp(next);
    setError(null);
    setShowPassword(false);
  }
  const toggleMode = () => applyMode(!isSignUp);

  async function handleGoogle() {
    setGoogleSubmitting(true);
    await signIn("google", { callbackUrl: dest });
  }

  return (
    <div
      className={`hx-stage auth-stage ${anton.variable} ${barlow.variable} ${barlowSemiCondensed.variable}`}
      style={{ fontFamily: "var(--font-barlow), system-ui, sans-serif" }}
    >
      <style dangerouslySetInnerHTML={{ __html: heroStyles }} />
      <style dangerouslySetInnerHTML={{ __html: authStyles }} />

      {/* LEFT — collage showcase */}
      <section className="ax-showcase" aria-hidden="true">
        <AuthCollage />
        <div className="ax-vignette" />
        <HeroCorner />
        <div className="ax-copy">
          <p className="ax-eyebrow">Grassroots to Global</p>
          <h2 className="ax-h2">
            Where India&rsquo;s next <b>champions</b> get found.
          </h2>
          <p className="ax-p">
            One profile. Every sport. Seen by the coaches, academies and scouts who matter.
          </p>
        </div>
      </section>

      {/* RIGHT — form */}
      <section className="ax-panel">
        <div className="ax-form-wrap">
          <p className="ax-kicker">{isSignUp ? "Join AthlasX" : "Welcome back"}</p>
          <h1 className="ax-title">{isSignUp ? "Create account" : "Sign in"}</h1>
          <p className="ax-subtitle">
            {isSignUp ? "Set up your profile in under a minute." : "Pick up right where you left off."}
          </p>

          {/* mode toggle */}
          <div className="ax-toggle" role="tablist" aria-label="Sign in or sign up">
            <button type="button" role="tab" aria-selected={!isSignUp} onClick={() => applyMode(false)}>
              Sign In
            </button>
            <button type="button" role="tab" aria-selected={isSignUp} onClick={() => applyMode(true)}>
              Sign Up
            </button>
          </div>

          {/* Already-signed-in banner — surfaces the existing session and
              offers a clean logout so the auth boundary isn't bypassed. */}
          {session?.user && (
            <div
              className="mb-5 p-3 rounded-lg flex items-center justify-between gap-3"
              style={{
                background: "rgba(251,191,36,0.1)",
                border: "1px solid rgba(251,191,36,0.35)",
                color: "#FBBF24",
                fontSize: 12.5,
              }}
            >
              <span>
                Signed in as <strong style={{ color: "#FCD34D" }}>{session.user.email}</strong>.
                {isSignUp ? " Sign out to register a new account." : " Sign out to switch accounts."}
              </span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: window.location.href })}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(248,113,113,0.4)",
                  color: "#F87171",
                  padding: "5px 12px",
                  borderRadius: 7,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Sign out
              </button>
            </div>
          )}

          {/* "Account created — please sign in" notice after signup. */}
          {registered && !isSignUp && !session?.user && (
            <div
              className="mb-5 p-3 rounded-lg"
              style={{
                background: "var(--hx-overlay-accent-14)",
                border: "1px solid var(--hx-overlay-accent-22)",
                color: "var(--hx-accent-bright)",
                fontSize: 12.5,
                textAlign: "center",
              }}
            >
              ✓ Account created. Sign in to continue.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* role picker — signup only */}
            {isSignUp && (
              <div>
                <p className="ax-field-label">I am a&hellip;</p>
                <div className="ax-roles" role="group" aria-label="Select your role">
                  {ROLE_PICKER.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      className="ax-role"
                      aria-pressed={role === r.value}
                      onClick={() => setRole(r.value)}
                    >
                      <span className="ax-role-ico" aria-hidden="true">
                        <r.Icon size={17} />
                      </span>
                      <span className="ax-role-rl">
                        <b>{r.label}</b>
                        <small>{r.sub}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isSignUp && (
              <div style={{ marginBottom: "0.9rem" }}>
                <AnimatedFormField
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  icon={<User size={18} />}
                  autoComplete="name"
                />
              </div>
            )}
            <div style={{ marginBottom: "0.9rem" }}>
              <AnimatedFormField
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail size={18} />}
                autoComplete="email"
              />
            </div>
            <div style={{ marginBottom: "0.9rem" }}>
              <AnimatedFormField
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock size={18} />}
                showToggle
                onToggle={() => setShowPassword((s) => !s)}
                showPassword={showPassword}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "var(--hx-text)", marginBottom: "0.9rem" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full relative group rounded-lg font-semibold transition-all duration-300 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
              style={{
                padding: "0.92rem 0.6rem",
                background: "var(--hx-accent)",
                color: "#1a0e02",
                border: "1.5px solid var(--hx-accent)",
                boxShadow: "0 10px 26px -10px rgba(var(--hx-accent-rgb), 0.8)",
              }}
            >
              <span
                className="transition-opacity duration-200"
                style={{ opacity: isSubmitting ? 0 : 1 }}
              >
                {isSignUp ? "Create Account" : "Sign In"}
              </span>
              {isSubmitting && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-5 h-5 rounded-full animate-spin"
                    style={{
                      border: "2px solid rgba(0,0,0,0.3)",
                      borderTopColor: "#1a0e02",
                    }}
                  />
                </div>
              )}
            </button>
          </form>

          <div className="ax-divider">or</div>
          <button
            type="button"
            className="ax-btn-ghost"
            onClick={handleGoogle}
            disabled={googleSubmitting}
          >
            {googleSubmitting ? "Redirecting…" : isSignUp ? "Sign up with Google" : "Continue with Google"}
          </button>

          <p className="ax-swap">
            {isSignUp ? "Already on AthlasX?" : "New to AthlasX?"}{" "}
            <button type="button" onClick={toggleMode}>
              {isSignUp ? "Sign in instead" : "Create an account"}
            </button>
          </p>

          <p className="ax-legal">
            By continuing you agree to our <a href="#">Terms</a> &amp; <a href="#">Privacy Policy</a>.
          </p>
        </div>
      </section>
    </div>
  );
};
