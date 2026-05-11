"use client";
// src/app/(app)/profile/complete/page.tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { profileApi } from "@/lib/api";
import toast from "react-hot-toast";
import axios from "axios";
import { useTheme } from "@/context/ThemeContext";

const TAGS_SUGGESTIONS = [
  "FinTech", "StartUp", "Investissement", "Innovation",
  "RH", "Marketing", "Tech", "IA", "Immobilier",
  "Santé", "Éducation", "E-commerce", "Retail",
  "Industrie", "Logistique", "Export", "Tourisme", "Énergie",
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export default function ProfileCompletePage() {
  const router = useRouter();
  const { participant, updateParticipant } = useAuthStore();
  const { toggleTheme, isDark } = useTheme();

  useEffect(() => {
    const { photoUrl, bio, tags } = participant ?? {};
    if (!!photoUrl && !!bio && !!tags) markSeenAndRedirect();
  }, []);

  const [bio, setBio] = useState(participant?.bio ?? "");
  const [jobTitle, setJobTitle] = useState(participant?.jobTitle ?? "");
  const [company, setCompany] = useState(participant?.company ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    if (!participant?.tags) return [];
    try { return JSON.parse(participant.tags); }
    catch { return participant.tags.split(",").map((t) => t.trim()).filter(Boolean); }
  });

  const [photoUrl, setPhotoUrl] = useState(participant?.photoUrl ?? "");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const markSeenAndRedirect = async () => {
    try {
      const { data } = await profileApi.markPromptSeen();
      updateParticipant(data.participant);
    } catch { /* ignore */ } finally {
      router.replace("/discovery");
    }
  };

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Veuillez sélectionner une image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("L'image ne doit pas dépasser 5 Mo"); return; }
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const { data } = await profileApi.uploadPhoto(formData);
      setPhotoUrl(data.photoUrl);
      updateParticipant(data.participant);
      toast.success("Photo mise à jour !");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.message ?? "Erreur upload photo") : "Erreur upload photo";
      toast.error(msg);
    } finally { setPhotoUploading(false); }
  }, [updateParticipant]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleSubmit = async () => {
    if (!bio.trim()) { toast.error("Ajoutez une courte bio"); return; }
    setLoading(true);
    try {
      const { data } = await profileApi.updateProfile({
        bio: bio.trim(),
        jobTitle: jobTitle.trim() || undefined,
        company: company.trim() || undefined,
        tags: selectedTags.length ? JSON.stringify(selectedTags) : undefined,
        photoUrl: photoUrl || undefined,
      });
      updateParticipant(data.participant);
      toast.success("Profil complété !");
      await markSeenAndRedirect();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.message ?? "Erreur") : "Erreur";
      toast.error(msg);
      setLoading(false);
    }
  };

  const completionSteps = [
    { done: !!photoUrl, label: "Photo" },
    { done: !!bio.trim(), label: "Bio" },
    { done: !!jobTitle.trim(), label: "Poste" },
    { done: !!company.trim(), label: "Entreprise" },
    { done: selectedTags.length > 0, label: "Tags" },
  ];
  const completionPct = Math.round((completionSteps.filter((s) => s.done).length / completionSteps.length) * 100);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-120px] left-[-80px] w-[420px] h-[420px] rounded-full blur-[100px]"
          style={{ background: "var(--aurora-1)" }} />
        <div className="absolute bottom-[-80px] right-[-60px] w-[360px] h-[360px] rounded-full blur-[90px]"
          style={{ background: "var(--aurora-3)" }} />
      </div>

      {/* Theme toggle */}
      <button onClick={toggleTheme} className="theme-toggle absolute top-5 right-5" aria-label="Toggle theme">
        {isDark ? "☀️" : "🌙"}
      </button>

      <motion.div variants={stagger} initial="hidden" animate="show" className="relative w-full max-w-xl">
        {/* Header */}
        <motion.div variants={item} className="mb-6 text-center">
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--brand-400)", opacity: 0.75 }} className="mb-2">
            Étape 1 sur 1
          </p>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)", lineHeight: 1.2 }}>
            Construisez votre profil
          </h1>
          <p style={{ marginTop: "6px", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Ces informations aident les autres participants à vous trouver
          </p>
        </motion.div>

        {/* Completion bar */}
        <motion.div variants={item} className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Complétion du profil</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--brand-400)" }}>{completionPct}%</span>
          </div>
          <div className="match-bar" style={{ height: "6px" }}>
            <motion.div className="match-fill" initial={{ width: 0 }} animate={{ width: `${completionPct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }} />
          </div>
          <div className="flex gap-3 mt-3">
            {completionSteps.map((s) => (
              <div key={s.label} className="flex items-center gap-1">
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", transition: "background 0.3s", background: s.done ? "var(--brand-400)" : "var(--border-default)" }} />
                <span style={{ fontSize: "10px", transition: "color 0.3s", color: s.done ? "var(--text-secondary)" : "var(--text-ghost)" }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Main card */}
        <motion.div variants={item} className="glass-strong rounded-3xl p-7 space-y-6"
          style={{ border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-lg)" }}>

          {/* Photo upload */}
          <div className="space-y-3">
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Photo de profil
            </label>
            <div
              className="relative flex items-center gap-5 p-4 rounded-2xl cursor-pointer select-none transition-all"
              style={{
                border: `2px dashed ${dragOver ? "var(--brand-400)" : photoUrl ? "rgba(139,92,246,0.35)" : "var(--border-default)"}`,
                background: dragOver ? "rgba(124,58,237,0.06)" : photoUrl ? "rgba(124,58,237,0.03)" : "var(--glass-bg)",
              }}
              onClick={() => !photoUploading && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="relative flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden"
                style={{ background: "var(--glass-bg-md)", border: "1px solid var(--border-subtle)" }}>
                <AnimatePresence mode="wait">
                  {photoUploading ? (
                    <motion.div key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.15)" }}>
                      <div className="w-6 h-6 border-2 border-t-[var(--brand-400)] rounded-full animate-spin"
                        style={{ borderColor: "var(--border-subtle)", borderTopColor: "var(--brand-400)" }} />
                    </motion.div>
                  ) : photoUrl ? (
                    <motion.img key="photo" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      src={photoUrl} alt="Photo de profil" className="w-full h-full object-cover" />
                  ) : (
                    <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center text-3xl">
                      📷
                    </motion.div>
                  )}
                </AnimatePresence>
                {photoUrl && !photoUploading && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                    style={{ background: "#10b981", border: "2px solid var(--bg-surface)" }}>
                    ✓
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>
                  {photoUploading ? "Upload en cours…" : photoUrl ? "Photo uploadée ✓" : "Glissez une photo ou cliquez"}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-ghost)", marginTop: "2px" }}>JPG, PNG, WebP · max 5 Mo</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Bio <span style={{ color: "var(--brand-500)", fontSize: "0.75rem", fontWeight: 400, textTransform: "none", letterSpacing: "normal", marginLeft: "4px" }}>*requis</span>
            </label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)}
              placeholder="Décrivez votre activité en quelques mots…"
              rows={3} maxLength={300} className="input-glass resize-none text-sm leading-relaxed" />
            <div className="flex justify-end">
              <span style={{ fontSize: "11px", color: bio.length > 260 ? "#b45309" : "var(--text-ghost)" }}>
                {bio.length}/300
              </span>
            </div>
          </div>

          {/* Job + Company */}
          {(!participant?.jobTitle || !participant?.company) && (
            <div className="grid grid-cols-2 gap-4">
              {!participant?.jobTitle && (
                <div className="space-y-2">
                  <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    Poste
                  </label>
                  <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="ex. Directeur Commercial" className="input-glass text-sm" />
                </div>
              )}
              {!participant?.company && (
                <div className="space-y-2">
                  <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    Entreprise
                  </label>
                  <input type="text" value={company} onChange={(e) => setCompany(e.target.value)}
                    placeholder="ex. Acme Corp" className="input-glass text-sm" />
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div className="space-y-3">
            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Secteurs d&apos;activité
              {selectedTags.length > 0 && (
                <span style={{ marginLeft: "8px", fontSize: "0.75rem", fontWeight: 400, textTransform: "none", letterSpacing: "normal", color: "var(--brand-400)" }}>
                  {selectedTags.length} sélectionné{selectedTags.length > 1 ? "s" : ""}
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {TAGS_SUGGESTIONS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <motion.button key={tag} type="button" whileTap={{ scale: 0.94 }} onClick={() => toggleTag(tag)}
                    style={{
                      fontSize: "0.75rem", padding: "5px 12px", borderRadius: "99px",
                      border: `1px solid ${active ? "var(--brand-400)" : "var(--border-subtle)"}`,
                      background: active ? "rgba(124,58,237,0.12)" : "var(--glass-bg)",
                      color: active ? "var(--brand-500)" : "var(--text-secondary)",
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer", transition: "all 0.15s ease",
                    }}>
                    {active && <span style={{ marginRight: "4px" }}>✓</span>}
                    {tag}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div variants={item} className="mt-5 space-y-3">
          <motion.button onClick={handleSubmit} disabled={loading || !bio.trim()} whileTap={{ scale: 0.98 }}
            className="btn-primary w-full py-3.5 text-sm font-semibold rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden group">
            <span className="relative z-10 flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  Accéder à la plateforme
                  <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                </>
              )}
            </span>
          </motion.button>
          <button onClick={markSeenAndRedirect}
            style={{ width: "100%", textAlign: "center", color: "var(--text-ghost)", fontSize: "0.75rem", background: "none", border: "none", cursor: "pointer", padding: "4px 0", transition: "color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-ghost)")}>
            Passer pour l&apos;instant
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}