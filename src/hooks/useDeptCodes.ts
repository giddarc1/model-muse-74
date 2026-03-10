import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DeptCode {
  id: string;
  model_id: string;
  value: string;
  is_default: boolean;
}

const DEFAULT_VALUE = 'out of area';

export function useDeptCodes(modelId: string | undefined) {
  const [deptCodes, setDeptCodes] = useState<DeptCode[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!modelId) return;
    const { data } = await supabase
      .from('model_dept_codes')
      .select('*')
      .eq('model_id', modelId)
      .order('is_default', { ascending: false })
      .order('value');
    
    const rows = (data as DeptCode[]) || [];
    
    // Ensure the default "out of area" entry always exists
    if (!rows.some(r => r.value.toLowerCase() === DEFAULT_VALUE)) {
      const { data: inserted } = await supabase
        .from('model_dept_codes')
        .insert({ model_id: modelId, value: DEFAULT_VALUE, is_default: true })
        .select()
        .single();
      if (inserted) {
        rows.unshift(inserted as DeptCode);
      }
    }
    
    setDeptCodes(rows);
    setLoading(false);
  }, [modelId]);

  useEffect(() => { load(); }, [load]);

  const addDeptCode = async (value: string) => {
    if (!modelId || !value.trim()) return;
    const trimmed = value.trim();
    if (deptCodes.some(d => d.value.toLowerCase() === trimmed.toLowerCase())) return;
    const { data, error } = await supabase
      .from('model_dept_codes')
      .insert({ model_id: modelId, value: trimmed, is_default: false })
      .select()
      .single();
    if (!error && data) {
      setDeptCodes(prev => [...prev, data as DeptCode]);
    }
    return { data, error };
  };

  const updateDeptCode = async (id: string, newValue: string) => {
    if (!newValue.trim()) return;
    const { error } = await supabase
      .from('model_dept_codes')
      .update({ value: newValue.trim() })
      .eq('id', id);
    if (!error) {
      setDeptCodes(prev => prev.map(d => d.id === id ? { ...d, value: newValue.trim() } : d));
    }
    return { error };
  };

  const deleteDeptCode = async (id: string) => {
    const { error } = await supabase
      .from('model_dept_codes')
      .delete()
      .eq('id', id);
    if (!error) {
      setDeptCodes(prev => prev.filter(d => d.id !== id));
    }
    return { error };
  };

  return { deptCodes, loading, reload: load, addDeptCode, updateDeptCode, deleteDeptCode };
}
