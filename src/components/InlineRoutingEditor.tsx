import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { RoutingEntry } from '@/stores/modelStore';

/** Percentage input that uses local state and only commits on blur/Enter */
function PctInput({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  const [local, setLocal] = useState(String(value));
  const committed = useRef(value);
  useEffect(() => { setLocal(String(value)); committed.current = value; }, [value]);
  const commit = () => {
    const n = +local;
    if (!isNaN(n) && n !== committed.current) {
      committed.current = n;
      onChange(n);
    }
  };
  return (
    <Input
      type="number"
      className={className}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } }}
    />
  );
}
interface InlineRoutingEditorProps {
  opName: string;
  routes: RoutingEntry[];
  allOpNames: string[]; // user ops (excluding DOCK, STOCK, SCRAP)
  onAddRoute: (toOpName: string, pct: number) => void;
  onUpdateRoute: (routeId: string, data: Partial<RoutingEntry>) => void;
  onDeleteRoute: (routeId: string) => void;
  colSpan: number;
  hideDelete?: boolean; // true for DOCK routes — no individual delete allowed
}

export function InlineRoutingEditor({
  opName,
  routes,
  allOpNames,
  onAddRoute,
  onUpdateRoute,
  onDeleteRoute,
  colSpan,
  hideDelete = false,
}: InlineRoutingEditorProps) {
  const [newTo, setNewTo] = useState('');
  const [newPct, setNewPct] = useState(100);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Escape key to cancel routing delete confirmation
  useEffect(() => {
    if (!confirmingDeleteId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmingDeleteId(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirmingDeleteId]);

  const total = routes.reduce((s, r) => s + r.pct_routed, 0);
  const totalOk = Math.abs(total - 100) < 0.01;
  const addDisabled = total >= 100;

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
            {routes.map(r => {
              const isConfirmingThis = confirmingDeleteId === r.id;
              return isConfirmingThis ? (
                <div key={r.id} className="flex items-center gap-2 rounded px-2 py-1 bg-destructive/10">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  <span className="text-xs text-destructive font-medium flex-1">
                    Delete this route from {opName} to {r.to_op_name}?
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setConfirmingDeleteId(null)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" size="sm" className="h-6 text-[11px] px-2" onClick={() => { onDeleteRoute(r.id); setConfirmingDeleteId(null); }}>
                    Delete
                  </Button>
                </div>
              ) : (
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
                <PctInput
                  className="h-7 w-16 font-mono text-xs"
                  value={r.pct_routed}
                  onChange={v => onUpdateRoute(r.id, { pct_routed: v })}
                />
                {!hideDelete && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => {
                  setConfirmingDeleteId(r.id);
                }}>
                  <X className="h-3 w-3" />
                </Button>
                )}
              </div>
              );
            })}
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
          <div className={`flex items-center gap-2 mt-2 ${addDisabled ? 'opacity-50' : ''}`}>
            <Select value={newTo} onValueChange={setNewTo} disabled={addDisabled}>
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
              disabled={addDisabled}
            />
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleAdd} disabled={!newTo || addDisabled}>
              <Plus className="h-3 w-3" /> Add path
            </Button>
          </div>
        </div>
      </td>
    </tr>
  );
}
