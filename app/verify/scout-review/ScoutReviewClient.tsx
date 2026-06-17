"use client";

import { useState } from "react";
import Link from "next/link";
import { VerifyChrome, VerifyLadder, VCCard, VCField } from "@/components/verify/VerifyChrome";

interface Props {
  level: number;
  identityVerified: boolean;
  performanceVerified: boolean;
  approvedScorecards: number;
  existingRequest: {
    id: string;
    status: string;
    note: string;
    submittedAt: string;
  } | null;
}

export default function ScoutReviewClient(p: Props) {
  const [note, setNote] = useState(p.existingRequest?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(p.existingRequest?.status === "Pending");

  const eligible = p.level >= 3;

  async function submit() {
    setError(null); setBusy(true);
    try {
      const res = await fetch("/api/player/scout-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Request failed"); return; }
      setSubmitted(true);
    } finally { setBusy(false); }
  }

  return (
    <VerifyChrome title="Verification Centre · Scout Endorsement" level={p.level}>
      <div className="vc-grid">

        <div className="vc-col">
          <VerifyLadder level={p.level} />
        </div>

        <div className="vc-col">
          {!eligible && (
            <VCCard title="Not yet eligible" action={<span className="bdg amber">L3 required</span>}>
              <p style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.55, marginBottom: 12 }}>
                Scout endorsement is the final ladder rung. It unlocks once your
                profile reaches Performance Verified (Level 3) — three approved
                scorecards.
              </p>
              <div className="vc-li" style={{ borderTop: "none" }}>
                <span className={`m${p.identityVerified ? "" : " x"}`}>{p.identityVerified ? "✓" : "✕"}</span>
                <span>Identity Verified (Aadhaar)</span>
              </div>
              <div className="vc-li">
                <span className={`m${p.performanceVerified ? "" : " x"}`}>{p.performanceVerified ? "✓" : "✕"}</span>
                <span>Performance Verified — {p.approvedScorecards} / 3 approved scorecards</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                {!p.identityVerified && (
                  <Link href="/verify/aadhaar" className="btn green" style={{ textDecoration: "none" }}>
                    Verify Aadhaar
                  </Link>
                )}
                {p.identityVerified && !p.performanceVerified && (
                  <Link href="/verify/scorecards" className="btn green" style={{ textDecoration: "none" }}>
                    Submit Scorecards
                  </Link>
                )}
              </div>
            </VCCard>
          )}

          {eligible && submitted && (
            <VCCard
              title="Request Submitted"
              action={<span className="bdg amber">Pending</span>}
            >
              <div className="vc-success">
                <div className="vc-disc">⏳</div>
                <h2>Awaiting scout review</h2>
                <p>
                  Your profile is now in the scout discovery pool. Verified
                  scouts can review your videos, stats and match history and
                  add an endorsement. You'll be notified when one comes in.
                </p>
              </div>
              {p.existingRequest && (
                <div style={{ marginTop: 12 }}>
                  <div className="vc-kv">
                    <span className="k">Submitted</span>
                    <span className="v">{p.existingRequest.submittedAt}</span>
                  </div>
                  {p.existingRequest.note && (
                    <div className="vc-kv">
                      <span className="k">Note to scout</span>
                      <span className="v" style={{ fontWeight: 400, whiteSpace: "normal" }}>
                        {p.existingRequest.note}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="btn" onClick={() => setSubmitted(false)}>Edit Request</button>
                <Link href="/dashboard/player" className="btn green" style={{ textDecoration: "none" }}>
                  Back to Dashboard
                </Link>
              </div>
            </VCCard>
          )}

          {eligible && !submitted && (
            <VCCard
              title="Request Scout Review"
              action={<span className="bdg blue">Level 4 unlock</span>}
            >
              <p style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.55, marginBottom: 14 }}>
                You meet the requirements for Scout Verified. Submitting this
                request adds your profile to the priority review queue for
                verified scouts in your region and role.
              </p>
              <VCField label="Optional note to scouts">
                <textarea
                  className="sinput"
                  rows={4}
                  style={{ height: "auto", padding: "10px 11px", resize: "vertical" }}
                  placeholder="Anything you'd like a scout to know — upcoming matches, recent form, video highlights to watch first…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                />
              </VCField>
              <div style={{ fontSize: 10.5, color: "var(--mut)", textAlign: "right" }}>
                {note.length} / 500
              </div>
              {error && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 10 }}>{error}</p>}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <button className="btn green" disabled={busy} onClick={submit}>
                  {busy ? "Submitting…" : "Submit Request"}
                </button>
                <span style={{ fontSize: 11, color: "var(--mut)" }}>
                  Typical scout response: 5–10 days
                </span>
              </div>
            </VCCard>
          )}
        </div>

        <div className="vc-col">
          <VCCard title="What Scouts See">
            <div className="vc-li"><span className="m">✓</span><span>Your full performance, fitness and behavioural intelligence</span></div>
            <div className="vc-li"><span className="m">✓</span><span>Verified match history with figures and tournament context</span></div>
            <div className="vc-li"><span className="m">✓</span><span>Bowling / batting videos with AI-flagged strong and weak points</span></div>
            <div className="vc-li"><span className="m">✓</span><span>Identity and academy / coach verification trail</span></div>
          </VCCard>

          <VCCard title="How Endorsement Works">
            <div className="vc-li"><span className="m n">1</span><span>A verified scout reviews your profile in detail</span></div>
            <div className="vc-li"><span className="m n">2</span><span>They watch you at a trial, match, or video session</span></div>
            <div className="vc-li"><span className="m n">3</span><span>If endorsed, your ladder reaches Level 4 — Scout Verified</span></div>
            <div className="vc-li"><span className="m n">4</span><span>Top scouts can also send direct trial invites</span></div>
          </VCCard>

          <VCCard title="Privacy" action={<span className="bdg ghost">You decide</span>}>
            <p style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.55 }}>
              Endorsement requests are visible only to verified scouts. You can
              withdraw a request at any time and scouts cannot contact you
              directly unless you accept a trial invite.
            </p>
          </VCCard>
        </div>

      </div>
    </VerifyChrome>
  );
}
