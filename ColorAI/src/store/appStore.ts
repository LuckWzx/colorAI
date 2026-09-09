import { create } from 'zustand';
import type { FullColorValues } from '@/types';

interface HistoryItem {
  hex: string;
  timestamp: number;
}

interface AppState {
  currentCorrectedImage: string | null;
  setCorrectedImage: (url: string | null) => void;
  pickedColor: FullColorValues | null;
  setPickedColor: (color: FullColorValues | null) => void;
  colorHistory: HistoryItem[];
  addColorToHistory: (hex: string) => void;
}

const MAX_HISTORY = 24;

export const useAppStore = create<AppState>((set, get) => ({
  currentCorrectedImage: null,
  setCorrectedImage: (url) => set({ currentCorrectedImage: url }),
  pickedColor: null,
  setPickedColor: (color) => set({ pickedColor: color }),
  colorHistory: [],
  addColorToHistory: (hex) => {
    const current = get().colorHistory;
    const exists = current.some((item) => item.hex === hex);
    if (exists) return;
    const next = [{ hex, timestamp: Date.now() }, ...current].slice(0, MAX_HISTORY);
    set({ colorHistory: next });
  },
}));

export default useAppStore;
