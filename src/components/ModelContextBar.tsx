import { useModelStore } from '@/stores/modelStore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Save, Download, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function ModelContextBar() {
  const model = useModelStore((s) => s.getActiveModel());
  const navigate = useNavigate();

  if (!model) return null;

  const statusConfig = {
    never_run: { label: 'Never Run', className: 'bg-muted text-muted-foreground' },
    current: { label: 'Results Current', className: 'bg-success text-success-foreground' },
    needs_recalc: { label: 'Recalc Needed', className: 'bg-warning text-warning-foreground' },
  };

  const status = statusConfig[model.run_status];

  return (
    <div className="h-11 bg-context-bar text-context-bar-foreground flex items-center px-4 gap-3 border-b border-sidebar-border shrink-0">
      <button
        onClick={() => { navigate('/library'); }}
        className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="font-medium truncate max-w-[200px]">{model.name}</span>
      </button>

      <div className="h-4 w-px bg-sidebar-border" />

      <Badge variant="outline" className="border-primary/40 text-primary text-xs font-mono">
        <CircleDot className="h-2.5 w-2.5 mr-1" />
        Basecase
      </Badge>

      <Badge className={`text-xs ${status.className}`}>
        {status.label}
      </Badge>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="ghost" className="h-7 text-xs text-context-bar-foreground hover:text-primary hover:bg-sidebar-accent">
          <Save className="h-3.5 w-3.5 mr-1" /> Save
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-context-bar-foreground hover:text-primary hover:bg-sidebar-accent">
          <Download className="h-3.5 w-3.5 mr-1" /> Export
        </Button>
        <Button size="sm" className="h-7 text-xs">
          <Play className="h-3.5 w-3.5 mr-1" /> Run
        </Button>
      </div>
    </div>
  );
}
