"use client";
// src/app/(app)/chat/[conversationId]/page.tsx
// Module 6.1 — Conversation Thread

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { chatApi } from "@/lib/api";
import { useChat } from "@/hooks/useChat";

import MeetRequestCard from "@/components/chat/MeetRequestCard";
import { getInitials, getFullName, formatTime, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  type: "TEXT" | "SYSTEM" | "MEET_REQUEST_CARD";
  content: string;
  senderId: string;
  isMine: boolean;
  sender: any;
  isRead: boolean;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

interface MeetCard {
  id: string;
  type: "MEET_REQUEST_CARD";
  meetingId: string;
  meetingStatus: string;
  meetingCreatedBy: "PARTICIPANT" | "ADMIN";
  requestMessage?: string | null;
  refuseReason?: string | null;
  slot?: any;
  table?: any;
  requester?: any;
  receiver?: any;
  isMine: boolean;
  canRespond: boolean;
  createdAt: string;
}

type TimelineItem = (ChatMessage | MeetCard) & { _isCard?: boolean };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Avatar({ participant, size = 36 }: { participant: any; size?: number }) {
  const name = getFullName(participant?.firstName, participant?.lastName) || "?";
  const initials = getInitials(participant?.firstName, participant?.lastName);

  if (participant?.photoUrl) {
    return (
      <div style={{ position: "relative", width: size, height: size, borderRadius: Math.round(size * 0.28), overflow: "hidden", flexShrink: 0 }}>
        <Image src={participant.photoUrl} alt={name} fill sizes={`${size}px`} className="object-cover" />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontWeight: 700, fontSize: size * 0.36, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function ReadReceipt({ isMine, isRead, deliveredAt }: { isMine: boolean; isRead: boolean; deliveredAt: string | null }) {
  if (!isMine) return null;
  if (isRead) return <span style={{ fontSize: "0.625rem", color: "#38bdf8" }}>✓✓</span>;
  if (deliveredAt) return <span style={{ fontSize: "0.625rem", color: "#64748b" }}>✓✓</span>;
  return <span style={{ fontSize: "0.625rem", color: "#475569" }}>✓</span>;
}

function groupByDay(items: TimelineItem[]): Record<string, TimelineItem[]> {
  const groups: Record<string, TimelineItem[]> = {};
  for (const item of items) {
    const day = new Date(item.createdAt).toISOString().split("T")[0];
    if (!groups[day]) groups[day] = [];
    groups[day].push(item);
  }
  return groups;
}

function DayDivider({ date }: { date: string }) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  let label: string;
  if (d.toDateString() === today.toDateString()) label = "Aujourd'hui";
  else if (d.toDateString() === yesterday.toDateString()) label = "Hier";
  else label = formatDate(date);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const conversationId = params.conversationId as string;

  const [messageText, setMessageText] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [readReceiptMap, setReadReceiptMap] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch messages (infinite scroll) ────────────────────────
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }) =>
      chatApi
        .getMessages(conversationId, { before: pageParam as string | undefined, limit: 30 })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.oldestMessageCursor : undefined,
    enabled: !!conversationId,
    staleTime: 10_000,
  });

  const threadInfo = data?.pages[0];
  const otherParticipant = threadInfo?.otherParticipant;

  // All fetched messages (oldest → newest)
  const fetchedMessages: ChatMessage[] = (data?.pages ?? [])
    .slice()
    .reverse()
    .flatMap((p) => p.messages ?? []);

  // All meet cards (stable, from first page)
  const meetCards: MeetCard[] = threadInfo?.meetingCards ?? [];

  // Merge fetched + local into timeline
  const allMessages = [...fetchedMessages, ...localMessages];

  // Build unified timeline: messages + meet cards sorted by time
  const timeline: TimelineItem[] = [
    ...allMessages,
    ...meetCards.map((c) => ({ ...c, _isCard: true as const })),
  ].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const grouped = groupByDay(timeline);
  const days = Object.keys(grouped).sort();

  // ── WebSocket ────────────────────────────────────────────────
  const { sendTypingStart, sendTypingStop } = useChat({
    conversationId,
    onNewMessage: (msg) => {
      if (msg.senderId !== otherParticipant?.id) return;
      setLocalMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, { ...msg, isMine: false }];
      });
      // Mark as read immediately (thread is open)
      chatApi.markRead(conversationId, msg.id).catch(() => {});
      scrollToBottom();
    },
    onTypingStart: ({ participantId }) => {
      if (participantId === otherParticipant?.id) setIsOtherTyping(true);
    },
    onTypingStop: ({ participantId }) => {
      if (participantId === otherParticipant?.id) setIsOtherTyping(false);
    },
    onPresenceUpdate: ({ participantId, isOnline }) => {
      if (participantId === otherParticipant?.id) setIsOtherOnline(isOnline);
    },
    onMessagesRead: ({ readByParticipantId }) => {
      if (readByParticipantId === otherParticipant?.id) {
        // Mark all my messages as read in UI
        setReadReceiptMap((prev) => {
          const next = { ...prev };
          allMessages.filter((m) => m.isMine).forEach((m) => (next[m.id] = true));
          return next;
        });
      }
    },
    onMessageDelivered: ({ messageId }) => {
      // delivered receipt from server
    },
  });

  // ── Typing indicator ─────────────────────────────────────────
  const handleTyping = useCallback(() => {
    sendTypingStart(conversationId);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => sendTypingStop(conversationId), 2000);
  }, [conversationId, sendTypingStart, sendTypingStop]);

  // ── Send message ─────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      chatApi.sendMessage(conversationId, { content }),
    onMutate: (content) => {
      // Optimistic update
      const optimisticMsg: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        type: "TEXT",
        content,
        senderId: "me",
        isMine: true,
        sender: null,
        isRead: false,
        deliveredAt: null,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, optimisticMsg]);
      scrollToBottom();
      return { optimisticId: optimisticMsg.id };
    },
    onSuccess: (data, _, ctx) => {
      // Replace optimistic with real message
      setLocalMessages((prev) =>
        prev.map((m) =>
          m.id === ctx?.optimisticId ? { ...data.data, isMine: true } : m,
        ),
      );
      sendTypingStop(conversationId);
    },
    onError: (_, __, ctx) => {
      setLocalMessages((prev) =>
        prev.filter((m) => m.id !== ctx?.optimisticId),
      );
      toast.error("Erreur lors de l'envoi");
    },
  });

  const handleSend = () => {
    const text = messageText.trim();
    if (!text || sendMutation.isPending) return;
    setMessageText("");
    sendMutation.mutate(text);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendTypingStop(conversationId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Mark read on open ────────────────────────────────────────
  useEffect(() => {
    const lastMsg = allMessages.filter((m) => !m.isMine).at(-1);
    if (lastMsg) {
      chatApi.markRead(conversationId, lastMsg.id).catch(() => {});
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, data]);

  // ── Set initial online status ────────────────────────────────
  useEffect(() => {
    if (threadInfo?.otherParticipant) {
      setIsOtherOnline(threadInfo.otherParticipant.isOnline ?? false);
    }
  }, [threadInfo]);

  // ── Auto-scroll ───────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, localMessages.length]);

  // ── Infinite scroll (upward) ─────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el || isFetchingNextPage || !hasNextPage) return;
    if (el.scrollTop < 80) {
      const prevScrollHeight = el.scrollHeight;
      fetchNextPage().then(() => {
        // Preserve scroll position
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevScrollHeight;
        });
      });
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // ── Long-press copy ───────────────────────────────────────────
  const handleLongPress = (content: string) => {
    navigator.clipboard?.writeText(content).then(() => {
      toast.success("Copié !");
    });
  };

  if (isLoading) return <ConversationSkeleton />;

  return (
    <div className="chat-root">

      {/* ── HEADER ── */}
      <header className="chat-header">
        <button className="back-btn" onClick={() => router.back()} aria-label="Retour">
          ←
        </button>

        <Link href={`/connections/${conversationId}`} className="header-participant">
          <Avatar participant={otherParticipant} size={38} />
          <div className="header-info">
            <span className="header-name">
              {getFullName(otherParticipant?.firstName, otherParticipant?.lastName)}
            </span>
            <span className={`header-status ${isOtherOnline ? "online" : ""}`}>
              {isOtherTyping
                ? "est en train d'écrire…"
                : isOtherOnline
                ? "En ligne"
                : otherParticipant?.jobTitle ?? otherParticipant?.company ?? ""}
            </span>
          </div>
        </Link>

        <Link
          href={`/connections/${conversationId}`}
          className="profile-btn"
          aria-label="Voir le profil"
        >
          👤
        </Link>
      </header>

      {/* ── MESSAGES AREA ── */}
      <div
        className="messages-area"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {/* Load more indicator */}
        {isFetchingNextPage && (
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
            <div className="spinner" />
          </div>
        )}

        {days.map((day) => (
          <div key={day}>
            <DayDivider date={day} />

            {grouped[day].map((item) => {
              // Meet request card
              if ((item as MeetCard).type === "MEET_REQUEST_CARD" || (item as any)._isCard) {
                const card = item as MeetCard;
                return (
                  <MeetRequestCard
                    key={card.id}
                    meetingId={card.meetingId}
                    meetingStatus={card.meetingStatus}
                    meetingCreatedBy={card.meetingCreatedBy}
                    requestMessage={card.requestMessage}
                    refuseReason={card.refuseReason}
                    slot={card.slot}
                    table={card.table}
                    requester={card.requester}
                    receiver={card.receiver}
                    isMine={card.isMine}
                    canRespond={card.canRespond}
                    conversationId={conversationId}
                    createdAt={card.createdAt}
                  />
                );
              }

              const msg = item as ChatMessage;

              // System message
              if (msg.type === "SYSTEM") {
                return (
                  <div key={msg.id} className="system-msg">
                    {msg.content}
                  </div>
                );
              }

              // Text bubble
              const isMine = msg.isMine;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className={`bubble-row ${isMine ? "mine" : "theirs"}`}
                >
                  {!isMine && <Avatar participant={otherParticipant} size={28} />}

                  <div className="bubble-col">
                    <div
                      className={`bubble ${isMine ? "bubble-mine" : "bubble-theirs"}`}
                      onDoubleClick={() => handleLongPress(msg.content)}
                      title="Double-clic pour copier"
                    >
                      {msg.content}
                    </div>
                    <div className={`bubble-meta ${isMine ? "meta-right" : "meta-left"}`}>
                      <span className="time">{formatTime(msg.createdAt)}</span>
                      <ReadReceipt
                        isMine={isMine}
                        isRead={readReceiptMap[msg.id] ?? msg.isRead}
                        deliveredAt={msg.deliveredAt}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}

        {/* Typing indicator */}
        <AnimatePresence>
          {isOtherTyping && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="bubble-row theirs"
            >
              <Avatar participant={otherParticipant} size={28} />
              <div className="typing-bubble">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* ── INPUT AREA ── */}
      <div className="input-area">
        <div className="input-container">
          <textarea
            ref={inputRef}
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Écrire un message…"
            rows={1}
            className="message-input"
            style={{ height: "auto" }}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button
            className={`send-btn ${messageText.trim() ? "active" : ""}`}
            onClick={handleSend}
            disabled={!messageText.trim() || sendMutation.isPending}
            aria-label="Envoyer"
          >
            {sendMutation.isPending ? (
              <div className="send-spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .chat-root {
          display: flex;
          flex-direction: column;
          height: 100dvh;
          max-width: 680px;
          margin: 0 auto;
          background: var(--surface-0, #080812);
          position: relative;
        }

        /* Header */
        .chat-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: var(--surface-1, #0f0f1a);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 10;
          flex-shrink: 0;
        }
        .back-btn {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.07);
          color: var(--text-muted, #94a3b8);
          font-size: 1rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s; flex-shrink: 0;
        }
        .back-btn:hover { background: rgba(255,255,255,0.09); }
        .header-participant {
          display: flex; align-items: center; gap: 10px;
          flex: 1; text-decoration: none; min-width: 0;
        }
        .header-info { min-width: 0; }
        .header-name {
          display: block;
          font-size: 0.9375rem; font-weight: 700;
          color: var(--text-primary, #f1f5f9);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .header-status {
          display: block;
          font-size: 0.72rem;
          color: var(--text-ghost, #475569);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          transition: color 0.2s;
        }
        .header-status.online { color: #34d399; }
        .profile-btn {
          width: 34px; height: 34px; border-radius: 9px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.875rem; text-decoration: none;
          transition: background 0.15s; flex-shrink: 0;
        }
        .profile-btn:hover { background: rgba(255,255,255,0.08); }

        /* Messages area */
        .messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 12px 14px 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.08) transparent;
        }
        .messages-area::-webkit-scrollbar { width: 4px; }
        .messages-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

        /* Bubbles */
        .bubble-row {
          display: flex;
          align-items: flex-end;
          gap: 7px;
          padding: 2px 0;
        }
        .bubble-row.mine { flex-direction: row-reverse; }
        .bubble-col {
          display: flex; flex-direction: column;
          max-width: min(75%, 420px);
          gap: 3px;
        }
        .bubble {
          padding: 9px 13px;
          border-radius: 18px;
          font-size: 0.875rem;
          line-height: 1.5;
          word-break: break-word;
          cursor: default;
          user-select: text;
        }
        .bubble-mine {
          background: var(--brand-500, #7c3aed);
          color: white;
          border-bottom-right-radius: 5px;
        }
        .bubble-theirs {
          background: rgba(255,255,255,0.07);
          color: var(--text-primary, #f1f5f9);
          border: 1px solid rgba(255,255,255,0.07);
          border-bottom-left-radius: 5px;
        }
        .bubble-meta {
          display: flex; align-items: center; gap: 4px;
          font-size: 0.6rem;
        }
        .meta-right { justify-content: flex-end; }
        .meta-left { justify-content: flex-start; }
        .time { color: var(--text-ghost, #475569); }

        /* System message */
        .system-msg {
          text-align: center;
          font-size: 0.72rem;
          color: var(--text-ghost, #475569);
          padding: 10px 20px;
          font-style: italic;
        }

        /* Typing bubble */
        .typing-bubble {
          display: flex; align-items: center; gap: 4px;
          padding: 10px 14px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px; border-bottom-left-radius: 5px;
          min-width: 52px;
        }
        .dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #64748b;
          animation: typing-bounce 1.4s ease infinite;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }

        /* Input area */
        .input-area {
          padding: 10px 14px 20px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: var(--surface-1, #0f0f1a);
          flex-shrink: 0;
        }
        .input-container {
          display: flex; align-items: flex-end; gap: 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 16px;
          padding: 8px 8px 8px 14px;
          transition: border-color 0.2s;
        }
        .input-container:focus-within {
          border-color: rgba(139,92,246,0.4);
        }
        .message-input {
          flex: 1;
          background: none; border: none; outline: none;
          color: var(--text-primary, #f1f5f9);
          font-size: 0.9375rem;
          line-height: 1.5;
          resize: none;
          font-family: inherit;
          min-height: 24px;
          max-height: 120px;
          scrollbar-width: none;
        }
        .message-input::placeholder { color: var(--text-ghost, #475569); }
        .send-btn {
          width: 36px; height: 36px; border-radius: 10px;
          background: rgba(255,255,255,0.07);
          border: none; color: #475569;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
          flex-shrink: 0;
        }
        .send-btn.active {
          background: var(--brand-500, #7c3aed);
          color: white;
          box-shadow: 0 2px 12px rgba(124,58,237,0.4);
        }
        .send-btn:hover.active { background: #6d28d9; transform: scale(1.05); }
        .send-btn:disabled { cursor: not-allowed; }
        .send-spinner {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Loading spinner */
        .spinner {
          width: 20px; height: 20px; border-radius: 50%;
          border: 2px solid rgba(167,139,250,0.2);
          border-top-color: #a78bfa;
          animation: spin 0.7s linear infinite;
        }
      `}</style>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ConversationSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", maxWidth: 680, margin: "0 auto", padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={sk(36, 36, 10)} />
        <div style={sk(38, 38, 11)} />
        <div>
          <div style={{ ...sk(120, 12, 6), marginBottom: 6 }} />
          <div style={sk(80, 8, 4)} />
        </div>
      </div>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} style={{ display: "flex", justifyContent: i % 2 === 0 ? "flex-end" : "flex-start", marginBottom: 10 }}>
          <div style={sk(i % 3 === 0 ? 200 : 150, 40, 16)} />
        </div>
      ))}
      <style>{`@keyframes shimmer { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
    </div>
  );
}

function sk(w: number | string, h: number, r: number): React.CSSProperties {
  return { width: w, height: h, borderRadius: r, background: "rgba(255,255,255,0.06)", animation: "shimmer 1.5s ease infinite" };
}