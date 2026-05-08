"use client";
// src/components/meetings/RateMeetingModal.tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { meetingsApi } from "@/lib/api";
import { AgendaItem } from "@/types";
import { getInitials } from "@/lib/utils";
import toast from "react-hot-toast";
import Image from "next/image";

interface Props { meeting: AgendaItem; onClose: () => void; }

export default function RateMeetingModal({ meeting, onClose }: Props) {
  const qc = useQueryClient();
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");

  const mutation = useMutation({
    mutationFn: () => meetingsApi.rateMeeting(meeting.id, stars, comment || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success("Évaluation enregistrée !");
      onClose();
    },
    onError: () => toast.error("Erreur lors de l'évaluation"),
  });

  const active = hovered || stars;
  const labels = ["", "Décevant", "Moyen", "Bien", "Très bien", "Excellent !"];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full max-w-lg glass-strong rounded-t-3xl p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-6" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-brand-700 relative flex-shrink-0">
            {meeting.otherParticipant?.photoUrl ? (
              <Image src={meeting.otherParticipant.photoUrl} alt="" fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-white text-sm">
                {getInitials(meeting.otherParticipant?.firstName, meeting.otherParticipant?.lastName)}
              </div>
            )}
          </div>
          <div>
            <p className="text-white font-semibold">{meeting.otherParticipant?.firstName} {meeting.otherParticipant?.lastName}</p>
            <p className="text-white/40 text-sm">Comment s&apos;est passée cette réunion ?</p>
          </div>
        </div>

        {/* Stars */}
        <div className="flex items-center justify-center gap-3 mb-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <motion.button
              key={s}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setStars(s)}
              className={`text-4xl transition-all ${s <= active ? "opacity-100" : "opacity-25"}`}
            >
              ⭐
            </motion.button>
          ))}
        </div>
        <p className="text-center text-brand-300 text-sm h-5 mb-4">{active ? labels[active] : ""}</p>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Commentaire optionnel (max 200 caractères)…"
          maxLength={200}
          rows={3}
          className="input-glass resize-none text-sm mb-4"
        />

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Plus tard</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!stars || mutation.isPending}
            className="btn-primary flex-1 disabled:opacity-40"
          >
            {mutation.isPending ? "Envoi…" : "Valider"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}