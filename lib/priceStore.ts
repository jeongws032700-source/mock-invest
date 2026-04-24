import { create } from 'zustand';

interface LivePrice {
  price: number;
  chgPct: number;
  vol24: number;
}

interface PriceStore {
  prices: Record<string, LivePrice>;
  setPrice: (sym: string, data: LivePrice) => void;
}

export const usePriceStore = create<PriceStore>(set => ({
  prices: {},
  setPrice: (sym, data) => set(state => ({
    prices: { ...state.prices, [sym]: data },
  })),
}));
