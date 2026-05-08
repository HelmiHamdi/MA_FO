"use client";
// src/app/(app)/profile/complete/page.tsx
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { profileApi } from "@/lib/api";
import toast from "react-hot-toast";
import axios from "axios";

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

  const [bio, setBio] = useState(participant?.bio ?? "");
  const [jobTitle, setJobTitle] = useState(participant?.jobTitle ?? "");
  const [company, setCompany] = useState(participant?.company ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    if (!participant?.tags) return [];
    try { return JSON.parse(participant.tags); }
    catch { return participant.tags.split(",").map((t) => t.trim()).filter(Boolean); }
  });

  // ✅ photoUrl vient de Cloudinary après upload
  const [photoUrl, setPhotoUrl] = useState(participant?.photoUrl ?? "");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  // ✅ Upload vers le backend → Cloudinary → retourne secure_url
  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo");
      return;
    }

    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const { data } = await profileApi.uploadPhoto(formData);
      // data.photoUrl est maintenant une URL Cloudinary (https://res.cloudinary.com/...)
      setPhotoUrl(data.photoUrl);
      updateParticipant(data.participant);
      toast.success("Photo mise à jour !");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? "Erreur upload photo")
        : "Erreur upload photo";
      toast.error(msg);
    } finally {
      setPhotoUploading(false);
    }
  }, [updateParticipant]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleSubmit = async () => {
    if (!bio.trim()) {
      toast.error("Ajoutez une courte bio");
      return;
    }
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
      router.replace("/discovery");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? "Erreur lors de la mise à jour")
        : "Erreur lors de la mise à jour";
      toast.error(msg);
    } finally {
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
  const completionPct = Math.round(
    (completionSteps.filter((s) => s.done).length / completionSteps.length) * 100
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-120px] left-[-80px] w-[420px] h-[420px] rounded-full bg-violet-600/20 blur-[100px]" />
        <div className="absolute bottom-[-80px] right-[-60px] w-[360px] h-[360px] rounded-full bg-brand-500/15 blur-[90px]" />
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative w-full max-w-xl"
      >
        {/* Header */}
        <motion.div variants={item} className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-400/70 mb-2">
            Étape 1 sur 1
          </p>
          <h1 className="text-3xl font-bold text-white leading-tight">
            Construisez votre profil
          </h1>
          <p className="mt-1.5 text-white/40 text-sm">
            Ces informations aident les autres participants à vous trouver
          </p>
        </motion.div>

        {/* Completion bar */}
        <motion.div variants={item} className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40">Complétion du profil</span>
            <span className="text-xs font-semibold text-brand-400">{completionPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500"
              initial={{ width: 0 }}
              animate={{ width: `${completionPct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <div className="flex gap-3 mt-3">
            {completionSteps.map((s) => (
              <div key={s.label} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full transition-colors ${s.done ? "bg-brand-400" : "bg-white/15"}`} />
                <span className={`text-[10px] transition-colors ${s.done ? "text-white/60" : "text-white/25"}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Main card */}
        <motion.div
          variants={item}
          className="glass-strong rounded-3xl p-7 space-y-6 border border-white/8 shadow-2xl shadow-black/30"
        >
          {/* Photo upload */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-widest text-white/40">
              Photo de profil
            </label>
            <div
              className={`relative flex items-center gap-5 p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none
                ${dragOver
                  ? "border-brand-400/70 bg-brand-500/10"
                  : photoUrl
                    ? "border-brand-400/30 bg-brand-500/5 hover:border-brand-400/50"
                    : "border-white/10 bg-white/3 hover:border-white/20"
                }`}
              onClick={() => !photoUploading && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden bg-white/6 border border-white/10 shadow-lg">
                <AnimatePresence mode="wait">
                  {photoUploading ? (
                    <motion.div
                      key="spinner"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/30"
                    >
                      <div className="w-6 h-6 border-2 border-white/30 border-t-brand-400 rounded-full animate-spin" />
                    </motion.div>
                  ) : photoUrl ? (
                    <motion.img
                      key="photo"
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      src={photoUrl}
                      alt="Photo de profil"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <motion.div
                      key="placeholder"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center text-3xl"
                    >
                      📷
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Green checkmark */}
                {photoUrl && !photoUploading && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#1a1028] flex items-center justify-center text-[10px]">
                    ✓
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80">
                  {photoUploading
                    ? "Upload en cours…"
                    : photoUrl
                      ? "Photo uploadée sur Cloudinary ✓"
                      : "Glissez une photo ou cliquez"}
                </p>
                <p className="text-xs text-white/30 mt-0.5">JPG, PNG, WebP · max 5 Mo</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-widest text-white/40">
              Bio <span className="text-brand-400 normal-case tracking-normal text-xs font-normal ml-1">*requis</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Décrivez votre activité en quelques mots…"
              rows={3}
              maxLength={300}
              className="input-glass resize-none text-sm leading-relaxed"
            />
            <div className="flex justify-end">
              <span className={`text-[11px] ${bio.length > 260 ? "text-amber-400" : "text-white/20"}`}>
                {bio.length}/300
              </span>
            </div>
          </div>

          {/* Job + Company row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-white/40">
                Poste
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="ex. Directeur Commercial"
                className="input-glass text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-white/40">
                Entreprise
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="ex. Acme Corp"
                className="input-glass text-sm"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-widest text-white/40">
              Secteurs d&apos;activité
              {selectedTags.length > 0 && (
                <span className="ml-2 normal-case tracking-normal font-normal text-brand-400/70">
                  {selectedTags.length} sélectionné{selectedTags.length > 1 ? "s" : ""}
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {TAGS_SUGGESTIONS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <motion.button
                    key={tag}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                      active
                        ? "bg-brand-500/25 border-brand-400/60 text-brand-300 shadow-sm shadow-brand-500/20"
                        : "bg-white/4 border-white/8 text-white/40 hover:border-white/20 hover:text-white/60"
                    }`}
                  >
                    {active && <span className="mr-1">✓</span>}
                    {tag}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div variants={item} className="mt-5 space-y-3">
          <motion.button
            onClick={handleSubmit}
            disabled={loading || !bio.trim()}
            whileTap={{ scale: 0.98 }}
            className="btn-primary w-full py-3.5 text-sm font-semibold rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden group"
          >
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

          <button
            onClick={() => router.replace("/discovery")}
            className="w-full text-center text-white/25 text-xs hover:text-white/45 transition-colors py-1"
          >
            Passer pour l&apos;instant
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}