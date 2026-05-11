"use client";
// src/hooks/useChat.ts
// WebSocket hook for real-time chat

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import Cookies from "js-cookie";

export interface WsMessage {
  id: string;
  type: "TEXT" | "SYSTEM" | "MEET_REQUEST_CARD";
  content: string;
  senderId: string;
  isMine: boolean;
  sender: any;
  isRead: boolean;
  deliveredAt: string | null;
  readAt: string | null;
  conversationId: string;
  createdAt: string;
}

export interface TypingEvent {
  conversationId: string;
  participantId: string;
}

export interface PresenceEvent {
  participantId: string;
  isOnline: boolean;
  conversationId: string;
}

export interface ReadReceiptEvent {
  conversationId: string;
  readByParticipantId: string;
  lastReadMessageId: string;
}

interface UseChatOptions {
  conversationId?: string;
  onNewMessage?: (msg: WsMessage) => void;
  onTypingStart?: (event: TypingEvent) => void;
  onTypingStop?: (event: TypingEvent) => void;
  onPresenceUpdate?: (event: PresenceEvent) => void;
  onMessagesRead?: (event: ReadReceiptEvent) => void;
  onMessageDelivered?: (event: { messageId: string; conversationId: string }) => void;
}

const SOCKET_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ||
  "http://localhost:5000";

export function useChat(options: UseChatOptions = {}) {
  const {
    conversationId,
    onNewMessage,
    onTypingStart,
    onTypingStop,
    onPresenceUpdate,
    onMessagesRead,
    onMessageDelivered,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const joinedConversations = useRef<Set<string>>(new Set());

  // ── Connect on mount ─────────────────────────────────────────
  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (!token) return;

    const socket = io(`${SOCKET_URL}/chat`, {
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      // Re-join any tracked conversations after reconnect
      joinedConversations.current.forEach((id) => {
        socket.emit("join_conversation", { conversationId: id });
      });
    });

    socket.on("disconnect", () => setIsConnected(false));

    socket.on("new_message", (msg: WsMessage) => {
      onNewMessage?.(msg);
    });

    socket.on("user_typing", (event: TypingEvent) => {
      onTypingStart?.(event);
    });

    socket.on("user_stopped_typing", (event: TypingEvent) => {
      onTypingStop?.(event);
    });

    socket.on("presence_update", (event: PresenceEvent) => {
      onPresenceUpdate?.(event);
    });

    socket.on("messages_read", (event: ReadReceiptEvent) => {
      onMessagesRead?.(event);
    });

    socket.on("message_delivered", (event: { messageId: string; conversationId: string }) => {
      onMessageDelivered?.(event);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Join conversation room ───────────────────────────────────
  const joinConversation = useCallback((id: string) => {
    joinedConversations.current.add(id);
    socketRef.current?.emit("join_conversation", { conversationId: id });
  }, []);

  const leaveConversation = useCallback((id: string) => {
    joinedConversations.current.delete(id);
    socketRef.current?.emit("leave_conversation", { conversationId: id });
  }, []);

  // ── Auto join/leave when conversationId prop changes ────────
  useEffect(() => {
    if (!conversationId || !isConnected) return;
    joinConversation(conversationId);
    return () => {
      leaveConversation(conversationId);
    };
  }, [conversationId, isConnected, joinConversation, leaveConversation]);

  // ── Typing ───────────────────────────────────────────────────
  const sendTypingStart = useCallback((id: string) => {
    socketRef.current?.emit("typing_start", { conversationId: id });
  }, []);

  const sendTypingStop = useCallback((id: string) => {
    socketRef.current?.emit("typing_stop", { conversationId: id });
  }, []);

  return {
    isConnected,
    joinConversation,
    leaveConversation,
    sendTypingStart,
    sendTypingStop,
  };
}