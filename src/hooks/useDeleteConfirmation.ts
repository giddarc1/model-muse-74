import { useState, useEffect, useCallback } from 'react';

export function useDeleteConfirmation() {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const requestDelete = useCallback((id: string) => {
    setPendingDeleteId(prev => prev === id ? null : id);
  }, []);

  const cancelDelete = useCallback(() => {
    setPendingDeleteId(null);
  }, []);

  const confirmDelete = useCallback((id: string, onDelete: () => void) => {
    if (pendingDeleteId === id) {
      onDelete();
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId]);

  // Escape key handler
  useEffect(() => {
    if (!pendingDeleteId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingDeleteId(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pendingDeleteId]);

  return { pendingDeleteId, requestDelete, cancelDelete, confirmDelete };
}
