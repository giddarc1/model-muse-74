import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, X, CheckCircle, XCircle } from 'lucide-react';
import type { RoutingEntry } from '@/stores/modelStore';

interface InlineRoutingEditorProps {
  opName: string;
  routes: RoutingEntry[];
  allOpNames: string[]; // user ops (excluding DOCK, STOCK, SCRAP)
  onAddRoute: (toOpName: string, pct: number) => void;
  onUpdateRoute: (routeId: string, data: Partial<RoutingEntry>) => void;
  onDeleteRoute: (routeId: string) => void;
  colSpan: number;
}

export function InlineRoutingEditor({
  opName,
  routes,
  allOpNames,
  onAddRoute,
  onUpdateRoute,
  onDeleteRoute,
  colSpan,
}: InlineRoutingEditorProps) {
  const [newTo, setNewTo] = useState('');
  const [newPct, setNewPct] = useState(100);

  const total = routes.reduce((s, r) => s + r.pct_routed, 0);
  const totalOk = Math.abs(total - 100) < 0.01;

  // Build destination options: user ops (excluding self and DOCK) + STOCK/SCRAP
  const destOptions = allOpNames.filter(n => n !== opName && n !== 'DOCK');

  const handleAdd = () => {
    if (!newTo) return;
    onAddRoute(newTo, newPct);
    setNewTo('');
    setNewPct(100);
  };

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="mx-4 my-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Routing from {opName}
          </div>

          {routes.length === 0 && (
            <p className="text-xs text-muted-foreground mb-2">No outgoing paths defined.</p>
          )}

          <div className="space-y-1.5">
            {routes.map(r => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6 shrink-0">To:</span>
                <Select value={r.to_op_name} onValueChange={v => onUpdateRoute(r.id, { to_op_name: v })}>
                  <SelectTrigger className="h-7 w-36 font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {destOptions.filter(n => n !== 'STOCK' && n !== 'SCRAP').map(n => (
                      <SelectItem key={n} value={n} className="font-mono text-xs">{n}</SelectItem>
                    ))}
                    <Separator className="my-1" />
                    <SelectItem value="STOCK" className="font-mono text-xs text-emerald-600">
                      STOCK — finished goods
                    </SelectItem>
                    <SelectItem value="SCRAP" className="font-mono text-xs text-destructive">
                      SCRAP — defective, removed
                    </SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground shrink-0">%:</span>
                <Input
                  type="number"
                  className="h-7 w-16 font-mono text-xs"
                  value={r.pct_routed}
                  onChange={e => onUpdateRoute(r.id, { pct_routed: +e.target.value })}
                />
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => onDeleteRoute(r.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {/* Total line */}
          {routes.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border">
              {totalOk ? (
                <CheckCircle className="h-3 w-3 text-emerald-600" />
              ) : (
                <XCircle className="h-3 w-3 text-destructive" />
              )}
              <span className={`text-xs font-mono font-medium ${totalOk ? 'text-emerald-600' : 'text-destructive'}`}>
                Total: {total}%
              </span>
            </div>
          )}

          {/* Add path row */}
          <div className="flex items-center gap-2 mt-2">
            <Select value={newTo} onValueChange={setNewTo}>
              <SelectTrigger className="h-7 w-36 font-mono text-xs">
                <SelectValue placeholder="Add path to…" />
              </SelectTrigger>
              <SelectContent>
                {destOptions.filter(n => n !== 'STOCK' && n !== 'SCRAP').map(n => (
                  <SelectItem key={n} value={n} className="font-mono text-xs">{n}</SelectItem>
                ))}
                <Separator className="my-1" />
                <SelectItem value="STOCK" className="font-mono text-xs text-emerald-600">
                  STOCK — finished goods
                </SelectItem>
                <SelectItem value="SCRAP" className="font-mono text-xs text-destructive">
                  SCRAP — defective, removed
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              className="h-7 w-16 font-mono text-xs"
              value={newPct}
              onChange={e => setNewPct(+e.target.value)}
              placeholder="%"
            />
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleAdd} disabled={!newTo}>
              <Plus className="h-3 w-3" /> Add path
            </Button>
          </div>
        </div>
      </td>
    </tr>
  );
}
