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
          needsProfileCompletion: flags.needsProfileCompletion ?? false,
        });
      },

      updateParticipant: (data) =>
        set((state) => ({
          participant: state.participant
            ? { ...state.participant, ...data }
            : null,
          // Recalculer needsProfileCompletion après mise à jour du profil
          needsProfileCompletion: state.participant
            ? !{ ...state.participant, ...data }.photoUrl ||
              !{ ...state.participant, ...data }.bio ||
              !{ ...state.participant, ...data }.tags
            : false,
        })),

      // FIX: appeler l'API avant de vider l'état local
      logout: async () => {
        const refreshToken = Cookies.get("refreshToken");
        try {
          await authApi.logout(refreshToken);
        } catch {
          // Silencieux — on déconnecte localement quoi qu'il arrive
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
      // FIX: persister aussi les flags pour survivre à un F5
      partialize: (state) => ({
        participant: state.participant,
        isAuthenticated: state.isAuthenticated,
        needsProfileCompletion: state.needsProfileCompletion,
      }),
    },
  ),
);