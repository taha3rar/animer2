import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Profile } from "@streaming/types";

type ProfileState = {
  activeProfile: Profile | null;
  setActiveProfile: (profile: Profile) => void;
  clearActiveProfile: () => void;
};

// Persisted so the TV doesn't ask "who's watching" every single time the app opens —
// it only needs to ask again after an explicit "switch profile" or a fresh login.
export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      activeProfile: null,
      setActiveProfile: (profile) => set({ activeProfile: profile }),
      clearActiveProfile: () => set({ activeProfile: null }),
    }),
    { name: "streaming.activeProfile" }
  )
);
