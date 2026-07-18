"use client";
import { Chips, OptCards, NumStep, Field, svgIcon } from "../../academy/WizPrimitives";
import type { CoachFormData } from "../CoachOnboardingWizard";

const STATES = [
  "Andhra Pradesh","Assam","Bihar","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh",
  "Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya",
  "Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Jammu & Kashmir","Ladakh",
  "Chandigarh","Puducherry","Andaman and Nicobar Islands",
];

const ROLES = [
  { value: "HEAD",       label: "Head Coach",      sub: "Full programme responsibility", icon: svgIcon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>') },
  { value: "ASSISTANT",  label: "Assistant Coach", sub: "Supporting role",               icon: svgIcon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>') },
  { value: "SPECIALIST", label: "Specialist",      sub: "Batting, bowling, fielding",    icon: svgIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>') },
  { value: "FREELANCE",  label: "Freelance",       sub: "Multiple academies",            icon: svgIcon('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>') },
];

const SPECS = ["Batting","Bowling (Pace)","Bowling (Spin)","Wicket-keeping","Fielding","Fitness & Conditioning","Mental Skills","All-round"];
const AGE_GROUPS = ["U-10","U-12","U-14","U-16","U-19","U-23","Senior"];
const LEVELS = ["District","State U-19","State Ranji","IPL","International"];
const PLAYING_ROLES = ["Batsman","Pace Bowler","Spin Bowler","All-rounder","Wicket-keeper"];

export default function Step2Experience({
  data, patch, errors, clearError,
}: {
  data: CoachFormData;
  patch: (p: Partial<CoachFormData>) => void;
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  return (
    <>
      <p className="step-kicker">Step 2 of 4</p>
      <h2 className="step-title">Experience</h2>
      <p className="step-desc">Your coaching role, specialisations, and playing background.</p>

      <Field label="Primary Coaching Role" required error={errors.coachingRole}>
        <div style={{ marginTop: "0.4rem" }}>
          <OptCards
            options={ROLES}
            value={data.coachingRole}
            onChange={(v) => { patch({ coachingRole: v }); clearError("coachingRole"); }}
          />
        </div>
      </Field>

      <Field label="Coaching Specialisation" required error={errors.specialisations}>
        <div style={{ marginTop: "0.4rem" }}>
          <Chips
            options={SPECS}
            value={data.specialisations}
            onChange={(v) => { patch({ specialisations: v as string[] }); clearError("specialisations"); }}
            multi
          />
        </div>
      </Field>

      <Field label="Age Groups You Coach" required error={errors.ageGroupsCoached}>
        <div style={{ marginTop: "0.4rem" }}>
          <Chips
            options={AGE_GROUPS}
            value={data.ageGroupsCoached}
            onChange={(v) => { patch({ ageGroupsCoached: v as string[] }); clearError("ageGroupsCoached"); }}
            multi
          />
        </div>
      </Field>

      <div className="grid2">
        <div className="field">
          <label>Years of Coaching Experience</label>
          <NumStep
            value={data.coachingExperienceYears}
            onChange={(v) => patch({ coachingExperienceYears: v })}
            min={0}
            max={50}
          />
        </div>
        <Field label="City" required error={errors.city}>
          <input
            placeholder="e.g. Mumbai"
            value={data.city}
            onChange={(e) => { patch({ city: e.target.value }); clearError("city"); }}
          />
        </Field>
      </div>

      <Field label="State" required error={errors.state}>
        <select
          value={data.state}
          onChange={(e) => { patch({ state: e.target.value }); clearError("state"); }}
        >
          <option value="">Select state</option>
          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <div className="field">
        <label>Played at State / Higher Level?</label>
        <Chips
          options={["Yes", "No"]}
          value={data.playedStateLevel}
          onChange={(v) => {
            patch({
              playedStateLevel: v as string,
              highestLevelPlayed: v === "No" ? "" : data.highestLevelPlayed,
              playingRole: v === "No" ? "" : data.playingRole,
            });
          }}
        />
        <div className={`reveal${data.playedStateLevel === "Yes" ? " show" : ""}`}>
          <div className="inner">
            <div className="grid2">
              <Field label="Highest Level Played">
                <select
                  value={data.highestLevelPlayed}
                  onChange={(e) => patch({ highestLevelPlayed: e.target.value })}
                >
                  <option value="">Select level</option>
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="Playing Role">
                <select
                  value={data.playingRole}
                  onChange={(e) => patch({ playingRole: e.target.value })}
                >
                  <option value="">Select role</option>
                  {PLAYING_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
