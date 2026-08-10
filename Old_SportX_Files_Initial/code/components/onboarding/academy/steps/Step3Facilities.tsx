"use client";
import { Chips, NumStep, Field } from "../WizPrimitives";
import type { AcademyFormData } from "../AcademyOnboardingWizard";

export default function Step3Facilities({
  data, patch, errors, clearError,
}: {
  data: AcademyFormData;
  patch: (p: Partial<AcademyFormData>) => void;
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  return (
    <>
      <p className="step-kicker">Step 3 of 5</p>
      <h2 className="step-title">Facilities &amp; staff</h2>
      <p className="step-desc">What you offer on the ground, and who&apos;s coaching.</p>

      <div className="section-h" style={{ borderTop: 0, paddingTop: 0, marginTop: "0.3rem" }}>
        <h3>Facilities</h3><span>Ground &amp; equipment</span>
      </div>

      <Field label="Ground Type" required error={errors.groundType}>
        <Chips
          options={["Turf", "Matting", "Both"]}
          value={data.groundType}
          onChange={(v) => { patch({ groundType: v as string }); clearError("groundType"); }}
        />
      </Field>

      <div className="grid2">
        <div className="field">
          <label>Practice Nets</label>
          <NumStep value={data.practiceNets} onChange={(v) => patch({ practiceNets: v })} min={0} max={30} />
        </div>
        <Field label="Approx Capacity" optional error={errors.playerCapacity}>
          <input
            type="number"
            placeholder="e.g. 60 players"
            value={data.playerCapacity || ""}
            onChange={(e) => patch({ playerCapacity: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid2">
        <Field label="Bowling Machine" required error={errors.bowlingMachine}>
          <Chips
            options={["Yes", "No"]}
            value={data.bowlingMachine}
            onChange={(v) => { patch({ bowlingMachine: v as string }); clearError("bowlingMachine"); }}
          />
        </Field>
        <div className="field">
          <label>Indoor Facility</label>
          <Chips
            options={["Yes", "No"]}
            value={data.indoorFacility}
            onChange={(v) => patch({ indoorFacility: v as string })}
          />
        </div>
      </div>

      <div className="section-h">
        <h3>Staff</h3><span>Head coach &amp; team</span>
      </div>

      <div className="grid2">
        <Field label="Head Coach Name" required error={errors.headCoachName}>
          <input
            placeholder="Full name"
            value={data.headCoachName}
            onChange={(e) => { patch({ headCoachName: e.target.value }); clearError("headCoachName"); }}
          />
        </Field>
        <Field label="Head Coach Certification" error={errors.headCoachCertification}>
          <select
            value={data.headCoachCertification}
            onChange={(e) => { patch({ headCoachCertification: e.target.value }); clearError("headCoachCertification"); }}
          >
            <option value="">Select certification</option>
            {["BCCI L1","BCCI L2","BCCI L3","NCA","NIS","State Board","None"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid2">
        <div className="field">
          <label>Head Coach Experience (yrs)</label>
          <NumStep value={data.headCoachExperienceYears} onChange={(v) => patch({ headCoachExperienceYears: v })} min={0} max={50} />
        </div>
        <div className="field">
          <label>Assistant Coaches</label>
          <NumStep value={data.numAssistantCoaches} onChange={(v) => patch({ numAssistantCoaches: v })} min={0} max={20} />
        </div>
      </div>

      <div className="field">
        <label>Ex-Professional on Staff?</label>
        <Chips
          options={["Yes", "No"]}
          value={data.exPro}
          onChange={(v) => {
            patch({ exPro: v as string, exProName: v === "No" ? "" : data.exProName, exProLevel: v === "No" ? "" : data.exProLevel });
          }}
        />
        <div className={`reveal${data.exPro === "Yes" ? " show" : ""}`}>
          <div className="inner">
            <div className="grid2">
              <Field label="Name" error={errors.exProName}>
                <input
                  placeholder="Full name"
                  value={data.exProName}
                  onChange={(e) => { patch({ exProName: e.target.value }); clearError("exProName"); }}
                />
              </Field>
              <Field label="Highest Level Played">
                <input
                  placeholder="e.g. Ranji Trophy, IPL"
                  value={data.exProLevel}
                  onChange={(e) => patch({ exProLevel: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
