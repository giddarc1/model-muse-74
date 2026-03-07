import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeleteConfirmInlineProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  colSpan?: number;
}

export function DeleteConfirmInline({ message, onConfirm, onCancel, colSpan }: DeleteConfirmInlineProps) {
  // When used inside a table cell, we render just the content.
  // The parent TableRow/tr handles the red background.
  return (
    <div className="flex items-center gap-3 px-2 py-1">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
      <span className="text-sm text-destructive font-medium flex-1">{message}</span>
      <div className="flex gap-1.5 shrink-0">
        <Button variant="ghost" size="sm" className="h-7 text-xs px-3" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" className="h-7 text-xs px-3" onClick={onConfirm}>
          Delete
        </Button>
      </div>
    </div>
  );
}
