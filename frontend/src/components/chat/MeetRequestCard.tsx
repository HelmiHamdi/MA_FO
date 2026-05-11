"use client";
// src/components/chat/MeetRequestCard.tsx
// In-chat Meet Request Card — displayed inline in conversation thread

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { meetingsApi } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";
import toast from "react-hot-toast";

interface MeetRequestCardProps {
  meetingId: string;
  meetingStatus: string;
  meetingCreatedBy: "PARTICIPANT" | "ADMIN";
  requestMessage?: string | null;
  refuseReason?: string | null;
  slot?: { id: string; startTime: string; endTime: string } | null;
  table?: { number: number; room: string } | null;
  requester?: any;
  receiver?: any;
  isMine: boolean;
  canRespond: boolean;
  conversationId: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { bg: string; border: string; icon: string; label: string; color: string }> = {
  PENDING: {
    bg: "rgba(251,191,36,0.06)",
    border: "rgba(251,191,36,0.2)",
    icon: "📅",
    label: "Demande de réunion",
    color: "#fbbf24",
  },
  CONFIRMED: {
    bg: "rgba(16,185,129,0.06)",
    border: "rgba(16,185,129,0.22)",
    icon: "✅",
    label: "Réunion confirmée",
    color: "#34d399",
  },
  CANCELLED: {
    bg: "rgba(239,68,68,0.06)",
    border: "rgba(239,68,68,0.18)",
    icon: "✕",
    label: "Réunion annulée",
    color: "#f87171",
  },
  COMPLETED: {
    bg: "rgba(148,163,184,0.06)",
    border: "rgba(148,163,184,0.18)",
    icon: "☑️",
    label: "Réunion terminée",
    color: "#94a3b8",
  },
  RESCHEDULED: {
    bg: "rgba(139,92,246,0.06)",
    border: "rgba(139,92,246,0.22)",
    icon: "🔄",
    label: "Réunion replanifiée",
    color: "#a78bfa",
  },
};

export default function MeetRequestCard({
  meetingId,
  meetingStatus,
  meetingCreatedBy,
  requestMessage,
  refuseReason,
  slot,
  table,
  requester,
  receiver,
  isMine,
  canRespond,
  conversationId,
  createdAt,
}: MeetRequestCardProps) {
  const qc = useQueryClient();
  const [isResponding, setIsResponding] = useState(false);

  const cfg = STATUS_CONFIG[meetingStatus] ?? STATUS_CONFIG.PENDING;

  const respondMutation = useMutation({
    mutationFn: (action: "CONFIRMED" | "CANCELLED") =>
      meetingsApi.respondToMeeting(meetingId, action),
    onSuccess: (_, action) => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["connections"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success(action === "CONFIRMED" ? "Réunion acceptée ! ✅" : "Réunion déclinée");
      setIsResponding(false);
    },
    onError: () => {
      toast.error("Une erreur est survenue");
      setIsResponding(false);
    },
  });

  const isAdmin = meetingCreatedBy === "ADMIN";

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          width: "min(100%, 360px)",
          borderRadius: "18px",
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          overflow: "hidden",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Header stripe */}
        <div style={{
          height: "2px",
          background: `linear-gradient(90deg, ${cfg.color}80, ${cfg.color}20)`,
        }} />

        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>

          {/* Top row: icon + status */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <span style={{ fontSize: "1rem" }}>{cfg.icon}</span>
              <span style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: cfg.color,
              }}>
                {cfg.label}
              </span>
            </div>
            {isAdmin && (
              <span style={{
                fontSize: "0.6rem",
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: "4px",
                background: "rgba(245,158,11,0.1)",
                color: "#d97706",
                border: "1px solid rgba(245,158,11,0.2)",
              }}>
                Organisateur
              </span>
            )}
          </div>

          {/* Slot info */}
          {slot && (
            <div style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.75rem" }}>🕐</span>
                <span style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-primary, #f1f5f9)",
                  fontFamily: "var(--font-mono, monospace)",
                }}>
                  {formatDate(slot.startTime)} · {formatTime(slot.startTime)} — {formatTime(slot.endTime)}
                </span>
              </div>
              {table && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.75rem" }}>📍</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--brand-400, #a78bfa)", fontWeight: 500 }}>
                    Table {table.number} · {table.room}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Request message */}
          {requestMessage && (
            <p style={{
              fontSize: "0.8125rem",
              color: "var(--text-secondary, #cbd5e1)",
              lineHeight: 1.55,
              margin: 0,
              fontStyle: "italic",
              paddingLeft: "4px",
              borderLeft: `2px solid ${cfg.border}`,
            }}>
              "{requestMessage}"
            </p>
          )}

          {/* Refuse reason */}
          {meetingStatus === "CANCELLED" && refuseReason && (
            <p style={{
              fontSize: "0.75rem",
              color: "#f87171",
              margin: 0,
              lineHeight: 1.4,
            }}>
              Motif : {refuseReason}
            </p>
          )}

          {/* Action buttons — only for receiver on PENDING meetings */}
          <AnimatePresence>
            {canRespond && meetingStatus === "PENDING" && !isAdmin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ display: "flex", gap: "8px", overflow: "hidden" }}
              >
                <button
                  onClick={() => {
                    setIsResponding(true);
                    respondMutation.mutate("CANCELLED");
                  }}
                  disabled={respondMutation.isPending}
                  style={{
                    flex: 1,
                    height: "38px",
                    borderRadius: "10px",
                    border: "1px solid rgba(239,68,68,0.25)",
                    background: "rgba(239,68,68,0.08)",
                    color: "#f87171",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    opacity: respondMutation.isPending ? 0.5 : 1,
                  }}
                >
                  ✕ Décliner
                </button>
                <button
                  onClick={() => {
                    setIsResponding(true);
                    respondMutation.mutate("CONFIRMED");
                  }}
                  disabled={respondMutation.isPending}
                  style={{
                    flex: 2,
                    height: "38px",
                    borderRadius: "10px",
                    border: "none",
                    background: "rgba(16,185,129,0.85)",
                    color: "white",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    opacity: respondMutation.isPending ? 0.5 : 1,
                  }}
                >
                  {respondMutation.isPending ? "…" : "✓ Accepter"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}