"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ChevronRight, ChevronLeft, Check } from "lucide-react";

// ── Shared classes ───────────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-[#1A6B3C] focus:ring-1 focus:ring-[#1A6B3C]";
const selectCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#1A6B3C] focus:ring-1 focus:ring-[#1A6B3C]";
const textareaCls =
  "w-full resize-none rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-[#1A6B3C] focus:ring-1 focus:ring-[#1A6B3C]";

// ── Constants ────────────────────────────────────────────────────────────────
const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];
const AGE_GROUPS  = ["U12","U14","U16","U19","Open"] as const;
const FACILITIES  = ["Nets","Turf","Bowling Machine","Gym","Fitness Area","Video Analysis"] as const;
const SPECIALTIES = ["Batting","Fast Bowling","Spin","Wicketkeeping","Fitness","Mental Conditioning"] as const;

// ── Schemas ──────────────────────────────────────────────────────────────────
const step1Schema = z.object({
  contact_name:     z.string().min(2, "At least 2 characters"),
  email:            z.string().email("Enter a valid email"),
  phone:            z.string().regex(/^\+91\d{10}$/, "Format: +91XXXXXXXXXX"),
  password:         z.string().min(8, "Min 8 characters").regex(/\d/, "Must include a number"),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

const step2Schema = z.object({
  academy_name:        z.string().min(2, "Academy name required"),
  city:                z.string().min(1, "City required"),
  state:               z.string().min(1, "State required"),
  address:             z.string().optional(),
  website:             z.union([z.string().url("Enter a valid URL"), z.literal("")]).optional(),
  founded_year:        z.string().optional(),
  academy_description: z.string().max(500, "Max 500 characters").optional(),
});

const step3Schema = z.object({
  age_groups:  z.array(z.string()).min(1, "Select at least one"),
  facilities:  z.array(z.string()).default([]),
  specialties: z.array(z.string()).min(1, "Select at least one"),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;
type Step3 = z.infer<typeof step3Schema>;

// ── Helpers ──────────────────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function CheckboxGroup({
  options, selected, onChange,
}: { options: readonly string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map(opt => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt} type="button" onClick={() => toggle(opt)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              on ? "border-[#1A6B3C] bg-[#1A6B3C]/20 text-white"
                 : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-500"
            }`}
          >
            <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${on ? "border-[#1A6B3C] bg-[#1A6B3C]" : "border-slate-600"}`}>
              {on && <Check size={10} strokeWidth={3} className="text-white" />}
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  const steps = ["Account", "Academy", "Specialization"];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={idx} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                done    ? "border-[#1A6B3C] bg-[#1A6B3C] text-white"
                : active ? "border-[#1A6B3C] bg-transparent text-[#1A6B3C]"
                :          "border-slate-700 bg-transparent text-slate-500"
              }`}>
                {done ? <Check size={14} strokeWidth={3} /> : idx}
              </div>
              <span className={`text-xs ${active ? "text-white" : done ? "text-[#1A6B3C]" : "text-slate-500"}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-12 sm:w-20 mx-1 mb-5 transition-all ${done ? "bg-[#1A6B3C]" : "bg-slate-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1 ───────────────────────────────────────────────────────────────────
function Step1Form({ onNext, saved }: { onNext: (d: Step1) => void; saved: Partial<Step1> }) {
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Step1>({
    resolver: zodResolver(step1Schema),
    defaultValues: saved,
  });
  return (
    <form onSubmit={handleSubmit(onNext)} className="flex flex-col gap-4">
      <Field label="Full name" error={errors.contact_name?.message}>
        <input className={inputCls} placeholder="Rajesh Kumar" {...register("contact_name")} />
      </Field>
      <Field label="Email address" error={errors.email?.message}>
        <input type="email" className={inputCls} placeholder="coach@academy.in" {...register("email")} />
      </Field>
      <Field label="Phone number (+91XXXXXXXXXX)" error={errors.phone?.message}>
        <input className={inputCls} placeholder="+91XXXXXXXXXX" {...register("phone")} />
      </Field>
      <Field label="Password" error={errors.password?.message}>
        <div className="relative">
          <input type={showPw ? "text" : "password"} className={`${inputCls} pr-10`} placeholder="Min 8 chars with a number" {...register("password")} />
          <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </Field>
      <Field label="Confirm password" error={errors.confirm_password?.message}>
        <div className="relative">
          <input type={showConfirm ? "text" : "password"} className={`${inputCls} pr-10`} placeholder="Repeat password" {...register("confirm_password")} />
          <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </Field>
      <button type="submit" className="flex w-full items-center justify-center gap-1 rounded-lg bg-[#1A6B3C] py-2.5 text-sm font-semibold text-white transition hover:bg-[#155c33]">
        Next <ChevronRight size={16} />
      </button>
    </form>
  );
}

// ── Step 2 ───────────────────────────────────────────────────────────────────
function Step2Form({ onNext, onBack, saved }: { onNext: (d: Step2) => void; onBack: () => void; saved: Partial<Step2> }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Step2>({
    resolver: zodResolver(step2Schema),
    defaultValues: saved,
  });
  const desc = watch("academy_description") ?? "";
  return (
    <form onSubmit={handleSubmit(onNext)} className="flex flex-col gap-4">
      <Field label="Academy name" error={errors.academy_name?.message}>
        <input className={inputCls} placeholder="Champions Cricket Academy" {...register("academy_name")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City" error={errors.city?.message}>
          <input className={inputCls} placeholder="Mumbai" {...register("city")} />
        </Field>
        <Field label="State" error={errors.state?.message}>
          <select className={selectCls} {...register("state")} defaultValue="">
            <option value="" disabled>Select state</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Address (optional)" error={errors.address?.message}>
        <input className={inputCls} placeholder="123, MG Road, Andheri West" {...register("address")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Website (optional)" error={errors.website?.message}>
          <input className={inputCls} placeholder="https://..." {...register("website")} />
        </Field>
        <Field label="Year founded (optional)">
          <input type="number" className={inputCls} placeholder="2005" min={1800} max={new Date().getFullYear()} {...register("founded_year")} />
        </Field>
      </div>
      <Field label={`About the academy (${desc.length}/500)`} error={errors.academy_description?.message}>
        <textarea rows={4} className={textareaCls} placeholder="Tell scouts and players what makes your academy special..." maxLength={500} {...register("academy_description")} />
      </Field>
      <div className="flex gap-3 mt-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-2.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white">
          <ChevronLeft size={16} /> Back
        </button>
        <button type="submit" className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#1A6B3C] py-2.5 text-sm font-semibold text-white transition hover:bg-[#155c33]">
          Next <ChevronRight size={16} />
        </button>
      </div>
    </form>
  );
}

// ── Step 3 ───────────────────────────────────────────────────────────────────
function Step3Form({ onSubmit, onBack, saved, submitting, error }: {
  onSubmit: (d: Step3) => void; onBack: () => void;
  saved: Partial<Step3>; submitting: boolean; error: string | null;
}) {
  const { handleSubmit, setValue, watch, formState: { errors } } = useForm<Step3>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      age_groups:  saved.age_groups  ?? [],
      facilities:  saved.facilities  ?? [],
      specialties: saved.specialties ?? [],
    },
  });
  const age_groups  = watch("age_groups")  ?? [];
  const facilities  = watch("facilities")  ?? [];
  const specialties = watch("specialties") ?? [];
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium text-slate-300 mb-2">Age groups served</p>
        <CheckboxGroup options={AGE_GROUPS} selected={age_groups} onChange={v => setValue("age_groups", v, { shouldValidate: true })} />
        {errors.age_groups && <p className="text-xs text-red-400 mt-1">{errors.age_groups.message as string}</p>}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-300 mb-2">Facilities available</p>
        <CheckboxGroup options={FACILITIES} selected={facilities} onChange={v => setValue("facilities", v, { shouldValidate: true })} />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-300 mb-2">Specialties</p>
        <CheckboxGroup options={SPECIALTIES} selected={specialties} onChange={v => setValue("specialties", v, { shouldValidate: true })} />
        {errors.specialties && <p className="text-xs text-red-400 mt-1">{errors.specialties.message as string}</p>}
      </div>
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}
      <div className="flex gap-3 mt-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-2.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white">
          <ChevronLeft size={16} /> Back
        </button>
        <button type="submit" disabled={submitting} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#1A6B3C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#155c33] disabled:opacity-60">
          {submitting ? "Creating account…" : "Create Academy Account"}
        </button>
      </div>
    </form>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AcademyRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Partial<Step1>>({});
  const [step2Data, setStep2Data] = useState<Partial<Step2>>({});
  const [step3Data, setStep3Data] = useState<Partial<Step3>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleStep3 = async (d: Step3) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/auth/register/academy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...step1Data, ...step2Data, ...d }),
      });
      if (res.ok) {
        router.push("/auth/verify-email");
      } else {
        const body = await res.json();
        setSubmitError(typeof body.error === "string" ? body.error : "Registration failed. Try again.");
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1628] flex flex-col">
      <header className="px-6 py-4">
        <span className="text-xl font-extrabold tracking-tight text-white">SportX</span>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 shadow-2xl backdrop-blur">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">Register your Academy</h1>
              <p className="text-sm text-slate-400 mt-1">
                Step {step} of 3 — {["Account Setup","Academy Profile","Specialization"][step - 1]}
              </p>
            </div>
            <StepIndicator current={step} />
            {step === 1 && <Step1Form saved={step1Data} onNext={d => { setStep1Data(d); setStep(2); }} />}
            {step === 2 && <Step2Form saved={step2Data} onNext={d => { setStep2Data(d); setStep(3); }} onBack={() => setStep(1)} />}
            {step === 3 && <Step3Form saved={step3Data} onSubmit={handleStep3} onBack={() => setStep(2)} submitting={submitting} error={submitError} />}
          </div>
          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <a href="/auth/login" className="text-[#1A6B3C] hover:underline font-medium">Sign in</a>
          </p>
        </div>
      </main>
    </div>
  );
}
