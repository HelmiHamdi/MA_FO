"use client";
// src/hooks/useTypingIndicator.ts
// Debounced typing indicator with auto-stop after idle

import { useRef, useCallback } from "react";

export function useTypingIndicator(
  conversationId: string,
  sendStart: (id: string) => void,
  sendStop: (id: string) => void,
  debounceMs = 2000,
) {
  const typingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onKeyPress = useCallback(() => {
    if (!typingRef.current) {
      typingRef.current = true;
      sendStart(conversationId);
    }

    // Reset the stop timer on each keystroke
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (typingRef.current) {
        typingRef.current = false;
        sendStop(conversationId);
      }
    }, debounceMs);
  }, [conversationId, sendStart, sendStop, debounceMs]);

  const onBlur = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (typingRef.current) {
      typingRef.current = false;
      sendStop(conversationId);
    }
  }, [conversationId, sendStop]);

  return { onKeyPress, onBlur };
}