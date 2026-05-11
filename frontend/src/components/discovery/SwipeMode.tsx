"use client";
// src/components/discovery/SwipeMode.tsx
import React, { useState } from "react";
import { motion, useMotionValue, useTransform, useAnimation, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { discoveryApi } from "@/lib/api";
import { PublicProfile, SwipeBatchResponse } from "@/types";
import { getInitials, parseTags, resolvePhotoUrl } from "@/lib/utils";
import toast from "react-hot-toast";

export default function SwipeMode() {
  const qc = useQueryClient();
  const [swipedIds, setSwipedIds] = useState<string[]>([]);
  const [matchPopup, setMatchPopup] = useState<{ name: string } | null>(null);

  const { data, isLoading } = useQuery<SwipeBatchResponse>({
    queryKey: ["swipe-batch"],
    queryFn: () => discoveryApi.getCurrentBatch().then((r) => r.data),
  });

  const profiles = data?.profiles ?? [];
  const remaining = profiles.filter((p) => !swipedIds.includes(p.id));
  const visibleCards = remaining.slice(0, 3);

  const swipe = async (profile: PublicProfile, action: "RIGHT" | "LEFT") => {
    if (!data?.batchId) return;
    setSwipedIds((s) => [...s, profile.id]);
    try {
      const { data: result } = await discoveryApi.recordSwipe({
        targetParticipantId: profile.id, action, batchId: data.batchId,
      });
      if (result.match?.isMatch) {
        setMatchPopup({ name: `${profile.firstName} ${profile.lastName}` });
        setTimeout(() => setMatchPopup(null), 3500);
      }
    } catch {
      setSwipedIds((s) => s.filter((id) => id !== profile.id));
      toast.error("Erreur lors du swipe");
    }
  };

  if (isLoading) return <SwipeSkeleton />;

  if (!remaining.length || data?.isComplete) {
    return (
      <div className="flex flex-col items-center justify-center px-8 text-center" style={{ height: "65vh" }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mb-6"
          style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}>
          🎯
        </motion.div>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }} className="mb-2">
          Batch terminé !
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.6 }}>
          Vous avez vu tous vos profils.<br />Le prochain batch sera prêt bientôt.
        </p>
        <button onClick={() => qc.invalidateQueries({ queryKey: ["swipe-batch"] })} className="btn-secondary mt-6">
          Rafraîchir
        </button>
      </div>
    );
  }

  const progressPct = ((data?.totalCount ?? 10) - remaining.length) / (data?.totalCount ?? 10) * 100;

  return (
    <div className="relative px-4 pb-8">
      {/* Progress bar */}
      <div className="px-1 mb-5">
        <div className="flex justify-between mb-2">
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{data?.swiped ?? 0} vus</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{remaining.length} restants</span>
        </div>
        <div className="match-bar">
          <motion.div className="match-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Card stack — centered, max-width for desktop */}
      <div className="relative mx-auto max-w-sm lg:max-w-md" style={{ height: "530px" }}>
        {[...visibleCards].reverse().map((profile, reversedIdx) => {
          const stackIdx = visibleCards.length - 1 - reversedIdx;
          const isTop = stackIdx === 0;
          return isTop ? (
            <SwipeCard key={profile.id} profile={profile} onSwipe={swipe} />
          ) : (
            <div key={profile.id} className="absolute inset-0 rounded-3xl overflow-hidden"
              style={{
                transform: `translateY(${stackIdx * 10}px) scale(${1 - stackIdx * 0.04})`,
                zIndex: visibleCards.length - stackIdx,
                opacity: 1 - stackIdx * 0.15,
              }}>
              <ProfileCardContent profile={profile} isTop={false} />
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      {remaining[0] && (
        <div className="flex justify-center items-center gap-5 mt-5">
          <ActionButton icon="✕" label="Passer" color="red" onClick={() => swipe(remaining[0], "LEFT")} />
          <div className="text-center">
            <p style={{ fontSize: "0.65rem", color: "var(--text-ghost)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Ou glissez
            </p>
          </div>
          <ActionButton icon="♥" label="Connecter" color="brand" onClick={() => swipe(remaining[0], "RIGHT")} />
        </div>
      )}

      {/* Match popup */}
      <AnimatePresence>
        {matchPopup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)" }}
            onClick={() => setMatchPopup(null)}>
            <motion.div
              initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="glass-lg rounded-3xl p-10 text-center mx-4"
              style={{ maxWidth: "360px", boxShadow: "var(--shadow-lg)" }}
              onClick={(e) => e.stopPropagation()}>
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.6, delay: 0.2 }}
                style={{ fontSize: "4rem", lineHeight: 1, marginBottom: "1.25rem" }}>
                💜
              </motion.div>
              <h2 className="text-gradient" style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 800, marginBottom: "0.75rem" }}>
                C'est un Match !
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                Vous et <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{matchPopup.name}</span> êtes maintenant connectés
              </p>
              <button onClick={() => setMatchPopup(null)} className="btn-primary mt-6 w-full">
                Super ! 🎉
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwipeCard({ profile, onSwipe }: { profile: PublicProfile; onSwipe: (p: PublicProfile, a: "RIGHT" | "LEFT") => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-18, 0, 18]);
  const likeOpacity = useTransform(x, [30, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -30], [1, 0]);
  const controls = useAnimation();

  const handleDragEnd = async (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x > 100) {
      await controls.start({ x: 700, opacity: 0, transition: { duration: 0.32 } });
      onSwipe(profile, "RIGHT");
    } else if (info.offset.x < -100) {
      await controls.start({ x: -700, opacity: 0, transition: { duration: 0.32 } });
      onSwipe(profile, "LEFT");
    } else {
      controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 420, damping: 32 } });
    }
  };

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing swipe-card"
      style={{ x, rotate, zIndex: 10 }}
      drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.75}
      onDragEnd={handleDragEnd} animate={controls} whileDrag={{ scale: 1.02 }}>

      {/* Like label */}
      <motion.div style={{ opacity: likeOpacity, transform: "rotate(-12deg)", position: "absolute", top: "1.75rem", left: "1.75rem", zIndex: 20 }}>
        <span style={{ display: "block", background: "linear-gradient(135deg, #10b981, #34d399)", border: "2.5px solid #34d399", padding: "6px 14px", borderRadius: "10px", fontWeight: 800, fontSize: "1.1rem", color: "white", letterSpacing: "0.04em" }}>
          CONNECTER
        </span>
      </motion.div>

      {/* Pass label */}
      <motion.div style={{ opacity: passOpacity, transform: "rotate(12deg)", position: "absolute", top: "1.75rem", right: "1.75rem", zIndex: 20 }}>
        <span style={{ display: "block", background: "rgba(239,68,68,0.9)", border: "2.5px solid #f87171", padding: "6px 14px", borderRadius: "10px", fontWeight: 800, fontSize: "1.1rem", color: "white", letterSpacing: "0.04em" }}>
          PASSER
        </span>
      </motion.div>

      <ProfileCardContent profile={profile} isTop />
    </motion.div>
  );
}

function ProfileCardContent({ profile, isTop }: { profile: PublicProfile; isTop: boolean }) {
  const tags = parseTags(profile.tags);
  const photoSrc = resolvePhotoUrl(profile.photoUrl);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative"
      style={{ boxShadow: isTop ? "0 24px 64px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.3)" : "none" }}>
      {profile.photoUrl && !imgError ? (
        <img src={photoSrc} alt={`${profile.firstName} ${profile.lastName}`}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #a855f7 100%)" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "6rem", fontWeight: 800, color: "rgba(255,255,255,0.15)" }}>
            {getInitials(profile.firstName, profile.lastName)}
          </span>
        </div>
      )}
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 35%, rgba(0,0,0,0.6) 65%, rgba(0,0,0,0.92) 100%)" }} />

      <div className="absolute bottom-0 left-0 right-0 p-5">
        {profile.matchScore != null && isTop && (
          <div className="flex items-center gap-2.5 mb-3">
            <div className="match-bar" style={{ flex: 1, maxWidth: "6rem" }}>
              <div className="match-fill" style={{ width: `${Math.round(profile.matchScore * 100)}%` }} />
            </div>
            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
              {Math.round(profile.matchScore * 100)}% compatibilité
            </span>
          </div>
        )}

        <div className="flex items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.01em", color: "white" }} className="mb-0.5">
              {profile.firstName} {profile.lastName}
            </h3>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.875rem" }} className="truncate">
              {profile.jobTitle}{profile.company ? ` · ${profile.company}` : ""}
            </p>
            {profile.country && (
              <p style={{ color: "rgba(255,255,255,0.38)", fontSize: "0.75rem", marginTop: "2px" }}>
                📍 {profile.country}
              </p>
            )}
          </div>
          {profile.profileType && (
            <span style={{
              fontSize: "0.65rem", padding: "3px 8px", borderRadius: "6px",
              background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.4)",
              color: "#c4b5fd", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0,
            }}>
              {profile.profileType}
            </span>
          )}
        </div>

        {tags.length > 0 && isTop && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.slice(0, 3).map((t) => (
              <span key={t} style={{
                fontSize: "0.7rem", padding: "3px 10px", borderRadius: "99px",
                background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.75)", backdropFilter: "blur(8px)",
              }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {profile.aiExplanation && isTop && (
          <div className="mt-3 px-3.5 py-2.5 rounded-xl" style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(139,92,246,0.3)" }}>
            <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
              <span style={{ color: "#a78bfa", fontWeight: 600 }}>IA · </span>
              {profile.aiExplanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ icon, color, label, onClick }: { icon: string; color: string; label: string; onClick: () => void }) {
  const isRed = color === "red";
  return (
    <motion.button whileHover={{ scale: 1.1, y: -2 }} whileTap={{ scale: 0.9 }}
      onClick={onClick} aria-label={label}
      style={{
        width: "4rem", height: "4rem", borderRadius: "18px",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px",
        background: isRed ? "rgba(239,68,68,0.10)" : "rgba(124,58,237,0.12)",
        border: `1.5px solid ${isRed ? "rgba(239,68,68,0.30)" : "rgba(139,92,246,0.35)"}`,
        boxShadow: isRed ? "0 4px 16px rgba(239,68,68,0.12)" : "var(--shadow-brand)",
        cursor: "pointer", transition: "all 0.15s ease",
        color: isRed ? "#f87171" : "var(--brand-400)",
      }}>
      <span style={{ fontSize: "1.375rem", lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.7 }}>
        {label}
      </span>
    </motion.button>
  );
}

function SwipeSkeleton() {
  return (
    <div className="px-4 animate-pulse">
      <div className="skeleton h-[530px] rounded-3xl mx-auto max-w-sm mb-5" />
      <div className="flex justify-center gap-5">
        <div className="skeleton w-16 h-16 rounded-[18px]" />
        <div className="skeleton w-16 h-16 rounded-[18px]" />
      </div>
    </div>
  );
}