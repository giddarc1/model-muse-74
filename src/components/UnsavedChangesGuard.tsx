import { useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface UnsavedChangesGuardProps {
  isDirty: boolean;
  onSave: () => void;
}

export function UnsavedChangesGuard({ isDirty, onSave }: UnsavedChangesGuardProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Browser tab close / refresh
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Intercept link clicks for in-app navigation
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!isDirtyRef.current) return;
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#')) return;
      // Only intercept internal navigation away from current path
      if (href === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingPath(href);
      setShowDialog(true);
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [location.pathname]);

  const handleSave = useCallback(() => {
    onSave();
    setShowDialog(false);
    if (pendingPath) {
      navigate(pendingPath);
      setPendingPath(null);
    }
  }, [onSave, navigate, pendingPath]);

  const handleDiscard = useCallback(() => {
    setShowDialog(false);
    if (pendingPath) {
      // We need to clear dirty state before navigating
      navigate(pendingPath);
      setPendingPath(null);
    }
  }, [navigate, pendingPath]);

  const handleCancel = useCallback(() => {
    setShowDialog(false);
    setPendingPath(null);
  }, []);

  if (!showDialog) return null;

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. Do you want to save before leaving?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={handleDiscard}
          >
            Discard &amp; Continue
          </Button>
          <Button onClick={handleSave}>
            Save &amp; Continue
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
