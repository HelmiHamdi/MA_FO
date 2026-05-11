"use client";
// src/app/(app)/meetings/page.tsx — REDESIGN PREMIUM

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { meetingsApi } from "@/lib/api";
import { AgendaItem, AgendaResponse } from "@/types";
import {
  formatCountdown,
  formatDate,
  formatTime,
  getInitials,
  getFullName,
} from "@/lib/utils";
import toast from "react-hot-toast";
import Image from "next/image";
import RateMeetingModal from "@/components/meetings/RateMeetingModal";
import TableQrModal from "@/components/meetings/TableQrModal";
import RescheduleMeetingModal from "@/components/meetings/RescheduleMeetingModal";
import { useTheme } from "@/context/ThemeContext";
import Link from "next/link";

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string; bg: string; text: string;
  dot: string; border: string; glow: string;
}> = {
  CONFIRMED: {
    label: "Confirmée", bg: "rgba(16,185,129,0.10)", text: "#34d399",
    dot: "#10b981", border: "rgba(16,185,129,0.25)", glow: "rgba(16,185,129,0.15)",
  },
  PENDING: {
    label: "En attente", bg: "rgba(251,191,36,0.10)", text: "#fbbf24",
    dot: "#f59e0b", border: "rgba(251,191,36,0.25)", glow: "rgba(251,191,36,0.12)",
  },
  COMPLETED: {
    label: "Terminée", bg: "rgba(148,163,184,0.10)", text: "#94a3b8",
    dot: "#64748b", border: "rgba(148,163,184,0.2)", glow: "rgba(148,163,184,0.08)",
  },
  CANCELLED: {
    label: "Annulée", bg: "rgba(239,68,68,0.08)", text: "#f87171",
    dot: "#ef4444", border: "rgba(239,68,68,0.2)", glow: "rgba(239,68,68,0.08)",
  },
  RESCHEDULED: {
    label: "Replanifiée", bg: "rgba(139,92,246,0.12)", text: "#a78bfa",
    dot: "#8b5cf6", border: "rgba(139,92,246,0.3)", glow: "rgba(139,92,246,0.15)",
  },
};

// ─── Live Countdown ───────────────────────────────────────────────────────────
function useLiveCountdown(initialMs: number) {
  const [ms, setMs] = useState(initialMs);
  useEffect(() => {
    if (ms <= 0) return;
    const id = setInterval(() => setMs((p) => Math.max(0, p - 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return ms;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function participantColor(name: string): string {
  const colors = [
    "#7c3aed", "#0ea5e9", "#ec4899", "#f97316",
    "#10b981", "#6366f1", "#14b8a6", "#8b5cf6",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function Avatar({
  firstName, lastName, photoUrl, size = 40,
}: {
  firstName?: string; lastName?: string; photoUrl?: string; size?: number;
}) {
  const name = getFullName(firstName, lastName) || "?";
  const color = participantColor(name);
  const initials = getInitials(firstName, lastName) || "?";
  const radius = Math.round(size * 0.28);

  if (photoUrl) {
    return (
      <div style={{
        position: "relative", width: size, height: size,
        borderRadius: radius, overflow: "hidden", flexShrink: 0,
      }}>
        <Image src={photoUrl} alt={name} fill sizes={`${size}px`} className="object-cover" />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: `linear-gradient(135deg, ${color}99, ${color})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontWeight: 700, fontSize: size * 0.325,
      letterSpacing: "0.02em",
    }}>{initials}</div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═════════════════════════════════════════════════════════════════════════════
export default function MeetingsPage() {
  const qc = useQueryClient();
  const { toggleTheme, isDark } = useTheme();
  const [ratingMeeting, setRatingMeeting] = useState<AgendaItem | null>(null);
  const [qrMeeting, setQrMeeting] = useState<AgendaItem | null>(null);
  const [rescheduleMeeting, setRescheduleMeeting] = useState<AgendaItem | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");

  const { data, isLoading } = useQuery<AgendaResponse>({
    queryKey: ["agenda"],
    queryFn: () => meetingsApi.getMyAgenda().then((r) => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => meetingsApi.cancelMeeting(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["connections"] });
      toast.success("Réunion annulée");
      setCancellingId(null);
    },
    onError: () => {
      toast.error("Erreur lors de l'annulation");
      setCancellingId(null);
    },
  });

  const handleCancel = (item: AgendaItem) => {
    const name = getFullName(item.otherParticipant?.firstName, item.otherParticipant?.lastName);
    const msg = item.status === "PENDING"
      ? `Retirer la demande avec ${name} ?`
      : `Annuler la réunion avec ${name} ?`;
    if (window.confirm(msg)) {
      setCancellingId(item.id);
      cancelMutation.mutate(item.id);
    }
  };

  const days = Object.keys(data?.byDay ?? {}).sort();

  // Stats rapides
  const allItems = days.flatMap((d) => data?.byDay[d] ?? []);
  const confirmedCount = allItems.filter((i) => i.status === "CONFIRMED").length;
  const pendingCount = allItems.filter((i) => i.status === "PENDING").length;
  const completedCount = allItems.filter((i) => i.status === "COMPLETED").length;

  const filters = [
    { key: "ALL", label: "Tout", count: allItems.length },
    { key: "CONFIRMED", label: "Confirmées", count: confirmedCount },
    { key: "PENDING", label: "En attente", count: pendingCount },
    { key: "COMPLETED", label: "Terminées", count: completedCount },
  ];

  if (isLoading) return <AgendaSkeleton />;

  return (
    <>
      <div className="agenda-root">

        {/* ── HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="agenda-header"
        >
          <div className="header-left">
            <p className="header-eyebrow">B2B Meeting Agenda</p>
            <h1 className="header-title">Mon Agenda</h1>
          </div>
          <div className="header-right">
            <button onClick={toggleTheme} className="icon-btn" aria-label="Thème">
              {isDark ? "☀️" : "🌙"}
            </button>
            <Link href="/connections?action=request-meeting" className="cta-btn">
              <span className="cta-plus">+</span>
              <span>Réunion</span>
            </Link>
          </div>
        </motion.div>

        {/* ── STATS ROW ── */}
        {allItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="stats-row"
          >
            <div className="stat-card stat-total">
              <span className="stat-num">{allItems.length}</span>
              <span className="stat-label">Total</span>
            </div>
            <div className="stat-card stat-confirmed">
              <span className="stat-num">{confirmedCount}</span>
              <span className="stat-label">Confirmées</span>
            </div>
            <div className="stat-card stat-pending">
              <span className="stat-num">{pendingCount}</span>
              <span className="stat-label">En attente</span>
            </div>
            <div className="stat-card stat-done">
              <span className="stat-num">{completedCount}</span>
              <span className="stat-label">Terminées</span>
            </div>
          </motion.div>
        )}

        {/* ── NEXT MEETING BANNER ── */}
        <AnimatePresence>
          {data?.nextMeeting && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ delay: 0.15, duration: 0.5 }}
            >
              <NextMeetingBanner meeting={data.nextMeeting} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── FILTER PILLS ── */}
        {allItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="filter-row"
          >
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`filter-pill ${activeFilter === f.key ? "active" : ""}`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className="filter-count">{f.count}</span>
                )}
              </button>
            ))}
          </motion.div>
        )}

        {/* ── EMPTY STATE ── */}
        {days.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="empty-state"
          >
            <div className="empty-graphic">
              <div className="empty-circle" />
              <span className="empty-emoji">📅</span>
            </div>
            <p className="empty-title">Aucune réunion planifiée</p>
            <p className="empty-sub">
              Connectez-vous avec des participants et demandez vos premières réunions
            </p>
            <Link href="/connections" className="empty-cta">
              Voir mes connexions →
            </Link>
          </motion.div>
        )}

        {/* ── TIMELINE ── */}
        {days.length > 0 && (
          <div className="timeline-wrapper">
            {days.map((day, dayIdx) => {
              const dayItems = (data?.byDay[day] ?? []).filter(
                (item) => activeFilter === "ALL" || item.status === activeFilter
              );
              if (dayItems.length === 0) return null;

              return (
                <motion.div
                  key={day}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + dayIdx * 0.06 }}
                  className="day-block"
                >
                  {/* Day header */}
                  <div className="day-header">
                    <div className="day-badge">
                      <span className="day-name">{formatDate(day)}</span>
                      <span className="day-count">{dayItems.length}</span>
                    </div>
                    <div className="day-rule" />
                  </div>

                  {/* Cards */}
                  <div className="cards-col">
                    {dayItems.map((item, idx) => (
                      <MeetingCard
                        key={item.id}
                        item={item}
                        index={idx}
                        isCancelling={cancellingId === item.id}
                        onCancel={() => handleCancel(item)}
                        onRate={() => setRatingMeeting(item)}
                        onScanQr={() => setQrMeeting(item)}
                        onReschedule={() => setRescheduleMeeting(item)}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      <AnimatePresence>
        {ratingMeeting && (
          <RateMeetingModal meeting={ratingMeeting} onClose={() => setRatingMeeting(null)} />
        )}
        {qrMeeting && (
          <TableQrModal meeting={qrMeeting} onClose={() => setQrMeeting(null)} />
        )}
        {rescheduleMeeting && (
          <RescheduleMeetingModal meeting={rescheduleMeeting} onClose={() => setRescheduleMeeting(null)} />
        )}
      </AnimatePresence>

      <style jsx global>{`
        /* ── ROOT ── */
        .agenda-root {
          padding: 3rem 1.25rem 6rem;
          max-width: 680px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        @media (min-width: 768px) {
          .agenda-root { padding: 2.5rem 2rem 5rem; }
        }

        /* ── HEADER ── */
        .agenda-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          gap: 1rem;
        }
        .header-eyebrow {
          font-size: 0.625rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--brand-400, #a78bfa);
          margin: 0 0 4px;
        }
        .header-title {
          font-size: clamp(1.625rem, 5vw, 2.25rem);
          font-weight: 800;
          letter-spacing: -0.04em;
          color: var(--text-primary, #f1f5f9);
          margin: 0;
          line-height: 1;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          padding-top: 2px;
        }
        .icon-btn {
          width: 38px; height: 38px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--text-muted, #94a3b8);
          font-size: 1rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s;
        }
        .icon-btn:hover { background: rgba(255,255,255,0.09); }
        .cta-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 9px 14px;
          background: var(--brand-500, #7c3aed);
          color: white;
          border-radius: 10px;
          font-size: 0.8125rem; font-weight: 700;
          text-decoration: none;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .cta-btn:hover { background: #6d28d9; transform: translateY(-1px); }
        .cta-plus { font-size: 1.1rem; font-weight: 400; line-height: 1; }

        /* ── STATS ── */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 1.25rem;
        }
        .stat-card {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.06);
          display: flex; flex-direction: column; gap: 3px;
          background: rgba(255,255,255,0.03);
        }
        .stat-total { border-color: rgba(255,255,255,0.08); }
        .stat-confirmed { border-color: rgba(16,185,129,0.2); background: rgba(16,185,129,0.05); }
        .stat-pending { border-color: rgba(251,191,36,0.2); background: rgba(251,191,36,0.05); }
        .stat-done { border-color: rgba(148,163,184,0.15); }
        .stat-num {
          font-size: 1.375rem; font-weight: 800;
          color: var(--text-primary, #f1f5f9);
          line-height: 1; letter-spacing: -0.03em;
        }
        .stat-confirmed .stat-num { color: #34d399; }
        .stat-pending .stat-num { color: #fbbf24; }
        .stat-label {
          font-size: 0.6rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: var(--text-ghost, #475569);
        }

        /* ── FILTERS ── */
        .filter-row {
          display: flex;
          gap: 6px;
          margin-bottom: 1.5rem;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .filter-row::-webkit-scrollbar { display: none; }
        .filter-pill {
          display: flex; align-items: center; gap: 5px;
          padding: 6px 12px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: var(--text-muted, #94a3b8);
          font-size: 0.78rem; font-weight: 600;
          cursor: pointer; white-space: nowrap;
          transition: all 0.18s;
          flex-shrink: 0;
        }
        .filter-pill:hover {
          background: rgba(255,255,255,0.07);
          color: var(--text-secondary, #cbd5e1);
        }
        .filter-pill.active {
          background: rgba(124,58,237,0.2);
          border-color: rgba(139,92,246,0.4);
          color: #c4b5fd;
        }
        .filter-count {
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 1px 5px;
          font-size: 0.65rem; font-weight: 700;
          color: inherit;
        }
        .filter-pill.active .filter-count {
          background: rgba(139,92,246,0.3);
        }

        /* ── TIMELINE ── */
        .timeline-wrapper {
          display: flex; flex-direction: column; gap: 2rem;
        }
        .day-block { display: flex; flex-direction: column; gap: 0.875rem; }
        .day-header {
          display: flex; align-items: center; gap: 10px;
        }
        .day-badge {
          display: flex; align-items: center; gap: 6px;
          flex-shrink: 0;
        }
        .day-name {
          font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--text-secondary, #cbd5e1);
        }
        .day-count {
          font-size: 0.6rem; font-weight: 700;
          padding: 1px 6px; border-radius: 8px;
          background: rgba(255,255,255,0.07);
          color: var(--text-ghost, #475569);
        }
        .day-rule {
          flex: 1; height: 1px;
          background: linear-gradient(90deg, rgba(255,255,255,0.08) 0%, transparent 100%);
        }
        .cards-col { display: flex; flex-direction: column; gap: 10px; }

        /* ── EMPTY ── */
        .empty-state {
          display: flex; flex-direction: column;
          align-items: center; text-align: center;
          padding: 4rem 1rem 2rem;
          gap: 0.5rem;
        }
        .empty-graphic {
          position: relative; width: 80px; height: 80px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1rem;
        }
        .empty-circle {
          position: absolute; inset: 0; border-radius: 50%;
          background: radial-gradient(circle, rgba(124,58,237,0.15), transparent 70%);
          border: 1px solid rgba(139,92,246,0.2);
        }
        .empty-emoji { font-size: 2.5rem; position: relative; }
        .empty-title {
          font-size: 1.0625rem; font-weight: 700;
          color: var(--text-secondary, #cbd5e1);
          margin: 0;
        }
        .empty-sub {
          font-size: 0.8125rem;
          color: var(--text-muted, #94a3b8);
          max-width: 260px; line-height: 1.6;
          margin: 0;
        }
        .empty-cta {
          margin-top: 1rem;
          padding: 10px 20px; border-radius: 10px;
          background: var(--brand-500, #7c3aed);
          color: white; font-size: 0.875rem; font-weight: 700;
          text-decoration: none; transition: background 0.2s;
        }
        .empty-cta:hover { background: #6d28d9; }
      `}</style>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// NEXT MEETING BANNER
// ═════════════════════════════════════════════════════════════════════════════
function NextMeetingBanner({
  meeting,
}: {
  meeting: AgendaItem & { countdownMs: number };
}) {
  const countdown = useLiveCountdown(meeting.countdownMs);
  const parts = formatCountdown(countdown).split(":");
  const isImminente = countdown < 30 * 60 * 1000;

  return (
    <div className="banner">
      {/* Top stripe */}
      <div className="banner-stripe" />

      <div className="banner-inner">
        {/* Left: label + info */}
        <div className="banner-left">
          <div className="banner-label">
            <span className={`pulse-dot ${isImminente ? "urgent" : ""}`} />
            <span>Prochaine réunion</span>
          </div>

          <div className="banner-participant">
            <Avatar
              firstName={meeting.otherParticipant?.firstName}
              lastName={meeting.otherParticipant?.lastName}
              photoUrl={meeting.otherParticipant?.photoUrl}
              size={48}
            />
            <div className="banner-info">
              <p className="banner-name">
                {getFullName(meeting.otherParticipant?.firstName, meeting.otherParticipant?.lastName)}
              </p>
              <p className="banner-company">{meeting.otherParticipant?.company}</p>
              <div className="banner-meta">
                {meeting.slot && (
                  <span className="meta-chip">
                    🕐 {formatTime(meeting.slot.startTime)} — {formatTime(meeting.slot.endTime)}
                  </span>
                )}
                {meeting.table && (
                  <span className="meta-chip accent">
                    📍 Table {meeting.table.number} · {meeting.table.room}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: countdown */}
        <div className="banner-right">
          <div className={`countdown-block ${isImminente ? "urgent" : ""}`}>
            <div className="countdown-digits">
              {parts.map((p, i) => (
                <div key={i} className="digit-group">
                  <span className="digit">{p}</span>
                  {i < parts.length - 1 && <span className="digit-sep">:</span>}
                </div>
              ))}
            </div>
            <span className="countdown-label">
              {isImminente ? "⚠ IMMINENTE" : "restant"}
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .banner {
          position: relative;
          border-radius: 20px;
          margin-bottom: 1.5rem;
          overflow: hidden;
          background: linear-gradient(
            135deg,
            rgba(109,40,217,0.16) 0%,
            rgba(79,70,229,0.10) 50%,
            rgba(16,185,129,0.06) 100%
          );
          border: 1px solid rgba(139,92,246,0.25);
        }
        .banner-stripe {
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #7c3aed, #6366f1, #10b981);
        }
        .banner-inner {
          padding: 1.125rem 1.25rem;
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 1rem;
        }
        .banner-left { flex: 1; min-width: 0; }
        .banner-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.6rem; font-weight: 700; letter-spacing: 0.16em;
          text-transform: uppercase; color: #a78bfa;
          margin-bottom: 12px;
        }
        .pulse-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #a78bfa;
          animation: pulse-anim 2s ease infinite;
        }
        .pulse-dot.urgent { background: #f87171; animation: pulse-anim 1s ease infinite; }
        @keyframes pulse-anim {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
        .banner-participant { display: flex; align-items: center; gap: 12px; }
        .banner-info { min-width: 0; }
        .banner-name {
          font-size: 0.9375rem; font-weight: 700;
          color: var(--text-primary, #f1f5f9);
          margin: 0 0 2px; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .banner-company {
          font-size: 0.75rem; color: #94a3b8; margin: 0 0 7px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .banner-meta { display: flex; flex-wrap: wrap; gap: 5px; }
        .meta-chip {
          font-size: 0.68rem; font-weight: 600; padding: 3px 8px;
          border-radius: 6px; background: rgba(255,255,255,0.07);
          color: var(--text-secondary, #cbd5e1);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .meta-chip.accent { color: #a78bfa; background: rgba(124,58,237,0.12); border-color: rgba(139,92,246,0.25); }
        .banner-right { flex-shrink: 0; }
        .countdown-block {
          text-align: center;
          padding: 10px 14px; border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          min-width: 88px;
        }
        .countdown-block.urgent {
          background: rgba(239,68,68,0.08);
          border-color: rgba(239,68,68,0.25);
        }
        .countdown-digits { display: flex; align-items: baseline; justify-content: center; gap: 1px; }
        .digit-group { display: flex; align-items: baseline; }
        .digit {
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          font-size: 1.375rem; font-weight: 800;
          color: #c4b5fd; line-height: 1; letter-spacing: -0.02em;
        }
        .countdown-block.urgent .digit { color: #fca5a5; }
        .digit-sep {
          font-family: monospace; font-size: 1.1rem; font-weight: 700;
          color: rgba(196,181,253,0.4); margin: 0 1px; line-height: 1;
        }
        .countdown-label {
          display: block; font-size: 0.6rem; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #475569; margin-top: 5px;
        }
        .countdown-block.urgent .countdown-label { color: #f87171; }
      `}</style>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MEETING CARD
// ═════════════════════════════════════════════════════════════════════════════
function MeetingCard({
  item, index, isCancelling, onCancel, onRate, onScanQr, onReschedule,
}: {
  item: AgendaItem; index: number; isCancelling: boolean;
  onCancel: () => void; onRate: () => void;
  onScanQr: () => void; onReschedule: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG["CONFIRMED"];
  const isAdmin = item.createdBy === "ADMIN";
  const cancelLabel = item.status === "PENDING" ? "Retirer" : "Annuler";

  const hasActions = item.needsRating || item.canScanQr || item.canCancel
    || item.canReschedule || item.conversationId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { delay: index * 0.04, type: "spring", stiffness: 320, damping: 26 } }}
      style={{ opacity: isCancelling ? 0.45 : 1, transition: "opacity 0.3s" }}
      className={`mcard ${item.status === "CANCELLED" ? "mcard-cancelled" : ""}`}
    >
      {/* Left accent */}
      <div className="mcard-accent" style={{ background: cfg.dot }} />

      {/* Time column */}
      <div className="mcard-time">
        {item.slot ? (
          <>
            <span className="time-h">{formatTime(item.slot.startTime)}</span>
            <span className="time-div">↓</span>
            <span className="time-e">{formatTime(item.slot.endTime)}</span>
            <span className="time-dur">20 min</span>
          </>
        ) : (
          <span className="time-tbd">TBD</span>
        )}
      </div>

      {/* Main content */}
      <div className="mcard-body">
        {/* Top row */}
        <div className="mcard-top">
          <div className="participant-row">
            <Avatar
              firstName={item.otherParticipant?.firstName}
              lastName={item.otherParticipant?.lastName}
              photoUrl={item.otherParticipant?.photoUrl}
              size={38}
            />
            <div className="participant-meta">
              <p className="p-name">
                {getFullName(item.otherParticipant?.firstName, item.otherParticipant?.lastName)}
              </p>
              <p className="p-company">{item.otherParticipant?.company}</p>
            </div>
          </div>

          {/* Status + expand */}
          <div className="mcard-right-top">
            <span
              className="status-pill"
              style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
            >
              <span className="status-dot" style={{ background: cfg.dot }} />
              {cfg.label}
            </span>
            {hasActions && (
              <button
                className="expand-btn"
                onClick={() => setExpanded((v) => !v)}
                aria-label="Plus d'options"
              >
                <span style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", display: "inline-block", transition: "transform 0.2s" }}>
                  ⌄
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Table info */}
        {item.table && (
          <div className="table-row">
            <span className="table-icon">📍</span>
            <span className="table-text">
              Table {item.table.number}
              <span className="table-room"> · {item.table.room}</span>
            </span>
            {item.canScanQr && (
              <button className="quick-qr" onClick={onScanQr}>Scanner QR →</button>
            )}
          </div>
        )}

        {/* Admin badge */}
        {isAdmin && (
          <span className="admin-badge">Planifiée par l'organisateur</span>
        )}

        {/* Needs rating badge */}
        {item.needsRating && !expanded && (
          <button className="rate-teaser" onClick={onRate}>
            ⭐ Évaluer cette réunion
          </button>
        )}

        {/* Expanded actions */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div className="actions-grid">
                {item.needsRating && (
                  <button className="action-chip chip-rate" onClick={onRate}>
                    ⭐ Évaluer
                  </button>
                )}
                {item.canScanQr && (
                  <button className="action-chip chip-qr" onClick={onScanQr}>
                    📷 Scanner QR
                  </button>
                )}
                {item.canReschedule && (
                  <button className="action-chip chip-reschedule" onClick={onReschedule}>
                    🔄 Reporter
                  </button>
                )}
                {item.conversationId && (
                  <Link href={`/chat/${item.conversationId}`} className="action-chip chip-chat">
                    💬 Chat
                  </Link>
                )}
                {item.canCancel && (
                  <button
                    className="action-chip chip-cancel"
                    onClick={onCancel}
                    disabled={isCancelling}
                  >
                    {isCancelling ? "En cours…" : `✕ ${cancelLabel}`}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        .mcard {
          display: flex;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.03);
          overflow: hidden;
          transition: border-color 0.2s, background 0.2s;
          position: relative;
        }
        .mcard:hover {
          border-color: rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.045);
        }
        .mcard-cancelled { opacity: 0.5; }

        /* Accent bar */
        .mcard-accent {
          width: 3px; flex-shrink: 0;
          border-radius: 0;
        }

        /* Time column */
        .mcard-time {
          width: 52px; flex-shrink: 0;
          display: flex; flex-direction: column; align-items: center;
          justify-content: flex-start;
          padding: 14px 0 14px 6px;
          gap: 1px;
        }
        .time-h {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8125rem; font-weight: 700;
          color: var(--text-primary, #f1f5f9);
          line-height: 1;
        }
        .time-div { font-size: 0.55rem; color: rgba(255,255,255,0.2); margin: 1px 0; }
        .time-e {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.6875rem; font-weight: 400;
          color: var(--text-muted, #94a3b8);
          line-height: 1;
        }
        .time-dur {
          font-size: 0.55rem; font-weight: 600; margin-top: 3px;
          color: rgba(255,255,255,0.2); letter-spacing: 0.05em;
        }
        .time-tbd { font-size: 0.65rem; color: #475569; }

        /* Body */
        .mcard-body {
          flex: 1; min-width: 0;
          padding: 12px 14px 12px 8px;
          display: flex; flex-direction: column; gap: 8px;
        }

        /* Top row */
        .mcard-top {
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 8px;
        }
        .participant-row { display: flex; align-items: center; gap: 9px; min-width: 0; }
        .participant-meta { min-width: 0; }
        .p-name {
          font-size: 0.875rem; font-weight: 700;
          color: var(--text-primary, #f1f5f9);
          margin: 0 0 2px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .p-company {
          font-size: 0.72rem; color: var(--text-muted, #94a3b8);
          margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* Right top */
        .mcard-right-top {
          display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }
        .status-pill {
          display: flex; align-items: center; gap: 4px;
          font-size: 0.65rem; font-weight: 700;
          padding: 3px 8px; border-radius: 20px;
          letter-spacing: 0.02em; white-space: nowrap;
        }
        .status-dot {
          width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
        }
        .expand-btn {
          width: 26px; height: 26px; border-radius: 7px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--text-muted, #94a3b8);
          font-size: 0.875rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .expand-btn:hover { background: rgba(255,255,255,0.1); }

        /* Table */
        .table-row {
          display: flex; align-items: center; gap: 6px;
        }
        .table-icon { font-size: 0.75rem; }
        .table-text {
          font-size: 0.75rem; color: var(--text-muted, #94a3b8);
        }
        .table-room { color: #475569; }
        .quick-qr {
          margin-left: auto; font-size: 0.65rem; font-weight: 700;
          color: #a78bfa; background: rgba(124,58,237,0.1);
          border: 1px solid rgba(139,92,246,0.2);
          padding: 2px 8px; border-radius: 5px; cursor: pointer;
          transition: background 0.15s; white-space: nowrap;
        }
        .quick-qr:hover { background: rgba(124,58,237,0.18); }

        /* Admin */
        .admin-badge {
          display: inline-block; font-size: 0.62rem; font-weight: 600;
          padding: 2px 7px; border-radius: 4px;
          background: rgba(245,158,11,0.1); color: #d97706;
          border: 1px solid rgba(245,158,11,0.2);
        }

        /* Rate teaser */
        .rate-teaser {
          align-self: flex-start;
          font-size: 0.72rem; font-weight: 700;
          color: #fbbf24; background: rgba(251,191,36,0.08);
          border: 1px solid rgba(251,191,36,0.2);
          padding: 4px 10px; border-radius: 7px; cursor: pointer;
          transition: background 0.15s;
        }
        .rate-teaser:hover { background: rgba(251,191,36,0.14); }

        /* Actions grid */
        .actions-grid {
          display: flex; flex-wrap: wrap; gap: 6px;
          padding-top: 6px;
          border-top: 1px solid rgba(255,255,255,0.05);
          margin-top: 2px;
        }
        .action-chip {
          font-size: 0.7rem; font-weight: 700;
          padding: 5px 10px; border-radius: 8px;
          border: 1px solid transparent; cursor: pointer;
          transition: all 0.15s; text-decoration: none;
          display: inline-flex; align-items: center; gap: 3px;
        }
        .action-chip:disabled { opacity: 0.5; cursor: not-allowed; }
        .chip-rate { background: rgba(251,191,36,0.1); border-color: rgba(251,191,36,0.2); color: #fbbf24; }
        .chip-rate:hover { background: rgba(251,191,36,0.16); }
        .chip-qr { background: rgba(124,58,237,0.1); border-color: rgba(139,92,246,0.25); color: #a78bfa; }
        .chip-qr:hover { background: rgba(124,58,237,0.16); }
        .chip-reschedule { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.25); color: #818cf8; }
        .chip-reschedule:hover { background: rgba(99,102,241,0.16); }
        .chip-chat { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.25); color: #34d399; }
        .chip-chat:hover { background: rgba(16,185,129,0.16); }
        .chip-cancel { background: transparent; border-color: transparent; color: #475569; }
        .chip-cancel:hover { color: #94a3b8; }
      `}</style>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SKELETON
// ═════════════════════════════════════════════════════════════════════════════
function AgendaSkeleton() {
  return (
    <div style={{ padding: "3rem 1.25rem", maxWidth: 680, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <div style={skel(80, 8, 6)} />
          <div style={{ ...skel(160, 32, 8), marginTop: 8 }} />
        </div>
        <div style={skel(80, 36, 10)} />
      </div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: "1.25rem" }}>
        {[...Array(4)].map((_, i) => <div key={i} style={skel("100%", 52, 12)} />)}
      </div>
      {/* Banner */}
      <div style={{ ...skel("100%", 90, 20), marginBottom: "1.5rem" }} />
      {/* Cards */}
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ ...skel("100%", 72, 16), marginBottom: 10, animationDelay: `${i * 0.08}s` }} />
      ))}
      <style>{`
        @keyframes shimmer { 0%,100%{opacity:1}50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

function skel(w: number | string, h: number, radius: number): React.CSSProperties {
  return {
    width: w, height: h, borderRadius: radius,
    background: "rgba(255,255,255,0.06)",
    animation: "shimmer 1.6s ease infinite",
  };
}