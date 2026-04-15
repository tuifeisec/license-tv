import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AuthScope, TokenPair, UserProfile } from "@/types/api";

interface AuthState {
  user: UserProfile | null;
  authScope: AuthScope | null;
  setSession: (payload: TokenPair, scope: AuthScope) => void;
  updateUser: (user: UserProfile) => void;
  clearSession: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      authScope: null,
      setSession: (payload, scope) =>
        set({
          user: payload.user,
          authScope: scope,
        }),
      updateUser: (user) =>
        set((state) => ({
          ...state,
          user,
        })),
      clearSession: () =>
        set({
          user: null,
          authScope: null,
        }),
      isAuthenticated: () => Boolean(get().user && get().authScope),
    }),
    {
      name: "tv-distribution-auth",
      partialize: (state) => ({
        user: state.user,
        authScope: state.authScope,
      }),
    },
  ),
);
