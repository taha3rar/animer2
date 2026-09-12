import { create } from "zustand";
import type { AuthenticatedUser } from "@streaming/types";
import { apiClient } from "../lib/apiClient";

type AuthState = {
  isAuthenticated: boolean;
  user: AuthenticatedUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: apiClient.isAuthenticated(),
  user: null,

  login: async (email, password) => {
    const user = await apiClient.login(email, password);
    set({ isAuthenticated: true, user });
  },

  logout: async () => {
    await apiClient.logout();
    set({ isAuthenticated: false, user: null });
  },
}));
