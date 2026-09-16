import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartLine } from "@/lib/types";

type DraftMode = "pos" | "table";
type PosDraft = {
  cart: CartLine[];
  mode: DraftMode;
  tableId: string | null;
};

type PosDraftStore = {
  drafts: Record<string, PosDraft>;
  clearCart: (restaurantId: string) => void;
  clearAll: () => void;
  setCart: (restaurantId: string, update: CartLine[] | ((cart: CartLine[]) => CartLine[])) => void;
  setMode: (restaurantId: string, mode: DraftMode) => void;
  setTableId: (restaurantId: string, tableId: string | null) => void;
};

const emptyDraft = (mode: DraftMode): PosDraft => ({ cart: [], mode, tableId: null });

export const usePosDraftStore = create<PosDraftStore>()(
  persist(
    (set, get) => ({
      drafts: {},
      clearCart: (restaurantId) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [restaurantId]: { ...(state.drafts[restaurantId] ?? emptyDraft("pos")), cart: [] },
          },
        })),
      clearAll: () => set({ drafts: {} }),
      setCart: (restaurantId, update) => {
        const current = get().drafts[restaurantId] ?? emptyDraft("pos");
        const cart = typeof update === "function" ? update(current.cart) : update;
        set((state) => ({ drafts: { ...state.drafts, [restaurantId]: { ...current, cart } } }));
      },
      setMode: (restaurantId, mode) =>
        set((state) => {
          const current = state.drafts[restaurantId] ?? emptyDraft(mode);
          return { drafts: { ...state.drafts, [restaurantId]: { ...current, mode } } };
        }),
      setTableId: (restaurantId, tableId) =>
        set((state) => {
          const current = state.drafts[restaurantId] ?? emptyDraft("pos");
          return { drafts: { ...state.drafts, [restaurantId]: { ...current, tableId } } };
        }),
    }),
    {
      name: "yopido-pos-drafts-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ drafts: state.drafts }),
    },
  ),
);
