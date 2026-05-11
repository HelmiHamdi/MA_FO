"use client";
// src/components/meetings/RateMeetingModal.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { meetingsApi } from "@/lib/api";
import { AgendaItem } from "@/types";
import { getInitials, getFullName } from "@/lib/utils";
import toast from "react-hot-toast";
import Image from "next/image";

interface Props {
  meeting: AgendaItem;
  onClose: () => void;
}

const STAR_LABELS = ["", "Décevant", "Moyen", "Bien", "Très bien", "Excellent !"];
const STAR_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"];

export default function RateMeetingModal({ meeting, onClose }: Props) {
  const qc = useQueryClient();
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [step, setStep] = useState<"rating" | "comment" | "done">("rating");

  const mutation = useMutation({
    mutationFn: () =>
      meetingsApi.rateMeeting(meeting.id, stars, comment || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      setStep("done");
      setTimeout(() => {
        toast.success("Évaluation enregistrée !");
        onClose();
      }, 1200);
    },
    onError: () => toast.error("Erreur lors de l'évaluation"),
  });

  const active = hovered || stars;
  const activeColor = STAR_COLORS[active] || "var(--brand-400, #a78bfa)";

  const handleStarClick = (s: number) => {
    setStars(s);
    if (s > 0) {
      setTimeout(() => setStep("comment"), 300);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="modal-backdrop"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="modal-handle" />

        <AnimatePresence mode="wait">
          {step === "done" ? (
            /* Success state */
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="done-state"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
                className="done-icon"
              >
                ✅
              </motion.div>
              <p className="done-title">Évaluation enregistrée !</p>
              <p className="done-subtitle">Merci pour votre retour</p>
            </motion.div>
          ) : step === "rating" ? (
            /* Star rating step */
            <motion.div
              key="rating"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="step-content"
            >
              {/* Participant header */}
              <div className="participant-header">
                <div className="p-avatar">
                  {meeting.otherParticipant?.photoUrl ? (
                    <Image
                      src={meeting.otherParticipant.photoUrl}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <span>
                      {getInitials(
                        meeting.otherParticipant?.firstName,
                        meeting.otherParticipant?.lastName
                      )}
                    </span>
                  )}
                </div>
                <div>
                  <p className="p-name">
                    {getFullName(
                      meeting.otherParticipant?.firstName,
                      meeting.otherParticipant?.lastName
                    )}
                  </p>
                  <p className="p-question">Comment s'est passée cette réunion ?</p>
                </div>
              </div>

              {/* Stars */}
              <div className="stars-container">
                <div className="stars-row">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <motion.button
                      key={s}
                      whileHover={{ scale: 1.25 }}
                      whileTap={{ scale: 0.85 }}
                      onMouseEnter={() => setHovered(s)}
                      onMouseLeave={() => setHovered(0)}
                      onClick={() => handleStarClick(s)}
                      className="star-btn"
                      style={{ opacity: s <= active ? 1 : 0.2 }}
                      aria-label={`${s} étoile${s > 1 ? "s" : ""}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill={s <= active ? activeColor : "var(--text-ghost, #475569)"}
                        width="40"
                        height="40"
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </motion.button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.p
                    key={active}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="star-label"
                    style={{ color: activeColor }}
                  >
                    {active ? STAR_LABELS[active] : "Touchez une étoile"}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Skip */}
              <button onClick={onClose} className="skip-btn">
                Plus tard
              </button>
            </motion.div>
          ) : (
            /* Comment step */
            <motion.div
              key="comment"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="step-content"
            >
              {/* Stars summary */}
              <div className="stars-summary">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStars(s)}
                    style={{ opacity: s <= stars ? 1 : 0.2, background: "none", border: "none", cursor: "pointer" }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill={s <= stars ? STAR_COLORS[stars] : "#475569"}
                      width="28"
                      height="28"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
                <span className="summary-label" style={{ color: STAR_COLORS[stars] }}>
                  {STAR_LABELS[stars]}
                </span>
              </div>

              <p className="comment-heading">
                Un commentaire ? <span>(optionnel)</span>
              </p>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Partagez votre expérience en quelques mots…"
                maxLength={200}
                rows={3}
                className="comment-textarea"
                autoFocus
              />

              <div className="char-count">{comment.length} / 200</div>

              <div className="modal-actions">
                <button
                  onClick={() => setStep("rating")}
                  className="btn-secondary-modal"
                >
                  ← Retour
                </button>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  className="btn-primary-modal"
                >
                  {mutation.isPending ? (
                    <span className="spinner" />
                  ) : (
                    "Valider ✓"
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
        }
        .modal-sheet {
          width: 100%;
          max-width: 520px;
          background: var(--surface-1, #0f0f1a);
          border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
          border-radius: 28px 28px 0 0;
          padding: 1.25rem 1.5rem 2.5rem;
          box-shadow: 0 -8px 48px rgba(0,0,0,0.4);
        }
        .modal-handle {
          width: 40px;
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.15);
          margin: 0 auto 1.5rem;
        }

        /* Participant header */
        .participant-header {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          margin-bottom: 2rem;
        }
        .p-avatar {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 14px;
          overflow: hidden;
          background: linear-gradient(135deg, #4c1d95, #7c3aed);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: white;
          font-size: 0.875rem;
        }
        .p-name {
          font-weight: 700;
          font-size: 1rem;
          color: var(--text-primary, #f1f5f9);
          margin: 0 0 3px;
        }
        .p-question {
          font-size: 0.8125rem;
          color: var(--text-muted, #94a3b8);
          margin: 0;
        }

        /* Stars */
        .stars-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }
        .stars-row {
          display: flex;
          gap: 0.5rem;
        }
        .star-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          transition: opacity 0.15s;
        }
        .star-label {
          font-size: 0.9375rem;
          font-weight: 700;
          min-height: 1.5rem;
          transition: color 0.2s;
        }

        /* Comment step */
        .stars-summary {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 1.25rem;
        }
        .summary-label {
          font-size: 0.875rem;
          font-weight: 700;
          margin-left: 0.5rem;
        }
        .comment-heading {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--text-primary, #f1f5f9);
          margin-bottom: 0.75rem;
        }
        .comment-heading span {
          font-weight: 400;
          color: var(--text-muted, #94a3b8);
        }
        .comment-textarea {
          width: 100%;
          background: var(--glass-bg, rgba(255,255,255,0.04));
          border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
          border-radius: 12px;
          padding: 0.75rem 1rem;
          color: var(--text-primary, #f1f5f9);
          font-size: 0.875rem;
          line-height: 1.5;
          resize: none;
          outline: none;
          font-family: inherit;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .comment-textarea:focus {
          border-color: var(--brand-400, #a78bfa);
        }
        .comment-textarea::placeholder {
          color: var(--text-ghost, #475569);
        }
        .char-count {
          text-align: right;
          font-size: 0.7rem;
          color: var(--text-ghost, #475569);
          margin-top: 4px;
          margin-bottom: 1rem;
        }

        /* Action buttons */
        .modal-actions {
          display: flex;
          gap: 0.75rem;
        }
        .btn-primary-modal {
          flex: 1;
          height: 48px;
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
        }
        .btn-primary-modal:hover:not(:disabled) {
          background: var(--brand-600, #6d28d9);
          transform: translateY(-1px);
        }
        .btn-primary-modal:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary-modal {
          flex: 0 0 auto;
          height: 48px;
          padding: 0 1.25rem;
          background: var(--glass-bg, rgba(255,255,255,0.05));
          color: var(--text-muted, #94a3b8);
          border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
          border-radius: 12px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-secondary-modal:hover {
          background: var(--glass-hover, rgba(255,255,255,0.08));
          color: var(--text-primary, #f1f5f9);
        }
        .skip-btn {
          display: block;
          margin: 0 auto;
          background: none;
          border: none;
          color: var(--text-ghost, #475569);
          font-size: 0.875rem;
          cursor: pointer;
          padding: 0.5rem 1rem;
          transition: color 0.2s;
        }
        .skip-btn:hover { color: var(--text-muted, #94a3b8); }

        /* Done state */
        .done-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem 0;
          gap: 0.5rem;
        }
        .done-icon { font-size: 3.5rem; }
        .done-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--text-primary, #f1f5f9);
          margin: 0.5rem 0 0;
        }
        .done-subtitle {
          font-size: 0.875rem;
          color: var(--text-muted, #94a3b8);
          margin: 0;
        }

        /* Step content */
        .step-content { display: flex; flex-direction: column; }

        /* Spinner */
        .spinner {
          display: inline-block;
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </motion.div>
  );
}