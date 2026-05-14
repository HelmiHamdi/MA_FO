"use client";
// src/app/(app)/chat/page.tsx — Dashboard redesign
// Logic identique, nouveau design inspiré Mantine Admin

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { chatApi } from "@/lib/api";
import { useChat } from "@/hooks/useChat";
import { getInitials, getFullName, timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";

// ─── Types (unchanged) ────────────────────────────────────────────────────────
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
  COMPLETED: { label: "☑️ Réunion terminée",   color: "#6366f1" },
  CANCELLED: { label: "✕ Réunion annulée",     color: "#dc2626" },
  NONE:      { label: "",                       color: "" },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ participant, size = 44 }: { participant: any; size?: number }) {
  const initials = getInitials(participant?.firstName, participant?.lastName);
  const r = Math.round(size * 0.28);
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: r, overflow: "hidden",
        background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "white", fontWeight: 700, fontSize: size * 0.33, position: "relative",
      }}>
        {participant?.photoUrl ? (
          <Image src={participant.photoUrl} alt="" fill sizes={`${size}px`} className="object-cover"/>
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {participant?.isOnline && (
        <span style={{
          position: "absolute", bottom: 1, right: 1, width: 10, height: 10,
          borderRadius: "50%", background: "#34d399",
          border: "2px solid var(--bg-base,#0d1117)",
        }} />
      )}
    </div>
  );
}

// ─── Last message preview ─────────────────────────────────────────────────────
function LastMessagePreview({ msg }: { msg: ConversationItem["lastMessage"] }) {
  if (!msg) return <span style={{ color: "var(--text-ghost)", fontStyle: "italic", fontSize: "0.8rem" }}>Pas encore de messages</span>;
  if (msg.type === "MEET_REQUEST_CARD") return (
    <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
      📅 {msg.isMine ? "Demande de réunion envoyée" : "Demande de réunion reçue"}
    </span>
  );
  if (msg.type === "SYSTEM") return <span style={{ color: "var(--text-ghost)", fontStyle: "italic", fontSize: "0.8rem" }}>{msg.content}</span>;
  const preview = msg.content.length > 55 ? `${msg.content.slice(0, 55)}…` : msg.content;
  return (
    <span style={{
      color: !msg.isMine && !msg.isRead ? "var(--text-primary)" : "var(--text-muted)",
      fontWeight: !msg.isMine && !msg.isRead ? 600 : 400,
      fontSize: "0.8rem",
    }}>
      {msg.isMine && <span style={{ color: "var(--text-ghost)" }}>Vous : </span>}
      {preview}
    </span>
  );
}

// ─── Conversation Row ─────────────────────────────────────────────────────────
function ConversationRow({ item, index }: { item: ConversationItem; index: number }) {
  const hasUnread = item.unreadCount > 0;
  const meetBadge = MEETING_STATUS_BADGE[item.meetingStatus];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ delay: index * 0.035, type: "spring", stiffness: 300, damping: 26 }}
    >
      <Link href={`/chat/${item.id}`} style={{ display: "block", textDecoration: "none" }}>
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          padding: "14px 16px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--r-lg,14px)",
          transition: "all 0.15s",
          cursor: "pointer",
        }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-default)"; (e.currentTarget as HTMLDivElement).style.background = "var(--bg-card-hover)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLDivElement).style.background = "var(--bg-card)"; }}
        >
          <Avatar participant={item.otherParticipant} size={46} />

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Name row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{
                fontSize: "0.9rem", fontWeight: hasUnread ? 700 : 600,
                color: hasUnread ? "var(--text-primary)" : "var(--text-secondary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {getFullName(item.otherParticipant?.firstName, item.otherParticipant?.lastName)}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {item.lastMessage && (
                  <span style={{ fontSize: "0.68rem", color: "var(--text-ghost)" }}>{timeAgo(item.lastMessage.createdAt)}</span>
                )}
                {hasUnread && (
                  <span style={{
                    minWidth: 18, height: 18, padding: "0 5px",
                    borderRadius: 99, background: "var(--brand-500,#7c3aed)",
                    color: "white", fontSize: "0.6rem", fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</span>
                )}
              </div>
            </div>

            {/* Job/company */}
            {(item.otherParticipant?.jobTitle || item.otherParticipant?.company) && (
              <span style={{ fontSize: "0.7rem", color: "var(--text-ghost)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.otherParticipant.jobTitle}
                {item.otherParticipant.jobTitle && item.otherParticipant.company ? " · " : ""}
                {item.otherParticipant.company}
              </span>
            )}

            {/* Last msg */}
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <LastMessagePreview msg={item.lastMessage} />
            </div>

            {/* Meeting badge */}
            {item.meetingStatus !== "NONE" && meetBadge?.label && (
              <span style={{ fontSize: "0.65rem", fontWeight: 600, color: meetBadge.color }}>
                {meetBadge.label}
              </span>
            )}
          </div>
        </div>
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
    staleTime: 15_000, refetchInterval: 30_000,
  });

  const conversations: ConversationItem[] = data?.data ?? [];

  useChat({
    onNewMessage: () => { qc.invalidateQueries({ queryKey: ["conversations"] }); },
    onPresenceUpdate: (event) => {
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

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) =>
      getFullName(c.otherParticipant?.firstName, c.otherParticipant?.lastName).toLowerCase().includes(q) ||
      (c.otherParticipant?.company ?? "").toLowerCase().includes(q),
    );
  }, [conversations, search]);

  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  if (isLoading) return <ConversationsSkeleton />;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 80px" }}>

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{
            fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, letterSpacing: "-0.03em",
            color: "var(--text-primary)", margin: 0,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            Messages
            {totalUnread > 0 && (
              <span style={{
                minWidth: 22, height: 22, padding: "0 6px", borderRadius: 11,
                background: "var(--brand-500,#7c3aed)", color: "white",
                fontSize: "0.7rem", fontWeight: 800,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>{totalUnread}</span>
            )}
          </h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
      </motion.div>

      {/* ── Search ── */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none" }}
          width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7"/><path d="m21 21-3.5-3.5"/>
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une conversation…"
          className="input-glass"
          style={{ paddingLeft: 36 }}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer", fontSize: "0.75rem",
          }}>✕</button>
        )}
      </div>

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "4rem 1rem", gap: "0.5rem" }}>
          <span style={{ fontSize: "3rem", display: "block", marginBottom: 10 }}>{search ? "🔍" : "💬"}</span>
          <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-secondary)", margin: 0 }}>
            {search ? "Aucun résultat" : "Aucune conversation"}
          </p>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", maxWidth: 280, margin: 0, lineHeight: 1.55 }}>
            {search ? `Aucune conversation ne correspond à "${search}"` : "Connectez-vous avec des participants pour démarrer"}
          </p>
          {!search && (
            <Link href="/connections" style={{
              marginTop: 12, padding: "8px 20px", borderRadius: "var(--r-md)",
              background: "var(--brand-500,#7c3aed)", color: "white",
              fontWeight: 600, fontSize: "0.875rem", textDecoration: "none",
            }}>
              Voir mes connexions →
            </Link>
          )}
        </motion.div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <AnimatePresence>
            {filtered.map((item, i) => <ConversationRow key={item.id} item={item} index={i} />)}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ConversationsSkeleton() {
  return (
    <div style={{ padding: "24px", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ height: "2rem", width: "10rem", borderRadius: 8, background: "var(--bg-elevated)", marginBottom: 20, animation: "shimmer 1.5s ease infinite" }} />
      <div style={{ height: 42, borderRadius: 10, background: "var(--bg-elevated)", marginBottom: 16, animation: "shimmer 1.5s ease infinite" }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ height: 76, borderRadius: 14, background: "var(--bg-elevated)", marginBottom: 6, animation: "shimmer 1.5s ease infinite", animationDelay: `${i * 0.07}s` }} />
      ))}
      <style>{`@keyframes shimmer { 0%,100%{opacity:1}50%{opacity:0.45} }`}</style>
    </div>
  );
}