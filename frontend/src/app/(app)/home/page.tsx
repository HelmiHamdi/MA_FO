"use client";
// src/app/(app)/home/page.tsx
// Module 2.1 — Home Page
// Snapshot journalier : prochain RDV + countdown, stats, quick actions, event info, batch alert

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { meetingsApi, notificationsApi, discoveryApi, connectionsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { getFullName, getInitials, formatTime } from "@/lib/utils";
import { AgendaResponse, NotificationsResponse } from "@/types";

// ─── Event config (CMS-driven in real app, static here) ──────────────────────
const EVENT = {
  name: "Africa Business Forum 2025",
  dates: "12–14 Juin 2025",
  venue: "Palais des Congrès, Tunis",
};

// ─── Live countdown hook ──────────────────────────────────────────────────────
function useLiveCountdown(targetISO: string | null) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!targetISO) return;
    const target = new Date(targetISO).getTime();
    const tick = () => setMs(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetISO]);
  return ms;
}

function formatCountdownParts(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { h: pad(h), m: pad(m), s: pad(s) };
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({
  firstName, lastName, photoUrl, size = 44,
}: {
  firstName?: string; lastName?: string; photoUrl?: string | null; size?: number;
}) {
  const initials = getInitials(firstName, lastName);
  const radius = Math.round(size * 0.3);
  if (photoUrl) {
    return (
      <div style={{ position: "relative", width: size, height: size, borderRadius: radius, overflow: "hidden", flexShrink: 0 }}>
        <Image src={photoUrl} alt="" fill sizes={`${size}px`} style={{ objectFit: "cover" }} />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontWeight: 700, fontSize: size * 0.33,
    }}>{initials}</div>
  );
}

// ─── Quick action button ──────────────────────────────────────────────────────
function QuickAction({
  href, emoji, label, badge,
}: {
  href: string; emoji: string; label: string; badge?: number;
}) {
  return (
    <Link href={href} style={{
      flex: 1, minWidth: 0,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      padding: "14px 6px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "18px",
      textDecoration: "none", position: "relative",
      transition: "background 0.18s",
    }}>
      <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{emoji}</span>
      <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-secondary, #cbd5e1)", textAlign: "center", lineHeight: 1.2 }}>
        {label}
      </span>
      {badge != null && badge > 0 && (
        <span style={{
          position: "absolute", top: 6, right: 6,
          minWidth: 16, height: 16, padding: "0 4px",
          borderRadius: 8, background: "#7c3aed",
          color: "white", fontSize: "0.55rem", fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{badge > 99 ? "99+" : badge}</span>
      )}
    </Link>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div style={{
      flex: 1, background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "14px", padding: "12px 10px",
      display: "flex", flexDirection: "column", gap: 3,
    }}>
      <span style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em", color: color ?? "var(--text-primary, #f1f5f9)", lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: "0.6rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-ghost, #475569)" }}>
        {label}
      </span>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 8px", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--brand-400, #a78bfa)" }}>
      {children}
    </p>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function HomePage() {
  const qc = useQueryClient();
  const { participant } = useAuthStore();

  // ── Agenda (next meeting) ─────────────────────────────────────────────────
  const { data: agendaData } = useQuery<AgendaResponse>({
    queryKey: ["agenda"],
    queryFn: () => meetingsApi.getMyAgenda().then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // ── Notifications unread count ────────────────────────────────────────────
  const { data: notifData } = useQuery({
    queryKey: ["unread-count"],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // ── Connections count ─────────────────────────────────────────────────────
  const { data: connectionsData } = useQuery({
    queryKey: ["connections-count"],
    queryFn: () => connectionsApi.getAll({ limit: 1 }).then((r) => r.data),
    staleTime: 60_000,
  });

  // ── Swipe batch status (check new batch) ──────────────────────────────────
  const { data: batchData } = useQuery({
    queryKey: ["swipe-batch"],
    queryFn: () => discoveryApi.getCurrentBatch().then((r) => r.data),
    staleTime: 60_000,
  });

  const nextMeeting = agendaData?.nextMeeting ?? null;
  const countdownMs = useLiveCountdown(nextMeeting?.slot?.startTime ?? null);
  const { h, m, s } = formatCountdownParts(countdownMs);

  const unreadCount = notifData?.unreadCount ?? 0;
  const connectionsCount = connectionsData?.pagination?.total ?? 0;
  const meetingsConfirmed = agendaData ? Object.values(agendaData.byDay).flat().filter((i) => i.status === "CONFIRMED").length : 0;
  const batchsRemaining = batchData?.isComplete === false ? 1 : 0;
  const hasNewBatch = batchData && !batchData.isComplete && batchData.remaining > 0;

  const op = nextMeeting?.otherParticipant;
  const isImminente = countdownMs > 0 && countdownMs < 30 * 60 * 1000;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "3.5rem 1.25rem 6rem", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Greeting ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)" }}>
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 style={{ margin: "2px 0 0", fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary, #f1f5f9)" }}>
            Bonjour, {participant?.firstName ?? "—"} 👋
          </h1>
        </div>
        <Link href="/notifications" style={{ position: "relative", textDecoration: "none" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.25rem",
          }}>🔔</div>
          {unreadCount > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -4,
              minWidth: 18, height: 18, padding: "0 5px",
              borderRadius: 9, background: "#ec4899",
              color: "white", fontSize: "0.6rem", fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(236,72,153,0.4)",
            }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
          )}
        </Link>
      </motion.div>

      {/* ── New batch alert ── */}
      <AnimatePresence>
        {hasNewBatch && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Link href="/discovery" style={{ textDecoration: "none", display: "block" }}>
              <div style={{
                background: "rgba(124,58,237,0.10)",
                border: "1px solid rgba(139,92,246,0.35)",
                borderRadius: 16,
                padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>🎯</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.875rem", color: "#c4b5fd" }}>
                    Nouveau lot de profils disponible
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)" }}>
                    {batchData.remaining} profil{batchData.remaining > 1 ? "s" : ""} vous attendent · Swipez maintenant
                  </p>
                </div>
                <span style={{ color: "#a78bfa", fontSize: "1.1rem", flexShrink: 0 }}>→</span>
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Next meeting ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <SectionLabel>Prochain rendez-vous</SectionLabel>
        {nextMeeting && op ? (
          <Link href={`/meetings`} style={{ textDecoration: "none", display: "block" }}>
            <div style={{
              borderRadius: 20,
              background: "rgba(255,255,255,0.035)",
              border: `1px solid ${isImminente ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.08)"}`,
              overflow: "hidden",
              position: "relative",
            }}>
              {/* Top gradient stripe */}
              <div style={{
                height: 2,
                background: isImminente
                  ? "linear-gradient(90deg, #ef4444, #f97316)"
                  : "linear-gradient(90deg, #7c3aed, #6366f1, #10b981)",
              }} />

              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                <Avatar firstName={op.firstName} lastName={op.lastName} photoUrl={op.photoUrl} size={52} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary, #f1f5f9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {getFullName(op.firstName, op.lastName)}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {(op as any).jobTitle ?? ""}{(op as any).company ? ` · ${(op as any).company}` : ""}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                    {nextMeeting.slot && (
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary, #cbd5e1)", fontFamily: "monospace" }}>
                        🕐 {formatTime(nextMeeting.slot.startTime)} — {formatTime(nextMeeting.slot.endTime)}
                      </span>
                    )}
                    {nextMeeting.table && (
                      <span style={{ fontSize: "0.72rem", color: "#a78bfa" }}>
                        📍 Table {nextMeeting.table.number} · {nextMeeting.table.room}
                      </span>
                    )}
                  </div>
                </div>

                {/* Countdown block */}
                <div style={{
                  flexShrink: 0, textAlign: "center",
                  padding: "8px 12px", borderRadius: 12,
                  background: isImminente ? "rgba(239,68,68,0.10)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isImminente ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)"}`,
                  minWidth: 72,
                }}>
                  <p style={{ margin: 0, fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: isImminente ? "#f87171" : "var(--text-ghost, #475569)" }}>
                    {isImminente ? "⚠ imminente" : "dans"}
                  </p>
                  <p style={{ margin: "3px 0 0", fontFamily: "monospace", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.02em", color: isImminente ? "#fca5a5" : "#c4b5fd", lineHeight: 1 }}>
                    {h}:{m}:{s}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <div style={{
            borderRadius: 20, border: "1px dashed rgba(255,255,255,0.08)",
            padding: "20px 16px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center",
          }}>
            <span style={{ fontSize: "2rem" }}>📅</span>
            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary, #cbd5e1)" }}>Aucun rendez-vous confirmé</p>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)" }}>Connectez-vous et demandez votre première réunion</p>
            <Link href="/connections" style={{
              marginTop: 4, padding: "6px 16px", borderRadius: 8,
              background: "rgba(124,58,237,0.12)", border: "1px solid rgba(139,92,246,0.25)",
              color: "#a78bfa", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none",
            }}>Mes connexions →</Link>
          </div>
        )}
      </motion.div>

      {/* ── Stats ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <SectionLabel>Mes statistiques</SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <StatCard value={connectionsCount} label="Connexions" color="#34d399" />
          <StatCard value={meetingsConfirmed} label="RDV confirmés" color="#a78bfa" />
          <StatCard value={batchsRemaining} label="Lots restants" color="#fbbf24" />
        </div>
      </motion.div>

      {/* ── Quick actions ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <SectionLabel>Accès rapide</SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <QuickAction href="/discovery" emoji="🎴" label="Discovery" badge={hasNewBatch ? batchData?.remaining : 0} />
          <QuickAction href="/meetings" emoji="📅" label="Mon agenda" />
          <QuickAction href="/connections" emoji="🤝" label="Connexions" badge={connectionsCount > 0 ? undefined : 0} />
          <QuickAction href="/chat" emoji="💬" label="Messages" badge={notifData?.unreadCount} />
        </div>
      </motion.div>

      {/* ── Program shortcut ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <Link href="/program" style={{ textDecoration: "none", display: "block" }}>
          <div style={{
            borderRadius: 16,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <span style={{ fontSize: "1.75rem", flexShrink: 0 }}>🗓️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary, #f1f5f9)" }}>Programme de l'événement</p>
              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)" }}>Sessions, speakers & salles</p>
            </div>
            <span style={{ color: "var(--text-ghost, #475569)", fontSize: "1.1rem" }}>→</span>
          </div>
        </Link>
      </motion.div>

      {/* ── Event info ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <SectionLabel>L'événement</SectionLabel>
        <div style={{
          borderRadius: 16,
          background: "rgba(99,102,241,0.06)",
          border: "1px solid rgba(99,102,241,0.18)",
          padding: "14px 16px",
          display: "flex", gap: 14, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: "1.5rem", flexShrink: 0, marginTop: 2 }}>🏛️</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary, #f1f5f9)" }}>
              {EVENT.name}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--text-muted, #94a3b8)" }}>
              📆 {EVENT.dates}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-muted, #94a3b8)" }}>
              📍 {EVENT.venue}
            </p>
          </div>
        </div>
      </motion.div>

    </div>
  );
}