"use client";
import { useState } from "react";
import type { AcademyFormData } from "../AcademyOnboardingWizard";

export default function Step5GoLive({
  data, patch,
}: {
  data: AcademyFormData;
  patch: (p: Partial<AcademyFormData>) => void;
}) {
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [batchCreated, setBatchCreated] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);

  async function sendInvite() {
    if (!data.inviteCoachPhone.trim()) return;
    setInviteBusy(true);
    try {
      await fetch("/api/academy/invite-coach", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.inviteCoachPhone }),
      });
      setInviteSent(true);
    } catch {}
    setInviteBusy(false);
  }

  async function createBatch() {
    if (!data.firstBatchName.trim()) return;
    setBatchBusy(true);
    try {
      await fetch("/api/batches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.firstBatchName,
          ageGroup: data.firstBatchAgeGroup,
          timing: data.firstBatchTiming,
        }),
      });
      setBatchCreated(true);
    } catch {}
    setBatchBusy(false);
  }

  return (
    <>
      <p className="step-kicker">Step 5 of 5</p>
      <h2 className="step-title">Go live</h2>
      <p className="step-desc">Bring your team on board, or jump straight to your dashboard.</p>

      <div className="twocards">
        <div className="gocard">
          <h4>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 2 .7 3a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c1 .4 2 .6 3 .7a2 2 0 0 1 1.7 2z"/>
            </svg>
            Invite Coaches
          </h4>
          {inviteSent ? (
            <p style={{ color: "var(--ok)", fontSize: "0.88rem", fontWeight: 600, margin: 0 }}>✓ Invite sent!</p>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="tel"
                placeholder="Coach's mobile number"
                value={data.inviteCoachPhone}
                onChange={(e) => patch({ inviteCoachPhone: e.target.value })}
              />
              <button type="button" className="inline-amber" style={{ padding: "0.68rem 1rem" }} onClick={sendInvite} disabled={inviteBusy}>
                {inviteBusy ? "…" : "Invite"}
              </button>
            </div>
          )}
        </div>

        <div className="gocard amber">
          <h4>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Create First Batch
          </h4>
          {batchCreated ? (
            <p style={{ color: "var(--ok)", fontSize: "0.88rem", fontWeight: 600, margin: 0 }}>✓ Batch created!</p>
          ) : (
            <>
              <input
                type="text"
                placeholder="Batch name, e.g. Morning U-14"
                value={data.firstBatchName}
                onChange={(e) => patch({ firstBatchName: e.target.value })}
              />
              <select value={data.firstBatchAgeGroup} onChange={(e) => patch({ firstBatchAgeGroup: e.target.value })}>
                <option value="">Age group</option>
                {["U-10","U-12","U-14","U-16","U-19","U-23","Senior"].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={data.firstBatchTiming} onChange={(e) => patch({ firstBatchTiming: e.target.value })}>
                <option value="">Timing</option>
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
              </select>
              <button type="button" className="inline-amber" style={{ padding: "0.68rem 1rem" }} onClick={createBatch} disabled={batchBusy}>
                {batchBusy ? "Creating…" : "Create Batch"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="callout" style={{ marginTop: "1.4rem" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0, marginTop: "0.1rem" }}>
          <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/>
        </svg>
        <p>
          <b>{data.academyName || "Your academy"}</b> goes live the moment you finish — players who join via your invite link enter an approval queue.
        </p>
      </div>
    </>
  );
}
