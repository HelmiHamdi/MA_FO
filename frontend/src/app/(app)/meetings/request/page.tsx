"use client";
// src/app/(app)/meetings/request/page.tsx
// Flow 5.1 — Demande de réunion (sélection du participant + créneau + message)

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { meetingsApi } from "@/lib/api";
import { TimeSlot, AvailableSlotsResponse, GenerateMessageResponse } from "@/types";
import { formatDate, formatTime } from "@/lib/utils";
import toast from "react-hot-toast";
import Link from "next/link";

type Step = "slots" | "message" | "confirm" | "done";

export default function RequestMeetingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // receiverId peut être passé en query param depuis ConnectionProfile (4.2)
  const receiverIdFromQuery = searchParams.get("receiverId") ?? "";
  const receiverNameFromQuery = searchParams.get("name") ?? "ce participant";

  const [step, setStep] = useState<Step>("slots");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageSource, setMessageSource] = useState<"profile" | "ai" | "custom">("ai");

  // ── 1. Charger les créneaux disponibles ──────────────────────────────────
  const {
    data: slotsData,
    isLoading: slotsLoading,
    error: slotsError,
  } = useQuery<AvailableSlotsResponse>({
    queryKey: ["slots", receiverIdFromQuery],
    queryFn: () =>
      meetingsApi.getAvailableSlots(receiverIdFromQuery).then((r) => r.data),
    enabled: !!receiverIdFromQuery,
    staleTime: 30_000,
  });

  // ── 2. Pré-générer le message IA dès qu'un slot est sélectionné ──────────
  const {
    data: messageData,
    isLoading: messageLoading,
  } = useQuery<GenerateMessageResponse>({
    queryKey: ["generate-message", receiverIdFromQuery],
    queryFn: () =>
      meetingsApi.generateMessage(receiverIdFromQuery).then((r) => r.data),
    enabled: !!receiverIdFromQuery && step === "message",
    staleTime: Infinity,
  });

  useEffect(() => {
    if (messageData && !message) {
      setMessage(messageData.message);
      setMessageSource(messageData.source);
    }
  }, [messageData, message]);

  // ── 3. Soumettre la demande ───────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () =>
      meetingsApi.requestMeeting({
        receiverId: receiverIdFromQuery,
        slotId: selectedSlotId!,
        message: message || undefined,
      }),
    onSuccess: () => {
      setStep("done");
      setTimeout(() => {
        router.push("/meetings");
      }, 2000);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? "Erreur lors de la demande";
      toast.error(msg);
    },
  });

  // ── Données ───────────────────────────────────────────────────────────────
  const slotsByDay = slotsData?.slotsByDay ?? {};
  const days = Object.keys(slotsByDay).sort();

  const selectedSlot = days
    .flatMap((d) => slotsByDay[d])
    .find((s) => s.id === selectedSlotId);

  if (!receiverIdFromQuery) {
    return (
      <div className="page-wrapper">
        <div className="error-state">
          <p>⚠️ Aucun participant sélectionné.</p>
          <Link href="/connections" className="btn-back">
            ← Retour aux connexions
          </Link>
        </div>
        <style jsx>{pageStyles}</style>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <button
          onClick={() => {
            if (step === "slots") router.back();
            else if (step === "message") setStep("slots");
            else if (step === "confirm") setStep("message");
          }}
          className="btn-back-icon"
          aria-label="Retour"
        >
          ←
        </button>
        <div>
          <h1 className="page-title">Demander une réunion</h1>
          <p className="page-subtitle">avec {receiverNameFromQuery}</p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="steps-bar">
        {(["slots", "message", "confirm"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`step-indicator ${
              step === s
                ? "active"
                : ["slots", "message", "confirm", "done"].indexOf(step) > i
                ? "done"
                : ""
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── DONE ── */}
        {step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="done-state"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
              className="done-icon"
            >
              📅
            </motion.span>
            <p className="done-title">Demande envoyée !</p>
            <p className="done-subtitle">
              {receiverNameFromQuery} recevra une notification
            </p>
          </motion.div>
        )}

        {/* ── STEP 1: SLOTS ── */}
        {step === "slots" && (
          <motion.div
            key="slots"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="step-content"
          >
            <p className="step-heading">
              Choisissez un créneau disponible
            </p>

            {slotsLoading ? (
              <div className="loading-center">
                <span className="spinner" />
                <span>Chargement des créneaux…</span>
              </div>
            ) : slotsError ? (
              <div className="error-state">
                <p>Erreur lors du chargement des créneaux.</p>
                <Link href="/connections" className="btn-back">
                  ← Retour
                </Link>
              </div>
            ) : !slotsData?.available || days.length === 0 ? (
              <div className="empty-slots">
                <span className="empty-icon">😔</span>
                <p>{slotsData?.message ?? "Aucun créneau disponible en commun."}</p>
                <Link href="/connections" className="btn-back">
                  ← Retour aux connexions
                </Link>
              </div>
            ) : (
              <div className="slots-list">
                {days.map((day) => (
                  <div key={day} className="day-group">
                    <p className="day-label">{formatDate(day)}</p>
                    <div className="day-slots">
                      {slotsByDay[day].map((slot) => {
                        const isSelected = selectedSlotId === slot.id;
                        return (
                          <button
                            key={slot.id}
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={`slot-btn ${isSelected ? "selected" : ""}`}
                          >
                            <div>
                              <p className="slot-time">
                                {formatTime(slot.startTime)} —{" "}
                                {formatTime(slot.endTime)}
                              </p>
                              {slot.table && (
                                <p className="slot-table">
                                  📍 Table {slot.table.number} · {slot.table.room}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <span className="slot-check">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="step-footer">
              <button
                onClick={() => {
                  if (selectedSlotId) setStep("message");
                }}
                disabled={!selectedSlotId}
                className="btn-primary"
              >
                Continuer →
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: MESSAGE ── */}
        {step === "message" && (
          <motion.div
            key="message"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="step-content"
          >
            <p className="step-heading">Personnalisez votre message</p>
            <p className="step-sub">
              Ce message sera affiché dans la demande de réunion
            </p>

            {/* Slot recap */}
            {selectedSlot && (
              <div className="slot-recap">
                <span className="slot-recap-icon">📅</span>
                <span>
                  {formatDate(selectedSlot.startTime)} ·{" "}
                  {formatTime(selectedSlot.startTime)} —{" "}
                  {formatTime(selectedSlot.endTime)}
                  {selectedSlot.table
                    ? ` · Table ${selectedSlot.table.number}`
                    : ""}
                </span>
              </div>
            )}

            {/* Message source badge */}
            <div className="message-source-badge">
              {messageLoading ? (
                <span>✨ Génération du message IA…</span>
              ) : messageSource === "profile" ? (
                <span>📝 Depuis votre profil</span>
              ) : (
                <span>✨ Généré par IA — modifiable</span>
              )}
            </div>

            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setMessageSource("custom");
              }}
              placeholder={
                messageLoading
                  ? "Génération en cours…"
                  : "Saisissez votre message de demande de réunion…"
              }
              maxLength={500}
              rows={5}
              className="message-textarea"
              disabled={messageLoading}
            />
            <div className="char-count">{message.length} / 500</div>

            <div className="step-footer two-btns">
              <button
                onClick={() => setStep("slots")}
                className="btn-secondary"
              >
                ← Retour
              </button>
              <button
                onClick={() => setStep("confirm")}
                className="btn-primary"
              >
                Continuer →
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: CONFIRM ── */}
        {step === "confirm" && selectedSlot && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="step-content"
          >
            <p className="step-heading">Confirmez votre demande</p>

            {/* Slot */}
            <div className="confirm-card">
              <p className="confirm-label">Créneau</p>
              <p className="confirm-value">
                {formatDate(selectedSlot.startTime)}
              </p>
              <p className="confirm-value secondary">
                {formatTime(selectedSlot.startTime)} —{" "}
                {formatTime(selectedSlot.endTime)}
                {selectedSlot.table
                  ? ` · Table ${selectedSlot.table.number}, ${selectedSlot.table.room}`
                  : ""}
              </p>
            </div>

            {/* Message */}
            <div className="confirm-card">
              <p className="confirm-label">Message</p>
              <p className="confirm-message">{message || "Aucun message"}</p>
            </div>

            <div className="step-footer two-btns">
              <button
                onClick={() => setStep("message")}
                className="btn-secondary"
              >
                ← Modifier
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="btn-primary"
              >
                {mutation.isPending ? (
                  <span className="spinner-sm" />
                ) : (
                  "📅 Envoyer la demande"
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{pageStyles}</style>
    </div>
  );
}

const pageStyles = `
  .page-wrapper {
    max-width: 540px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 5rem;
    min-height: 100vh;
  }

  /* Header */
  .page-header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-bottom: 1.5rem;
  }
  .btn-back-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: var(--glass-bg, rgba(255,255,255,0.05));
    border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
    color: var(--text-muted, #94a3b8);
    font-size: 1.125rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.2s;
  }
  .btn-back-icon:hover { background: var(--glass-hover, rgba(255,255,255,0.09)); }
  .page-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-primary, #f1f5f9);
    margin: 0;
  }
  .page-subtitle {
    font-size: 0.8125rem;
    color: var(--text-muted, #94a3b8);
    margin: 2px 0 0;
  }

  /* Progress */
  .steps-bar {
    display: flex;
    gap: 6px;
    margin-bottom: 1.75rem;
  }
  .step-indicator {
    flex: 1;
    height: 3px;
    border-radius: 2px;
    background: rgba(255,255,255,0.08);
    transition: background 0.3s;
  }
  .step-indicator.active { background: var(--brand-400, #a78bfa); }
  .step-indicator.done { background: var(--brand-500, #7c3aed); }

  /* Step content */
  .step-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .step-heading {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary, #f1f5f9);
    margin: 0;
  }
  .step-sub {
    font-size: 0.8125rem;
    color: var(--text-muted, #94a3b8);
    margin: -0.5rem 0 0;
  }

  /* Slots */
  .slots-list { display: flex; flex-direction: column; gap: 1.25rem; }
  .day-group { display: flex; flex-direction: column; gap: 0.5rem; }
  .day-label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-secondary, #cbd5e1);
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .day-slots { display: flex; flex-direction: column; gap: 6px; }
  .slot-btn {
    width: 100%;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.03);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    transition: all 0.15s;
    text-align: left;
  }
  .slot-btn:hover {
    border-color: rgba(139,92,246,0.3);
    background: rgba(124,58,237,0.08);
  }
  .slot-btn.selected {
    border: 1.5px solid rgba(139,92,246,0.6);
    background: rgba(124,58,237,0.15);
  }
  .slot-time {
    font-family: var(--font-mono, monospace);
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-primary, #f1f5f9);
    margin: 0;
  }
  .slot-btn.selected .slot-time { color: #c4b5fd; }
  .slot-table {
    font-size: 0.75rem;
    color: var(--text-muted, #94a3b8);
    margin: 2px 0 0;
  }
  .slot-btn.selected .slot-table { color: #a78bfa; }
  .slot-check {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(139,92,246,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    color: #c4b5fd;
    flex-shrink: 0;
  }

  /* Slot recap */
  .slot-recap {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(124,58,237,0.08);
    border: 1px solid rgba(139,92,246,0.2);
    font-size: 0.8125rem;
    color: var(--text-secondary, #cbd5e1);
  }
  .slot-recap-icon { font-size: 1rem; }

  /* Message */
  .message-source-badge {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--brand-400, #a78bfa);
    padding: 4px 10px;
    border-radius: 6px;
    background: rgba(139,92,246,0.1);
    border: 1px solid rgba(139,92,246,0.15);
    width: fit-content;
  }
  .message-textarea {
    width: 100%;
    background: var(--glass-bg, rgba(255,255,255,0.04));
    border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
    border-radius: 12px;
    padding: 0.875rem 1rem;
    color: var(--text-primary, #f1f5f9);
    font-size: 0.875rem;
    line-height: 1.6;
    resize: none;
    outline: none;
    font-family: inherit;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .message-textarea:focus { border-color: var(--brand-400, #a78bfa); }
  .message-textarea::placeholder { color: var(--text-ghost, #475569); }
  .message-textarea:disabled { opacity: 0.5; }
  .char-count {
    text-align: right;
    font-size: 0.7rem;
    color: var(--text-ghost, #475569);
    margin-top: -0.5rem;
  }

  /* Confirm */
  .confirm-card {
    padding: 14px 16px;
    border-radius: 14px;
    background: var(--glass-bg, rgba(255,255,255,0.04));
    border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .confirm-label {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--brand-400, #a78bfa);
    margin: 0;
  }
  .confirm-value {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary, #f1f5f9);
    margin: 0;
  }
  .confirm-value.secondary { font-weight: 400; color: var(--text-muted, #94a3b8); font-size: 0.8125rem; }
  .confirm-message {
    font-size: 0.875rem;
    color: var(--text-secondary, #cbd5e1);
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
  }

  /* Footer */
  .step-footer {
    margin-top: 0.5rem;
    display: flex;
    justify-content: flex-end;
  }
  .step-footer.two-btns { gap: 0.75rem; }
  .btn-primary {
    flex: 1;
    height: 50px;
    background: var(--brand-500, #7c3aed);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 0.9375rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s, transform 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--brand-600, #6d28d9);
    transform: translateY(-1px);
  }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary {
    flex: 0 0 auto;
    height: 50px;
    padding: 0 1.25rem;
    background: var(--glass-bg, rgba(255,255,255,0.05));
    color: var(--text-muted, #94a3b8);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }
  .btn-secondary:hover {
    background: rgba(255,255,255,0.08);
    color: var(--text-primary, #f1f5f9);
  }

  /* States */
  .loading-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2.5rem 0;
    color: var(--text-muted, #94a3b8);
    font-size: 0.875rem;
  }
  .empty-slots {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2.5rem 1rem;
    gap: 0.5rem;
    color: var(--text-muted, #94a3b8);
    font-size: 0.875rem;
    line-height: 1.5;
  }
  .empty-icon { font-size: 2.5rem; display: block; margin-bottom: 0.25rem; }
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1rem;
    gap: 1rem;
    color: #ef4444;
    font-size: 0.875rem;
    text-align: center;
  }
  .btn-back {
    padding: 0.5rem 1.25rem;
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    color: var(--text-muted, #94a3b8);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 600;
  }

  /* Done state */
  .done-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem 1rem 2rem;
    gap: 0.5rem;
    text-align: center;
  }
  .done-icon { font-size: 4rem; display: block; }
  .done-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary, #f1f5f9);
    margin: 0.5rem 0 0;
  }
  .done-subtitle {
    font-size: 0.875rem;
    color: var(--text-muted, #94a3b8);
  }

  /* Spinners */
  .spinner {
    display: inline-block;
    width: 28px;
    height: 28px;
    border: 2.5px solid rgba(167,139,250,0.2);
    border-top-color: #a78bfa;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  .spinner-sm {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;