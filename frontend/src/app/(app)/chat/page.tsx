"use client";
// src/app/(app)/chat/page.tsx
// Module 6.2 — Conversations List (Inbox)

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { chatApi } from "@/lib/api";
import { useChat } from "@/hooks/useChat";
import { getInitials, getFullName, timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationItem {
  id: string;
  otherParticipant: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle?: string;
    company?: string;
    photoUrl?: string;
    isOnline?: boolean;
  };
  lastMessage: {
    id: string;
    content: string;
    type: string;
    isMine: boolean;
    isRead: boolean;
    createdAt: string;
  } | null;
  unreadCount: number;
  meetingStatus: string;
  meetingId?: string | null;
  updatedAt: string;
}

const MEETING_STATUS_BADGE: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "⏳ Réunion en attente", color: "#d97706" },
  CONFIRMED: { label: "✅ Réunion confirmée",  color: "#059669" },
  COMPLETED: { label: "☑️ Réunion terminée",   color: "#4f46e5" },
  CANCELLED: { label: "✕ Réunion annulée",     color: "#dc2626" },
  NONE:      { label: "",                       color: "" },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ participant, size = 48 }: { participant: any; size?: number }) {
  const initials = getInitials(participant?.firstName, participant?.lastName);
  const radius = Math.round(size * 0.3);

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: radius, overflow: "hidden",
        background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "white", fontWeight: 700, fontSize: size * 0.33,
        position: "relative",
      }}>
        {participant?.photoUrl ? (
          <Image src={participant.photoUrl} alt="" fill sizes={`${size}px`} className="object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {/* Online dot */}
      {participant?.isOnline && (
        <span style={{
          position: "absolute", bottom: 1, right: 1,
          width: 10, height: 10, borderRadius: "50%",
          background: "#34d399",
          border: "2px solid var(--surface-1, #0f0f1a)",
        }} />
      )}
    </div>
  );
}

// ─── Last message preview ─────────────────────────────────────────────────────

function LastMessagePreview({ msg }: { msg: ConversationItem["lastMessage"] }) {
  if (!msg) {
    return <span style={{ color: "var(--text-ghost, #475569)", fontStyle: "italic", fontSize: "0.8rem" }}>Pas encore de messages</span>;
  }

  if (msg.type === "MEET_REQUEST_CARD") {
    return (
      <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.8rem" }}>
        📅 {msg.isMine ? "Demande de réunion envoyée" : "Demande de réunion reçue"}
      </span>
    );
  }
  if (msg.type === "SYSTEM") {
    return <span style={{ color: "var(--text-ghost, #475569)", fontStyle: "italic", fontSize: "0.8rem" }}>{msg.content}</span>;
  }

  const preview = msg.content.length > 55 ? `${msg.content.slice(0, 55)}…` : msg.content;
  return (
    <span style={{
      color: msg.isMine
        ? "var(--text-muted, #94a3b8)"
        : msg.isRead
        ? "var(--text-muted, #94a3b8)"
        : "var(--text-secondary, #cbd5e1)",
      fontWeight: !msg.isMine && !msg.isRead ? 600 : 400,
      fontSize: "0.8rem",
    }}>
      {msg.isMine && <span style={{ color: "var(--text-ghost, #475569)" }}>Vous : </span>}
      {preview}
    </span>
  );
}

// ─── Conversation Row ─────────────────────────────────────────────────────────

function ConversationRow({ item, index }: { item: ConversationItem; index: number }) {
  const hasUnread = item.unreadCount > 0;
  const meetBadge = MEETING_STATUS_BADGE[item.meetingStatus];
  const hasMeetBadge = item.meetingStatus !== "NONE" && meetBadge?.label;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 280, damping: 24 }}
    >
      <Link href={`/chat/${item.id}`} className="conv-row" aria-label={getFullName(item.otherParticipant?.firstName, item.otherParticipant?.lastName)}>
        <Avatar participant={item.otherParticipant} size={50} />

        <div className="conv-body">
          {/* Name row */}
          <div className="name-row">
            <span className={`conv-name ${hasUnread ? "unread" : ""}`}>
              {getFullName(item.otherParticipant?.firstName, item.otherParticipant?.lastName)}
            </span>
            <div className="meta-right">
              {item.lastMessage && (
                <span className="time-ago">
                  {timeAgo(item.lastMessage.createdAt)}
                </span>
              )}
              {hasUnread && (
                <span className="unread-badge">{item.unreadCount > 99 ? "99+" : item.unreadCount}</span>
              )}
            </div>
          </div>

          {/* Job/company */}
          {(item.otherParticipant?.jobTitle || item.otherParticipant?.company) && (
            <span className="conv-job">
              {item.otherParticipant.jobTitle}
              {item.otherParticipant.jobTitle && item.otherParticipant.company ? " · " : ""}
              {item.otherParticipant.company}
            </span>
          )}

          {/* Last message */}
          <div className="last-msg">
            <LastMessagePreview msg={item.lastMessage} />
          </div>

          {/* Meeting badge */}
          {hasMeetBadge && (
            <span className="meet-badge" style={{ color: meetBadge.color }}>
              {meetBadge.label}
            </span>
          )}
        </div>

        <style jsx>{`
          .conv-row {
            display: flex; align-items: flex-start; gap: 12px;
            padding: 14px 16px;
            border-radius: 18px;
            background: var(--glass-bg, rgba(255,255,255,0.03));
            border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
            text-decoration: none;
            transition: all 0.18s;
          }
          .conv-row:hover {
            background: rgba(255,255,255,0.055);
            border-color: rgba(139,92,246,0.2);
          }
          .conv-body {
            flex: 1; min-width: 0;
            display: flex; flex-direction: column; gap: 3px;
          }
          .name-row {
            display: flex; align-items: center;
            justify-content: space-between; gap: 8px;
          }
          .conv-name {
            font-size: 0.9375rem; font-weight: 600;
            color: var(--text-secondary, #cbd5e1);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .conv-name.unread {
            font-weight: 700; color: var(--text-primary, #f1f5f9);
          }
          .meta-right {
            display: flex; align-items: center; gap: 6px; flex-shrink: 0;
          }
          .time-ago {
            font-size: 0.68rem; color: var(--text-ghost, #475569);
          }
          .unread-badge {
            min-width: 18px; height: 18px; padding: 0 5px;
            border-radius: 9px;
            background: var(--brand-500, #7c3aed);
            color: white; font-size: 0.625rem; font-weight: 800;
            display: flex; align-items: center; justify-content: center;
          }
          .conv-job {
            font-size: 0.72rem; color: var(--text-ghost, #475569);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .last-msg {
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .meet-badge {
            font-size: 0.68rem; font-weight: 600;
          }
        `}</style>
      </Link>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => chatApi.getConversations().then((r) => r.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const conversations: ConversationItem[] = data?.data ?? [];

  // ── WebSocket: update conversations list on new message ──────
  useChat({
    onNewMessage: (msg) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onPresenceUpdate: (event) => {
      // Update online status in list
      qc.setQueryData(["conversations"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((conv: ConversationItem) =>
            conv.otherParticipant.id === event.participantId
              ? { ...conv, otherParticipant: { ...conv.otherParticipant, isOnline: event.isOnline } }
              : conv,
          ),
        };
      });
    },
  });

  // ── Search filter ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) =>
      getFullName(c.otherParticipant?.firstName, c.otherParticipant?.lastName)
        .toLowerCase().includes(q) ||
      (c.otherParticipant?.company ?? "").toLowerCase().includes(q),
    );
  }, [conversations, search]);

  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  if (isLoading) return <ConversationsSkeleton />;

  return (
    <div className="page-root">

      {/* ── HEADER ── */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header"
      >
        <div>
          <h1 className="page-title">
            Messages
            {totalUnread > 0 && (
              <span className="title-badge">{totalUnread}</span>
            )}
          </h1>
          <p className="page-subtitle">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
      </motion.header>

      {/* ── SEARCH ── */}
      <div className="search-wrap">
        <span className="search-icon">🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une conversation…"
          className="search-input"
        />
        {search && (
          <button onClick={() => setSearch("")} className="search-clear">✕</button>
        )}
      </div>

      {/* ── LIST ── */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="empty-state"
        >
          <span className="empty-icon">{search ? "🔍" : "💬"}</span>
          <p className="empty-title">
            {search ? "Aucun résultat" : "Aucune conversation"}
          </p>
          <p className="empty-sub">
            {search
              ? `Aucune conversation ne correspond à "${search}"`
              : "Connectez-vous avec des participants pour démarrer une conversation"}
          </p>
          {!search && (
            <Link href="/connections" className="empty-cta">
              Voir mes connexions →
            </Link>
          )}
        </motion.div>
      ) : (
        <div className="conv-list">
          <AnimatePresence>
            {filtered.map((item, i) => (
              <ConversationRow key={item.id} item={item} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <style jsx>{`
        .page-root {
          max-width: 680px;
          margin: 0 auto;
          padding: 3.5rem 1.25rem 6rem;
        }
        @media (min-width: 768px) {
          .page-root { padding: 2rem 2rem 4rem; }
        }

        /* Header */
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1.375rem;
        }
        .page-title {
          font-size: clamp(1.625rem, 5vw, 2rem);
          font-weight: 800;
          letter-spacing: -0.04em;
          color: var(--text-primary, #f1f5f9);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .title-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          border-radius: 11px;
          background: var(--brand-500, #7c3aed);
          color: white;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0;
        }
        .page-subtitle {
          font-size: 0.8125rem;
          color: var(--text-muted, #94a3b8);
          margin: 4px 0 0;
        }

        /* Search */
        .search-wrap {
          position: relative;
          margin-bottom: 1.125rem;
        }
        .search-icon {
          position: absolute; left: 0.875rem; top: 50%;
          transform: translateY(-50%);
          font-size: 0.875rem; pointer-events: none;
        }
        .search-input {
          width: 100%; height: 44px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 0 2.5rem;
          color: var(--text-primary, #f1f5f9);
          font-size: 0.875rem; outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .search-input:focus { border-color: rgba(139,92,246,0.4); }
        .search-input::placeholder { color: var(--text-ghost, #475569); }
        .search-clear {
          position: absolute; right: 0.75rem; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          color: var(--text-ghost, #475569);
          cursor: pointer; font-size: 0.75rem; padding: 4px;
        }

        /* List */
        .conv-list {
          display: flex; flex-direction: column; gap: 6px;
        }

        /* Empty */
        .empty-state {
          display: flex; flex-direction: column;
          align-items: center; text-align: center;
          padding: 4rem 1rem 2rem; gap: 0.5rem;
        }
        .empty-icon { font-size: 3rem; margin-bottom: 0.75rem; display: block; }
        .empty-title {
          font-size: 1rem; font-weight: 700;
          color: var(--text-secondary, #cbd5e1); margin: 0;
        }
        .empty-sub {
          font-size: 0.875rem; color: var(--text-muted, #94a3b8);
          max-width: 280px; line-height: 1.55; margin: 0;
        }
        .empty-cta {
          margin-top: 1rem;
          padding: 0.625rem 1.5rem; border-radius: 10px;
          background: var(--brand-500, #7c3aed);
          color: white; font-size: 0.875rem; font-weight: 700;
          text-decoration: none; transition: background 0.2s;
        }
        .empty-cta:hover { background: #6d28d9; }
      `}</style>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ConversationsSkeleton() {
  return (
    <div style={{ padding: "3.5rem 1.25rem", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ height: "2rem", width: "10rem", borderRadius: 8, background: "rgba(255,255,255,0.06)", marginBottom: "1.375rem", animation: "shimmer 1.5s ease infinite" }} />
      <div style={{ height: 44, borderRadius: 12, background: "rgba(255,255,255,0.06)", marginBottom: "1.125rem", animation: "shimmer 1.5s ease infinite" }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ height: 80, borderRadius: 18, background: "rgba(255,255,255,0.06)", marginBottom: 6, animation: "shimmer 1.5s ease infinite", animationDelay: `${i * 0.07}s` }} />
      ))}
      <style>{`@keyframes shimmer { 0%,100%{opacity:1}50%{opacity:0.45} }`}</style>
    </div>
  );
}