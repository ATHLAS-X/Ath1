"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";

const schema = z.object({
  email:    z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password required"),
});
type FormData = z.infer<typeof schema>;

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const verified = params.get("verified") === "1";
  const [showPw, setShowPw] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setLoginError(null);
    const res = await signIn("credentials", {
      email:    data.email,
      password: data.password,
      redirect: false,
    });
    setLoading(false);

    if (res?.error === "pending") {
      setLoginError("Please verify your email before signing in.");
    } else if (res?.error) {
      setLoginError("Invalid email or password.");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1628] flex flex-col">
      <header className="px-6 py-4">
        <span className="text-xl font-extrabold tracking-tight text-white">AthlasX</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 shadow-2xl backdrop-blur">
            <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
            <p className="text-sm text-slate-400 mb-6">Sign in to your AthlasX account</p>

            {verified && (
              <div className="mb-4 rounded-lg border border-[#1A6B3C]/40 bg-[#1A6B3C]/10 px-4 py-3 text-sm text-green-400">
                Email verified! You can now sign in.
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <Field label="Email" error={errors.email?.message}>
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register("email")}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-[#1A6B3C] focus:ring-1 focus:ring-[#1A6B3C]"
                />
              </Field>

              <Field label="Password" error={errors.password?.message}>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Your password"
                    autoComplete="current-password"
                    {...register("password")}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 outline-none transition focus:border-[#1A6B3C] focus:ring-1 focus:ring-[#1A6B3C]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              <div className="text-right">
                <a href="/auth/forgot-password" className="text-xs text-slate-400 hover:text-white">
                  Forgot password?
                </a>
              </div>

              {loginError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#1A6B3C] py-2.5 text-sm font-semibold text-white transition hover:bg-[#155c33] disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          </div>

          <p className="mt-4 text-center text-sm text-slate-500">
            New academy?{" "}
            <a href="/register/academy" className="text-[#1A6B3C] hover:underline font-medium">
              Register here
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
