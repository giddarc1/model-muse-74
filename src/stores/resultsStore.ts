import { create } from 'zustand';
import type { CalcResults } from '@/lib/calculationEngine';

interface ResultsStore {
  /** Map of scenarioId (or 'basecase') → CalcResults */
  results: Record<string, CalcResults>;
  setResults: (key: string, results: CalcResults) => void;
  getResults: (key: string) => CalcResults | undefined;
  clearResults: (key: string) => void;
  clearAllForModel: () => void;
}

export const useResultsStore = create<ResultsStore>((set, get) => ({
  results: {},

  setResults: (key, results) => set(s => ({
    results: { ...s.results, [key]: results },
  })),

  getResults: (key) => get().results[key],

  clearResults: (key) => set(s => {
    const { [key]: _, ...rest } = s.results;
    return { results: rest };
  }),

  clearAllForModel: () => set({ results: {} }),
}));
