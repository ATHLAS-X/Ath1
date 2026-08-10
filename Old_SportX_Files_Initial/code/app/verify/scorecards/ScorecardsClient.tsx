"use client";

import { useState } from "react";
import Link from "next/link";
import { VerifyChrome, VerifyLadder, VCCard, VCField } from "@/components/verify/VerifyChrome";
import { DsButton, DsInput, DsSelect, DsPill, DsIcon } from "@/app/_ds";

interface Match {
  id: string;
  title: string;
  submitted: string;
  fmt: string;
  runs: number;
  wickets: number;
  status: "Approved" | "Pending" | "Rejected";
  reason?: string;
}

interface Props {
  identityVerified: boolean;
  initialMatches: Match[];
}

const REQUIRED_APPROVALS = 3;

const STATUS_TONE: Record<Match["status"], "ok" | "accent" | "bad"> = {
  Approved: "ok", Pending: "accent", Rejected: "bad",
};

/* Maps the new mockup's tournament-type selector to the existing API's
   fixed mqi_tag enum. */
const TOURNAMENT_TYPES = [
  { label: "League", mqi: "DCA League" },
  { label: "Academy Cup", mqi: "Academy Cup" },
  { label: "Corporate", mqi: "Corporate" },
  { label: "Trial", mqi: "Trial" },
];

export default function ScorecardsClient({ identityVerified, initialMatches }: Props) {
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [form, setForm] = useState({
    tournament: "", date: "", opponent: "",
    fmt: "T20", type: "League", runs: "", wickets: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const approved = matches.filter((m) => m.status === "Approved").length;
  const pending = matches.filter((m) => m.status === "Pending").length;
  const stillNeeded = Math.max(0, REQUIRED_APPROVALS - approved);
  const level = approved >= REQUIRED_APPROVALS ? 3 : identityVerified ? 2 : 1;

  const valid = form.tournament.trim() && form.date && form.opponent.trim() && file;

  async function submit() {
    if (!valid) return;
    setError(null); setBusy(true);
    try {
      const mqi = TOURNAMENT_TYPES.find((t) => t.label === form.type)?.mqi ?? "Trial";
      const fd = new FormData();
      fd.set("opponent", form.opponent.trim());
      fd.set("match_date", form.date);
      fd.set("format", form.fmt);
      fd.set("competition_level", form.tournament.trim());
      fd.set("mqi_tag", mqi);
      fd.set("runs_scored", form.runs || "0");
      fd.set("wickets_taken", form.wickets || "0");
      if (file) fd.set("scorecard", file);
      const res = await fetch("/api/onboarding/match", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Submission failed"); return; }
      const isApproved = data?.data?.ocr_status === "VERIFIED";
      setMatches((p) => [{
        id: String(Math.random()).slice(2),
        title: `${form.tournament.trim()} — vs ${form.opponent.trim()}`,
        submitted: "Submitted today",
        fmt: form.fmt,
        runs: Number(form.runs || 0),
        wickets: Number(form.wickets || 0),
        status: isApproved ? "Approved" : "Pending",
      }, ...p]);
      setForm({ tournament: "", date: "", opponent: "", fmt: "T20", type: "League", runs: "", wickets: "" });
      setFile(null);
    } finally { setBusy(false); }
  }

  return (
    <VerifyChrome title="Verification Centre · Performance" level={level}>
      <div className="vc-grid">

        <div className="vc-col">
          <VerifyLadder
            level={level}
            actions={level >= 3 ? {
              4: (
                <Link href="/verify/scout-review" style={{ textDecoration: "none", flexShrink: 0 }}>
                  <DsButton variant="fill" size="sm">Request Scout Review</DsButton>
                </Link>
              ),
            } : undefined}
          />
        </div>

        <div className="vc-col">
          {!identityVerified && (
            <VCCard title="Identity Required" action={<DsPill tone="accent">L2 first</DsPill>}>
              <p style={{ fontSize: "0.8rem", color: "var(--ax-text-dim)", lineHeight: 1.55, marginBottom: 12 }}>
                Aadhaar verification (Level 2) is required before scorecards
                can count toward Level 3. Submissions made now will be held
                pending until identity is verified.
              </p>
              <Link href="/verify/aadhaar" style={{ textDecoration: "none" }}>
                <DsButton variant="fill">Verify Aadhaar</DsButton>
              </Link>
            </VCCard>
          )}

          <VCCard
            title="Progress to Performance Verified"
            action={<DsPill tone={approved >= REQUIRED_APPROVALS ? "ok" : "accent"}>{approved} / {REQUIRED_APPROVALS} approved</DsPill>}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <div className="vc-tile" style={{ flex: 1 }}><div className="v" style={{ color: "var(--ax-ok)" }}>{approved}</div><div className="l">Approved</div></div>
              <div className="vc-tile" style={{ flex: 1 }}><div className="v" style={{ color: "var(--ax-accent-bright)" }}>{pending}</div><div className="l">Pending</div></div>
              <div className="vc-tile" style={{ flex: 1 }}><div className="v">{stillNeeded}</div><div className="l">Still Needed</div></div>
            </div>
            {approved >= REQUIRED_APPROVALS ? (
              <div style={{
                marginTop: 14, padding: 14, borderRadius: "var(--ax-radius-lg)",
                background: "var(--ax-ok-soft)",
                border: "1px solid var(--ax-ok-border)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{
                    width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center",
                    background: "var(--ax-ok)", color: "var(--ax-text-on-accent)",
                  }}>
                    <DsIcon name="check" size={16} stroke={3} />
                  </span>
                  <div>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--ax-text)" }}>
                      Performance Verified unlocked
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--ax-text-faint)", marginTop: 1 }}>
                      Level 3 reached — the final rung is scout endorsement.
                    </div>
                  </div>
                </div>
                <Link href="/verify/scout-review" style={{ textDecoration: "none", display: "block" }}>
                  <DsButton variant="fill" block>Continue → Request Scout Review</DsButton>
                </Link>
              </div>
            ) : (
              <p style={{ fontSize: "0.78rem", color: "var(--ax-text-dim)", lineHeight: 1.55, marginTop: 12 }}>
                Three approved scorecards from official tournaments unlock Level 3 — Performance Verified.
              </p>
            )}
          </VCCard>

          <VCCard title="Submit Scorecard" action={<DsPill tone="ghost">Reviewed by AthlasX</DsPill>}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <VCField label="Tournament / League">
                  <DsInput placeholder="e.g. Rajasthan U19 League"
                    value={form.tournament} onChange={set("tournament")} />
                </VCField>
              </div>
              <VCField label="Match Date">
                <DsInput type="date" value={form.date} onChange={set("date")} />
              </VCField>
              <VCField label="Format">
                <DsSelect value={form.fmt} onChange={set("fmt")}>
                  <option value="T20">T20</option>
                  <option value="ODI">ODI (50 ov)</option>
                  <option value="List-A">List-A</option>
                </DsSelect>
              </VCField>
              <div style={{ gridColumn: "1 / -1" }}>
                <VCField label="Opponent">
                  <DsInput placeholder="e.g. Haryana U19"
                    value={form.opponent} onChange={set("opponent")} />
                </VCField>
              </div>
              <VCField label="Tournament Type">
                <DsSelect value={form.type} onChange={set("type")}>
                  {TOURNAMENT_TYPES.map((t) => <option key={t.label}>{t.label}</option>)}
                </DsSelect>
              </VCField>
              <VCField label="Runs Scored">
                <DsInput inputMode="numeric" placeholder="0"
                  value={form.runs} onChange={set("runs")} />
              </VCField>
              <VCField label="Wickets Taken">
                <DsInput inputMode="numeric" placeholder="0"
                  value={form.wickets} onChange={set("wickets")} />
              </VCField>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{
                  fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.1em",
                  fontSize: "0.62rem", fontWeight: 700, color: "var(--ax-text-dim)", margin: "0.8rem 0 0.4rem",
                }}>Scorecard Photo / PDF</div>
                <label style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 110, border: `1.5px dashed ${file ? "var(--ax-accent)" : "var(--ax-border)"}`,
                  borderRadius: "var(--ax-radius-md)", background: "var(--ax-field)", cursor: "pointer", fontSize: "0.78rem",
                  color: file ? "var(--ax-accent-bright)" : "var(--ax-text-faint)", textAlign: "center", padding: "0 12px",
                }}>
                  <input type="file" hidden accept="image/*,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  {file ? `📎 ${file.name}` : "Drop a clear photo of the official scorecard"}
                </label>
              </div>
            </div>
            {error && <p style={{ color: "var(--ax-bad-text)", fontSize: "0.78rem", marginTop: 10 }}>{error}</p>}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <DsButton variant="fill" disabled={busy || !valid} onClick={submit}>
                {busy ? "Submitting…" : "Submit for Review"}
              </DsButton>
              <span style={{ fontSize: "0.7rem", color: "var(--ax-text-faint)" }}>Typical review time: 2–3 working days</span>
            </div>
          </VCCard>

          <VCCard title="My Scorecards" action={<DsPill tone="ghost">{approved} approved · {matches.length} total</DsPill>}>
            {matches.length === 0 ? (
              <div style={{ color: "var(--ax-text-faint)", fontSize: "0.8rem", padding: "8px 0" }}>
                No submissions yet. Add your first scorecard above.
              </div>
            ) : matches.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--ax-border)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>{m.title}</div>
                  <div style={{ fontSize: "0.66rem", color: "var(--ax-text-faint)", marginTop: 1 }}>{m.submitted}</div>
                  {m.reason && <div style={{ fontSize: "0.7rem", color: "var(--ax-bad-text)", marginTop: 3 }}>{m.reason}</div>}
                </div>
                <DsPill tone="ghost">{m.fmt}</DsPill>
                <span style={{ fontFamily: "var(--ax-font-display)", fontSize: "0.8rem", fontWeight: 400, whiteSpace: "nowrap" }}>
                  {m.runs} R · {m.wickets} W
                </span>
                <DsPill tone={STATUS_TONE[m.status]}>
                  {m.status === "Pending" ? "Pending ⏳" : m.status}
                </DsPill>
              </div>
            ))}
          </VCCard>
        </div>

        <div className="vc-col">
          <VCCard title="What Gets Approved">
            <div className="vc-li"><span className="m">✓</span><span>Official tournament or league scorecards with organizer name</span></div>
            <div className="vc-li"><span className="m">✓</span><span>Legible photo — your name and figures clearly readable</span></div>
            <div className="vc-li"><span className="m">✓</span><span>Match date and opponent match the scorecard</span></div>
            <div className="vc-li"><span className="m x">✕</span><span>Practice matches, nets sessions, or edited images</span></div>
          </VCCard>

          <VCCard title="Review Process">
            <div className="vc-li"><span className="m n">1</span><span>AthlasX verification team checks the scorecard (2–3 days)</span></div>
            <div className="vc-li"><span className="m n">2</span><span>Cross-checked with the tournament organizer where possible</span></div>
            <div className="vc-li"><span className="m n">3</span><span>Approved figures merge into your verified match history</span></div>
          </VCCard>

          <VCCard title="Next Level" action={<DsPill tone="ghost">L4</DsPill>}>
            <p style={{ fontSize: "0.8rem", color: "var(--ax-text-dim)", lineHeight: 1.55 }}>
              After Performance Verified, an endorsement from a verified scout
              at a trial or match raises the profile to{" "}
              <span style={{ color: "var(--ax-text)", fontWeight: 600 }}>Scout Verified</span>{" "}
              — the highest level.
            </p>
          </VCCard>
        </div>

      </div>
    </VerifyChrome>
  );
}