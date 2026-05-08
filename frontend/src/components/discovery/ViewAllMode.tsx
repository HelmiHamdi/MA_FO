"use client";
// src/components/discovery/ViewAllMode.tsx
import { useState, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { discoveryApi } from "@/lib/api";
import { PublicProfile } from "@/types";
import { cn, getInitials, parseTags, profileTypeColors } from "@/lib/utils";
import toast from "react-hot-toast";
import Image from "next/image";
import Link from "next/link";

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
    queryFn: ({ pageParam = 1 }) => discoveryApi.viewAll({ ...filters, page: pageParam as number }).then((r) => r.data),
    getNextPageParam: (last) => last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });

  const profiles = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.pagination.total ?? 0;

  const connectMutation = useMutation({
    mutationFn: (id: string) => discoveryApi.sendConnectionRequest(id),
    onSuccess: () => toast.success("Demande envoyée !"),
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  return (
    <div className="px-4 pb-4">
      {/* Search bar */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
          <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom, entreprise…"
          className="input-glass pl-9 pr-4"
        />
      </div>

      {/* AI prompt */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setActiveAi(aiPrompt)}
          placeholder="🤖 Recherche IA : ex. &quot;investisseurs en FinTech&quot;"
          className="input-glass flex-1 text-sm"
        />
        {aiPrompt && (
          <button onClick={() => { setActiveAi(aiPrompt); }} className="btn-primary px-3 py-2 text-sm">
            Chercher
          </button>
        )}
        {activeAi && (
          <button onClick={() => { setAiPrompt(""); setActiveAi(""); }} className="btn-secondary px-3 py-2 text-sm text-red-400">
            ✕
          </button>
        )}
      </div>

      {/* Filter toggle */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setShowFilters(!showFilters)} className={cn("flex items-center gap-1.5 text-xs transition-colors", showFilters ? "text-brand-400" : "text-white/40 hover:text-white/60")}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Filtres
          {(sector || country) && <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />}
        </button>
        <span className="text-xs text-white/30">{total} profils</span>
      </div>

      {showFilters && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="glass rounded-xl p-3 mb-4 space-y-2">
          <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Secteur…" className="input-glass text-sm py-2" />
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Pays…" className="input-glass text-sm py-2" />
        </motion.div>
      )}

      {activeAi && (
        <div className="glass rounded-xl px-3 py-2 mb-4 flex items-center gap-2">
          <span className="text-brand-400 text-xs">🤖</span>
          <span className="text-white/60 text-xs truncate">&quot;{activeAi}&quot;</span>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-56 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 text-white/40">
          <div className="text-4xl mb-3">🔍</div>
          <p>Aucun profil trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {profiles.map((p, i) => (
            <ProfileCard key={p.id} profile={p} index={i} onConnect={() => connectMutation.mutate(p.id)} connecting={connectMutation.isPending} />
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

function ProfileCard({ profile, index, onConnect, connecting }: { profile: PublicProfile; index: number; onConnect: () => void; connecting: boolean }) {
  const tags = parseTags(profile.tags);
  const isConnected = profile.connectionStatus === "ACCEPTED";
  const isPending = profile.connectionStatus === "REQUEST_SENT";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index % 6) * 0.05 }}
      className="glass rounded-2xl overflow-hidden group"
    >
      <Link href={`/discovery/profile/${profile.id}`}>
        {/* Photo */}
        <div className="relative h-36 bg-gradient-to-br from-brand-800 to-brand-900 overflow-hidden">
          {profile.photoUrl ? (
            <Image src={profile.photoUrl} alt={profile.firstName} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-4xl text-white/20">{getInitials(profile.firstName, profile.lastName)}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <span className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${profileTypeColors[profile.profileType]}`}>
            {profile.profileType === "INSTITUTIONNEL" ? "INST." : profile.profileType}
          </span>
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="text-white font-semibold text-sm truncate">{profile.firstName} {profile.lastName}</p>
          <p className="text-white/50 text-xs truncate mt-0.5">{profile.jobTitle}</p>
          {profile.company && <p className="text-white/35 text-xs truncate">{profile.company}</p>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.slice(0, 2).map((t) => (
                <span key={t} className="text-[10px] bg-white/8 text-white/50 px-1.5 py-0.5 rounded-md">{t}</span>
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* Connect button */}
      <div className="px-3 pb-3">
        {isConnected ? (
          <span className="block text-center text-xs text-emerald-400 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            ✓ Connecté
          </span>
        ) : isPending ? (
          <span className="block text-center text-xs text-amber-400 py-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
            En attente…
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onConnect(); }}
            disabled={connecting}
            className="w-full text-xs text-white/60 py-1.5 glass rounded-lg hover:bg-white/8 hover:text-white transition-all border border-white/8"
          >
            + Connecter
          </button>
        )}
      </div>
    </motion.div>
  );
}