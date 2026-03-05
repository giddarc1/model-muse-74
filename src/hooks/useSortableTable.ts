import { useState, useMemo, useCallback } from 'react';

export type SortDir = 'asc' | 'desc' | 'default';

interface SortState {
  key: string;
  dir: SortDir;
}

export function useSortableTable<T>(
  data: T[],
  defaultSortKey: string,
  defaultSortDir: 'asc' | 'desc' = 'desc'
) {
  const [sort, setSort] = useState<SortState>({ key: '', dir: 'default' });

  const handleSort = useCallback((key: string) => {
    setSort(prev => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      if (prev.dir === 'desc') return { key: '', dir: 'default' };
      return { key, dir: 'asc' };
    });
  }, []);

  const sorted = useMemo(() => {
    const arr = [...data];
    const activeKey = sort.dir === 'default' ? defaultSortKey : sort.key;
    const activeDir = sort.dir === 'default' ? defaultSortDir : sort.dir;

    if (!activeKey) return arr;

    return arr.sort((a, b) => {
      const va = (a as any)[activeKey];
      const vb = (b as any)[activeKey];
      if (typeof va === 'string' && typeof vb === 'string') {
        return activeDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      const na = Number(va) || 0;
      const nb = Number(vb) || 0;
      return activeDir === 'asc' ? na - nb : nb - na;
    });
  }, [data, sort, defaultSortKey, defaultSortDir]);

  const reset = useCallback(() => setSort({ key: '', dir: 'default' }), []);

  return { sorted, sort, handleSort, reset };
}
