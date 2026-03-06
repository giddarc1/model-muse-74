import { create } from 'zustand';
import type { CalcResults } from '@/lib/calculationEngine';

interface ResultsStore {
  /** Map of scenarioId (or 'basecase') → CalcResults */
  results: Record<string, CalcResults>;
  /** Which scenario is selected in the Run Control Bar dropdown (persists across navigation) */
  selectedRunScenarioId: string;
  setSelectedRunScenarioId: (id: string) => void;
  setResults: (key: string, results: CalcResults) => void;
  getResults: (key: string) => CalcResults | undefined;
  clearResults: (key: string) => void;
  clearAllForModel: () => void;
}

export const useResultsStore = create<ResultsStore>((set, get) => ({
  results: {},
  selectedRunScenarioId: 'basecase',

  setSelectedRunScenarioId: (id) => set({ selectedRunScenarioId: id }),

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
