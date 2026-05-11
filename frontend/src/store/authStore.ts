// src/store/authStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Participant } from "@/types";
import { clearAuth, setTokens, authApi } from "@/lib/api";
import Cookies from "js-cookie";

interface AuthState {
  participant: Participant | null;
  isAuthenticated: boolean;
  isFirstLogin: boolean;
  needsProfileCompletion: boolean;
  setAuth: (
    participant: Participant,
    tokens: { accessToken: string; refreshToken: string },
    flags?: { isFirstLogin?: boolean; needsProfileCompletion?: boolean },
  ) => void;
  updateParticipant: (data: Partial<Participant>) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      participant: null,
      isAuthenticated: false,
      isFirstLogin: false,
      needsProfileCompletion: false,

      setAuth: (participant, tokens, flags = {}) => {
        setTokens(tokens.accessToken, tokens.refreshToken);
        set({
          participant,
          isAuthenticated: true,
          isFirstLogin: flags.isFirstLogin ?? false,
          // ✅ utilise hasSeenProfilePrompt du participant si pas de flag explicite
          needsProfileCompletion:
            flags.needsProfileCompletion ?? !participant.hasSeenProfilePrompt,
        });
      },

      updateParticipant: (data) =>
        set((state) => {
          const updated = state.participant
            ? { ...state.participant, ...data }
            : null;
          return {
            participant: updated,
            // ✅ si hasSeenProfilePrompt devient true → plus besoin de complétion
            needsProfileCompletion: updated
              ? !updated.hasSeenProfilePrompt
              : false,
          };
        }),

      logout: async () => {
        const refreshToken = Cookies.get("refreshToken");
        try {
          await authApi.logout(refreshToken);
        } catch {
          // Silencieux
        } finally {
          clearAuth();
          set({
            participant: null,
            isAuthenticated: false,
            isFirstLogin: false,
            needsProfileCompletion: false,
          });
        }
      },
    }),
    {
      name: "ma-fo-auth",
      partialize: (state) => ({
        participant: state.participant,
        isAuthenticated: state.isAuthenticated,
        needsProfileCompletion: state.needsProfileCompletion,
      }),
    },
  ),
);