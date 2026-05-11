"use client";
// src/components/discovery/ViewAllMode.tsx
import { useState } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { discoveryApi } from "@/lib/api";
import { PublicProfile } from "@/types";
import { cn, getInitials, parseTags, profileTypeColors } from "@/lib/utils";
import toast from "react-hot-toast";
import Image from "next/image";
import Link from "next/link";

type LocalConnectionStatus = "CONNECTED" | "REQUEST_SENT" | "NOT_CONNECTED";
interface PublicProfileWithStatus extends PublicProfile {
  connectionStatus?: LocalConnectionStatus;
}

export default function ViewAllMode() {
  const [search, setSearch] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [activeAi, setActiveAi] = useState("");
  const [sector, setSector] = useState("");
  const [country, setCountry] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filters = {
    ...(search ? { search } : {}),
    ...(activeAi ? { aiPrompt: activeAi } : {}),
    ...(sector ? { sector } : {}),
    ...(country ? { country } : {}),
    limit: 20,
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["view-all", filters],
    queryFn: ({ pageParam = 1 }) =>
      discoveryApi.viewAll({ ...filters, page: pageParam as number }).then((r) => r.data),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });

  const profiles: PublicProfileWithStatus[] = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.pagination.total ?? 0;

  const connectMutation = useMutation({
    mutationFn: (id: string) => discoveryApi.sendConnectionRequest(id),
    onSuccess: () => toast.success("Demande envoyée !"),
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  return (
    <div className="px-4 pb-4">
      {/* ── Search ── */}
      <div className="relative mb-3">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-muted)", fontSize: "1rem" }}>🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom, entreprise, secteur…"
          className="input-glass"
          style={{ paddingLeft: "2.5rem" }}
        />
      </div>

      {/* ── AI prompt ── */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🤖</span>
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setActiveAi(aiPrompt)}
            placeholder='Recherche IA : "investisseurs en FinTech"'
            className="input-glass"
            style={{ paddingLeft: "2.25rem", fontSize: "0.875rem" }}
          />
        </div>
        {aiPrompt && (
          <button onClick={() => setActiveAi(aiPrompt)} className="btn-primary"
            style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem" }}>
            OK
          </button>
        )}
        {activeAi && (
          <button onClick={() => { setAiPrompt(""); setActiveAi(""); }} className="btn-secondary"
            style={{ padding: "0.5rem 0.875rem", color: "#f87171" }}>
            ✕
          </button>
        )}
      </div>

      {/* ── Filter row ── */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            fontSize: "0.8125rem", fontWeight: 500, background: "none", border: "none", cursor: "pointer",
            color: showFilters ? "#a78bfa" : "var(--text-muted)",
            transition: "color 0.15s ease",
          }}
        >
          <span>⚙</span>
          Filtres
          {(sector || country) && (
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#a78bfa", display: "inline-block" }} />
          )}
        </button>
        <span style={{ fontSize: "0.75rem", color: "var(--text-ghost)" }}>
          {total} profils
        </span>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-xl p-3 mb-4 space-y-2">
              <input value={sector} onChange={(e) => setSector(e.target.value)}
                placeholder="Secteur…" className="input-glass" style={{ fontSize: "0.875rem", padding: "0.6rem 0.875rem" }} />
              <input value={country} onChange={(e) => setCountry(e.target.value)}
                placeholder="Pays…" className="input-glass" style={{ fontSize: "0.875rem", padding: "0.6rem 0.875rem" }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeAi && (
        <div className="glass rounded-xl px-3.5 py-2 mb-4 flex items-center gap-2">
          <span style={{ color: "#a78bfa", fontSize: "0.875rem" }}>🤖</span>
          <span style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }} className="truncate">
            "{activeAi}"
          </span>
        </div>
      )}

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="skeleton rounded-2xl" style={{ height: "240px" }} />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🔍</div>
          <p style={{ fontWeight: 500 }}>Aucun profil trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {profiles.map((p, i) => (
            <ProfileCard key={p.id} profile={p} index={i}
              onConnect={() => connectMutation.mutate(p.id)}
              connecting={connectMutation.isPending} />
          ))}
        </div>
      )}

      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="btn-secondary w-full mt-4">
          {isFetchingNextPage ? "Chargement…" : "Voir plus"}
        </button>
      )}
    </div>
  );
}

function ProfileCard({ profile, index, onConnect, connecting }: {
  profile: PublicProfileWithStatus;
  index: number;
  onConnect: () => void;
  connecting: boolean;
}) {
  const tags = parseTags(profile.tags);
  const isConnected = profile.connectionStatus === "CONNECTED";
  const isPending   = profile.connectionStatus === "REQUEST_SENT";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index % 6) * 0.05 }}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "20px",
        overflow: "hidden",
        backdropFilter: "blur(14px)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      <Link href={`/discovery/profile/${profile.id}`}>
        {/* Photo */}
        <div className="relative overflow-hidden" style={{ height: "140px", background: "linear-gradient(135deg, #3b0764 0%, #6d28d9 100%)" }}>
          {profile.photoUrl ? (
            <Image src={profile.photoUrl} alt={profile.firstName} fill className="object-cover"
              style={{ transition: "transform 0.3s ease" }} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span style={{ fontFamily: "var(--font-display)", fontSize: "3rem", color: "rgba(255,255,255,0.18)", fontWeight: 800 }}>
                {getInitials(profile.firstName, profile.lastName)}
              </span>
            </div>
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)" }} />

          {profile.profileType && (
            <span style={{
              position: "absolute", top: "8px", right: "8px",
              fontSize: "0.6rem", padding: "2px 7px", borderRadius: "5px",
              background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.8)", fontWeight: 700, letterSpacing: "0.04em",
              backdropFilter: "blur(8px)", textTransform: "uppercase",
            }}>
              {profile.profileType === "INSTITUTIONNEL" ? "INST." : profile.profileType}
            </span>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: "10px 12px 8px" }}>
          <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "white" }} className="truncate">
            {profile.firstName} {profile.lastName}
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "2px" }} className="truncate">
            {profile.jobTitle}
          </p>
          {profile.company && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.7rem" }} className="truncate">
              {profile.company}
            </p>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.slice(0, 2).map((t) => (
                <span key={t} style={{
                  fontSize: "0.6rem", padding: "2px 8px", borderRadius: "99px",
                  background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)",
                  color: "#c4b5fd", fontWeight: 500,
                }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* Connect button */}
      <div style={{ padding: "0 10px 10px" }}>
        {isConnected ? (
          <span style={{
            display: "block", textAlign: "center", fontSize: "0.7rem", fontWeight: 600,
            padding: "7px", borderRadius: "10px",
            background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)",
            color: "#34d399",
          }}>
            ✓ Connecté
          </span>
        ) : isPending ? (
          <span style={{
            display: "block", textAlign: "center", fontSize: "0.7rem", fontWeight: 500,
            padding: "7px", borderRadius: "10px",
            background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)",
            color: "#fbbf24",
          }}>
            En attente…
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onConnect(); }}
            disabled={connecting}
            style={{
              width: "100%", fontSize: "0.7rem", fontWeight: 600, padding: "7px", borderRadius: "10px",
              background: "rgba(124,58,237,0.12)", border: "1px solid rgba(139,92,246,0.25)",
              color: "#a78bfa", cursor: "pointer", transition: "all 0.15s ease",
              letterSpacing: "0.02em",
            }}
          >
            + Connecter
          </button>
        )}
      </div>
    </motion.div>
  );
}