import { create } from 'zustand';

interface LivePrice {
  price: number;
  chgPct: number;
  vol24: number;
}

interface PriceStore {
  prices: Record<string, LivePrice>;
  wsConnected: boolean;
  setPrice: (sym: string, data: LivePrice) => void;
  setConnected: (v: boolean) => void;
}

export const usePriceStore = create<PriceStore>(set => ({
  prices: {},
  wsConnected: false,
  setPrice: (sym, data) => set(state => ({
    prices: { ...state.prices, [sym]: data },
  })),
  setConnected: (v) => set({ wsConnected: v }),
}));
