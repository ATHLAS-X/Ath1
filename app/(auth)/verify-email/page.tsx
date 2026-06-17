"use client";

import { useSearchParams } from "next/navigation";
import { MailCheck, AlertCircle, RefreshCw } from "lucide-react";
import { useState } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  missing:  "Verification link is missing a token.",
  invalid:  "This verification link is invalid.",
  used:     "This link has already been used.",
  expired:  "This link has expired. Please request a new one.",
};

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const errorKey = params.get("error");
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  const resend = async () => {
    setResending(true);
    // In production, call an API route that re-sends the verification email.
    await new Promise(r => setTimeout(r, 800));
    setResent(true);
    setResending(false);
  };

  if (errorKey) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex flex-col">
        <header className="px-6 py-4">
          <span className="text-xl font-extrabold tracking-tight text-white">SportX</span>
        </header>
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-slate-900/70 p-8 shadow-2xl text-center">
            <AlertCircle size={44} className="mx-auto mb-4 text-red-400" />
            <h1 className="text-xl font-bold text-white mb-2">Verification failed</h1>
            <p className="text-sm text-slate-400 mb-6">
              {ERROR_MESSAGES[errorKey] ?? "Something went wrong with your verification link."}
            </p>
            {(errorKey === "expired" || errorKey === "used") && (
              <button
                onClick={resend}
                disabled={resending || resent}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1A6B3C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#155c33] disabled:opacity-60"
              >
                <RefreshCw size={14} className={resending ? "animate-spin" : ""} />
                {resent ? "Email sent!" : resending ? "Sending…" : "Resend verification email"}
              </button>
            )}
            <p className="mt-6 text-xs text-slate-500">
              Need help?{" "}
              <a href="mailto:support@sportx.in" className="text-[#1A6B3C] hover:underline">
                Contact support
              </a>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1628] flex flex-col">
      <header className="px-6 py-4">
        <span className="text-xl font-extrabold tracking-tight text-white">SportX</span>
      </header>
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1A6B3C]/20">
            <MailCheck size={32} className="text-[#1A6B3C]" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Check your inbox</h1>
          <p className="text-sm text-slate-400 mb-6">
            We've sent a verification link to your email address. Click the link to activate your
            SportX Academy account.
          </p>

          <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3 text-xs text-slate-400 text-left space-y-1 mb-6">
            <p>• The link expires in <span className="text-white font-medium">24 hours</span></p>
            <p>• Check your spam/junk folder if you don't see it</p>
            <p>• After verifying, you'll be redirected to set up your academy profile</p>
          </div>

          {!resent ? (
            <button
              onClick={resend}
              disabled={resending}
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
            >
              <RefreshCw size={14} className={resending ? "animate-spin" : ""} />
              {resending ? "Resending…" : "Resend email"}
            </button>
          ) : (
            <p className="text-sm text-[#1A6B3C]">Email resent! Check your inbox.</p>
          )}

          <p className="mt-6 text-xs text-slate-500">
            Wrong email?{" "}
            <a href="/register/academy" className="text-[#1A6B3C] hover:underline">
              Register again
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
