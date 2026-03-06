import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export type UserLevel = 'novice' | 'standard' | 'advanced';

/** All gated feature keys — the single source of truth */
export type FeatureKey =
  | 'all_operations'
  | 'advanced_parameters'
  | 'calculate_util_only'
  | 'formula_builder'
  | 'oper_details'
  | 'parameter_names'
  | 'aggregate_products'
  | 'allow_edit_whatif'
  | 'whatif_families'
  | 'max_throughput'
  | 'lot_size_range'
  | 'optimise_lot_sizes'
  | 'product_inclusion';

/**
 * Complete gating table — true means visible at that level.
 * Standard-gated: hidden for novice, visible for standard+advanced.
 * Advanced-gated: hidden for novice+standard, visible for advanced only.
 */
const GATING_TABLE: Record<FeatureKey, Record<UserLevel, boolean>> = {
  // Standard-gated (novice: hidden, standard+advanced: visible)
  all_operations:       { novice: false, standard: true, advanced: true },
  advanced_parameters:  { novice: false, standard: true, advanced: true },
  calculate_util_only:  { novice: false, standard: true, advanced: true },
  formula_builder:      { novice: false, standard: true, advanced: true },
  oper_details:         { novice: false, standard: true, advanced: true },
  parameter_names:      { novice: false, standard: true, advanced: true },

  // Advanced-gated (novice+standard: hidden, advanced only)
  aggregate_products:   { novice: false, standard: false, advanced: true },
  allow_edit_whatif:     { novice: false, standard: false, advanced: true },
  whatif_families:       { novice: false, standard: false, advanced: true },
  max_throughput:        { novice: false, standard: false, advanced: true },
  lot_size_range:        { novice: false, standard: false, advanced: true },
  optimise_lot_sizes:    { novice: false, standard: false, advanced: true },
  product_inclusion:     { novice: false, standard: false, advanced: true },
};

/** Single utility function for all feature gating — the ONLY function components should call */
export function isVisible(feature: FeatureKey, level: UserLevel): boolean {
  return GATING_TABLE[feature]?.[level] ?? false;
}

/** @deprecated Use isVisible() instead */
export function canAccess(level: UserLevel, feature: string): boolean {
  // Map old keys to new keys for backward compat during migration
  const keyMap: Record<string, FeatureKey> = {
    'all-operations': 'all_operations',
    'advanced-params': 'advanced_parameters',
    'util-only-mode': 'calculate_util_only',
    'formula-builder': 'formula_builder',
    'oper-details': 'oper_details',
    'param-names': 'parameter_names',
    'inline-change-edit': 'allow_edit_whatif',
    'whatif-families': 'whatif_families',
    'product-inclusion': 'product_inclusion',
    'max-throughput': 'max_throughput',
    'optimize-lots': 'optimise_lot_sizes',
  };
  const mapped = keyMap[feature] || (feature as FeatureKey);
  return isVisible(mapped, level);
}

interface UserLevelStore {
  userLevel: UserLevel;
  loading: boolean;
  fetchUserLevel: () => Promise<void>;
  setUserLevel: (level: UserLevel) => Promise<void>;
}

export const useUserLevelStore = create<UserLevelStore>((set) => ({
  userLevel: 'standard',
  loading: true,

  fetchUserLevel: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('users').select('user_level').eq('id', user.id).single();
    set({ userLevel: (data?.user_level as UserLevel) || 'standard', loading: false });
  },

  setUserLevel: async (level) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('users').update({ user_level: level }).eq('id', user.id);
    set({ userLevel: level });
  },
}));
