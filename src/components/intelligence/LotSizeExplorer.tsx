import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Save } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { calculate } from '@/lib/calculationEngine';
import { useScenarioStore } from '@/stores/scenarioStore';
import { toast } from '@/hooks/use-toast';
import type { Model } from '@/stores/modelStore';
import type { CalcResults } from '@/lib/calculationEngine';

interface Props {
  model: Model;
  results: CalcResults | undefined;
}

interface SweepPoint {
  lotSize: number;
  mct: number;
  wip: number;
  maxUtil: number;
}

export function LotSizeExplorer({ model, results }: Props) {
  const productsWithDemand = useMemo(() => model.products.filter(p => p.demand > 0), [model]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(productsWithDemand.map(p => p.id)));

  const createScenario = useScenarioStore(s => s.createScenario);
  const applyChange = useScenarioStore(s => s.applyScenarioChange);

  const toggleProduct = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Compute sweep data for each selected product
  const sweepData = useMemo(() => {
    const data = new Map<string, { points: SweepPoint[]; optimal: number; rangeMin: number; rangeMax: number }>();

    productsWithDemand.forEach(product => {
      if (!selectedIds.has(product.id)) return;

      const currentLot = product.lot_size;
      const minLot = Math.max(1, Math.round(currentLot * 0.25));
      const maxLot = Math.round(currentLot * 3);
      const steps = 16;
      const stepSize = Math.max(1, Math.round((maxLot - minLot) / steps));

      const points: SweepPoint[] = [];
      let bestWip = Infinity;
      let bestLot = currentLot;

      for (let lot = minLot; lot <= maxLot; lot += stepSize) {
        const trialModel = {
          ...model,
          products: model.products.map(p => p.id === product.id ? { ...p, lot_size: lot } : { ...p }),
        };
        const r = calculate(trialModel);
        const pr = r.products.find(p => p.id === product.id);
        const maxUtil = Math.max(...r.equipment.map(e => e.totalUtil));

        points.push({
          lotSize: lot,
          mct: pr?.mct || 0,
          wip: pr?.wip || 0,
          maxUtil,
        });

        if (pr && pr.wip < bestWip && maxUtil < model.general.util_limit) {
          bestWip = pr.wip;
          bestLot = lot;
        }
      }

      const margin = Math.round(bestLot * 0.15);
      data.set(product.id, {
        points,
        optimal: bestLot,
        rangeMin: Math.max(1, bestLot - margin),
        rangeMax: bestLot + margin,
      });
    });

    return data;
  }, [model, selectedIds, productsWithDemand]);

  const applyAsWhatIf = async () => {
    const scenarioId = await createScenario(model.id, `Lot Size Sweep — ${new Date().toLocaleDateString()}`);
    sweepData.forEach((sweep, prodId) => {
      const product = model.products.find(p => p.id === prodId);
      if (product && sweep.optimal !== product.lot_size) {
        applyChange(scenarioId, 'Product', prodId, product.name, 'lot_size', 'Lot Size', sweep.optimal);
      }
    });
    toast({ title: 'What-If Created', description: 'Selected lot sizes saved as a new What-If scenario.' });
  };

  const mctUnit = model.general.mct_time_unit?.toLowerCase() || 'day';

  if (!results) {
    return <p className="text-muted-foreground italic">Run a calculation first to use the Lot Size Explorer.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Product selector */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Select Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {productsWithDemand.map(p => (
              <label key={p.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox
                  checked={selectedIds.has(p.id)}
                  onCheckedChange={() => toggleProduct(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts per product */}
      {productsWithDemand.filter(p => selectedIds.has(p.id)).map(product => {
        const sweep = sweepData.get(product.id);
        if (!sweep) return null;

        return (
          <Card key={product.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {product.name} — Current: {product.lot_size} | Optimal: {sweep.optimal}
                <span className="text-muted-foreground text-xs ml-2">
                  (range: {sweep.rangeMin}–{sweep.rangeMax})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sweep.points} margin={{ top: 5, right: 40, bottom: 20, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="lotSize" label={{ value: 'Lot Size', position: 'insideBottom', offset: -10 }} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" label={{ value: `MCT (${mctUnit}s)`, angle: -90, position: 'insideLeft' }} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'WIP', angle: 90, position: 'insideRight' }} tick={{ fontSize: 11 }} />

                    {/* Optimal range highlight */}
                    <ReferenceArea
                      yAxisId="left"
                      x1={sweep.rangeMin}
                      x2={sweep.rangeMax}
                      fill="hsl(var(--success))"
                      fillOpacity={0.1}
                    />

                    {/* Current lot size */}
                    <ReferenceLine
                      yAxisId="left"
                      x={product.lot_size}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="5 5"
                      label={{ value: 'Current', position: 'top', fontSize: 10 }}
                    />

                    {/* Util limit breach line */}
                    {sweep.points.some(p => p.maxUtil >= model.general.util_limit) && (
                      <ReferenceLine
                        yAxisId="left"
                        x={sweep.points.find(p => p.maxUtil >= model.general.util_limit)?.lotSize}
                        stroke="hsl(var(--destructive))"
                        strokeDasharray="3 3"
                        label={{ value: '⚠ Util Limit', position: 'top', fontSize: 10 }}
                      />
                    )}

                    <Line yAxisId="left" type="monotone" dataKey="mct" stroke="hsl(var(--info))" strokeWidth={2} dot={false} name="MCT" />
                    <Line yAxisId="right" type="monotone" dataKey="wip" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} name="WIP" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[hsl(var(--info))] inline-block" /> MCT</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[hsl(var(--warning))] inline-block" /> WIP</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t border-dashed border-muted-foreground inline-block" /> Current</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[hsl(var(--success))]/10 inline-block rounded-sm" /> Optimal Range</span>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {selectedIds.size > 0 && (
        <div className="flex justify-end">
          <Button onClick={applyAsWhatIf} className="bg-primary text-primary-foreground">
            <Save className="h-4 w-4 mr-1" /> Apply as What-If
          </Button>
        </div>
      )}
    </div>
  );
}
