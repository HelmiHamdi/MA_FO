"use client";
// src/components/discovery/SwipeMode.tsx
import React, { useState } from "react";
import { motion, useMotionValue, useTransform, useAnimation } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { discoveryApi } from "@/lib/api";
import { PublicProfile, SwipeBatchResponse } from "@/types";
import { getInitials, parseTags, profileTypeColors, resolvePhotoUrl } from "@/lib/utils";
import toast from "react-hot-toast";

// ✅ Plus de `import Image from "next/image"` — on utilise <img> directement

export default function SwipeMode() {
  const qc = useQueryClient();
  const [currentIdx, setCurrentIdx] = useState(0);
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
        targetParticipantId: profile.id,
        action,
        batchId: data.batchId,
      });
      if (result.match?.isMatch) {
        setMatchPopup({ name: `${profile.firstName} ${profile.lastName}` });
        setTimeout(() => setMatchPopup(null), 3000);
        toast.success(`Match avec ${profile.firstName} ! 🎉`, { duration: 4000 });
      }
    } catch {
      setSwipedIds((s) => s.filter((id) => id !== profile.id));
      toast.error("Erreur lors du swipe");
    }
  };

  if (isLoading) return <SwipeSkeleton />;

  if (!remaining.length || data?.isComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-[65vh] px-8 text-center">
        <div className="text-6xl mb-4">🎯</div>
        <h3 className="text-white font-semibold text-lg mb-2">Batch terminé !</h3>
        <p className="text-white/50 text-sm">
          Vous avez vu tous vos profils. Le prochain batch sera prêt bientôt.
        </p>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["swipe-batch"] })}
          className="btn-secondary mt-6"
        >
          Rafraîchir
        </button>
      </div>
    );
  }

  return (
    <div className="relative px-4 pb-8">
      {/* Progress */}
      <div className="px-1 mb-4">
        <div className="flex justify-between text-xs text-white/40 mb-1.5">
          <span>{data?.swiped ?? 0} swipés</span>
          <span>{remaining.length} restants</span>
        </div>
        <div className="match-bar">
          <div
            className="match-fill"
            style={{
              width: `${
                (((data?.totalCount ?? 10) - remaining.length) /
                  (data?.totalCount ?? 10)) *
                100
              }%`,
            }}
          />
        </div>
      </div>

      {/* Card stack */}
      <div className="relative h-[540px] mx-auto max-w-sm">
        {[...visibleCards].reverse().map((profile, reversedIdx) => {
          const stackIdx = visibleCards.length - 1 - reversedIdx;
          const isTop = stackIdx === 0;

          return isTop ? (
            <SwipeCard key={profile.id} profile={profile} onSwipe={swipe} stackOffset={0} />
          ) : (
            <div
              key={profile.id}
              className="absolute inset-0 rounded-3xl overflow-hidden"
              style={{
                transform: `translateY(${stackIdx * 8}px) scale(${1 - stackIdx * 0.04})`,
                zIndex: visibleCards.length - stackIdx,
              }}
            >
              <ProfileCardContent profile={profile} isTop={false} />
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      {remaining[0] && (
        <div className="flex justify-center gap-6 mt-4">
          <ActionButton
            icon="✕"
            color="red"
            label="Passer"
            onClick={() => swipe(remaining[0], "LEFT")}
          />
          <ActionButton
            icon="♡"
            color="brand"
            label="Connecter"
            onClick={() => swipe(remaining[0], "RIGHT")}
          />
        </div>
      )}

      {/* Match popup */}
      {matchPopup && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setMatchPopup(null)}
        >
          <div className="glass-strong rounded-3xl p-8 text-center max-w-sm mx-4">
            <div className="text-6xl mb-4 animate-bounce">💜</div>
            <h2 className="text-2xl font-bold text-gradient mb-2">est un Match !</h2>
            <p className="text-white/60">
              Vous et{" "}
              <span className="text-white font-medium">{matchPopup.name}</span>{" "}
              êtes maintenant connectés
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SwipeCard({
  profile,
  onSwipe,
  stackOffset,
}: {
  profile: PublicProfile;
  onSwipe: (p: PublicProfile, a: "RIGHT" | "LEFT") => void;
  stackOffset: number;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-20, 0, 20]);
  const likeOpacity = useTransform(x, [20, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, -20], [1, 0]);
  const controls = useAnimation();

  const handleDragEnd = async (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }
  ) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      await controls.start({ x: 600, opacity: 0, transition: { duration: 0.35 } });
      onSwipe(profile, "RIGHT");
    } else if (info.offset.x < -threshold) {
      await controls.start({ x: -600, opacity: 0, transition: { duration: 0.35 } });
      onSwipe(profile, "LEFT");
    } else {
      controls.start({
        x: 0,
        rotate: 0,
        transition: { type: "spring", stiffness: 400, damping: 30 },
      });
    }
  };

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, rotate, zIndex: 10 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      animate={controls}
      whileDrag={{ scale: 1.02 }}
    >
      <motion.div
        style={{ opacity: likeOpacity }}
        className="absolute top-8 left-8 z-20 bg-green-500/90 text-white font-bold text-xl px-4 py-2 rounded-xl rotate-[-12deg] border-2 border-green-400"
      >
        CONNECT
      </motion.div>
      <motion.div
        style={{ opacity: passOpacity }}
        className="absolute top-8 right-8 z-20 bg-red-500/90 text-white font-bold text-xl px-4 py-2 rounded-xl rotate-12 border-2 border-red-400"
      >
        PASSER
      </motion.div>

      <ProfileCardContent profile={profile} isTop />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ProfileCardContent({
  profile,
  isTop,
}: {
  profile: PublicProfile;
  isTop: boolean;
}) {
  const tags = parseTags(profile.tags);
  // ✅ Résoudre l'URL (Cloudinary, absolue, relative ou null)
  const photoSrc = resolvePhotoUrl(profile.photoUrl);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative shadow-card">
      {/* ✅ <img> natif — pas de next/image, pas de proxy /_next/image */}
      {profile.photoUrl && !imgError ? (
        <img
          src={photoSrc}
          alt={`${profile.firstName} ${profile.lastName}`}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center">
          <span className="text-white font-display text-8xl opacity-30">
            {getInitials(profile.firstName, profile.lastName)}
          </span>
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-900/40 via-transparent to-black/90 pointer-events-none" />

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        {profile.matchScore && isTop && (
          <div className="flex items-center gap-2 mb-3">
            <div className="match-bar flex-1 max-w-24">
              <div
                className="match-fill"
                style={{ width: `${Math.round(profile.matchScore * 100)}%` }}
              />
            </div>
            <span className="text-xs text-white/60">
              {Math.round(profile.matchScore * 100)}% compatibilité
            </span>
          </div>
        )}

        <div className="flex items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-xl leading-tight">
              {profile.firstName} {profile.lastName}
            </h3>
            <p className="text-white/70 text-sm mt-0.5 truncate">
              {profile.jobTitle}
              {profile.company ? ` · ${profile.company}` : ""}
            </p>
            {profile.country && (
              <p className="text-white/40 text-xs mt-0.5">📍 {profile.country}</p>
            )}
          </div>
          <span
            className={`text-xs px-2 py-1 rounded-lg border font-medium ${
              profileTypeColors[profile.profileType]
            }`}
          >
            {profile.profileType}
          </span>
        </div>

        {tags.length > 0 && isTop && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded-full border border-white/10"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {profile.aiExplanation && isTop && (
          <div className="mt-3 glass rounded-xl p-3">
            <p className="text-xs text-white/70 leading-relaxed">
              <span className="text-brand-300 font-medium">IA · </span>
              {profile.aiExplanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ActionButton({
  icon,
  color,
  label,
  onClick,
}: {
  icon: string;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-card transition-all ${
        color === "red"
          ? "bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 text-red-400"
          : "bg-brand-500/20 border border-brand-500/40 hover:bg-brand-500/30 text-brand-400"
      }`}
    >
      {icon}
    </motion.button>
  );
}

function SwipeSkeleton() {
  return (
    <div className="px-4 animate-pulse">
      <div className="h-[540px] bg-white/5 rounded-3xl mx-auto max-w-sm" />
      <div className="flex justify-center gap-6 mt-4">
        <div className="w-16 h-16 bg-white/5 rounded-2xl" />
        <div className="w-16 h-16 bg-white/5 rounded-2xl" />
      </div>
    </div>
  );
}