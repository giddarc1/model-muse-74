import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { Model, Operation } from '@/stores/modelStore';
import type { CalcResults, EquipmentResult } from '@/lib/calculationEngine';

interface Props {
  model: Model;
  results: CalcResults | undefined;
}

function getUtilColor(util: number, wip?: number): string {
  if (util >= 90) return wip && wip > 100 ? 'bg-red-900 text-red-100' : 'bg-red-600 text-white';
  if (util >= 80) return 'bg-orange-500 text-white';
  if (util >= 65) return 'bg-yellow-400 text-yellow-900';
  if (util > 0) return 'bg-emerald-500/80 text-white';
  return 'bg-muted text-muted-foreground';
}

export function BottleneckRadar({ model, results }: Props) {
  const [highlightedEqId, setHighlightedEqId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ eqId: string; prodId: string } | null>(null);

  const equipWithOps = useMemo(() => {
    return model.equipment.filter(eq =>
      model.operations.some(op => op.equip_id === eq.id)
    );
  }, [model]);

  const productsWithDemand = useMemo(() => {
    return model.products.filter(p => p.demand > 0);
  }, [model]);

  // Build utilization contribution matrix: equipment × product
  const utilMatrix = useMemo(() => {
    if (!results) return new Map<string, Map<string, number>>();
    const matrix = new Map<string, Map<string, number>>();

    equipWithOps.forEach(eq => {
      const eqResult = results.equipment.find(e => e.id === eq.id);
      if (!eqResult) return;
      const prodMap = new Map<string, number>();

      productsWithDemand.forEach(product => {
        const ops = model.operations.filter(o => o.equip_id === eq.id && o.product_id === product.id);
        if (ops.length === 0) { prodMap.set(product.id, 0); return; }

        // Approximate contribution: proportional share of total util
        const totalOpsAtEq = model.operations.filter(o => o.equip_id === eq.id);
        const totalRunTime = totalOpsAtEq.reduce((s, o) => s + o.equip_run_piece * product.lot_size + o.equip_setup_lot, 0);
        const thisRunTime = ops.reduce((s, o) => s + o.equip_run_piece * product.lot_size + o.equip_setup_lot, 0);
        const fraction = totalRunTime > 0 ? thisRunTime / totalRunTime : 0;
        const contribution = (eqResult.setupUtil + eqResult.runUtil) * fraction;
        prodMap.set(product.id, contribution);
      });

      matrix.set(eq.id, prodMap);
    });

    return matrix;
  }, [results, equipWithOps, productsWithDemand, model.operations]);

  // Top 5 bottlenecks
  const topBottlenecks = useMemo(() => {
    if (!results) return [];
    return [...results.equipment]
      .filter(e => e.totalUtil > 0)
      .sort((a, b) => b.totalUtil - a.totalUtil)
      .slice(0, 5);
  }, [results]);

  // Selected cell operation detail
  const selectedOp = useMemo(() => {
    if (!selectedCell) return null;
    return model.operations.find(
      o => o.equip_id === selectedCell.eqId && o.product_id === selectedCell.prodId
    ) || null;
  }, [selectedCell, model.operations]);

  if (!results) {
    return <p className="text-muted-foreground italic">Run a calculation first to see bottleneck data.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Top 5 Bottlenecks card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top 5 Bottlenecks</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="space-y-1">
            {topBottlenecks.map((eq, i) => {
              const pressureLabel = eq.totalUtil >= 90 ? ' — High queue pressure' : '';
              return (
                <button
                  key={eq.id}
                  onClick={() => setHighlightedEqId(eq.id === highlightedEqId ? null : eq.id)}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors hover:bg-accent/50 ${
                    highlightedEqId === eq.id ? 'bg-accent text-accent-foreground' : ''
                  }`}
                >
                  <span className="font-mono text-muted-foreground w-5">{i + 1}.</span>
                  <span className="font-medium">{eq.name}</span>
                  <span className="text-muted-foreground">— {eq.totalUtil}% utilization{pressureLabel}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Utilization Heatmap — Equipment × Product</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pb-3">
          <table className="min-w-max text-xs">
            <thead>
              <tr>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground sticky left-0 bg-card z-10">Equipment</th>
                {productsWithDemand.map(p => (
                  <th key={p.id} className="px-2 py-1.5 font-medium text-muted-foreground text-center">{p.name}</th>
                ))}
                <th className="px-2 py-1.5 font-medium text-muted-foreground text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {equipWithOps.map(eq => {
                const eqResult = results.equipment.find(e => e.id === eq.id);
                const isHighlighted = highlightedEqId === eq.id;
                return (
                  <tr key={eq.id} className={isHighlighted ? 'ring-2 ring-primary ring-inset' : ''}>
                    <td className="px-2 py-1.5 font-mono font-medium sticky left-0 bg-card z-10">{eq.name}</td>
                    {productsWithDemand.map(p => {
                      const val = utilMatrix.get(eq.id)?.get(p.id) || 0;
                      const isSelected = selectedCell?.eqId === eq.id && selectedCell?.prodId === p.id;
                      return (
                        <td
                          key={p.id}
                          onClick={() => setSelectedCell(val > 0 ? { eqId: eq.id, prodId: p.id } : null)}
                          className={`px-2 py-1.5 text-center font-mono cursor-pointer transition-all ${getUtilColor(val)} ${
                            isSelected ? 'ring-2 ring-primary' : ''
                          } ${val > 0 ? 'hover:opacity-80' : ''}`}
                        >
                          {val > 0.1 ? val.toFixed(1) : '—'}
                        </td>
                      );
                    })}
                    <td className={`px-2 py-1.5 text-center font-mono font-semibold ${getUtilColor(eqResult?.totalUtil || 0)}`}>
                      {eqResult?.totalUtil.toFixed(1) || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Inline operation detail panel */}
      {selectedCell && selectedOp && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Operation: {selectedOp.op_name} — {model.products.find(p => p.id === selectedOp.product_id)?.name} @ {model.equipment.find(e => e.id === selectedOp.equip_id)?.name}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedCell(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <FieldDisplay label="E.Setup/Lot" value={selectedOp.equip_setup_lot} />
              <FieldDisplay label="E.Run/Pc" value={selectedOp.equip_run_piece} />
              <FieldDisplay label="L.Setup/Lot" value={selectedOp.labor_setup_lot} />
              <FieldDisplay label="L.Run/Pc" value={selectedOp.labor_run_piece} />
              <FieldDisplay label="% Assigned" value={selectedOp.pct_assigned} />
              <FieldDisplay label="Op Number" value={selectedOp.op_number} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FieldDisplay({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="font-mono font-medium">{value}</div>
    </div>
  );
}
