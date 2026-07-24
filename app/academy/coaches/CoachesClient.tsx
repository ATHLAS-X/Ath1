"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { AddCoachForm, ACADEMY_SPECIALIZATIONS } from "@/components/academy/forms";
import { Skeleton, SkeletonStyles } from "@/components/ui/Skeleton";

/* /academy/coaches — list of academy coaches with edit, soft-delete, and
   "Add coach" reuse of the onboarding Step 2 form. */

interface Props {
  academyName: string;
  adminName: string;
  adminEmail: string;
}

interface CoachRow {
  id: string;
  coach_name: string;
  specialization: string | null;
  years_experience: number | null;
  certifications: string | null;
  can_submit_fitness: boolean;
  can_submit_evaluations: boolean;
  coach_status: string;
  created_at: string;
  assessment_count: number;
}

const NAV = [
  { label: "Dashboard",             href: "/academy/dashboard" },
  { label: "Players",               href: "/academy/players" },
  { label: "Coaches",               href: "/academy/coaches" },
  { label: "Fitness & Assessments", href: "/academy/fitness" },
  { label: "Settings",              href: "/academy/settings" },
];

export default function CoachesClient(p: Props) {
  const pathname = usePathname() ?? "";
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editCoach, setEditCoach] = useState<CoachRow | null>(null);
  const [removeCoach, setRemoveCoach] = useState<CoachRow | null>(null);
  const [fetchError, setFetchError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFetchError(false);
    try {
      const res = await fetch("/api/academy/coaches");
      const data = await res.json().catch(() => ({}));
      if (data?.success) setCoaches(data.coaches ?? []);
      else setFetchError(true);
    } catch { setFetchError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const initials = p.adminName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--ax-bg)", color: "var(--ax-text)", fontFamily: "var(--ax-font-body)" }}>
      <style>{STYLES}</style>

      <aside className="cc-sidebar">
        <div className="cc-brand">
          <div>
            <div className="cc-word">ATHLAS<em>X</em></div>
            <div className="cc-sub">Academy admin</div>
          </div>
        </div>
        <nav className="cc-nav">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/academy/dashboard" && pathname.startsWith(item.href));
            return <Link key={item.href} href={item.href} className={`cc-link${active ? " on" : ""}`}>{item.label}</Link>;
          })}
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header className="cc-topbar">
          <div className="cc-title">
            <h1>Coaches</h1>
            <div className="cc-tsub">
              {p.academyName} · {loading ? "loading…" : `${coaches.length} coach${coaches.length === 1 ? "" : "es"}`}
            </div>
          </div>
          <div className="cc-top-right">
            <div className="cc-admin">
              <div className="cc-avatar">{initials}</div>
              <div>
                <div className="cc-admin-n">{p.adminName}</div>
                <div className="cc-admin-e">{p.adminEmail}</div>
              </div>
            </div>
            <button className="cc-logout" onClick={() => signOut({ callbackUrl: "/auth/login" })}>Logout</button>
          </div>
        </header>

        <main className="cc-main">
          <div className="cc-card">
            <div className="cc-card-head">
              <div>
                <h2 className="cc-card-title">Your coaching staff</h2>
                <p className="cc-card-sub">Add coaches, toggle their permissions, and review their evaluation history.</p>
              </div>
              <button className="cc-add" onClick={() => setAddOpen(true)}>+ Add coach</button>
            </div>

            {loading ? (
              <div style={{ padding: 18 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
                    <Skeleton width="22%" height={14} />
                    <Skeleton width="20%" height={14} />
                    <Skeleton width="12%" height={14} />
                    <Skeleton width="28%" height={20} />
                    <Skeleton width="14%" height={14} />
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <div className="cc-empty" style={{ padding: "32px 16px" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 6 }}>
                  Couldn&apos;t load coaches
                </div>
                <div style={{ fontSize: 12.5, color: "#64748B", marginBottom: 12 }}>
                  Check your connection and try again.
                </div>
                <button className="cc-add" onClick={load}>Try again</button>
              </div>
            ) : coaches.length === 0 ? (
              <EmptyState onAdd={() => setAddOpen(true)} />
            ) : (
              <div className="cc-table-wrap">
                <table className="cc-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Specialization</th>
                      <th>Experience</th>
                      <th>Permissions</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coaches.map((c) => (
                      <tr key={c.id}>
                        <td className="cc-name">{c.coach_name}</td>
                        <td>{c.specialization ?? "—"}</td>
                        <td className="cc-muted">
                          {c.years_experience != null ? `${c.years_experience} year${c.years_experience === 1 ? "" : "s"}` : "—"}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Pill active={c.can_submit_evaluations}>Can evaluate</Pill>
                            <Pill active={c.can_submit_fitness}>Can assess fitness</Pill>
                          </div>
                        </td>
                        <td className="cc-actions">
                          <button className="cc-link-btn" onClick={() => setEditCoach(c)}>Edit</button>
                          <button className="cc-link-btn cc-link-btn--danger" onClick={() => setRemoveCoach(c)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      <SkeletonStyles />

      {addOpen && (
        <Modal title="Add Coach" onClose={() => { setAddOpen(false); load(); }} width={680}>
          <AddCoachForm variant="dark" onSuccess={() => { load(); }} />
        </Modal>
      )}

      {editCoach && (
        <Modal title={`Edit · ${editCoach.coach_name}`} onClose={() => { setEditCoach(null); load(); }} width={680}>
          <EditCoachForm
            coach={editCoach}
            onSaved={() => { setEditCoach(null); load(); toast.success("Coach updated"); }}
          />
        </Modal>
      )}

      {removeCoach && (
        <RemoveConfirm
          coach={removeCoach}
          onClose={() => setRemoveCoach(null)}
          onDone={(msg) => { setRemoveCoach(null); toast.success(msg); load(); }}
        />
      )}
    </div>
  );
}

/* ─────── Sub-components ─────── */
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="cc-empty-state">
      <div className="cc-empty-illus">
        <svg viewBox="0 0 100 70" fill="none">
          <ellipse cx="50" cy="60" rx="35" ry="4" fill="var(--ax-field)" />
          <circle cx="50" cy="26" r="14" fill="var(--ax-ok-soft)" stroke="var(--ax-ok-border)" strokeWidth="1.5" />
          <path d="M50 18v8M50 30v.2" stroke="var(--ax-ok)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M28 56c0-10 9-16 22-16s22 6 22 16" fill="rgba(74,158,255,0.14)" stroke="rgba(74,158,255,0.35)" strokeWidth="1.5" />
        </svg>
      </div>
      <h3 className="cc-empty-h">No coaches yet</h3>
      <p className="cc-empty-p">
        Add your first coach to start submitting fitness assessments
        and player evaluations.
      </p>
      <button className="cc-add" style={{ marginTop: 14 }} onClick={onAdd}>+ Add coach</button>
    </div>
  );
}

function Pill({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99,
      background: active ? "var(--ax-ok-soft)" : "var(--ax-field)",
      color:      active ? "var(--ax-ok)" : "var(--ax-text-dim)",
      border:     `1px solid ${active ? "var(--ax-ok-border)" : "var(--ax-border)"}`,
      fontFamily: "var(--ax-font-display)", fontSize: 10.5, fontWeight: 600,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: active ? "var(--ax-ok)" : "var(--ax-text-faint)",
      }} />
      {children}
    </span>
  );
}

function EditCoachForm({ coach, onSaved }: { coach: CoachRow; onSaved: () => void }) {
  const [form, setForm] = useState({
    coach_name: coach.coach_name ?? "",
    specialization: coach.specialization ?? "",
    years_experience: coach.years_experience ?? "" as any,
    certifications: coach.certifications ?? "",
    can_submit_fitness: coach.can_submit_fitness,
    can_submit_evaluations: coach.can_submit_evaluations,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/academy/coaches/${coach.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          years_experience: form.years_experience === "" ? null : Number(form.years_experience),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Save failed"); return; }
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="cc-grid2">
        <Field label="Coach name *">
          <input className="cc-input" value={form.coach_name}
            onChange={(e) => setForm({ ...form, coach_name: e.target.value })} />
        </Field>
        <Field label="Specialization">
          <select className="cc-input" value={form.specialization}
            onChange={(e) => setForm({ ...form, specialization: e.target.value })}>
            <option value="">Select…</option>
            {ACADEMY_SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Years of experience">
          <input className="cc-input" type="number" min={0} max={80}
            value={form.years_experience}
            onChange={(e) => setForm({ ...form, years_experience: e.target.value as any })} />
        </Field>
        <Field label="Certifications">
          <input className="cc-input" value={form.certifications}
            onChange={(e) => setForm({ ...form, certifications: e.target.value })} />
        </Field>
      </div>

      <div className="cc-perms">
        <Toggle
          label="Can submit player evaluations"
          desc="Skill + behavioural ratings — counts toward Performance Verified"
          on={form.can_submit_evaluations}
          onChange={(v) => setForm({ ...form, can_submit_evaluations: v })}
        />
        <Toggle
          label="Can submit fitness assessments"
          desc="YoYo, sprint, 2 km — counts toward player fitness score"
          on={form.can_submit_fitness}
          onChange={(v) => setForm({ ...form, can_submit_fitness: v })}
        />
      </div>

      {error && <div className="cc-error">{error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={save} disabled={busy} className="cc-btn-save">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="cc-toggle-row">
      <div>
        <div className="cc-toggle-n">{label}</div>
        <div className="cc-toggle-d">{desc}</div>
      </div>
      <span onClick={() => onChange(!on)} className={`cc-toggle${on ? " on" : ""}`}>
        <span className="cc-toggle-knob" />
      </span>
    </label>
  );
}

function RemoveConfirm({ coach, onClose, onDone }: {
  coach: CoachRow; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/academy/coaches/${coach.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) {
        setError(data?.error ?? "Could not remove coach");
        return;
      }
      onDone(`${coach.coach_name} removed`);
    } finally { setBusy(false); }
  };

  const linked = coach.assessment_count > 0;

  return (
    <div className="cc-modal-bg" onClick={onClose}>
      <div className="cc-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <header className="cc-modal-head"><h3>Remove coach</h3><button onClick={onClose}>×</button></header>
        <div className="cc-modal-body">
          {linked ? (
            <div>
              <div className="cc-error" style={{ marginBottom: 12 }}>
                This coach has submitted <strong>{coach.assessment_count}</strong> fitness
                {coach.assessment_count === 1 ? " assessment" : " assessments"}. Remove their
                assessments first.
              </div>
              <p className="cc-muted" style={{ fontSize: 12 }}>
                Open the player profiles where {coach.coach_name} appears under
                Fitness Assessments, delete those rows, and try again.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button onClick={onClose} className="cc-btn-cancel">Close</button>
              </div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13.5, color: "var(--ax-text)", marginBottom: 12 }}>
                Remove <strong>{coach.coach_name}</strong> from your coaching staff?
              </p>
              <p className="cc-muted" style={{ fontSize: 12 }}>
                Their record is kept but hidden from your roster (soft-delete).
                They will no longer appear in the &quot;Assessed by coach&quot; dropdown.
              </p>
              {error && <div className="cc-error" style={{ marginTop: 12 }}>{error}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button onClick={onClose} className="cc-btn-cancel">Cancel</button>
                <button onClick={remove} disabled={busy} className="cc-btn-danger">
                  {busy ? "Removing…" : "Remove coach"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--ax-text-dim)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children, width = 720 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div className="cc-modal-bg" onClick={onClose}>
      <div className="cc-modal" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <header className="cc-modal-head"><h3>{title}</h3><button onClick={onClose}>×</button></header>
        <div className="cc-modal-body">{children}</div>
      </div>
    </div>
  );
}

const STYLES = `
.cc-sidebar { width: 240px; flex-shrink: 0; background: var(--ax-bg-soft); color: var(--ax-text); display: flex; flex-direction: column; padding: 20px 14px; position: sticky; top: 0; height: 100vh; border-right: 1px solid var(--ax-border); }
.cc-brand { display: flex; align-items: center; gap: 11px; padding: 4px 4px 14px; }
.cc-word { font-family: var(--ax-font-display); font-size: 16px; font-weight: 700; letter-spacing: 0.05em; }
.cc-word em { font-style: normal; color: var(--ax-accent); }
.cc-sub { font-size: 10px; color: var(--ax-text-faint); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px; }
.cc-nav { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
.cc-link { display: block; padding: 10px 14px; border-radius: var(--ax-radius-md); color: var(--ax-text-dim); font-size: 13px; font-weight: 500; text-decoration: none; border-left: 3px solid transparent; }
.cc-link:hover { color: var(--ax-text); background: var(--ax-bg-elevated); }
.cc-link.on { background: var(--ax-accent-14); color: var(--ax-accent-bright); border-left-color: var(--ax-accent); }
@media (max-width: 800px) { .cc-sidebar { width: 60px; padding: 16px 8px; } .cc-link { padding: 10px 8px; font-size: 10px; text-align: center; } .cc-brand div:nth-child(2) { display: none; } }

.cc-topbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 28px; background: rgba(13,13,13,0.6); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); border-bottom: 1px solid var(--ax-border); position: sticky; top: 0; z-index: 10; }
.cc-title h1 { font-size: 19px; font-weight: 700; color: var(--ax-text); margin: 0; font-family: var(--ax-font-display); }
.cc-tsub { font-size: 12px; color: var(--ax-text-faint); margin-top: 2px; }
.cc-top-right { display: flex; align-items: center; gap: 14px; }
.cc-admin { display: flex; align-items: center; gap: 10px; }
.cc-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--ax-accent-14); color: var(--ax-accent-bright); display: grid; place-items: center; font-family: var(--ax-font-display); font-weight: 700; font-size: 12px; }
.cc-admin-n { font-size: 12.5px; font-weight: 600; color: var(--ax-text); }
.cc-admin-e { font-size: 10.5px; color: var(--ax-text-faint); }
.cc-logout { padding: 7px 12px; border-radius: var(--ax-radius-md); background: var(--ax-field); border: 1px solid var(--ax-border); color: var(--ax-text-dim); font-size: 12px; font-weight: 600; cursor: pointer; }
.cc-logout:hover { background: var(--ax-bad-soft); color: var(--ax-bad-text); border-color: var(--ax-bad); }
@media (max-width: 600px) { .cc-admin > div:last-child { display: none; } }

.cc-main { padding: 24px 28px 48px; max-width: 1280px; }
.cc-card { background: var(--ax-card); border: 1px solid var(--ax-border); border-radius: var(--ax-radius-xl); box-shadow: var(--ax-shadow-card); }
.cc-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 20px 14px; border-bottom: 1px solid var(--ax-border); }
.cc-card-title { font-size: 15px; font-weight: 700; color: var(--ax-text); margin: 0; font-family: var(--ax-font-display); }
.cc-card-sub { font-size: 11.5px; color: var(--ax-text-faint); margin-top: 2px; }
.cc-add { background: var(--ax-accent); color: var(--ax-text-on-accent); border: none; padding: 0 16px; height: 36px; border-radius: var(--ax-radius-md); font-size: 12.5px; font-weight: 600; cursor: pointer; box-shadow: var(--ax-glow-accent); }
.cc-add:hover { background: var(--ax-accent-bright); }

.cc-table-wrap { overflow-x: auto; }
.cc-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.cc-table th { background: var(--ax-bg-soft); color: var(--ax-text-faint); font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600; padding: 11px 16px; text-align: left; border-bottom: 1px solid var(--ax-border); }
.cc-table td { padding: 14px 16px; border-bottom: 1px solid var(--ax-border); color: var(--ax-text); vertical-align: middle; }
.cc-table tbody tr { transition: background 0.13s; }
.cc-table tbody tr:hover { background: var(--ax-bg-elevated); }
.cc-table tbody tr:last-child td { border-bottom: none; }
.cc-name { font-weight: 600; }
.cc-muted { color: var(--ax-text-faint); }
.cc-actions { text-align: right; white-space: nowrap; }
.cc-actions > * + * { margin-left: 12px; }
.cc-link-btn { background: none; border: none; color: var(--ax-accent-bright); font-size: 12px; font-weight: 600; cursor: pointer; padding: 0; }
.cc-link-btn:hover { text-decoration: underline; }
.cc-link-btn--danger { color: var(--ax-bad-text); }
.cc-empty { padding: 38px 16px; text-align: center; color: var(--ax-text-faint); font-size: 13px; }
.cc-empty-state { padding: 50px 24px; text-align: center; color: var(--ax-text-faint); }
.cc-empty-illus { width: 140px; height: 100px; margin: 0 auto 14px; display: grid; place-items: center; }
.cc-empty-illus svg { width: 100%; height: 100%; }
.cc-empty-h { font-size: 17px; font-weight: 700; color: var(--ax-text); margin: 0; font-family: var(--ax-font-display); }
.cc-empty-p { font-size: 12.5px; color: var(--ax-text-dim); max-width: 360px; margin: 8px auto 0; line-height: 1.55; }

.cc-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 600px) { .cc-grid2 { grid-template-columns: 1fr; } }
.cc-input { width: 100%; height: 34px; padding: 0 11px; background: var(--ax-field); border: 1px solid var(--ax-border); border-radius: var(--ax-radius-md); color: var(--ax-text); font-size: 12.5px; outline: none; color-scheme: dark; }
.cc-input:focus { border-color: var(--ax-accent); }
.cc-error { padding: 10px 12px; border-radius: var(--ax-radius-md); background: var(--ax-bad-soft); border: 1px solid rgba(255,90,77,0.3); color: var(--ax-bad-text); font-size: 12.5px; }

.cc-perms { background: var(--ax-bg-soft); border: 1px solid var(--ax-border); border-radius: var(--ax-radius-md); padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.cc-toggle-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; cursor: pointer; }
.cc-toggle-n { font-size: 12.5px; font-weight: 600; color: var(--ax-text); }
.cc-toggle-d { font-size: 11px; color: var(--ax-text-faint); margin-top: 2px; }
.cc-toggle { width: 38px; height: 21px; border-radius: 99px; background: var(--ax-field); border: 1px solid var(--ax-border); position: relative; cursor: pointer; flex-shrink: 0; transition: all 0.15s; }
.cc-toggle.on { background: var(--ax-accent-14); border-color: var(--ax-accent); }
.cc-toggle-knob { position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%; background: var(--ax-text-faint); transition: all 0.15s; }
.cc-toggle.on .cc-toggle-knob { left: 19px; background: var(--ax-accent); box-shadow: var(--ax-glow-accent); }

.cc-btn-save { background: var(--ax-accent); border: 1px solid var(--ax-accent); color: var(--ax-text-on-accent); padding: 8px 16px; border-radius: var(--ax-radius-md); font-size: 12.5px; font-weight: 600; cursor: pointer; }
.cc-btn-save:hover:not(:disabled) { background: var(--ax-accent-bright); }
.cc-btn-save:disabled { opacity: 0.55; cursor: not-allowed; }
.cc-btn-cancel { background: var(--ax-field); border: 1px solid var(--ax-border); color: var(--ax-text-dim); padding: 8px 16px; border-radius: var(--ax-radius-md); font-size: 12.5px; font-weight: 600; cursor: pointer; }
.cc-btn-cancel:hover { background: var(--ax-bg-elevated); }
.cc-btn-danger { background: var(--ax-bad); border: 1px solid var(--ax-bad); color: #FFFFFF; padding: 8px 16px; border-radius: var(--ax-radius-md); font-size: 12.5px; font-weight: 600; cursor: pointer; }
.cc-btn-danger:hover:not(:disabled) { background: #E0483C; }
.cc-btn-danger:disabled { opacity: 0.55; cursor: not-allowed; }

.cc-toast { position: fixed; bottom: 24px; right: 24px; background: var(--ax-card); color: var(--ax-text); padding: 11px 18px; border-radius: var(--ax-radius-md); font-size: 13px; font-weight: 600; box-shadow: var(--ax-shadow-pop); z-index: 200; border: 1px solid var(--ax-border); }

.cc-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); z-index: 100; display: grid; place-items: start center; padding: 40px 16px; overflow-y: auto; }
.cc-modal { width: 100%; background: var(--ax-card); border: 1px solid var(--ax-border); border-radius: var(--ax-radius-xl); box-shadow: var(--ax-shadow-pop); overflow: hidden; }
.cc-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--ax-border); }
.cc-modal-head h3 { font-size: 16px; font-weight: 700; color: var(--ax-text); margin: 0; font-family: var(--ax-font-display); }
.cc-modal-head button { width: 32px; height: 32px; border-radius: var(--ax-radius-sm); border: 1px solid var(--ax-border); background: var(--ax-field); font-size: 20px; line-height: 1; color: var(--ax-text-dim); cursor: pointer; }
.cc-modal-body { padding: 18px 20px 22px; max-height: 70vh; overflow-y: auto; }

/* ─── Mobile patches (Task 5) ─── */
@media (max-width: 640px) {
  .cc-sidebar { position: fixed; bottom: 0; left: 0; right: 0; top: auto; width: 100%; height: 60px; padding: 0; flex-direction: row; border-top: 1px solid var(--ax-border); z-index: 50; }
  .cc-brand { display: none; }
  .cc-nav { flex-direction: row; padding-top: 0; gap: 0; flex: 1; height: 100%; align-items: stretch; }
  .cc-link { flex: 1; padding: 8px 4px; font-size: 9.5px; text-align: center; border-left: none; border-top: 3px solid transparent; line-height: 1.2; display: flex; align-items: center; justify-content: center; }
  .cc-link.on { border-top-color: var(--ax-accent); border-left-color: transparent; }
  .cc-main { padding-bottom: 84px; }
  .cc-modal-bg { padding: 0; align-items: stretch; }
  .cc-modal { max-width: 100% !important; max-height: 100vh; min-height: 100vh; border-radius: 0; display: flex; flex-direction: column; }
  .cc-modal-body { max-height: none; flex: 1; }
}
`;
