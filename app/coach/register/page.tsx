"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, FileUp, ShieldCheck } from "lucide-react";

function CoachRegisterContent() {
  const params = useSearchParams();
  const token = params?.get("token") ?? "";
  const [name, setName] = useState("");
  const [academy, setAcademy] = useState("");
  const [officialId, setOfficialId] = useState("");
  const [cert, setCert] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = !!token && !!name && !!academy && !!officialId && !!cert;

  async function submit() {
    setError(null);
    if (!canSubmit) return setError("Fill all fields and attach the certificate");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("token", token);
      fd.append("coach_name", name);
      fd.append("academy_club", academy);
      fd.append("official_id", officialId);
      fd.append("cert", cert as File);
      const res = await fetch("/api/coach/register", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Could not register");
        return;
      }
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#050D18", color: "#E2E8F0" }}>
        <p className="p-6 rounded-md" style={{ background: "#060E1C", border: "1px solid #1E3A5F", color: "#EF4444" }}>
          Missing invite token. Ask your player for a fresh invite link.
        </p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "#050D18", color: "#E2E8F0" }}>
        <div className="max-w-md p-6 rounded-lg text-center space-y-3" style={{ background: "#060E1C", border: "1px solid rgba(34,197,94,0.4)" }}>
          <CheckCircle2 size={36} style={{ color: "#22C55E", margin: "0 auto" }} />
          <h1 className="text-xl font-bold">Submission received</h1>
          <p style={{ color: "#94A3B8" }}>
            Your registration is in <strong style={{ color: "#F59E0B" }}>PENDING_REVIEW</strong>. The player&rsquo;s profile
            will be unlocked once review completes.
          </p>
        </div>
      </main>
    );
  }

  const inputStyle: React.CSSProperties = {
    background: "#050D18", border: "1px solid #1E3A5F", color: "#E2E8F0",
    padding: "10px 12px", borderRadius: 6, outline: "none", width: "100%", fontSize: 14,
  };

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: "#050D18", color: "#E2E8F0" }}>
      <div className="max-w-lg mx-auto space-y-6">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-widest" style={{ color: "#22C55E" }}>AthlasX Coach Registry</p>
          <h1 className="text-2xl font-bold">Register as a verifying coach</h1>
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            Your endorsement unlocks your player&rsquo;s profile for scout discovery.
          </p>
        </header>

        <div className="space-y-4 p-5 rounded-lg" style={{ background: "#060E1C", border: "1px solid #1E3A5F" }}>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "#94A3B8" }}>
            <span>Coach name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "#94A3B8" }}>
            <span>Academy / Club</span>
            <input value={academy} onChange={(e) => setAcademy(e.target.value)} style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "#94A3B8" }}>
            <span>Official Coach ID</span>
            <input value={officialId} onChange={(e) => setOfficialId(e.target.value)} style={inputStyle} placeholder="BCCI / NCA / State coach ID" />
          </label>
          <label
            className="flex items-center gap-3 px-3 py-3 rounded-md cursor-pointer"
            style={{ background: "#050D18", border: "1px dashed #1E3A5F", color: "#94A3B8" }}
          >
            <FileUp size={18} style={{ color: "#60A5FA" }} />
            <span className="text-sm flex-1">{cert ? cert.name : "Coaching certificate (BCCI / NCA / State)"}</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setCert(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || busy}
            className="px-5 py-2 rounded-md text-sm font-semibold inline-flex items-center gap-2"
            style={{
              background: canSubmit && !busy ? "#22C55E" : "#1E3A5F",
              color: canSubmit && !busy ? "#062012" : "#94A3B8",
              border: "none",
              cursor: canSubmit && !busy ? "pointer" : "not-allowed",
            }}
          >
            <ShieldCheck size={14} /> {busy ? "Submitting…" : "Register as Coach"}
          </button>
          {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}
        </div>
      </div>
    </main>
  );
}

export default function CoachRegisterPage() {
  return (
    <Suspense>
      <CoachRegisterContent />
    </Suspense>
  );
}
