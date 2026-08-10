"use client";
import { Chips, Field } from "../WizPrimitives";
import type { AcademyFormData } from "../AcademyOnboardingWizard";

export default function Step4Programs({
  data, patch, errors, clearError,
}: {
  data: AcademyFormData;
  patch: (p: Partial<AcademyFormData>) => void;
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  return (
    <>
      <p className="step-kicker">Step 4 of 5</p>
      <h2 className="step-title">Programs</h2>
      <p className="step-desc">What you run, for whom, and at what price.</p>

      <Field label="Age Groups" required error={errors.ageGroups}>
        <div style={{ marginTop: "0.4rem" }}>
          <Chips
            options={["U-10","U-12","U-14","U-16","U-19","U-23","Senior"]}
            value={data.ageGroups}
            onChange={(v) => { patch({ ageGroups: v as string[] }); clearError("ageGroups"); }}
            multi
          />
        </div>
      </Field>

      <Field label="Formats" required error={errors.formats}>
        <div style={{ marginTop: "0.4rem" }}>
          <Chips
            options={["T20","ODI","Red-ball","All"]}
            value={data.formats}
            onChange={(v) => { patch({ formats: v as string[] }); clearError("formats"); }}
            multi
          />
        </div>
      </Field>

      <div className="grid2">
        <Field label="Batch Timings" required error={errors.batchTimings}>
          <div style={{ marginTop: "0.4rem" }}>
            <Chips
              options={["Morning","Evening","Both"]}
              value={data.batchTimings}
              onChange={(v) => { patch({ batchTimings: v as string }); clearError("batchTimings"); }}
            />
          </div>
        </Field>
        <Field label="Monthly Fee Range" required error={errors.feeRange}>
          <div style={{ marginTop: "0.4rem" }}>
            <Chips
              options={["Free","< 1K","1K–3K","3K–7K","7K+"]}
              value={data.feeRange}
              onChange={(v) => { patch({ feeRange: v as string }); clearError("feeRange"); }}
            />
          </div>
        </Field>
      </div>

      <div className="field">
        <label>BCCI Affiliated</label>
        <Chips
          options={["Yes","No"]}
          value={data.bcciAffiliated}
          onChange={(v) => { patch({ bcciAffiliated: v as string, bcciAffiliationId: v === "No" ? "" : data.bcciAffiliationId }); }}
        />
        <div className={`reveal${data.bcciAffiliated === "Yes" ? " show" : ""}`}>
          <div className="inner">
            <Field label="Affiliation ID">
              <input
                placeholder="e.g. BCCI-UP-0231"
                value={data.bcciAffiliationId}
                onChange={(e) => patch({ bcciAffiliationId: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="field">
        <label>State Cricket Association Affiliated</label>
        <Chips
          options={["Yes","No"]}
          value={data.stateAssociated}
          onChange={(v) => { patch({ stateAssociated: v as string, stateAssociationName: v === "No" ? "" : data.stateAssociationName }); }}
        />
        <div className={`reveal${data.stateAssociated === "Yes" ? " show" : ""}`}>
          <div className="inner">
            <Field label="Which association?" required={data.stateAssociated === "Yes"} error={errors.stateAssociationName}>
              <input
                placeholder="e.g. Uttar Pradesh Cricket Association"
                value={data.stateAssociationName}
                onChange={(e) => { patch({ stateAssociationName: e.target.value }); clearError("stateAssociationName"); }}
              />
            </Field>
          </div>
        </div>
      </div>
    </>
  );
}
