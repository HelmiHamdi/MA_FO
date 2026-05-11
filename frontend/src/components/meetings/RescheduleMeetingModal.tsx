"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { meetingsApi } from "@/lib/api";
import { AgendaItem, TimeSlot } from "@/types";
import { getFullName, formatTime, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

interface Props {
  meeting: AgendaItem;
  onClose: () => void;
}

export default function RescheduleMeetingModal({ meeting, onClose }: Props) {
  const qc = useQueryClient();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "confirm" | "done">("pick");

  const otherParticipantId = meeting.otherParticipant?.id;

  // ✅ Charge les créneaux disponibles mutuellement
  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ["slots", otherParticipantId],
    queryFn: () =>
      meetingsApi.getAvailableSlots(otherParticipantId!).then((r) => r.data),
    enabled: !!otherParticipantId,
  });

  const mutation = useMutation({
    mutationFn: () =>
      meetingsApi.rescheduleMeeting(meeting.id, selectedSlotId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      setStep("done");
      setTimeout(() => {
        toast.success("Réunion reprogrammée !");
        onClose();
      }, 1400);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ?? "Erreur lors du report";
      toast.error(msg);
    },
  });

  const name = getFullName(
    meeting.otherParticipant?.firstName,
    meeting.otherParticipant?.lastName
  );

  // Grouper les slots par jour
  const slotsByDay: Record<string, TimeSlot[]> = slotsData?.slotsByDay ?? {};
  const days = Object.keys(slotsByDay).sort();
  const selectedSlot = days
    .flatMap((d) => slotsByDay[d])
    .find((s) => s.id === selectedSlotId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(0,0,0,0.70)", backdropFilter: "blur(8px)",
      }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "520px",
          background: "var(--surface-1, #0f0f1a)",
          border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
          borderRadius: "28px 28px 0 0",
          padding: "1.25rem 1.5rem 3rem",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.5)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Handle */}
        <div style={{
          width: "40px", height: "4px", borderRadius: "2px",
          background: "rgba(255,255,255,0.15)", margin: "0 auto 1.25rem",
          flexShrink: 0,
        }} />

        <AnimatePresence mode="wait">

          {/* ── DONE ── */}
          {step === "done" && (
            <motion.div key="done"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", padding: "2.5rem 0", gap: "0.625rem",
              }}
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
                style={{ fontSize: "3.5rem" }}
              >🔄</motion.span>
              <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary, #f1f5f9)", margin: "0.5rem 0 0" }}>
                Réunion reprogrammée !
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted, #94a3b8)", margin: 0 }}>
                {name} a été notifié(e)
              </p>
            </motion.div>
          )}

          {/* ── CONFIRM ── */}
          {step === "confirm" && selectedSlot && (
            <motion.div key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
            >
              <div>
                <p style={{
                  fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "var(--brand-400, #a78bfa)", margin: "0 0 6px",
                }}>Confirmer le report</p>
                <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary, #f1f5f9)", margin: "0 0 4px" }}>
                  {name}
                </p>
              </div>

              {/* Récap ancien slot */}
              <div style={{
                padding: "12px 14px", borderRadius: "12px",
                background: "rgba(239,68,68,0.07)",
                border: "1px solid rgba(239,68,68,0.15)",
              }}>
                <p style={{ fontSize: "0.72rem", color: "#ef4444", fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Créneau actuel (sera libéré)
                </p>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary, #cbd5e1)", margin: 0 }}>
                  {meeting.slot
                    ? `${formatDate(meeting.slot.startTime)} · ${formatTime(meeting.slot.startTime)} — ${formatTime(meeting.slot.endTime)}`
                    : "—"}
                </p>
              </div>

              {/* Nouveau slot */}
              <div style={{
                padding: "12px 14px", borderRadius: "12px",
                background: "rgba(52,211,153,0.07)",
                border: "1px solid rgba(52,211,153,0.2)",
              }}>
                <p style={{ fontSize: "0.72rem", color: "#34d399", fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Nouveau créneau
                </p>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary, #cbd5e1)", margin: 0 }}>
                  {formatDate(selectedSlot.startTime)} · {formatTime(selectedSlot.startTime)} — {formatTime(selectedSlot.endTime)}
                </p>
                {selectedSlot.table && (
                  <p style={{ fontSize: "0.78rem", color: "var(--brand-400, #a78bfa)", margin: "4px 0 0" }}>
                    📍 Table {selectedSlot.table.number} · {selectedSlot.table.room}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
                <button
                  onClick={() => setStep("pick")}
                  style={{
                    flex: "0 0 auto", height: "48px", padding: "0 1.25rem",
                    background: "rgba(255,255,255,0.05)",
                    color: "var(--text-muted, #94a3b8)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
                  }}
                >← Retour</button>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  style={{
                    flex: 1, height: "48px",
                    background: "rgba(99,102,241,0.9)",
                    color: "white", border: "none", borderRadius: "12px",
                    fontSize: "0.9375rem", fontWeight: 700,
                    cursor: mutation.isPending ? "not-allowed" : "pointer",
                    opacity: mutation.isPending ? 0.5 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {mutation.isPending ? (
                    <span style={{
                      width: "18px", height: "18px",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white", borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 0.7s linear infinite",
                    }} />
                  ) : "✓ Confirmer le report"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── PICK SLOT ── */}
          {step === "pick" && (
            <motion.div key="pick"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{ display: "flex", flexDirection: "column", gap: "1rem", overflow: "hidden" }}
            >
              {/* Header */}
              <div style={{ flexShrink: 0 }}>
                <p style={{
                  fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "var(--brand-400, #a78bfa)", margin: "0 0 4px",
                }}>Reporter la réunion</p>
                <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary, #f1f5f9)", margin: "0 0 2px" }}>
                  {name}
                </p>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted, #94a3b8)", margin: 0 }}>
                  Choisissez un nouveau créneau disponible
                </p>
              </div>

              {/* Slots list */}
              <div style={{ overflowY: "auto", flex: 1, paddingRight: "2px" }}>
                {slotsLoading ? (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    padding: "2.5rem 0", gap: "0.75rem",
                  }}>
                    <span style={{
                      width: "32px", height: "32px",
                      border: "2.5px solid rgba(167,139,250,0.2)",
                      borderTopColor: "#a78bfa", borderRadius: "50%",
                      display: "inline-block", animation: "spin 0.7s linear infinite",
                    }} />
                    <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.875rem" }}>
                      Chargement des créneaux…
                    </span>
                  </div>
                ) : !slotsData?.available || days.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "2rem 1rem",
                    color: "var(--text-muted, #94a3b8)", fontSize: "0.875rem",
                  }}>
                    <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>😔</span>
                    Aucun créneau disponible en commun.<br />
                    Contactez l'organisateur de l'événement.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {days.map((day) => (
                      <div key={day}>
                        <p style={{
                          fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "var(--text-secondary, #cbd5e1)",
                          margin: "0 0 8px", paddingBottom: "6px",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}>
                          {formatDate(day)}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {slotsByDay[day].map((slot) => {
                            const isSelected = selectedSlotId === slot.id;
                            return (
                              <button
                                key={slot.id}
                                onClick={() => setSelectedSlotId(slot.id)}
                                style={{
                                  width: "100%",
                                  padding: "10px 14px",
                                  borderRadius: "12px",
                                  border: isSelected
                                    ? "1.5px solid rgba(139,92,246,0.6)"
                                    : "1px solid rgba(255,255,255,0.07)",
                                  background: isSelected
                                    ? "rgba(124,58,237,0.15)"
                                    : "rgba(255,255,255,0.03)",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "8px",
                                  transition: "all 0.15s",
                                }}
                              >
                                <div style={{ textAlign: "left" }}>
                                  <p style={{
                                    margin: 0,
                                    fontFamily: "var(--font-mono, monospace)",
                                    fontSize: "0.875rem",
                                    fontWeight: 700,
                                    color: isSelected ? "#c4b5fd" : "var(--text-primary, #f1f5f9)",
                                  }}>
                                    {formatTime(slot.startTime)} — {formatTime(slot.endTime)}
                                  </p>
                                  {slot.table && (
                                    <p style={{
                                      margin: "2px 0 0",
                                      fontSize: "0.75rem",
                                      color: isSelected ? "#a78bfa" : "var(--text-muted, #94a3b8)",
                                    }}>
                                      📍 Table {slot.table.number} · {slot.table.room}
                                    </p>
                                  )}
                                </div>
                                {isSelected && (
                                  <span style={{
                                    width: "20px", height: "20px", borderRadius: "50%",
                                    background: "rgba(139,92,246,0.3)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "0.75rem", color: "#c4b5fd", flexShrink: 0,
                                  }}>✓</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0, paddingTop: "0.5rem" }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: "0 0 auto", height: "48px", padding: "0 1.25rem",
                    background: "rgba(255,255,255,0.05)",
                    color: "var(--text-muted, #94a3b8)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
                  }}
                >Annuler</button>
                <button
                  onClick={() => { if (selectedSlotId) setStep("confirm"); }}
                  disabled={!selectedSlotId}
                  style={{
                    flex: 1, height: "48px",
                    background: selectedSlotId ? "rgba(99,102,241,0.9)" : "rgba(99,102,241,0.3)",
                    color: "white", border: "none", borderRadius: "12px",
                    fontSize: "0.9375rem", fontWeight: 700,
                    cursor: selectedSlotId ? "pointer" : "not-allowed",
                    transition: "background 0.2s",
                  }}
                >
                  Choisir ce créneau →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </motion.div>
    </motion.div>
  );
}