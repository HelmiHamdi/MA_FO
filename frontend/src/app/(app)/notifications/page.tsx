"use client";
// src/app/(app)/notifications/page.tsx
import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { notificationsApi } from "@/lib/api";
import { Notification, NotificationType } from "@/types";
import { cn, notificationIcons, timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";

const FILTER_TABS = [
  { key: undefined, label: "Tout" },
  { key: "MUTUAL_MATCH,CONNECTION_REQUEST_RECEIVED,CONNECTION_REQUEST_ACCEPTED", label: "Connexions" },
  { key: "MEETING_REQUEST_RECEIVED,MEETING_CONFIRMED,MEETING_REFUSED,MEETING_CANCELLED,MEETING_RESCHEDULED,MEETING_REMINDER,POST_MEETING_RATING", label: "Réunions" },
  { key: "NEW_MESSAGE", label: "Messages" },
];

export default function NotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["notifications", activeFilter],
    queryFn: ({ pageParam = 1 }) =>
      notificationsApi.getAll({ page: pageParam, limit: 20, type: activeFilter }).then((r) => r.data),
    getNextPageParam: (last) => last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
      toast.success("Tout marqué comme lu");
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markOneRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  const notifications = data?.pages.flatMap((p) => p.data) ?? [];
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;

  const handleNotifClick = (n: Notification) => {
    if (!n.isRead) markOneMutation.mutate(n.id);
    if (n.deepLink) router.push(n.deepLink);
  };

  return (
    <div className="px-5 pt-14 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-brand-300 text-sm mt-0.5">{unreadCount} non lues</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Tout lire
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide -mx-1 px-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setActiveFilter(tab.key)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              activeFilter === tab.key
                ? "bg-brand-600 text-white border-brand-500"
                : "glass text-white/50 border-white/10 hover:text-white/70"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 text-white/40">
          <div className="text-5xl mb-4">🔔</div>
          <p className="font-medium text-white/50">Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <NotificationRow key={n.id} notif={n} index={i} onClick={() => handleNotifClick(n)} />
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

function NotificationRow({ notif, index, onClick }: { notif: Notification; index: number; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index % 10) * 0.04 }}
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-4 rounded-2xl text-left transition-all",
        notif.isRead ? "glass hover:bg-white/6" : "bg-brand-600/15 border border-brand-500/25 hover:bg-brand-600/20"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0",
        notif.isRead ? "bg-white/5" : "bg-brand-500/20"
      )}>
        {notificationIcons[notif.type] ?? "🔔"}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-medium leading-snug", notif.isRead ? "text-white/70" : "text-white")}>
            {notif.title}
          </p>
          {!notif.isRead && <div className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0 mt-1" />}
        </div>
        <p className="text-white/40 text-xs mt-0.5 leading-relaxed line-clamp-2">{notif.body}</p>
        <p className="text-white/25 text-xs mt-1">{timeAgo(notif.createdAt)}</p>
      </div>
    </motion.button>
  );
}