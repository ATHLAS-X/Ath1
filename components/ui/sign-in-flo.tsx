"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";

const ACCENT_RGB = "255, 255, 255"; // pure white

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
          background: "var(--input-bg)",
          borderColor: isFocused ? "var(--accent)" : "var(--border)",
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200"
          style={{ color: isFocused ? "var(--accent)" : "var(--muted)" }}
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
          className="w-full bg-transparent pl-10 pr-12 pt-6 pb-2 text-sm focus:outline-none"
          style={{ color: "var(--text)" }}
        />
        <label
          className="absolute left-10 transition-all duration-200 ease-in-out pointer-events-none"
          style={{
            top: isFocused || value ? "0.35rem" : "50%",
            transform: isFocused || value ? "none" : "translateY(-50%)",
            fontSize: isFocused || value ? "0.7rem" : "0.85rem",
            color: isFocused || value ? "var(--accent)" : "var(--muted)",
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
            style={{ color: "var(--muted)" }}
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

const FloatingParticles: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setSize();
    window.addEventListener("resize", setSize);
    interface P { x: number; y: number; size: number; sx: number; sy: number; o: number }
    const particles: P[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 1,
      sx: (Math.random() - 0.5) * 0.5,
      sy: (Math.random() - 0.5) * 0.5,
      o: Math.random() * 0.4 + 0.1,
    }));
    let raf = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.sx; p.y += p.sy;
        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;
        if (p.y > canvas.height) p.y = 0;
        if (p.y < 0) p.y = canvas.height;
        ctx.fillStyle = `rgba(${ACCENT_RGB}, ${p.o})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", setSize);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
     Defaults to player. Server validates against the allow-list. */
  const roleParam = (params.get("role") || "player").toLowerCase();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(initialMode === "signup");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          role: roleParam,
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
      const dest = fromParam && fromParam !== "/dashboard" ? fromParam : "/dashboard";
      router.push(dest);
    }
  };

  const toggleMode = () => {
    setIsSignUp((s) => !s);
    setError(null);
    setShowPassword(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "#0A0A0A",
        color: "#F2F4F2",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        // CSS variables consumed by AnimatedFormField + the rest of this card.
        // Defined here (not globally) so they only apply to this page.
        ["--bg" as any]: "#0A0A0A",
        ["--text" as any]: "#F2F4F2",
        ["--muted" as any]: "#8B958D",
        ["--accent" as any]: "#2EE07B",
        ["--border" as any]: "#243027",
        ["--input-bg" as any]: "#0D120F",
        ["--error" as any]: "#F87171",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        /* Suppress browser autofill's pale-blue/yellow background + force
           our text colour. Edge/Chrome only honour this via the shadowed
           box-shadow trick. */
        .signin-card input:-webkit-autofill,
        .signin-card input:-webkit-autofill:hover,
        .signin-card input:-webkit-autofill:focus,
        .signin-card input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #0D120F inset !important;
          -webkit-text-fill-color: #F2F4F2 !important;
          caret-color: #F2F4F2;
          transition: background-color 5000s ease-in-out 0s;
          font-family: 'Instrument Sans', system-ui, sans-serif !important;
        }
        .signin-card input {
          font-family: 'Instrument Sans', system-ui, sans-serif;
          letter-spacing: 0.01em;
        }
        .signin-card h1 {
          font-family: 'Space Grotesk', monospace;
          letter-spacing: 0.01em;
        }
      ` }} />
      <FloatingParticles />

      <div className="relative z-10 w-full max-w-md">
        <div
          className="signin-card border rounded-2xl p-8 shadow-2xl backdrop-blur-xl"
          style={{ background: "rgba(13,13,13,0.85)", borderColor: "var(--border)" }}
        >
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
              style={{ background: `rgba(${ACCENT_RGB}, 0.15)` }}
            >
              <User className="w-8 h-8" style={{ color: "var(--accent)" }} />
            </div>
            <h1 className="text-3xl font-bold mb-2">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </h1>
            <p style={{ color: "var(--muted)" }}>
              {isSignUp ? "Sign up to get started" : "Sign in to continue"}
            </p>
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
                background: "rgba(46,224,123,0.1)",
                border: "1px solid rgba(46,224,123,0.35)",
                color: "#86efac",
                fontSize: 12.5,
                textAlign: "center",
              }}
            >
              ✓ Account created. Sign in to continue.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {isSignUp && (
              <AnimatedFormField
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                icon={<User size={18} />}
                autoComplete="name"
              />
            )}
            <AnimatedFormField
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={18} />}
              autoComplete="email"
            />
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

            {error && (
              <p className="text-sm" style={{ color: "var(--error)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full relative group py-3 px-4 rounded-lg font-semibold transition-all duration-300 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
              style={{ background: "var(--accent)", color: "#000000" }}
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
                      borderTopColor: "#000000",
                    }}
                  />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={toggleMode}
                className="font-semibold"
                style={{ color: "var(--accent)" }}
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
