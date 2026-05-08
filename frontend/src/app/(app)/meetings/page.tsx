"use client";
// src/app/(app)/meetings/page.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { meetingsApi } from "@/lib/api";
import { AgendaItem, AgendaResponse } from "@/types";
import { cn, formatCountdown, formatDate, formatTime, getInitials, meetingStatusColors } from "@/lib/utils";
import toast from "react-hot-toast";
import Image from "next/image";
import RateMeetingModal from "@/components/meetings/RateMeetingModal";
import TableQrModal from "@/components/meetings/TableQrModal";

export default function MeetingsPage() {
  const qc = useQueryClient();
  const [ratingMeeting, setRatingMeeting] = useState<AgendaItem | null>(null);
  const [qrMeeting, setQrMeeting] = useState<AgendaItem | null>(null);

  const { data, isLoading } = useQuery<AgendaResponse>({
    queryKey: ["agenda"],
    queryFn: () => meetingsApi.getMyAgenda().then((r) => r.data),
    refetchInterval: 60_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => meetingsApi.cancelMeeting(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agenda"] }); toast.success("Réunion annulée"); },
    onError: () => toast.error("Erreur lors de l'annulation"),
  });

  const days = Object.keys(data?.byDay ?? {}).sort();

  if (isLoading) return <AgendaSkeleton />;

  return (
    <div className="px-5 pt-14 pb-6">
      <h1 className="text-2xl font-semibold text-white mb-5">Mon Agenda</h1>

      {/* Next meeting countdown */}
      {data?.nextMeeting && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-5 mb-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-brand-500/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-brand-300 font-medium uppercase tracking-wider">Prochaine réunion</span>
              <div className="flex-1 h-px bg-brand-500/20" />
            </div>
            <NextMeetingCard meeting={data.nextMeeting} />
          </div>
        </motion.div>
      )}

      {/* Days */}
      {days.length === 0 ? (
        <div className="text-center py-20 text-white/40">
          <div className="text-5xl mb-4">📅</div>
          <p className="font-medium text-white/50">Aucune réunion</p>
          <p className="text-sm mt-1">Connectez-vous et demandez vos premières réunions !</p>
        </div>
      ) : (
        days.map((day) => (
          <div key={day} className="mb-6">
            <h2 className="text-xs text-white/40 uppercase tracking-widest font-medium mb-3">
              {formatDate(day, "EEEE d MMMM")}
            </h2>
            <div className="space-y-3">
              {data!.byDay[day].map((item, i) => (
                <MeetingCard
                  key={item.id}
                  item={item}
                  index={i}
                  onCancel={() => cancelMutation.mutate(item.id)}
                  onRate={() => setRatingMeeting(item)}
                  onScanQr={() => setQrMeeting(item)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Modals */}
      <AnimatePresence>
        {ratingMeeting && (
          <RateMeetingModal meeting={ratingMeeting} onClose={() => setRatingMeeting(null)} />
        )}
        {qrMeeting && (
          <TableQrModal meeting={qrMeeting} onClose={() => setQrMeeting(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function NextMeetingCard({ meeting }: { meeting: AgendaItem & { countdownMs: number } }) {
  const [countdown, setCountdown] = useState(meeting.countdownMs);

  return (
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-brand-700 flex-shrink-0 relative">
        {meeting.otherParticipant?.photoUrl ? (
          <Image src={meeting.otherParticipant.photoUrl} alt="" fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white">
            {getInitials(meeting.otherParticipant?.firstName, meeting.otherParticipant?.lastName)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold truncate">
          {meeting.otherParticipant?.firstName} {meeting.otherParticipant?.lastName}
        </p>
        <p className="text-white/50 text-sm">
          {meeting.slot ? `${formatTime(meeting.slot.startTime)} — ${formatTime(meeting.slot.endTime)}` : "Heure à définir"}
        </p>
        {meeting.table && (
          <p className="text-brand-300 text-xs mt-0.5">Table {meeting.table.number} · {meeting.table.room}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <span className="font-mono text-brand-300 font-semibold text-sm">{formatCountdown(countdown)}</span>
        <p className="text-white/30 text-xs">restant</p>
      </div>
    </div>
  );
}

function MeetingCard({ item, index, onCancel, onRate, onScanQr }: { item: AgendaItem; index: number; onCancel: () => void; onRate: () => void; onScanQr: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass rounded-2xl p-4"
    >
      <div className="flex items-start gap-3">
        {/* Time */}
        <div className="text-center w-14 flex-shrink-0">
          {item.slot ? (
            <>
              <p className="text-white font-mono font-semibold text-sm">{formatTime(item.slot.startTime)}</p>
              <p className="text-white/30 text-xs">{formatTime(item.slot.endTime)}</p>
            </>
          ) : (
            <p className="text-white/30 text-xs">–</p>
          )}
        </div>

        {/* Divider */}
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className="w-2 h-2 rounded-full bg-brand-400" />
          <div className="w-px flex-1 min-h-8 bg-brand-500/20" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-white font-medium truncate">
                {item.otherParticipant?.firstName} {item.otherParticipant?.lastName}
              </p>
              <p className="text-white/40 text-xs truncate">{item.otherParticipant?.company}</p>
            </div>
            <span className={cn("text-xs px-2 py-0.5 rounded-lg font-medium flex-shrink-0", meetingStatusColors[item.status])}>
              {item.status === "CONFIRMED" ? "Confirmée" : item.status === "PENDING" ? "En attente" : item.status === "COMPLETED" ? "Terminée" : item.status === "CANCELLED" ? "Annulée" : "Replanifiée"}
            </span>
          </div>

          {item.table && (
            <p className="text-white/30 text-xs mt-1">📍 Table {item.table.number} · {item.table.room}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {item.needsRating && (
              <button onClick={onRate} className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-lg border border-amber-500/30 hover:bg-amber-500/30 transition-colors">
                ⭐ Évaluer
              </button>
            )}
            {item.canScanQr && (
              <button onClick={onScanQr} className="text-xs bg-brand-500/20 text-brand-300 px-3 py-1.5 rounded-lg border border-brand-500/30 hover:bg-brand-500/30 transition-colors">
                📷 Scanner table
              </button>
            )}
            {item.canCancel && (
              <button onClick={onCancel} className="text-xs text-white/30 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-500/20">
                Annuler
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AgendaSkeleton() {
  return (
    <div className="px-5 pt-14 space-y-4 animate-pulse">
      <div className="h-8 w-40 bg-white/5 rounded-lg" />
      <div className="h-32 bg-white/5 rounded-2xl" />
      {Array(3).fill(0).map((_, i) => <div key={i} className="h-24 bg-white/5 rounded-2xl" />)}
    </div>
  );
}