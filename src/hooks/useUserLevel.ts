import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export type UserLevel = 'novice' | 'standard' | 'advanced';

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

/** Feature gating helpers */
export function canAccess(level: UserLevel, feature: string): boolean {
  const noviceHidden = [
    'all-operations', 'advanced-params', 'formula-builder', 'param-names',
    'util-only-mode', 'whatif-families', 'inline-change-edit',
  ];
  const standardHidden = [
    'product-inclusion', 'max-throughput', 'optimize-lots', 'whatif-families', 'inline-change-edit',
  ];

  if (level === 'advanced') return true;
  if (level === 'standard') return !standardHidden.includes(feature);
  return !noviceHidden.includes(feature); // novice
}
