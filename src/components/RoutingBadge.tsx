import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import type { RoutingEntry } from '@/stores/modelStore';

interface RoutingBadgeProps {
  opName: string;
  routes: RoutingEntry[];
  isExpanded: boolean;
  onClick: () => void;
}

export function RoutingBadge({ opName, routes, isExpanded, onClick }: RoutingBadgeProps) {
  const total = routes.reduce((s, r) => s + r.pct_routed, 0);

  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline';
  let content: React.ReactNode;

  if (routes.length === 0) {
    // No routing
    content = (
      <span className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> No routing
      </span>
    );
    variant = 'outline';
  } else if (Math.abs(total - 100) > 0.01) {
    // % doesn't sum to 100
    content = (
      <span className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> {total}% — must be 100%
      </span>
    );
    variant = 'destructive';
  } else if (routes.length === 1) {
    content = <span>→ {routes[0].to_op_name}</span>;
    variant = 'default';
  } else {
    content = <span>→ {routes.length} paths</span>;
    variant = 'secondary';
  }

  // Custom color classes based on state
  const colorClasses =
    routes.length === 0
      ? 'bg-amber-500/15 text-amber-700 border-amber-300 hover:bg-amber-500/25'
      : variant === 'destructive'
        ? 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25'
        : routes.length === 1
          ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300 hover:bg-emerald-500/25'
          : 'bg-blue-500/15 text-blue-700 border-blue-300 hover:bg-blue-500/25';

  return (
    <Badge
      variant="outline"
      className={`cursor-pointer font-mono text-[11px] px-2 py-0.5 transition-colors ${colorClasses} ${isExpanded ? 'ring-2 ring-primary/30' : ''}`}
      onClick={onClick}
    >
      {content}
    </Badge>
  );
}
