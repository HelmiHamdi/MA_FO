"use client";
// src/app/(app)/profile/page.tsx  ← REMPLACE le fichier existant
// Module 2.2 — My Profile (complet)
// Gestion identité, préférences, settings LinkedIn, message réunion, notifs, privacy, langue

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { profileApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { getInitials, getFullName, parseTags } from "@/lib/utils";
import toast from "react-hot-toast";
import axios from "axios";

// ─── Config ───────────────────────────────────────────────────────────────────
const TAGS_SUGGESTIONS = [
  "FinTech", "StartUp", "Investissement", "Innovation", "RH",
  "Marketing", "Tech", "IA", "Immobilier", "Santé", "Éducation",
  "E-commerce", "Retail", "Industrie", "Logistique", "Export",
  "Tourisme", "Énergie", "AgriTech", "Impact social",
];

const NOTIF_TYPES = [
  { key: "push",  label: "Notifications push",  icon: "📲" },
  { key: "email", label: "Notifications email",  icon: "📧" },
  { key: "sms",   label: "SMS",                  icon: "💬" },
];

// ─── Completeness calculator ──────────────────────────────────────────────────
function calcCompleteness(p: any): { pct: number; missing: string[] } {
  const checks: Array<{ key: string; label: string; value: any }> = [
    { key: "photo",   label: "Photo",     value: p?.photoUrl },
    { key: "bio",     label: "Bio",       value: p?.bio },
    { key: "job",     label: "Poste",     value: p?.jobTitle },
    { key: "company", label: "Entreprise",value: p?.company },
    { key: "country", label: "Pays",      value: p?.country },
    { key: "tags",    label: "Tags",      value: (() => { try { return JSON.parse(p?.tags ?? "[]").length > 0; } catch { return false; } })() },
    { key: "linkedin",label: "LinkedIn",  value: p?.linkedinConnected },
  ];
  const done = checks.filter((c) => !!c.value);
  const missing = checks.filter((c) => !c.value).map((c) => c.label);
  return { pct: Math.round((done.length / checks.length) * 100), missing };
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 20, overflow: "hidden",
    }}>
      <div style={{ padding: "10px 16px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <p style={{ margin: 0, fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--brand-400, #a78bfa)" }}>
          {title}
        </p>
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted, #94a3b8)" }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ margin: 0, fontSize: "0.68rem", color: "var(--text-ghost, #475569)", lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10,
  padding: "9px 12px", color: "var(--text-primary, #f1f5f9)",
  fontSize: "0.875rem", outline: "none", fontFamily: "inherit",
  boxSizing: "border-box",
};

const readOnlyStyle: React.CSSProperties = {
  ...inputStyle,
  background: "rgba(255,255,255,0.02)",
  color: "var(--text-muted, #94a3b8)",
  cursor: "not-allowed",
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 42, height: 24, borderRadius: 12, flexShrink: 0,
        background: checked ? "rgba(52,211,153,0.8)" : "rgba(255,255,255,0.1)",
        border: "none", cursor: "pointer", position: "relative",
        transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, width: 18, height: 18, borderRadius: 9,
        background: "white", transition: "left 0.2s",
        left: checked ? 21 : 3,
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}

function ToggleRow({ icon, label, checked, onChange }: { icon: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "1rem" }}>{icon}</span>
        <span style={{ fontSize: "0.875rem", color: "var(--text-secondary, #cbd5e1)" }}>{label}</span>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function MyProfilePage() {
  const qc = useQueryClient();
  const { participant: authParticipant, updateParticipant } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // ── Fetch fresh profile ───────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["profile-me"],
    queryFn: () => profileApi.getMe().then((r) => r.data.participant),
    staleTime: 30_000,
    initialData: authParticipant ?? undefined,
  });
  const p = data ?? authParticipant;

  // ── Local editable state (synced from p) ──────────────────────────────────
  const [bio, setBio]         = useState(p?.bio ?? "");
  const [bioEn, setBioEn]     = useState((p as any)?.bioEn ?? "");
  const [jobTitle, setJobTitle]       = useState(p?.jobTitle ?? "");
  const [company, setCompany]         = useState(p?.company ?? "");
  const [country, setCountry]         = useState(p?.country ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState((p as any)?.linkedinUrl ?? "");
  const [websiteUrl, setWebsiteUrl]   = useState((p as any)?.websiteUrl ?? "");
  const [meetingMsg, setMeetingMsg]   = useState((p as any)?.meetingMessage ?? "");
  const [language, setLanguage]       = useState((p as any)?.language ?? "FR");
  const [isPublic, setIsPublic]       = useState((p as any)?.isProfilePublic ?? true);
  const [pushNotif, setPushNotif]     = useState(true);
  const [emailNotif, setEmailNotif]   = useState(true);
  const [smsNotif, setSmsNotif]       = useState(false);
  const [saving, setSaving]           = useState(false);

  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    try { return JSON.parse(p?.tags ?? "[]"); }
    catch { return (p?.tags ?? "").split(",").map((t: string) => t.trim()).filter(Boolean); }
  });

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  // ── Completeness ──────────────────────────────────────────────────────────
  const { pct, missing } = calcCompleteness(p);

  // ── Upload photo ──────────────────────────────────────────────────────────
  const uploadPhoto = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Image uniquement"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5 Mo"); return; }
    setPhotoUploading(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const { data: res } = await profileApi.uploadPhoto(form);
      updateParticipant(res.participant);
      qc.invalidateQueries({ queryKey: ["profile-me"] });
      toast.success("Photo mise à jour !");
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? (err.response?.data?.message ?? "Erreur upload") : "Erreur upload");
    } finally { setPhotoUploading(false); }
  }, [updateParticipant, qc]);

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: res } = await profileApi.updateProfile({
        bio: bio.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        company: company.trim() || undefined,
        country: country.trim() || undefined,
        tags: selectedTags.length ? JSON.stringify(selectedTags) : undefined,
      });
      updateParticipant(res.participant);
      qc.invalidateQueries({ queryKey: ["profile-me"] });
      toast.success("Profil enregistré !");
    } catch (err: unknown) {
      toast.error(axios.isAxiosError(err) ? (err.response?.data?.message ?? "Erreur") : "Erreur");
    } finally { setSaving(false); }
  };

  if (isLoading && !p) return <ProfileSkeleton />;

  const tags: string[] = parseTags(p?.tags);

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "3.5rem 1.25rem 7rem", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary, #f1f5f9)" }}>
          Mon Profil
        </h1>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 18px", borderRadius: 10, border: "none",
            background: saving ? "rgba(124,58,237,0.4)" : "var(--brand-500, #7c3aed)",
            color: "white", fontWeight: 700, fontSize: "0.8125rem",
            cursor: saving ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {saving ? <><Spinner />&nbsp;Enregistrement…</> : "💾 Enregistrer"}
        </motion.button>
      </motion.div>

      {/* ── Hero: avatar + name + completeness ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 12 }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20, overflow: "hidden",
              background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}>
              {p?.photoUrl ? (
                <Image src={p.photoUrl} alt="" fill sizes="80px" style={{ objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: "1.75rem", fontWeight: 700, color: "white" }}>
                  {getInitials(p?.firstName, p?.lastName)}
                </span>
              )}
              {photoUploading && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Spinner />
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              style={{
                position: "absolute", bottom: -6, right: -6,
                width: 26, height: 26, borderRadius: 13,
                background: "#7c3aed", border: "2px solid var(--bg-surface, #0f0f1a)",
                color: "white", fontSize: "0.7rem", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >📷</button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
          </div>

          {/* Name + type */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
            <p style={{ margin: "0 0 2px", fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary, #f1f5f9)" }}>
              {getFullName(p?.firstName, p?.lastName)}
            </p>
            <p style={{ margin: "0 0 2px", fontSize: "0.8125rem", color: "var(--text-secondary, #cbd5e1)" }}>
              {p?.email}
            </p>
            {(p as any)?.profileType && (
              <span style={{
                display: "inline-block", marginTop: 4,
                padding: "2px 8px", borderRadius: 6, fontSize: "0.62rem", fontWeight: 700,
                background: "rgba(124,58,237,0.15)", border: "1px solid rgba(139,92,246,0.25)",
                color: "#a78bfa",
              }}>{(p as any).profileType}</span>
            )}
          </div>
        </div>

        {/* Completeness bar */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary, #cbd5e1)" }}>
              Profil complété à {pct}%
            </span>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: pct >= 80 ? "#34d399" : "#fbbf24" }}>
              {pct >= 100 ? "✓ Complet" : `${7 - Math.round(pct / 100 * 7)} manquant${7 - Math.round(pct / 100 * 7) > 1 ? "s" : ""}`}
            </span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 4, height: 6, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ height: "100%", borderRadius: 4, background: pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171" }}
            />
          </div>
          {missing.length > 0 && (
            <p style={{ margin: "6px 0 0", fontSize: "0.68rem", color: "var(--text-ghost, #475569)" }}>
              À compléter : {missing.join(", ")}
            </p>
          )}
        </div>
      </motion.div>

      {/* ── Identité ── */}
      <SectionCard title="Identité">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Prénom">
            <input value={p?.firstName ?? ""} readOnly style={readOnlyStyle} />
          </Field>
          <Field label="Nom">
            <input value={p?.lastName ?? ""} readOnly style={readOnlyStyle} />
          </Field>
        </div>
        <Field label="Email">
          <input value={p?.email ?? ""} readOnly style={readOnlyStyle} />
        </Field>
        <Field label="Poste">
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="ex. Head of Innovation" style={inputStyle} />
        </Field>
        <Field label="Entreprise">
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="ex. Nawat Group" style={inputStyle} />
        </Field>
        <Field label="Pays">
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="ex. TN" style={inputStyle} />
        </Field>
      </SectionCard>

      {/* ── Bio ── */}
      <SectionCard title="Présentation">
        <Field label="Bio (français)">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={500} placeholder="Décrivez votre activité…" style={{ ...inputStyle, resize: "vertical" } as React.CSSProperties} />
        </Field>
        <Field label="Bio (anglais)" hint="Optionnel — améliore votre visibilité internationale">
          <textarea value={bioEn} onChange={(e) => setBioEn(e.target.value)} rows={3} maxLength={500} placeholder="Describe your activity…" style={{ ...inputStyle, resize: "vertical" } as React.CSSProperties} />
        </Field>
      </SectionCard>

      {/* ── Tags ── */}
      <SectionCard title="Centres d'intérêt / Tags">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {TAGS_SUGGESTIONS.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button key={tag} onClick={() => toggleTag(tag)} style={{
                padding: "5px 12px", borderRadius: 99, fontSize: "0.75rem",
                border: `1px solid ${active ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.09)"}`,
                background: active ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                color: active ? "#c4b5fd" : "var(--text-secondary, #cbd5e1)",
                fontWeight: active ? 600 : 400, cursor: "pointer",
              }}>
                {active && "✓ "}{tag}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* ── Liens sociaux ── */}
      <SectionCard title="Liens sociaux">
        <Field label="LinkedIn URL" hint="Renseignez pour connecter manuellement — ou utilisez le bouton LinkedIn ci-dessous">
          <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" style={inputStyle} />
        </Field>
        <Field label="Site web">
          <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://…" style={inputStyle} />
        </Field>
      </SectionCard>

      {/* ── LinkedIn Connect ── */}
      <SectionCard title="LinkedIn">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary, #f1f5f9)" }}>
              {(p as any)?.linkedinConnected ? "✅ Compte connecté" : "Connecter LinkedIn"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)" }}>
              Enrichit votre profil et booste votre score de visibilité
            </p>
          </div>
          <Link href="/profile/linkedin" style={{
            padding: "8px 16px", borderRadius: 10, fontWeight: 700, fontSize: "0.8rem",
            textDecoration: "none",
            background: (p as any)?.linkedinConnected ? "rgba(239,68,68,0.10)" : "#0A66C2",
            color: (p as any)?.linkedinConnected ? "#f87171" : "white",
            border: (p as any)?.linkedinConnected ? "1px solid rgba(239,68,68,0.25)" : "none",
            flexShrink: 0,
          }}>
            {(p as any)?.linkedinConnected ? "Déconnecter" : "Connecter"}
          </Link>
        </div>
      </SectionCard>

      {/* ── Meeting request message ── */}
      <SectionCard title="Message de demande de réunion">
        <Field label="Message par défaut" hint="Utilisé automatiquement dans les cartes in-chat lors de vos demandes de réunion. Laissez vide pour générer avec l'IA.">
          <textarea value={meetingMsg} onChange={(e) => setMeetingMsg(e.target.value)} rows={3} maxLength={300} placeholder="Bonjour, j'aimerais échanger avec vous sur nos projets respectifs." style={{ ...inputStyle, resize: "vertical" } as React.CSSProperties} />
          <div style={{ textAlign: "right", marginTop: 2 }}>
            <span style={{ fontSize: "0.65rem", color: meetingMsg.length > 260 ? "#f87171" : "var(--text-ghost, #475569)" }}>
              {meetingMsg.length}/300
            </span>
          </div>
        </Field>
      </SectionCard>

      {/* ── Notifications ── */}
      <SectionCard title="Notifications">
        <ToggleRow icon="📲" label="Notifications push" checked={pushNotif} onChange={setPushNotif} />
        <ToggleRow icon="📧" label="Email" checked={emailNotif} onChange={setEmailNotif} />
        <ToggleRow icon="💬" label="SMS" checked={smsNotif} onChange={setSmsNotif} />
      </SectionCard>

      {/* ── Confidentialité ── */}
      <SectionCard title="Confidentialité">
        <ToggleRow icon="👁️" label="Profil visible dans Découverte" checked={isPublic} onChange={setIsPublic} />
        <p style={{ margin: "4px 0 0", fontSize: "0.68rem", color: "var(--text-ghost, #475569)", lineHeight: 1.4 }}>
          Si désactivé, votre profil n'apparaît pas dans le mode Explorer ni dans les lots de swipe des autres participants.
        </p>
      </SectionCard>

      {/* ── Langue ── */}
      <SectionCard title="Langue de l'interface">
        <div style={{ display: "flex", gap: 8 }}>
          {(["FR", "EN"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              style={{
                flex: 1, padding: "10px", borderRadius: 10, fontSize: "0.875rem", fontWeight: 600,
                border: language === lang ? "2px solid rgba(139,92,246,0.6)" : "1px solid rgba(255,255,255,0.08)",
                background: language === lang ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                color: language === lang ? "#c4b5fd" : "var(--text-secondary, #cbd5e1)",
                cursor: "pointer",
              }}
            >
              {lang === "FR" ? "🇫🇷 Français" : "🇬🇧 English"}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── Save CTA (bottom) ── */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        disabled={saving}
        style={{
          width: "100%", height: 50, borderRadius: 14, border: "none",
          background: saving ? "rgba(124,58,237,0.4)" : "var(--brand-500, #7c3aed)",
          color: "white", fontWeight: 700, fontSize: "1rem",
          cursor: saving ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {saving ? <><Spinner />Enregistrement…</> : "Enregistrer les modifications"}
      </motion.button>

    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <div style={{ padding: "3.5rem 1.25rem", maxWidth: 520, margin: "0 auto" }}>
      {[80, 60, 120, 100, 80].map((w, i) => (
        <div key={i} style={{ height: i === 0 ? 80 : 16, width: i === 0 ? 80 : `${w}%`, borderRadius: i === 0 ? 20 : 6, background: "rgba(255,255,255,0.06)", marginBottom: i === 0 ? 16 : 10, animation: "shimmer 1.5s ease infinite" }} />
      ))}
      <style>{`@keyframes shimmer { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 14, height: 14, borderRadius: 7,
      border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white",
      animation: "spin 0.7s linear infinite",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}