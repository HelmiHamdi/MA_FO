"use client";
// src/app/(app)/notifications/page.tsx
import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { notificationsApi } from "@/lib/api";
import { Notification } from "@/types";
import { notificationIcons, timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import { useTheme } from "@/context/ThemeContext";

const FILTER_TABS = [
  { key: undefined, label: "Tout", icon: "🔔" },
  { key: "MUTUAL_MATCH,CONNECTION_REQUEST_RECEIVED,CONNECTION_REQUEST_ACCEPTED", label: "Connexions", icon: "🤝" },
  { key: "MEETING_REQUEST_RECEIVED,MEETING_CONFIRMED,MEETING_REFUSED,MEETING_CANCELLED,MEETING_RESCHEDULED,MEETING_REMINDER,POST_MEETING_RATING", label: "Réunions", icon: "📅" },
  { key: "NEW_MESSAGE", label: "Messages", icon: "💬" },
];

export default function NotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toggleTheme, isDark } = useTheme();
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["notifications", activeFilter],
    queryFn: ({ pageParam = 1 }) =>
      notificationsApi.getAll({ page: pageParam, limit: 20, type: activeFilter }).then((r) => r.data),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
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

    if (n.deepLink) {
      // ✅ Corriger les anciens deepLinks /agenda/* → /meetings
      const link = n.deepLink
        .replace("/agenda/rate/", "/meetings")   // /agenda/rate/ID → /meetings
        .replace("/agenda", "/meetings");         // /agenda → /meetings
      router.push(link);
    }
  };

  return (
    <div style={{ padding: "3.5rem 1.25rem 1.5rem" }} className="lg:pt-8">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
            Notifications
          </h1>
          {unreadCount > 0 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ color: "var(--brand-400)", fontSize: "0.8125rem", marginTop: "4px", fontWeight: 500 }}>
              {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </motion.p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}
              style={{
                fontSize: "0.8rem", fontWeight: 500, background: "none", border: "none",
                color: "var(--text-muted)", cursor: "pointer", padding: "4px 0", marginTop: "6px",
              }}>
              Tout lire
            </button>
          )}
          <button onClick={toggleTheme} className="theme-toggle lg:hidden">{isDark ? "☀️" : "🌙"}</button>
        </div>
      </motion.div>

      {/* ── Filter chips ── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-5 -mx-1 px-1">
        {FILTER_TABS.map((tab) => {
          const active = activeFilter === tab.key;
          return (
            <motion.button key={tab.label} onClick={() => setActiveFilter(tab.key)} whileTap={{ scale: 0.96 }}
              style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: "5px",
                padding: "7px 14px", borderRadius: "99px", fontSize: "0.78rem", fontWeight: 600,
                border: "none", cursor: "pointer", transition: "all 0.18s ease",
                background: active ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "var(--glass-bg-md)",
                color: active ? "white" : "var(--text-secondary)",
                boxShadow: active ? "0 4px 16px rgba(109,40,217,0.30)" : "none",
              }}>
              <span style={{ fontSize: "0.9rem" }}>{tab.icon}</span>
              {tab.label}
            </motion.button>
          );
        })}
      </div>

      {/* ── List ── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(6).fill(0).map((_, i) => <div key={i} className="skeleton rounded-2xl" style={{ height: "5rem" }} />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🔔</div>
          <p style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: "1rem" }}>Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          <AnimatePresence>
            {notifications.map((n, i) => (
              <NotificationRow key={n.id} notif={n} index={i} onClick={() => handleNotifClick(n)} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="btn-secondary w-full mt-5">
          {isFetchingNextPage ? "Chargement…" : "Voir plus"}
        </button>
      )}
    </div>
  );
}

function NotificationRow({ notif, index, onClick }: { notif: Notification; index: number; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index % 10) * 0.04, type: "spring", stiffness: 300, damping: 28 }}
      onClick={onClick}
      className="w-full flex items-start gap-3 text-left"
      style={{
        padding: "14px", borderRadius: "18px",
        background: notif.isRead ? "var(--glass-bg)" : "rgba(124,58,237,0.08)",
        border: notif.isRead ? "1px solid var(--border-ghost)" : "1px solid var(--border-default)",
        boxShadow: notif.isRead ? "none" : "var(--shadow-brand)",
        cursor: "pointer", transition: "all 0.18s ease",
      }}>
      <div style={{
        width: "2.5rem", height: "2.5rem", borderRadius: "12px", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem",
        background: notif.isRead ? "var(--glass-bg)" : "rgba(139,92,246,0.14)",
      }}>
        {notificationIcons[notif.type] ?? "🔔"}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p style={{
            fontSize: "0.875rem", fontWeight: notif.isRead ? 400 : 600, lineHeight: 1.4,
            color: notif.isRead ? "var(--text-secondary)" : "var(--text-primary)",
          }}>
            {notif.title}
          </p>
          {!notif.isRead && (
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--brand-400)", flexShrink: 0, marginTop: "5px", boxShadow: "0 0 8px rgba(139,92,246,0.5)" }} />
          )}
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.775rem", marginTop: "3px", lineHeight: 1.5 }} className="line-clamp-2">
          {notif.body}
        </p>
        <p style={{ color: "var(--text-ghost)", fontSize: "0.7rem", marginTop: "6px" }}>
          {timeAgo(notif.createdAt)}
        </p>
      </div>
    </motion.button>
  );
}