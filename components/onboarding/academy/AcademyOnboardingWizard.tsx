"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import StepTransition from "@/components/onboarding/StepTransition";
import { ctaVariants, SPRING } from "@/lib/motion";
import Step1Account from "./steps/Step1Account";
import Step2Identity from "./steps/Step2Identity";
import Step3Facilities from "./steps/Step3Facilities";
import Step4Programs from "./steps/Step4Programs";
import Step5GoLive from "./steps/Step5GoLive";

// ── Types ─────────────────────────────────────────────────────────────────────
export type AcademyFormData = {
  // Step 1
  phone: string; otp: string[]; otpSent: boolean; otpVerified: boolean;
  // Step 2
  academyName: string; city: string; district: string; state: string;
  yearEstablished: string; academyType: string;
  primaryContactName: string; primaryContactDesignation: string; logoUrl: string;
  // Step 3
  groundType: string; practiceNets: number; bowlingMachine: string;
  indoorFacility: string; playerCapacity: string;
  headCoachName: string; headCoachCertification: string;
  headCoachExperienceYears: number; numAssistantCoaches: number;
  exPro: string; exProName: string; exProLevel: string;
  // Step 4
  ageGroups: string[]; formats: string[]; batchTimings: string; feeRange: string;
  bcciAffiliated: string; bcciAffiliationId: string;
  stateAssociated: string; stateAssociationName: string;
  // Step 5
  inviteCoachPhone: string; firstBatchName: string;
  firstBatchAgeGroup: string; firstBatchTiming: string;
};

const INIT: AcademyFormData = {
  phone: "", otp: ["","","","","",""], otpSent: false, otpVerified: false,
  academyName: "", city: "", district: "", state: "", yearEstablished: "",
  academyType: "", primaryContactName: "", primaryContactDesignation: "", logoUrl: "",
  groundType: "", practiceNets: 4, bowlingMachine: "", indoorFacility: "",
  playerCapacity: "", headCoachName: "", headCoachCertification: "",
  headCoachExperienceYears: 0, numAssistantCoaches: 0,
  exPro: "", exProName: "", exProLevel: "",
  ageGroups: [], formats: [], batchTimings: "", feeRange: "",
  bcciAffiliated: "", bcciAffiliationId: "", stateAssociated: "", stateAssociationName: "",
  inviteCoachPhone: "", firstBatchName: "", firstBatchAgeGroup: "", firstBatchTiming: "",
};
const LS_KEY = "academy-onboarding-draft";

const STEPS = [
  { lbl: "Account",            sub: "Phone + OTP" },
  { lbl: "Academy Identity",   sub: "Name, location, type" },
  { lbl: "Facilities & Staff", sub: "Ground, coaches" },
  { lbl: "Programs",           sub: "Ages, formats, fees" },
  { lbl: "Go Live",            sub: "Invite & launch" },
];

// ── Validation ────────────────────────────────────────────────────────────────
function validate(step: number, data: AcademyFormData): Record<string, string> {
  const errs: Record<string, string> = {};
  if (step === 0) {
    if (data.phone.length !== 10) errs.phone = "Enter a valid 10-digit mobile number.";
    /* TEMP BYPASS (2026-07-25): OTP verification is not required to advance
       past this step. lib/sms.ts has no real SMS provider wired up yet, so
       codes never reach a real phone outside dev (where the dev_otp hint
       covers it) — this unblocks onboarding testing until that's connected.
       RE-ENABLE before real users hit this flow:
       if (!data.otpVerified) errs.otp = "Verify the OTP before continuing."; */
  }
  if (step === 1) {
    if (!data.academyName.trim())        errs.academyName        = "Academy name is required.";
    if (!data.city.trim())               errs.city               = "City is required.";
    if (!data.state)                     errs.state              = "State is required.";
    if (!data.primaryContactName.trim()) errs.primaryContactName = "Contact name is required.";
  }
  if (step === 2) {
    if (!data.groundType)             errs.groundType             = "Select ground type.";
    if (!data.bowlingMachine)         errs.bowlingMachine         = "Select an option.";
    if (!data.headCoachName.trim())   errs.headCoachName          = "Head coach name is required.";
    if (!data.headCoachCertification) errs.headCoachCertification = "Select certification.";
    if (data.exPro === "Yes" && !data.exProName.trim()) errs.exProName = "Name is required.";
  }
  if (step === 3) {
    if (!data.ageGroups.length)  errs.ageGroups    = "Select at least one age group.";
    if (!data.formats.length)    errs.formats      = "Select at least one format.";
    if (!data.batchTimings)      errs.batchTimings = "Select batch timings.";
    if (!data.feeRange)          errs.feeRange     = "Select a fee range.";
    if (data.stateAssociated === "Yes" && !data.stateAssociationName.trim())
      errs.stateAssociationName = "Association name is required.";
  }
  return errs;
}

// ── Embedded CSS (from AthlasX Academy Onboarding v3.html) ───────────────────
const CSS = `
:root{
  --bg:#0D0D0D;--bg-soft:#141312;
  --text:#F5F5F0;--text-dim:rgba(245,245,240,0.62);--text-faint:rgba(245,245,240,0.4);
  --accent:#FF8A1E;--accent-rgb:255,138,30;--accent-bright:#FFA64D;
  --ov08:rgba(255,138,30,0.08);--ov14:rgba(255,138,30,0.14);--ov22:rgba(255,138,30,0.22);
  --card-border:rgba(245,245,240,0.14);--field-bg:rgba(245,245,240,0.06);
  --ok:#38d39f;--bad:#ff5a4d;
  --phi2:2.618rem;--ease:cubic-bezier(0.22,1,0.36,1);
}
.aow-root *,.aow-root *::before,.aow-root *::after{box-sizing:border-box;}
.aow-root{font-family:"Barlow",system-ui,sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh;min-height:100dvh;background:var(--bg);color:var(--text);}
.aow-root a{color:var(--accent-bright);text-decoration:none;}

/* ── LAYOUT ── */
.ob{display:grid;grid-template-columns:1fr 2fr;min-height:100vh;min-height:100dvh;}

/* ── LEFT RAIL ── */
.rail{position:relative;overflow:hidden;display:flex;flex-direction:column;padding:var(--phi2);background:var(--bg-soft) url("/images/hero/PlayerOnboardingImage.jpg") center/cover no-repeat;}
.rail::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 80% at 0% 0%,var(--ov14),transparent 55%),radial-gradient(110% 70% at 0% 100%,var(--ov08),transparent 55%),linear-gradient(180deg,rgba(13,13,13,.82) 0%,rgba(13,13,13,.94) 100%);}
.rail::after{content:"";position:absolute;inset:0;opacity:.04;pointer-events:none;background:repeating-linear-gradient(90deg,var(--text) 0 1px,transparent 1px 56px);}
.rail>*{position:relative;z-index:1;}
.brandmark{font-family:"Barlow Semi Condensed",sans-serif;text-transform:uppercase;letter-spacing:.22em;font-weight:700;font-size:.95rem;}
.brandmark span{color:var(--accent);}
.lead{margin-top:1.6rem;}
.lead .eyebrow{font-family:"Barlow Semi Condensed",sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:11px;font-weight:700;color:var(--accent-bright);margin:0 0 .55rem;}
.lead h1{font-family:"Anton",sans-serif;text-transform:uppercase;font-weight:400;line-height:.92;font-size:42px;margin:0;}
.lead h1 b{color:var(--accent);font-weight:400;}
.lead p{margin:.8rem 0 0;font-size:14px;line-height:1.5;color:var(--text-dim);max-width:22rem;}
.stepper{margin:2rem 0 0;display:flex;flex-direction:column;gap:.15rem;}
.step{display:flex;align-items:center;gap:.85rem;padding:.5rem .4rem;border-radius:9px;color:var(--text-dim);}
.step .num{flex:0 0 auto;width:27px;height:27px;border-radius:50%;display:grid;place-items:center;font-size:.78rem;font-weight:700;font-family:"Barlow Semi Condensed",sans-serif;border:1.5px solid var(--card-border);color:var(--text-dim);transition:all .25s var(--ease);}
.step .lbl{font-size:.9rem;font-weight:600;}
.step .lbl small{display:block;font-size:.7rem;font-weight:500;color:var(--text-faint);}
.step.done{color:var(--text);}
.step.done .num{border-color:var(--accent);background:var(--ov14);color:var(--accent-bright);}
.step.current{color:var(--text);}
.step.current .num{border-color:var(--accent);background:var(--accent);color:#1a0e02;box-shadow:0 0 0 4px var(--ov22);}
.rail .foot{margin-top:auto;padding-top:1.5rem;font-size:.76rem;color:var(--text-faint);display:flex;align-items:center;gap:.5rem;}
.save-dot{width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 8px var(--ok);}

/* ── RIGHT PANEL ── */
.form-side{position:relative;display:flex;flex-direction:column;background:var(--bg);min-width:0;}
.form-side::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(110% 50% at 100% 0%,var(--ov08),transparent 55%);}
.topbar{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem clamp(1.25rem,3.5vw,3rem);border-bottom:1px solid var(--card-border);}
.roleswitch{display:flex;gap:.3rem;padding:.28rem;background:var(--field-bg);border:1px solid var(--card-border);border-radius:11px;}
.roleswitch button{appearance:none;border:0;cursor:pointer;border-radius:8px;padding:.46rem .95rem;font-family:"Barlow Semi Condensed",sans-serif;text-transform:uppercase;letter-spacing:.05em;font-weight:700;font-size:.82rem;color:var(--text-dim);background:transparent;transition:background .22s var(--ease),color .22s var(--ease);}
.roleswitch button[aria-selected="true"]{background:var(--accent);color:#1a0e02;}
.acct{display:flex;align-items:center;gap:.7rem;font-size:.84rem;color:var(--text-dim);}
.acct .av{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--ov14);color:var(--accent-bright);font-weight:700;font-size:.82rem;font-family:"Barlow Semi Condensed",sans-serif;}
.progress-line{height:3px;background:var(--card-border);overflow:hidden;position:relative;z-index:2;}
.progress-line i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent-bright));transition:width .5s var(--ease);}
.scroller{position:relative;z-index:1;flex:1;overflow-y:auto;}
.form-body{width:100%;max-width:40rem;margin:0 auto;padding:clamp(1.5rem,3.5vw,2.6rem) clamp(1.25rem,3.5vw,3rem) 2rem;}

/* ── STEP HEADER ── */
.step-kicker{font-family:"Barlow Semi Condensed",sans-serif;text-transform:uppercase;letter-spacing:.18em;font-size:11px;font-weight:700;color:var(--accent-bright);margin:0 0 .45rem;}
.step-title{font-family:"Anton",sans-serif;text-transform:uppercase;font-weight:400;line-height:.92;font-size:40px;margin:0 0 .55rem;color:var(--text);}
.step-desc{margin:0 0 1.7rem;font-size:14px;line-height:1.5;color:var(--text-dim);max-width:32rem;}

/* ── GRID / FIELD ── */
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:.95rem 1rem;}
.ffull{grid-column:1/-1;}
.field{margin-bottom:1.05rem;}
.field>label{display:block;font-family:"Barlow Semi Condensed",sans-serif;text-transform:uppercase;letter-spacing:.12em;font-size:10.5px;font-weight:700;color:var(--text-dim);margin:0 0 .5rem;}
.field>label .req{color:var(--accent);margin-left:.15rem;}
.field>label .opt{color:var(--text-faint);font-weight:500;letter-spacing:.05em;margin-left:.3rem;text-transform:none;}
.field input,.field select,.gocard input,.gocard select{width:100%;padding:.78rem .95rem;font-family:"Barlow",sans-serif;font-size:.95rem;color:var(--text);background:var(--field-bg);border:1px solid var(--card-border);border-radius:9px;outline:none;transition:border-color .22s var(--ease),background .22s var(--ease),box-shadow .22s var(--ease);}
.field input::placeholder,.gocard input::placeholder{color:var(--text-faint);}
.field input:focus,.field select:focus{border-color:var(--accent);background:rgba(245,245,240,.09);box-shadow:0 0 0 3px var(--ov22);}
.field.invalid input,.field.invalid select{border-color:var(--bad);box-shadow:0 0 0 3px rgba(255,90,77,.16);}
.field .err{display:none;font-size:.76rem;color:#ff8a7e;margin:.45rem 0 0;}
.field.invalid .err{display:block;}
.field select{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23FFA64D' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");background-repeat:no-repeat;background-position:right .9rem center;padding-right:2.4rem;color-scheme:dark;}
.field select option{background:#1C1A18;color:var(--text);}

/* ── OPT CARDS ── */
.cardset{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;}
.optcard{cursor:pointer;text-align:left;padding:.85rem .95rem;border-radius:11px;background:var(--field-bg);border:1.5px solid var(--card-border);display:flex;align-items:flex-start;gap:.7rem;transition:all .18s var(--ease);width:100%;}
.optcard:hover{border-color:rgba(245,245,240,.3);}
.optcard[aria-pressed="true"]{border-color:var(--accent);background:var(--ov14);}
.optcard .ico{width:32px;height:32px;flex:0 0 auto;border-radius:8px;display:grid;place-items:center;background:rgba(var(--accent-rgb),.16);color:var(--accent-bright);transition:all .18s var(--ease);}
.optcard[aria-pressed="true"] .ico{background:var(--accent);color:#1a0e02;}
.optcard .ico svg{width:17px;height:17px;}
.optcard .t b{display:block;font-size:.94rem;font-weight:700;color:var(--text);}
.optcard .t small{font-size:.74rem;color:var(--text-dim);line-height:1.35;}

/* ── CHIPS ── */
.chips{display:flex;flex-wrap:wrap;gap:.5rem;}
.chip{cursor:pointer;user-select:none;padding:.5rem .9rem;border-radius:999px;font-size:.86rem;font-weight:600;color:var(--text-dim);background:var(--field-bg);border:1.5px solid var(--card-border);transition:all .18s var(--ease);}
.chip:hover{border-color:rgba(245,245,240,.3);color:var(--text);}
.chip[aria-pressed="true"]{background:var(--ov14);border-color:var(--accent);color:var(--accent-bright);}

/* ── NUMSTEP ── */
.numstep{display:inline-flex;align-items:center;border:1px solid var(--card-border);border-radius:9px;overflow:hidden;background:var(--field-bg);}
.numstep button{border:0;background:transparent;width:38px;height:42px;font-size:1.1rem;font-weight:700;color:var(--text);cursor:pointer;transition:background .15s var(--ease);}
.numstep button:hover{background:var(--ov14);color:var(--accent-bright);}
.numstep input{width:56px;text-align:center;border:0;border-left:1px solid var(--card-border);border-right:1px solid var(--card-border);height:42px;font-size:.98rem;font-weight:700;background:transparent;color:var(--text);font-family:"Barlow",sans-serif;outline:none;}

/* ── OTP ── */
.otp-boxes{display:flex;gap:.55rem;}
.otp-box{width:46px;height:52px;text-align:center;font-size:1.2rem;font-weight:700;border:1.5px solid var(--card-border);border-radius:9px;background:var(--field-bg);color:var(--text);outline:none;transition:all .18s var(--ease);font-family:"Barlow",sans-serif;}
.otp-box.filled{border-color:var(--accent);}
.otp-box:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--ov22);}
.otp-box:disabled{opacity:.35;cursor:not-allowed;}
.phone-row{display:flex;gap:.5rem;}
.phone-chip{flex:0 0 auto;display:flex;align-items:center;padding:0 .9rem;border:1px solid var(--card-border);border-radius:9px;background:var(--field-bg);font-weight:700;font-size:.92rem;}
.inline-amber{flex:0 0 auto;padding:0 1.1rem;border:0;border-radius:9px;background:var(--accent);color:#1a0e02;font-family:"Barlow Semi Condensed",sans-serif;text-transform:uppercase;letter-spacing:.05em;font-weight:700;font-size:.84rem;cursor:pointer;transition:background .18s var(--ease);}
.inline-amber:hover{background:var(--accent-bright);}
.inline-amber:disabled{opacity:.5;cursor:not-allowed;}

/* ── REVEAL ── */
.reveal{max-height:0;overflow:hidden;transition:max-height .4s var(--ease);}
.reveal.show{max-height:400px;}
.reveal .inner{padding:.9rem;background:var(--field-bg);border:1px solid var(--card-border);border-radius:10px;margin-top:.7rem;}

/* ── UPLOAD ── */
.upload-zone{border:2px dashed var(--accent);border-radius:11px;padding:1.8rem 1rem;display:flex;flex-direction:column;align-items:center;gap:.5rem;text-align:center;cursor:pointer;background:var(--ov08);transition:background .18s var(--ease);}
.upload-zone:hover{background:var(--ov14);}
.upload-zone svg{color:var(--accent);}
.upload-zone b{font-size:.9rem;color:var(--text);}
.upload-zone small{font-size:.74rem;color:var(--text-faint);}

/* ── CALLOUT ── */
.callout{display:flex;gap:.7rem;padding:.85rem 1rem;border-radius:10px;margin:.2rem 0 1.4rem;background:var(--ov08);border:1px solid var(--ov22);}
.callout svg{color:var(--accent-bright);flex:0 0 auto;}
.callout p{margin:0;font-size:.84rem;line-height:1.5;color:var(--text);}
.callout b{color:var(--accent-bright);}

/* ── SECTION HEADER ── */
.section-h{display:flex;align-items:baseline;gap:.7rem;margin:1.7rem 0 1rem;padding-top:1.3rem;border-top:1px solid var(--card-border);}
.section-h h3{font-family:"Barlow Semi Condensed",sans-serif;text-transform:uppercase;letter-spacing:.08em;font-size:1.02rem;font-weight:700;margin:0;color:var(--text);}
.section-h span{font-size:.76rem;color:var(--text-faint);}

/* ── STEP 5 CARDS ── */
.twocards{display:grid;grid-template-columns:1fr 1fr;gap:.9rem;}
.gocard{border-radius:11px;padding:1.15rem;display:flex;flex-direction:column;gap:.75rem;border:1.5px solid var(--card-border);background:var(--field-bg);}
.gocard.amber{border-color:var(--accent);background:var(--ov14);}
.gocard h4{margin:0;font-family:"Barlow Semi Condensed",sans-serif;text-transform:uppercase;letter-spacing:.06em;font-size:.92rem;font-weight:700;display:flex;align-items:center;gap:.5rem;color:var(--text);}
.gocard h4 svg{width:17px;height:17px;color:var(--accent);}
.gocard input,.gocard select{padding:.68rem .85rem;font-size:.9rem;background:rgba(245,245,240,.05);}
.gocard input:focus,.gocard select:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--ov22);}
.gocard select{appearance:none;cursor:pointer;color-scheme:dark;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23FFA64D' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");background-repeat:no-repeat;background-position:right .85rem center;padding-right:2.3rem;}
.gocard select option{background:#1C1A18;color:var(--text);}

/* ── FOOTER ── */
.form-foot{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem clamp(1.25rem,3.5vw,3rem);border-top:1px solid var(--card-border);background:rgba(13,13,13,.6);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);}
.form-foot .meta{font-size:.82rem;color:var(--text-dim);}
.form-foot .btns{display:flex;gap:.6rem;}
.btn{padding:.78rem 1.5rem;cursor:pointer;font-family:"Barlow Semi Condensed",sans-serif;text-transform:uppercase;letter-spacing:.06em;font-weight:700;font-size:.92rem;border-radius:9px;transition:transform .16s var(--ease),background .2s var(--ease),border-color .2s var(--ease);white-space:nowrap;}
.btn:active{transform:translateY(1px);}
.btn-fill{background:var(--accent);color:#1a0e02;border:1.5px solid var(--accent);box-shadow:0 8px 22px -8px rgba(var(--accent-rgb),.7);}
.btn-fill:hover{background:var(--accent-bright);border-color:var(--accent-bright);}
.btn-fill:disabled{opacity:.5;cursor:not-allowed;box-shadow:none;}
.btn-ghost{background:transparent;color:var(--text);border:1.5px solid var(--card-border);}
.btn-ghost:hover{border-color:var(--text);background:rgba(245,245,240,.06);}

/* ── DONE SCREEN ── */
.done-screen{text-align:center;padding:2.5rem 0 1rem;}
.done-screen .seal{width:84px;height:84px;margin:0 auto 1.4rem;border-radius:50%;display:grid;place-items:center;background:var(--ov14);border:1.5px solid var(--accent);color:var(--accent);}
.done-screen .seal svg{width:40px;height:40px;}
.done-screen h2{font-family:"Anton",sans-serif;text-transform:uppercase;font-weight:400;line-height:.92;font-size:clamp(30px,4vw,44px);margin:0 0 .7rem;}
.done-screen h2 b{color:var(--accent);font-weight:400;}
.done-screen p{font-size:.95rem;color:var(--text-dim);max-width:28rem;margin:0 auto;line-height:1.55;}

/* ── RESPONSIVE ── */
@media(max-width:900px){
  .ob{grid-template-columns:1fr;}
  .rail{padding:1.4rem;}
  .lead h1{font-size:32px;}
  .stepper{flex-direction:row;flex-wrap:wrap;gap:.4rem;margin-top:1.2rem;}
  .step{padding:.35rem .6rem .35rem .35rem;background:rgba(245,245,240,.04);}
  .step .lbl{font-size:.78rem;}.step .lbl small{display:none;}
  .rail .foot{display:none;}
}
@media(max-width:560px){
  .grid2,.cardset,.twocards{grid-template-columns:1fr;}
  .topbar{flex-direction:column;align-items:stretch;}
  .acct{display:none;}
  .roleswitch{overflow-x:auto;}
  .form-foot{flex-direction:column-reverse;align-items:stretch;}
  .form-foot .btns .btn{flex:1;}
  .step-title{font-size:32px;}
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition-duration:.001ms!important;animation-duration:.001ms!important;}}
`;

// ── Main Wizard ───────────────────────────────────────────────────────────────
export default function AcademyOnboardingWizard() {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [form, setForm] = useState<AcademyFormData>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
      if (!raw) return INIT;
      const saved = JSON.parse(raw);
      // OTP flow state must never persist — phone stays editable on reload
      return { ...INIT, ...saved, otpSent: false, otpVerified: false, otp: ["","","","","",""] };
    } catch { return INIT; }
  });

  const patch = useCallback((partial: Partial<AcademyFormData>) => {
    setForm((prev) => {
      const next = { ...prev, ...partial };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  function clearError(k: string) {
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  }

  async function handleNext() {
    if (done) { router.push("/academy/dashboard"); return; }

    const errs = validate(step, form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrors({});
    setApiError(null);

    if (step === 4) {
      setFinishing(true);
      try {
        const res = await fetch("/api/academy/onboarding", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: form.phone,
            academy_name: form.academyName, city: form.city, district: form.district,
            state: form.state, established_year: form.yearEstablished,
            academy_type: form.academyType, primary_contact_name: form.primaryContactName,
            primary_contact_designation: form.primaryContactDesignation, logo_url: form.logoUrl,
            ground_type: form.groundType, practice_nets: form.practiceNets,
            bowling_machine: form.bowlingMachine === "Yes",
            indoor_facility: form.indoorFacility === "Yes",
            approx_capacity: form.playerCapacity,
            head_coach_name: form.headCoachName, head_coach_certification: form.headCoachCertification,
            head_coach_experience_years: form.headCoachExperienceYears,
            num_assistant_coaches: form.numAssistantCoaches,
            ex_pro_on_staff: form.exPro === "Yes", ex_pro_name: form.exProName, ex_pro_level: form.exProLevel,
            age_groups_offered: form.ageGroups, formats_trained_in: form.formats,
            batch_timings: form.batchTimings, monthly_fee_range: form.feeRange,
            bcci_affiliated: form.bcciAffiliated === "Yes", bcci_affiliation_id: form.bcciAffiliationId,
            state_association_affiliated: form.stateAssociated === "Yes",
            state_association_name: form.stateAssociationName,
          }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          setApiError(d.error ?? `Save failed (${res.status}) — please try again.`);
          scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          setFinishing(false);
          return;
        }
        try { localStorage.removeItem(LS_KEY); } catch {}
        setDone(true);
      } catch (e: any) {
        setApiError(e?.message ?? "Network error — check your connection and try again.");
        scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }
      setFinishing(false);
      return;
    }

    setStep((s) => s + 1);
    scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    if (step > 0 && !done) {
      setStep((s) => s - 1);
      setErrors({});
      setApiError(null);
      scrollerRef.current?.scrollTo({ top: 0 });
    }
  }

  const pct = done ? 100 : ((step + 1) / 5) * 100;
  const stepProps = { data: form, patch, errors, clearError };

  return (
    <div className="aow-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ob">

        {/* ── LEFT RAIL ── */}
        <aside className="rail">
          <div className="brandmark">ATHLAS<span>X</span></div>
          <div className="lead">
            <p className="eyebrow">Academy Onboarding</p>
            <h1>Set up your <b>academy.</b></h1>
            <p>Five steps. Roster-ready in under 10 minutes. Everything auto-saves.</p>
          </div>
          <nav className="stepper">
            {STEPS.map((s, i) => {
              const isDone    = done || i < step;
              const isCurrent = !done && i === step;
              return (
                <div key={i} className={`step${isCurrent ? " current" : ""}${isDone ? " done" : ""}`}>
                  <motion.span
                    className="num"
                    animate={{ scale: isCurrent ? 1.05 : 1 }}
                    transition={SPRING}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {isDone ? (
                        <motion.svg
                          key="check"
                          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}
                          strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                          <polyline points="20 6 9 17 4 11" />
                        </motion.svg>
                      ) : (
                        <motion.span key="num" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING}>
                          {i + 1}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.span>
                  <span className="lbl">{s.lbl}<small>{s.sub}</small></span>
                </div>
              );
            })}
          </nav>
          <div className="foot">
            <span className="save-dot" />
            All progress saved automatically
          </div>
        </aside>

        {/* ── RIGHT PANEL ── */}
        <main className="form-side">
          <div className="topbar">
            <div className="roleswitch">
              <button type="button" aria-selected={false as unknown as boolean | undefined}>Player</button>
              <button type="button" aria-selected={false as unknown as boolean | undefined}>Coach</button>
              <button type="button" aria-selected={true  as unknown as boolean | undefined}>Academy</button>
              <button type="button" aria-selected={false as unknown as boolean | undefined}>Scout</button>
            </div>
            <div className="acct">
              <span>Welcome to AthlasX</span>
              <span className="av">A</span>
            </div>
          </div>

          <div className="progress-line">
            <motion.i
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "block" }}
            />
          </div>

          <div className="scroller" ref={scrollerRef}>
            <div className="form-body">
              {apiError && (
                <div style={{
                  margin: "0 0 16px", padding: "12px 16px",
                  background: "rgba(255,90,77,0.1)", border: "1px solid rgba(255,90,77,0.35)",
                  borderRadius: 10, color: "#ff5a4d", fontSize: 13, lineHeight: 1.5,
                }}>
                  {apiError}
                </div>
              )}
              {Object.keys(errors).length > 0 && (
                <div style={{
                  margin: "0 0 16px", padding: "12px 16px",
                  background: "rgba(255,90,77,0.08)", border: "1px solid rgba(255,90,77,0.3)",
                  borderRadius: 10, color: "#ff5a4d", fontSize: 12.5, lineHeight: 1.6,
                }}>
                  <strong style={{ display: "block", marginBottom: 4 }}>Fix the following before continuing:</strong>
                  {Object.values(errors).map((e, i) => <div key={i}>· {e}</div>)}
                </div>
              )}
              {done ? (
                <motion.div className="done-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <motion.div
                    className="seal"
                    initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1, transition: { ...SPRING, delay: 0.1 } }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                      strokeLinecap="round" strokeLinejoin="round">
                      <motion.polyline
                        points="20 6 9 17 4 11"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
                      />
                    </svg>
                  </motion.div>
                  <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}>
                    {form.academyName || "Your academy"} is <b>live.</b>
                  </motion.h2>
                  <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.38 } }}>
                    Your profile is submitted and pending verification. Invite links are active — start adding players now.
                  </motion.p>
                </motion.div>
              ) : (
                <StepTransition step={step}>
                  {step === 0 && <Step1Account {...stepProps} />}
                  {step === 1 && <Step2Identity {...stepProps} />}
                  {step === 2 && <Step3Facilities {...stepProps} />}
                  {step === 3 && <Step4Programs {...stepProps} />}
                  {step === 4 && <Step5GoLive data={form} patch={patch} />}
                </StepTransition>
              )}
            </div>
          </div>

          <div className="form-foot">
            <div className="meta">{done ? "Done" : `Step ${step + 1} of 5`}</div>
            <div className="btns">
              {!done && step > 0 && (
                <motion.button
                  type="button" className="btn btn-ghost" onClick={handleBack}
                  variants={ctaVariants} initial="rest" whileHover="hover" whileTap="tap"
                >Back</motion.button>
              )}
              <motion.button
                type="button"
                className="btn btn-fill"
                onClick={handleNext}
                disabled={finishing}
                variants={ctaVariants} initial="rest" whileHover="hover" whileTap="tap"
              >
                {done
                  ? "Go to Dashboard →"
                  : finishing
                  ? "Saving…"
                  : step === 4
                  ? "Finish & Go Live →"
                  : "Save & Continue →"}
              </motion.button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
