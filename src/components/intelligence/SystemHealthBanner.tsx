import { AlertTriangle, Zap, Clock } from 'lucide-react';
import type { Model } from '@/stores/modelStore';
import type { CalcResults } from '@/lib/calculationEngine';

interface Props {
  model: Model;
  results: CalcResults | undefined;
}

export function SystemHealthBanner({ model, results }: Props) {
  if (!results) {
    return (
      <div className="bg-muted border-b border-border px-4 py-3">
        <p className="text-sm text-muted-foreground italic">
          No calculation results available. Run a Full Calculate first.
        </p>
      </div>
    );
  }

  const avgUtil = results.equipment.length > 0
    ? results.equipment.reduce((s, e) => s + e.totalUtil, 0) / results.equipment.length
    : 0;

  const totalWip = results.products.reduce((s, p) => s + p.wip, 0);

  const avgMct = results.products.filter(p => p.mct > 0).length > 0
    ? results.products.filter(p => p.mct > 0).reduce((s, p) => s + p.mct, 0) / results.products.filter(p => p.mct > 0).length
    : 0;

  // Top bottleneck
  const topBottleneck = [...results.equipment].sort((a, b) => b.totalUtil - a.totalUtil)[0];

  // Biggest opportunity: find product with largest lot size that could be reduced
  const topOpp = [...results.products]
    .filter(p => p.demand > 0 && p.lotSize > 1)
    .sort((a, b) => b.wip - a.wip)[0];
  const oppText = topOpp ? `Reduce lot size for ${topOpp.name}` : 'No clear opportunity';

  const mctUnit = model.general.mct_time_unit || 'DAY';
  const stale = model.run_status === 'needs_recalc';

  return (
    <div className="bg-card border-b border-border px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <StatChip label="Avg Util" value={`${avgUtil.toFixed(1)}%`} />
      <StatChip label="Predicted MCT" value={`${avgMct.toFixed(2)} ${mctUnit.toLowerCase()}s`} />
      <StatChip label="Total WIP" value={totalWip.toLocaleString()} />

      {topBottleneck && (
        <span className="flex items-center gap-1 text-destructive font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          Top Bottleneck: {topBottleneck.name} — {topBottleneck.totalUtil}%
        </span>
      )}

      <span className="flex items-center gap-1 text-primary font-medium">
        <Zap className="h-3.5 w-3.5" />
        {oppText}
      </span>

      <span className={`ml-auto flex items-center gap-1 text-xs ${stale ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
        <Clock className="h-3 w-3" />
        {new Date(results.calculatedAt).toLocaleString()}
        {stale && ' (stale)'}
      </span>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}
