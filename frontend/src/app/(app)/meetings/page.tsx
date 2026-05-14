"use client";
// src/app/(app)/meetings/page.tsx — Fixed: visible cards + light/dark mode

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { meetingsApi } from "@/lib/api";
import { AgendaItem, AgendaResponse } from "@/types";
import { formatCountdown, formatDate, formatTime, getInitials, getFullName } from "@/lib/utils";
import toast from "react-hot-toast";
import Image from "next/image";
import RateMeetingModal from "@/components/meetings/RateMeetingModal";
import TableQrModal from "@/components/meetings/TableQrModal";
import RescheduleMeetingModal from "@/components/meetings/RescheduleMeetingModal";
import Link from "next/link";

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  CONFIRMED:   { label: "Confirmée",    bg: "rgba(5,150,105,0.15)",  text: "#34d399", dot: "#10b981", border: "rgba(16,185,129,0.4)"  },
  PENDING:     { label: "En attente",   bg: "rgba(217,119,6,0.15)",  text: "#fbbf24", dot: "#f59e0b", border: "rgba(245,158,11,0.4)"  },
  COMPLETED:   { label: "Terminée",     bg: "rgba(79,70,229,0.15)",  text: "#a78bfa", dot: "#6d28d9", border: "rgba(99,102,241,0.4)"  },
  CANCELLED:   { label: "Annulée",      bg: "rgba(220,38,38,0.12)",  text: "#f87171", dot: "#ef4444", border: "rgba(239,68,68,0.35)"  },
  RESCHEDULED: { label: "Replanifiée",  bg: "rgba(124,58,237,0.15)", text: "#c4b5fd", dot: "#8b5cf6", border: "rgba(139,92,246,0.4)"  },
};

// Card color variants — explicit colors for both themes
const CARD_VARIANTS = [
  {
    key: "blue",
    dark:  { bg: "#1a2d4a", border: "rgba(59,130,246,0.5)",  accent: "#60a5fa" },
    light: { bg: "#dbeafe", border: "rgba(37,99,235,0.4)",   accent: "#1d4ed8" },
  },
  {
    key: "green",
    dark:  { bg: "#14302a", border: "rgba(16,185,129,0.5)", accent: "#34d399" },
    light: { bg: "#d1fae5", border: "rgba(5,150,105,0.4)",  accent: "#047857" },
  },
  {
    key: "amber",
    dark:  { bg: "#352310", border: "rgba(245,158,11,0.5)", accent: "#fbbf24" },
    light: { bg: "#fef3c7", border: "rgba(217,119,6,0.4)",  accent: "#b45309" },
  },
  {
    key: "purple",
    dark:  { bg: "#261748", border: "rgba(139,92,246,0.5)", accent: "#a78bfa" },
    light: { bg: "#ede9fe", border: "rgba(109,40,217,0.4)", accent: "#5b21b6" },
  },
  {
    key: "pink",
    dark:  { bg: "#351228", border: "rgba(236,72,153,0.5)", accent: "#f472b6" },
    light: { bg: "#fce7f3", border: "rgba(219,39,119,0.4)", accent: "#9d174d" },
  },
  {
    key: "red",
    dark:  { bg: "#351212", border: "rgba(239,68,68,0.5)",  accent: "#f87171" },
    light: { bg: "#fee2e2", border: "rgba(220,38,38,0.4)",  accent: "#b91c1c" },
  },
] as const;

// ─── Live Countdown ────────────────────────────────────────────────────────────
function useLiveCountdown(ms: number) {
  const [val, setVal] = useState(ms);
  useEffect(() => {
    if (val <= 0) return;
    const id = setInterval(() => setVal((p) => Math.max(0, p - 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return val;
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ firstName, lastName, photoUrl, size = 40 }: { firstName?: string; lastName?: string; photoUrl?: string; size?: number }) {
  const initials = getInitials(firstName, lastName) || "?";
  const r = Math.round(size * 0.28);
  if (photoUrl) return (
    <div style={{ position: "relative", width: size, height: size, borderRadius: r, overflow: "hidden", flexShrink: 0 }}>
      <Image src={photoUrl} alt="" fill sizes={`${size}px`} className="object-cover"/>
    </div>
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: r, flexShrink: 0,
      background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontWeight: 700, fontSize: size * 0.32,
    }}>{initials}</div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function MeetingsPage() {
  const qc = useQueryClient();
  const [ratingMeeting, setRatingMeeting] = useState<AgendaItem | null>(null);
  const [qrMeeting, setQrMeeting] = useState<AgendaItem | null>(null);
  const [rescheduleMeeting, setRescheduleMeeting] = useState<AgendaItem | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("ALL");

  const { data, isLoading } = useQuery<AgendaResponse>({
    queryKey: ["agenda"],
    queryFn: () => meetingsApi.getMyAgenda().then((r) => r.data),
    refetchInterval: 60_000, staleTime: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => meetingsApi.cancelMeeting(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success("Réunion annulée"); setCancellingId(null);
    },
    onError: () => { toast.error("Erreur lors de l'annulation"); setCancellingId(null); },
  });

  const handleCancel = (item: AgendaItem) => {
    const name = getFullName(item.otherParticipant?.firstName, item.otherParticipant?.lastName);
    if (window.confirm(`${item.status === "PENDING" ? "Retirer" : "Annuler"} la réunion avec ${name} ?`)) {
      setCancellingId(item.id);
      cancelMutation.mutate(item.id);
    }
  };

  const days = Object.keys(data?.byDay ?? {}).sort();
  const allItems = days.flatMap((d) => data?.byDay[d] ?? []);
  const confirmedCount = allItems.filter((i) => i.status === "CONFIRMED").length;
  const pendingCount   = allItems.filter((i) => i.status === "PENDING").length;
  const completedCount = allItems.filter((i) => i.status === "COMPLETED").length;

  if (isLoading) return <AgendaSkeleton />;

  return (
    <>
      <div style={{ padding: "24px 24px 80px", maxWidth: 960, margin: "0 auto" }}>

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
          <div>
            <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brand-400,#a78bfa)", margin: "0 0 4px" }}>
              B2B Meeting Agenda
            </p>
            <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: 0, lineHeight: 1 }}>
              Mon Agenda
            </h1>
          </div>
          <Link href="/connections?action=request-meeting" style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 16px", background: "var(--brand-500,#7c3aed)", color: "white",
            borderRadius: "var(--r-md,10px)", fontWeight: 600, fontSize: "0.875rem",
            textDecoration: "none", transition: "all 0.2s", flexShrink: 0,
          }}>
            <span style={{ fontSize: "1.1rem" }}>+</span>
            <span>Réunion</span>
          </Link>
        </motion.div>

        {/* ── Stats row ── */}
        {allItems.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
              {[
                { num: allItems.length, label: "Total", sub: "réunions" },
                { num: confirmedCount,  label: "Confirmées", sub: "à venir", accent: "#34d399" },
                { num: pendingCount,    label: "En attente",  sub: "réponse",  accent: "#fbbf24" },
                { num: completedCount,  label: "Terminées",   sub: "réalisées" },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <p className="stat-num" style={s.accent ? { color: s.accent } : {}}>{s.num}</p>
                  <p className="stat-label">{s.label}</p>
                  {s.sub && <p className="stat-sub">{s.sub}</p>}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Next meeting banner ── */}
        <AnimatePresence>
          {data?.nextMeeting && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.12 }}>
              <NextMeetingBanner meeting={data.nextMeeting} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filter pills ── */}
        {allItems.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}
            style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 2 }}>
            {[
              { key: "ALL",       label: "Tout",        count: allItems.length },
              { key: "CONFIRMED", label: "Confirmées",  count: confirmedCount  },
              { key: "PENDING",   label: "En attente",  count: pendingCount    },
              { key: "COMPLETED", label: "Terminées",   count: completedCount  },
            ].map((f) => (
              <button key={f.key} onClick={() => setActiveFilter(f.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 14px", borderRadius: 99, whiteSpace: "nowrap",
                  fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                  border: "1px solid",
                  borderColor: activeFilter === f.key ? "rgba(139,92,246,0.6)" : "var(--border-subtle)",
                  background: activeFilter === f.key ? "rgba(124,58,237,0.18)" : "var(--bg-elevated)",
                  color: activeFilter === f.key ? "#c4b5fd" : "var(--text-muted)",
                  transition: "all 0.15s", flexShrink: 0,
                }}>
                {f.label}
                {f.count > 0 && (
                  <span style={{
                    fontSize: "0.65rem", fontWeight: 700,
                    padding: "1px 6px", borderRadius: 99,
                    background: activeFilter === f.key ? "rgba(139,92,246,0.3)" : "rgba(128,128,128,0.15)",
                  }}>{f.count}</span>
                )}
              </button>
            ))}
          </motion.div>
        )}

        {/* ── Empty ── */}
        {days.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "5rem 1rem", gap: "0.5rem" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "rgba(124,58,237,0.1)", border: "1px solid rgba(139,92,246,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "2rem", marginBottom: 12,
            }}>📅</div>
            <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-secondary)", margin: 0 }}>Aucune réunion planifiée</p>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: 0, maxWidth: 260 }}>
              Connectez-vous avec des participants pour planifier des réunions
            </p>
            <Link href="/connections" style={{
              marginTop: 16, padding: "10px 20px", borderRadius: "var(--r-md)",
              background: "var(--brand-500,#7c3aed)", color: "white",
              fontWeight: 600, fontSize: "0.875rem", textDecoration: "none",
            }}>
              Voir mes connexions →
            </Link>
          </motion.div>
        )}

        {/* ── Meeting grid ── */}
        {days.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {days.map((day, dayIdx) => {
              const dayItems = (data?.byDay[day] ?? []).filter(
                (item) => activeFilter === "ALL" || item.status === activeFilter
              );
              if (!dayItems.length) return null;

              return (
                <motion.div key={day}
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + dayIdx * 0.05 }}>
                  {/* Day header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-secondary)", margin: 0, flexShrink: 0 }}>
                      {formatDate(day)}
                    </p>
                    <span style={{
                      fontSize: "0.6rem", fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                      background: "var(--bg-elevated)", color: "var(--text-muted)",
                      border: "1px solid var(--border-subtle)",
                    }}>
                      {dayItems.length}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "var(--border-ghost)" }} />
                  </div>

                  {/* Grid of colored cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    {dayItems.map((item, idx) => (
                      <MeetingCard
                        key={item.id}
                        item={item}
                        colorVariant={CARD_VARIANTS[(dayIdx * 10 + idx) % CARD_VARIANTS.length]}
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

      {/* ── Modals ── */}
      <AnimatePresence>
        {ratingMeeting && <RateMeetingModal meeting={ratingMeeting} onClose={() => setRatingMeeting(null)} />}
        {qrMeeting && <TableQrModal meeting={qrMeeting} onClose={() => setQrMeeting(null)} />}
        {rescheduleMeeting && <RescheduleMeetingModal meeting={rescheduleMeeting} onClose={() => setRescheduleMeeting(null)} />}
      </AnimatePresence>
    </>
  );
}

// ─── Next Meeting Banner ───────────────────────────────────────────────────────
function NextMeetingBanner({ meeting }: { meeting: AgendaItem & { countdownMs: number } }) {
  const countdown = useLiveCountdown(meeting.countdownMs);
  const parts = formatCountdown(countdown).split(":");
  const urgent = countdown < 30 * 60 * 1000;

  return (
    <div style={{
      borderRadius: "var(--r-lg,14px)",
      border: urgent ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(139,92,246,0.3)",
      background: urgent ? "rgba(220,38,38,0.08)" : "rgba(124,58,237,0.08)",
      marginBottom: 20, overflow: "hidden",
    }}>
      <div style={{ height: 2, background: urgent ? "linear-gradient(90deg,#ef4444,#f87171)" : "linear-gradient(90deg,#7c3aed,#6366f1,#10b981)" }} />
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Avatar firstName={meeting.otherParticipant?.firstName} lastName={meeting.otherParticipant?.lastName} photoUrl={meeting.otherParticipant?.photoUrl} size={44} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: urgent ? "#f87171" : "#a78bfa", marginBottom: 3 }}>
              {urgent ? "⚠ IMMINENTE" : "· Prochaine réunion"}
            </p>
            <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {getFullName(meeting.otherParticipant?.firstName, meeting.otherParticipant?.lastName)}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {meeting.slot && (
                <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 6, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                  🕐 {formatTime(meeting.slot.startTime)} — {formatTime(meeting.slot.endTime)}
                </span>
              )}
              {meeting.table && (
                <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 6, background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}>
                  📍 Table {meeting.table.number}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Countdown */}
        <div style={{
          padding: "10px 16px", borderRadius: "var(--r-md,10px)", textAlign: "center", flexShrink: 0,
          background: urgent ? "rgba(239,68,68,0.1)" : "var(--bg-elevated)",
          border: urgent ? "1px solid rgba(239,68,68,0.3)" : "1px solid var(--border-subtle)",
        }}>
          <p style={{ margin: 0, fontFamily: "var(--font-mono,monospace)", fontSize: "1.25rem", fontWeight: 800, color: urgent ? "#fca5a5" : "#c4b5fd", letterSpacing: "-0.02em", lineHeight: 1 }}>
            {parts.join(":")}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>restant</p>
        </div>
      </div>
    </div>
  );
}

// ─── Meeting Card ──────────────────────────────────────────────────────────────
function MeetingCard({
  item, colorVariant, isCancelling, onCancel, onRate, onScanQr, onReschedule,
}: {
  item: AgendaItem;
  colorVariant: typeof CARD_VARIANTS[number];
  isCancelling: boolean;
  onCancel: () => void; onRate: () => void; onScanQr: () => void; onReschedule: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG["CONFIRMED"];
  const hasActions = item.needsRating || item.canScanQr || item.canCancel || item.canReschedule || item.conversationId;

  // Use CSS variable for theme detection via data attribute
  const isDarkClass = "meeting-card-themed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ opacity: isCancelling ? 0.5 : 1, transition: "opacity 0.3s" }}
      className={`${isDarkClass} meeting-card meeting-card--${colorVariant.key}`}
    >
      {/* Date */}
      <p className="card-date">
        {item.slot ? formatDate(item.slot.startTime) : "Date TBD"}
      </p>

      {/* Participant */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Avatar firstName={item.otherParticipant?.firstName} lastName={item.otherParticipant?.lastName} photoUrl={item.otherParticipant?.photoUrl} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="card-name">
            {getFullName(item.otherParticipant?.firstName, item.otherParticipant?.lastName)}
          </p>
          <p className="card-company">
            {item.otherParticipant?.company}
          </p>
        </div>
        {/* Status badge */}
        <span style={{
          fontSize: "0.62rem", fontWeight: 700, padding: "3px 8px", borderRadius: 99,
          background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`, flexShrink: 0,
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Time */}
      {item.slot && (
        <p className="card-time">
          {formatTime(item.slot.startTime)} — {formatTime(item.slot.endTime)}
        </p>
      )}

      {/* Progress bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <p className="card-progress-label">Progression</p>
          <p className="card-progress-pct">
            {item.status === "COMPLETED" ? "100%" : item.status === "CONFIRMED" ? "75%" : item.status === "PENDING" ? "40%" : "0%"}
          </p>
        </div>
        <div className="card-progress-bar">
          <div className="card-progress-fill" style={{
            width: item.status === "COMPLETED" ? "100%" : item.status === "CONFIRMED" ? "75%" : item.status === "PENDING" ? "40%" : "10%"
          }} />
        </div>
      </div>

      {/* Table info */}
      {item.table && (
        <p className="card-table">
          📍 Table {item.table.number} · {item.table.room}
        </p>
      )}

      {/* Footer row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div className="card-avatar-chip">
            {getInitials(item.otherParticipant?.firstName, item.otherParticipant?.lastName)}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {item.status === "CANCELLED" ? (
            <span className="card-cancelled-label">✕ Annulée</span>
          ) : item.status === "COMPLETED" ? (
            item.needsRating ? (
              <button onClick={onRate} className="card-rate-btn">⭐ Évaluer</button>
            ) : (
              <span className="card-done-label">Terminée</span>
            )
          ) : item.slot ? (
            <span className="card-days-left">2 jours restants</span>
          ) : null}

          {hasActions && item.status !== "CANCELLED" && item.status !== "COMPLETED" && (
            <button onClick={() => setExpanded((v) => !v)} className="card-expand-btn">
              <span style={{ display: "inline-block", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded actions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            <div className="card-actions-row">
              {item.canScanQr && (
                <button onClick={onScanQr} className="card-action-chip chip-purple">📷 Scanner QR</button>
              )}
              {item.canReschedule && (
                <button onClick={onReschedule} className="card-action-chip chip-indigo">🔄 Reporter</button>
              )}
              {item.conversationId && (
                <Link href={`/chat/${item.conversationId}`} className="card-action-chip chip-green" style={{ textDecoration: "none" }}>
                  💬 Chat
                </Link>
              )}
              {item.canCancel && (
                <button onClick={onCancel} disabled={isCancelling} className="card-action-chip chip-red">
                  {isCancelling ? "…" : "✕ Annuler"}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        /* ── Card base ── */
        .meeting-card {
          border-radius: 14px;
          padding: 18px 20px 16px;
          transition: transform 0.15s, box-shadow 0.2s;
          cursor: default;
        }
        .meeting-card:hover {
          transform: translateY(-2px);
        }

        /* ── Dark mode card colors ── */
        [data-theme="dark"] .meeting-card--blue,
        :root:not([data-theme="light"]) .meeting-card--blue {
          background: #1a2d4a;
          border: 1.5px solid rgba(59,130,246,0.55);
          box-shadow: 0 2px 16px rgba(59,130,246,0.12);
        }
        [data-theme="dark"] .meeting-card--green,
        :root:not([data-theme="light"]) .meeting-card--green {
          background: #14302a;
          border: 1.5px solid rgba(16,185,129,0.55);
          box-shadow: 0 2px 16px rgba(16,185,129,0.12);
        }
        [data-theme="dark"] .meeting-card--amber,
        :root:not([data-theme="light"]) .meeting-card--amber {
          background: #352310;
          border: 1.5px solid rgba(245,158,11,0.55);
          box-shadow: 0 2px 16px rgba(245,158,11,0.12);
        }
        [data-theme="dark"] .meeting-card--purple,
        :root:not([data-theme="light"]) .meeting-card--purple {
          background: #261748;
          border: 1.5px solid rgba(139,92,246,0.55);
          box-shadow: 0 2px 16px rgba(139,92,246,0.12);
        }
        [data-theme="dark"] .meeting-card--pink,
        :root:not([data-theme="light"]) .meeting-card--pink {
          background: #351228;
          border: 1.5px solid rgba(236,72,153,0.55);
          box-shadow: 0 2px 16px rgba(236,72,153,0.12);
        }
        [data-theme="dark"] .meeting-card--red,
        :root:not([data-theme="light"]) .meeting-card--red {
          background: #351212;
          border: 1.5px solid rgba(239,68,68,0.55);
          box-shadow: 0 2px 16px rgba(239,68,68,0.12);
        }

        /* ── Light mode card colors ── */
        [data-theme="light"] .meeting-card--blue {
          background: #dbeafe;
          border: 1.5px solid rgba(37,99,235,0.45);
          box-shadow: 0 2px 12px rgba(37,99,235,0.1);
        }
        [data-theme="light"] .meeting-card--green {
          background: #d1fae5;
          border: 1.5px solid rgba(5,150,105,0.45);
          box-shadow: 0 2px 12px rgba(5,150,105,0.1);
        }
        [data-theme="light"] .meeting-card--amber {
          background: #fef3c7;
          border: 1.5px solid rgba(217,119,6,0.45);
          box-shadow: 0 2px 12px rgba(217,119,6,0.1);
        }
        [data-theme="light"] .meeting-card--purple {
          background: #ede9fe;
          border: 1.5px solid rgba(109,40,217,0.45);
          box-shadow: 0 2px 12px rgba(109,40,217,0.1);
        }
        [data-theme="light"] .meeting-card--pink {
          background: #fce7f3;
          border: 1.5px solid rgba(219,39,119,0.45);
          box-shadow: 0 2px 12px rgba(219,39,119,0.1);
        }
        [data-theme="light"] .meeting-card--red {
          background: #fee2e2;
          border: 1.5px solid rgba(220,38,38,0.45);
          box-shadow: 0 2px 12px rgba(220,38,38,0.1);
        }

        /* ── Card text — dark ── */
        [data-theme="dark"] .card-date,
        :root:not([data-theme="light"]) .card-date {
          margin: 0 0 10px;
          font-size: 0.7rem;
          color: rgba(255,255,255,0.5);
          font-weight: 500;
        }
        [data-theme="dark"] .card-name,
        :root:not([data-theme="light"]) .card-name {
          margin: 0;
          font-weight: 700;
          font-size: 0.875rem;
          color: rgba(255,255,255,0.92);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        [data-theme="dark"] .card-company,
        :root:not([data-theme="light"]) .card-company {
          margin: 0;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.45);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        [data-theme="dark"] .card-time,
        :root:not([data-theme="light"]) .card-time {
          margin: 0 0 8px;
          font-size: 0.825rem;
          font-weight: 700;
          color: rgba(255,255,255,0.75);
          font-family: var(--font-mono,monospace);
        }
        [data-theme="dark"] .card-progress-label,
        :root:not([data-theme="light"]) .card-progress-label {
          margin: 0;
          font-size: 0.65rem;
          font-weight: 700;
          color: rgba(255,255,255,0.4);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        [data-theme="dark"] .card-progress-pct,
        :root:not([data-theme="light"]) .card-progress-pct {
          margin: 0;
          font-size: 0.65rem;
          color: rgba(255,255,255,0.5);
        }
        [data-theme="dark"] .card-table,
        :root:not([data-theme="light"]) .card-table {
          margin: 0 0 8px;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.5);
        }
        [data-theme="dark"] .card-avatar-chip,
        :root:not([data-theme="light"]) .card-avatar-chip {
          width: 24px; height: 24px; border-radius: 50%;
          background: rgba(255,255,255,0.15);
          border: 2px solid rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.6rem; font-weight: 700; color: rgba(255,255,255,0.75);
        }
        [data-theme="dark"] .card-progress-bar,
        :root:not([data-theme="light"]) .card-progress-bar {
          height: 4px; border-radius: 99px;
          background: rgba(255,255,255,0.1);
          overflow: hidden;
        }
        [data-theme="dark"] .card-progress-fill,
        :root:not([data-theme="light"]) .card-progress-fill {
          height: 100%; border-radius: 99px;
          background: rgba(255,255,255,0.5);
          transition: width 0.4s ease;
        }
        [data-theme="dark"] .card-expand-btn,
        :root:not([data-theme="light"]) .card-expand-btn {
          width: 24px; height: 24px; border-radius: 6px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.65);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 0.7rem; transition: all 0.15s;
        }
        [data-theme="dark"] .card-actions-row,
        :root:not([data-theme="light"]) .card-actions-row {
          display: flex; flex-wrap: wrap; gap: 6px;
          padding-top: 10px; margin-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        [data-theme="dark"] .card-cancelled-label,
        :root:not([data-theme="light"]) .card-cancelled-label {
          font-size: 0.65rem; color: #f87171; font-weight: 600;
        }
        [data-theme="dark"] .card-rate-btn,
        :root:not([data-theme="light"]) .card-rate-btn {
          font-size: 0.65rem; font-weight: 700; padding: 3px 10px; border-radius: 99px;
          background: rgba(251,191,36,0.15); border: 1px solid rgba(251,191,36,0.3);
          color: #fbbf24; cursor: pointer;
        }
        [data-theme="dark"] .card-done-label,
        :root:not([data-theme="light"]) .card-done-label {
          font-size: 0.65rem; color: rgba(255,255,255,0.4);
        }
        [data-theme="dark"] .card-days-left,
        :root:not([data-theme="light"]) .card-days-left {
          font-size: 0.65rem; font-weight: 600; color: rgba(255,255,255,0.5);
        }

        /* ── Card text — light ── */
        [data-theme="light"] .card-date {
          margin: 0 0 10px; font-size: 0.7rem; color: rgba(0,0,0,0.45); font-weight: 500;
        }
        [data-theme="light"] .card-name {
          margin: 0; font-weight: 700; font-size: 0.875rem; color: rgba(0,0,0,0.88);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        [data-theme="light"] .card-company {
          margin: 0; font-size: 0.72rem; color: rgba(0,0,0,0.45);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        [data-theme="light"] .card-time {
          margin: 0 0 8px; font-size: 0.825rem; font-weight: 700;
          color: rgba(0,0,0,0.72); font-family: var(--font-mono,monospace);
        }
        [data-theme="light"] .card-progress-label {
          margin: 0; font-size: 0.65rem; font-weight: 700; color: rgba(0,0,0,0.4);
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        [data-theme="light"] .card-progress-pct {
          margin: 0; font-size: 0.65rem; color: rgba(0,0,0,0.5);
        }
        [data-theme="light"] .card-table {
          margin: 0 0 8px; font-size: 0.72rem; color: rgba(0,0,0,0.5);
        }
        [data-theme="light"] .card-avatar-chip {
          width: 24px; height: 24px; border-radius: 50%;
          background: rgba(0,0,0,0.12); border: 2px solid rgba(0,0,0,0.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.6rem; font-weight: 700; color: rgba(0,0,0,0.6);
        }
        [data-theme="light"] .card-progress-bar {
          height: 4px; border-radius: 99px; background: rgba(0,0,0,0.1); overflow: hidden;
        }
        [data-theme="light"] .card-progress-fill {
          height: 100%; border-radius: 99px; background: rgba(0,0,0,0.3); transition: width 0.4s ease;
        }
        [data-theme="light"] .card-expand-btn {
          width: 24px; height: 24px; border-radius: 6px;
          background: rgba(0,0,0,0.07); border: 1px solid rgba(0,0,0,0.12);
          color: rgba(0,0,0,0.5); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.7rem; transition: all 0.15s;
        }
        [data-theme="light"] .card-actions-row {
          display: flex; flex-wrap: wrap; gap: 6px;
          padding-top: 10px; margin-top: 8px;
          border-top: 1px solid rgba(0,0,0,0.1);
        }
        [data-theme="light"] .card-cancelled-label { font-size: 0.65rem; color: #b91c1c; font-weight: 600; }
        [data-theme="light"] .card-rate-btn {
          font-size: 0.65rem; font-weight: 700; padding: 3px 10px; border-radius: 99px;
          background: rgba(217,119,6,0.1); border: 1px solid rgba(217,119,6,0.3);
          color: #b45309; cursor: pointer;
        }
        [data-theme="light"] .card-done-label { font-size: 0.65rem; color: rgba(0,0,0,0.4); }
        [data-theme="light"] .card-days-left { font-size: 0.65rem; font-weight: 600; color: rgba(0,0,0,0.5); }

        /* ── Action chips ── */
        .card-action-chip {
          font-size: 0.7rem; font-weight: 700; padding: 5px 10px; border-radius: 8px;
          cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s;
        }
        .chip-purple { color: #a78bfa; background: rgba(124,58,237,0.15); border: 1px solid rgba(139,92,246,0.3); }
        .chip-indigo { color: #818cf8; background: rgba(79,70,229,0.15); border: 1px solid rgba(99,102,241,0.3); }
        .chip-green  { color: #34d399; background: rgba(5,150,105,0.15);  border: 1px solid rgba(16,185,129,0.3); }
        .chip-red    { color: #f87171; background: rgba(220,38,38,0.12);  border: 1px solid rgba(239,68,68,0.2); }

        [data-theme="light"] .chip-purple { color: #5b21b6; background: rgba(109,40,217,0.1); border-color: rgba(109,40,217,0.25); }
        [data-theme="light"] .chip-indigo { color: #4338ca; background: rgba(67,56,202,0.1); border-color: rgba(67,56,202,0.25); }
        [data-theme="light"] .chip-green  { color: #047857; background: rgba(5,150,105,0.1); border-color: rgba(5,150,105,0.25); }
        [data-theme="light"] .chip-red    { color: #b91c1c; background: rgba(185,28,28,0.08); border-color: rgba(185,28,28,0.2); }
      `}</style>
    </motion.div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function AgendaSkeleton() {
  return (
    <div style={{ padding: "24px", maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <div><div style={sk("120px", 10, 6)} /><div style={{ ...sk("180px", 28, 8), marginTop: 6 }} /></div>
        <div style={sk("100px", 38, 10)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[...Array(4)].map((_,i) => <div key={i} style={sk("100%", 70, 14)} />)}
      </div>
      <div style={{ ...sk("100%", 80, 14), marginBottom: 20 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
        {[...Array(6)].map((_,i) => <div key={i} style={{ ...sk("100%", 160, 14), animationDelay: `${i * 0.06}s` }} />)}
      </div>
      <style>{`@keyframes shimmer { 0%,100%{opacity:1}50%{opacity:0.45} }`}</style>
    </div>
  );
}
function sk(w: number | string, h: number, r: number): React.CSSProperties {
  return { width: w, height: h, borderRadius: r, background: "var(--bg-elevated,#1c2333)", animation: "shimmer 1.6s ease infinite" };
}