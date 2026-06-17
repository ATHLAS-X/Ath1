"use client";

import { useState } from "react";
import Link from "next/link";
import { VerifyChrome, VerifyLadder, VCCard, VCField } from "@/components/verify/VerifyChrome";

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

const STATUS_COLOR: Record<Match["status"], string> = {
  Approved: "green", Pending: "amber", Rejected: "red",
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
                <Link href="/verify/scout-review" className="btn sm green" style={{ textDecoration: "none", flexShrink: 0 }}>
                  Request Scout Review
                </Link>
              ),
            } : undefined}
          />
        </div>

        <div className="vc-col">
          {!identityVerified && (
            <VCCard title="Identity Required" action={<span className="bdg amber">L2 first</span>}>
              <p style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.55, marginBottom: 12 }}>
                Aadhaar verification (Level 2) is required before scorecards
                can count toward Level 3. Submissions made now will be held
                pending until identity is verified.
              </p>
              <Link href="/verify/aadhaar" className="btn green" style={{ textDecoration: "none" }}>
                Verify Aadhaar
              </Link>
            </VCCard>
          )}

          <VCCard
            title="Progress to Performance Verified"
            action={<span className={`bdg ${approved >= REQUIRED_APPROVALS ? "green" : "amber"}`}>{approved} / {REQUIRED_APPROVALS} approved</span>}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <div className="vc-tile" style={{ flex: 1 }}><div className="v" style={{ color: "var(--green)" }}>{approved}</div><div className="l">Approved</div></div>
              <div className="vc-tile" style={{ flex: 1 }}><div className="v" style={{ color: "var(--amber)" }}>{pending}</div><div className="l">Pending</div></div>
              <div className="vc-tile" style={{ flex: 1 }}><div className="v">{stillNeeded}</div><div className="l">Still Needed</div></div>
            </div>
            {approved >= REQUIRED_APPROVALS ? (
              <div style={{
                marginTop: 14, padding: 14, borderRadius: 11,
                background: "linear-gradient(168deg, rgba(46,224,123,0.16), rgba(46,224,123,0.04))",
                border: "1px solid var(--green-bd)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 18px -8px var(--green-glow)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center",
                    background: "radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%)",
                    color: "#04140a", fontFamily: "var(--num)", fontSize: 14, fontWeight: 700,
                    boxShadow: "0 0 12px var(--green-glow)",
                  }}>✓</div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
                      Performance Verified unlocked
                    </div>
                    <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 1 }}>
                      Level 3 reached — the final rung is scout endorsement.
                    </div>
                  </div>
                </div>
                <Link href="/verify/scout-review" className="btn green"
                  style={{ width: "100%", textDecoration: "none", justifyContent: "center" }}>
                  Continue → Request Scout Review
                </Link>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "var(--mut)", lineHeight: 1.55, marginTop: 12 }}>
                Three approved scorecards from official tournaments unlock Level 3 — Performance Verified.
              </p>
            )}
          </VCCard>

          <VCCard title="Submit Scorecard" action={<span className="bdg ghost">Reviewed by SportX</span>}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <VCField label="Tournament / League">
                  <input className="sinput" placeholder="e.g. Rajasthan U19 League"
                    value={form.tournament} onChange={set("tournament")} />
                </VCField>
              </div>
              <VCField label="Match Date">
                <input className="sinput" type="date" value={form.date} onChange={set("date")} />
              </VCField>
              <VCField label="Format">
                <select className="sinput" value={form.fmt} onChange={set("fmt")}>
                  <option value="T20">T20</option>
                  <option value="ODI">ODI (50 ov)</option>
                  <option value="List-A">List-A</option>
                </select>
              </VCField>
              <div style={{ gridColumn: "1 / -1" }}>
                <VCField label="Opponent">
                  <input className="sinput" placeholder="e.g. Haryana U19"
                    value={form.opponent} onChange={set("opponent")} />
                </VCField>
              </div>
              <VCField label="Tournament Type">
                <select className="sinput" value={form.type} onChange={set("type")}>
                  {TOURNAMENT_TYPES.map((t) => <option key={t.label}>{t.label}</option>)}
                </select>
              </VCField>
              <VCField label="Runs Scored">
                <input className="sinput" inputMode="numeric" placeholder="0"
                  value={form.runs} onChange={set("runs")} />
              </VCField>
              <VCField label="Wickets Taken">
                <input className="sinput" inputMode="numeric" placeholder="0"
                  value={form.wickets} onChange={set("wickets")} />
              </VCField>
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="f-label">Scorecard Photo / PDF</div>
                <label style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 110, border: `1.5px dashed ${file ? "var(--green-bd)" : "var(--line2)"}`,
                  borderRadius: 10, background: "var(--card-alt)", cursor: "pointer", fontSize: 12,
                  color: file ? "var(--green)" : "var(--mut)", textAlign: "center", padding: "0 12px",
                }}>
                  <input type="file" hidden accept="image/*,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  {file ? `📎 ${file.name}` : "Drop a clear photo of the official scorecard"}
                </label>
              </div>
            </div>
            {error && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 10 }}>{error}</p>}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button className="btn green" disabled={busy || !valid}
                style={{ opacity: valid ? 1 : 0.6 }} onClick={submit}>
                {busy ? "Submitting…" : "Submit for Review"}
              </button>
              <span style={{ fontSize: 11, color: "var(--mut)" }}>Typical review time: 2–3 working days</span>
            </div>
          </VCCard>

          <VCCard title="My Scorecards" action={<span className="bdg ghost">{approved} approved · {matches.length} total</span>}>
            {matches.length === 0 ? (
              <div style={{ color: "var(--mut)", fontSize: 12.5, padding: "8px 0" }}>
                No submissions yet. Add your first scorecard above.
              </div>
            ) : matches.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.title}</div>
                  <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 1 }}>{m.submitted}</div>
                  {m.reason && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 3 }}>{m.reason}</div>}
                </div>
                <span className="bdg ghost">{m.fmt}</span>
                <span style={{ fontFamily: "var(--num)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {m.runs} R · {m.wickets} W
                </span>
                <span className={`bdg ${STATUS_COLOR[m.status]}`}>
                  {m.status === "Pending" ? "Pending ⏳" : m.status}
                </span>
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
            <div className="vc-li"><span className="m n">1</span><span>SportX verification team checks the scorecard (2–3 days)</span></div>
            <div className="vc-li"><span className="m n">2</span><span>Cross-checked with the tournament organizer where possible</span></div>
            <div className="vc-li"><span className="m n">3</span><span>Approved figures merge into your verified match history</span></div>
          </VCCard>

          <VCCard title="Next Level" action={<span className="bdg ghost">L4</span>}>
            <p style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.55 }}>
              After Performance Verified, an endorsement from a verified scout
              at a trial or match raises the profile to{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>Scout Verified</span>{" "}
              — the highest level.
            </p>
          </VCCard>
        </div>

      </div>
    </VerifyChrome>
  );
}
