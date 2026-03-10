import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Save } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { calculate } from '@/lib/calculationEngine';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useModelStore } from '@/stores/modelStore';
import { toast } from '@/hooks/use-toast';
import type { Model } from '@/stores/modelStore';
import type { CalcResults } from '@/lib/calculationEngine';

interface Props {
  model: Model;
  results: CalcResults | undefined;
}

interface ProductConfig {
  id: string;
  name: string;
  importance: number;
  optimizeLot: boolean;
  optimizeTBatch: boolean;
  currentLotSize: number;
  currentTBatch: number;
  recommendedLotSize: number;
  recommendedTBatch: number;
  lotRange: [number, number];
  tbatchRange: [number, number];
}

interface OptimizerResult {
  before: { avgMct: number; totalWip: number; bottleneckUtil: number };
  after: { avgMct: number; totalWip: number; bottleneckUtil: number };
  convergence: { iteration: number; wip: number }[];
  configs: ProductConfig[];
}

export function GlobalOptimizer({ model, results }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [configs, setConfigs] = useState<ProductConfig[]>(() =>
    model.products.filter(p => p.demand > 0).map(p => ({
      id: p.id,
      name: p.name,
      importance: 1,
      optimizeLot: true,
      optimizeTBatch: false,
      currentLotSize: p.lot_size,
      currentTBatch: p.tbatch_size,
      recommendedLotSize: p.lot_size,
      recommendedTBatch: p.tbatch_size,
      lotRange: [p.lot_size, p.lot_size],
      tbatchRange: [p.tbatch_size, p.tbatch_size],
    }))
  );
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [optimizerResult, setOptimizerResult] = useState<OptimizerResult | null>(null);

  const createScenario = useScenarioStore(s => s.createScenario);
  const applyChange = useScenarioStore(s => s.applyScenarioChange);

  const updateConfig = (id: string, patch: Partial<ProductConfig>) => {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const selectAllLot = (val: boolean) => setConfigs(prev => prev.map(c => ({ ...c, optimizeLot: val })));
  const selectAllTBatch = (val: boolean) => setConfigs(prev => prev.map(c => ({ ...c, optimizeTBatch: val })));

  const runOptimizer = useCallback(async () => {
    setRunning(true);
    setProgress(0);
    const convergence: { iteration: number; wip: number }[] = [];
    const maxIter = 30;

    // Before metrics
    const beforeResults = results || calculate(model);
    const beforeAvgMct = beforeResults.products.filter(p => p.mct > 0).reduce((s, p) => s + p.mct, 0) / Math.max(1, beforeResults.products.filter(p => p.mct > 0).length);
    const beforeWip = beforeResults.products.reduce((s, p) => s + p.wip, 0);
    const beforeBottleneck = Math.max(...beforeResults.equipment.map(e => e.totalUtil));

    // Hill-climbing optimization
    let bestModel = { ...model, products: model.products.map(p => ({ ...p })) };
    let bestWip = beforeWip;
    convergence.push({ iteration: 0, wip: beforeWip });

    for (let iter = 1; iter <= maxIter; iter++) {
      // Try adjusting lot sizes/tbatch sizes
      const trialModel = { ...bestModel, products: bestModel.products.map(p => ({ ...p })) };
      
      configs.forEach(cfg => {
        const prod = trialModel.products.find(p => p.id === cfg.id);
        if (!prod) return;

        if (cfg.optimizeLot) {
          const adjustment = 1 + (Math.random() - 0.6) * 0.25; // bias toward reduction
          const newLot = Math.max(1, Math.round(prod.lot_size * adjustment));
          prod.lot_size = newLot;
        }
        if (cfg.optimizeTBatch && prod.tbatch_size > 0) {
          const adjustment = 1 + (Math.random() - 0.6) * 0.25;
          const newTB = Math.max(1, Math.round(prod.tbatch_size * adjustment));
          prod.tbatch_size = newTB;
        }
      });

      const trialResults = calculate(trialModel);
      const trialWip = trialResults.products.reduce((s, p) => s + p.wip, 0);
      const trialMaxUtil = Math.max(...trialResults.equipment.map(e => e.totalUtil));

      // Accept if WIP improves and doesn't breach util limit
      if (trialWip < bestWip && trialMaxUtil < model.general.util_limit) {
        bestModel = trialModel;
        bestWip = trialWip;
      }

      convergence.push({ iteration: iter, wip: bestWip });
      setProgress(Math.round((iter / maxIter) * 100));

      // Yield to UI
      await new Promise(r => setTimeout(r, 50));
    }

    // Compute after metrics
    const afterResults = calculate(bestModel);
    const afterAvgMct = afterResults.products.filter(p => p.mct > 0).reduce((s, p) => s + p.mct, 0) / Math.max(1, afterResults.products.filter(p => p.mct > 0).length);
    const afterWip = afterResults.products.reduce((s, p) => s + p.wip, 0);
    const afterBottleneck = Math.max(...afterResults.equipment.map(e => e.totalUtil));

    // Update configs with recommendations
    const updatedConfigs = configs.map(cfg => {
      const optimized = bestModel.products.find(p => p.id === cfg.id);
      const recLot = optimized?.lot_size || cfg.currentLotSize;
      const recTB = optimized?.tbatch_size || cfg.currentTBatch;
      const lotMargin = Math.round(recLot * 0.15);
      const tbMargin = Math.round(Math.abs(recTB) * 0.15);
      return {
        ...cfg,
        recommendedLotSize: recLot,
        recommendedTBatch: recTB,
        lotRange: [Math.max(1, recLot - lotMargin), recLot + lotMargin] as [number, number],
        tbatchRange: [Math.max(-1, recTB - tbMargin), recTB + tbMargin] as [number, number],
      };
    });

    setOptimizerResult({
      before: { avgMct: beforeAvgMct, totalWip: beforeWip, bottleneckUtil: beforeBottleneck },
      after: { avgMct: afterAvgMct, totalWip: afterWip, bottleneckUtil: afterBottleneck },
      convergence,
      configs: updatedConfigs,
    });
    setConfigs(updatedConfigs);
    setRunning(false);
    setStep(3);
  }, [model, results, configs]);

  const applyAsWhatIf = async () => {
    if (!optimizerResult) return;
    const scenarioId = await createScenario(model.id, `Optimized Lot Sizes — ${new Date().toLocaleDateString()}`);
    optimizerResult.configs.forEach(cfg => {
      if (cfg.optimizeLot && cfg.recommendedLotSize !== cfg.currentLotSize) {
        applyChange(scenarioId, 'Product', cfg.id, cfg.name, 'lot_size', 'Lot Size', cfg.recommendedLotSize);
      }
      if (cfg.optimizeTBatch && cfg.recommendedTBatch !== cfg.currentTBatch) {
        applyChange(scenarioId, 'Product', cfg.id, cfg.name, 'tbatch_size', 'TBatch Size', cfg.recommendedTBatch);
      }
    });
    toast({ title: 'What-If Created', description: 'Optimized lot sizes saved as a new What-If scenario.' });
  };

  const mctUnit = model.general.mct_time_unit?.toLowerCase() || 'day';

  return (
    <div className="space-y-4">
      {/* Step 1 — Setup */}
      {step === 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Step 1 — Configure Optimization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <Button variant="outline" size="sm" onClick={() => selectAllLot(true)}>Select All Lot</Button>
              <Button variant="outline" size="sm" onClick={() => selectAllLot(false)}>Deselect All Lot</Button>
              <Button variant="outline" size="sm" onClick={() => selectAllTBatch(true)}>Select All TBatch</Button>
              <Button variant="outline" size="sm" onClick={() => selectAllTBatch(false)}>Deselect All TBatch</Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Importance (0.1–10)</TableHead>
                    <TableHead className="text-center">Optimize Lot Size</TableHead>
                    <TableHead className="text-center">Optimize TBatch</TableHead>
                    <TableHead className="text-right">Current Lot</TableHead>
                    <TableHead className="text-right">Current TBatch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map(cfg => (
                    <TableRow key={cfg.id}>
                      <TableCell className="font-medium">{cfg.name}</TableCell>
                      <TableCell className="w-48">
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[cfg.importance]}
                            min={0.1}
                            max={10}
                            step={0.1}
                            onValueChange={([v]) => updateConfig(cfg.id, { importance: v })}
                            className="flex-1"
                          />
                          <span className="font-mono text-xs w-8 text-right">{cfg.importance.toFixed(1)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={cfg.optimizeLot}
                          onCheckedChange={(v) => updateConfig(cfg.id, { optimizeLot: !!v })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={cfg.optimizeTBatch}
                          onCheckedChange={(v) => updateConfig(cfg.id, { optimizeTBatch: !!v })}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">{cfg.currentLotSize}</TableCell>
                      <TableCell className="text-right font-mono">{cfg.currentTBatch === -1 ? 'Auto' : cfg.currentTBatch}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => { setStep(2); runOptimizer(); }} className="bg-primary text-primary-foreground">
                <Play className="h-4 w-4 mr-1" /> Run Optimizer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Running */}
      {step === 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Step 2 — Optimizing…</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="mb-4" />
            <p className="text-sm text-muted-foreground mb-4">{progress}% complete</p>
            {optimizerResult && optimizerResult.convergence.length > 0 && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={optimizerResult.convergence}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="iteration" label={{ value: 'Iteration', position: 'insideBottom', offset: -5 }} className="text-xs" />
                    <YAxis label={{ value: 'Total WIP', angle: -90, position: 'insideLeft' }} className="text-xs" />
                    <Line type="monotone" dataKey="wip" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Results */}
      {step === 3 && optimizerResult && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Step 3 — Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Current Lot</TableHead>
                      <TableHead className="text-right">Recommended Lot</TableHead>
                      <TableHead className="text-right">Acceptable Range</TableHead>
                      <TableHead className="text-right">Current TBatch</TableHead>
                      <TableHead className="text-right">Recommended TBatch</TableHead>
                      <TableHead className="text-right">Acceptable Range</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {optimizerResult.configs.map(cfg => (
                      <TableRow key={cfg.id}>
                        <TableCell className="font-medium">{cfg.name}</TableCell>
                        <TableCell className="text-right font-mono">{cfg.currentLotSize}</TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${cfg.recommendedLotSize !== cfg.currentLotSize ? 'text-primary' : ''}`}>
                          {cfg.recommendedLotSize}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground text-xs">
                          {cfg.lotRange[0]}–{cfg.lotRange[1]}
                        </TableCell>
                        <TableCell className="text-right font-mono">{cfg.currentTBatch === -1 ? 'Auto' : cfg.currentTBatch}</TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${cfg.recommendedTBatch !== cfg.currentTBatch ? 'text-primary' : ''}`}>
                          {cfg.recommendedTBatch === -1 ? 'Auto' : cfg.recommendedTBatch}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground text-xs">
                          {cfg.tbatchRange[0]}–{cfg.tbatchRange[1]}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Summary comparison */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono">
                <div className="space-y-1">
                  <p className="text-muted-foreground font-sans font-medium text-xs uppercase tracking-wider">Before</p>
                  <p>Avg MCT: {optimizerResult.before.avgMct.toFixed(2)} {mctUnit}s</p>
                  <p>Total WIP: {optimizerResult.before.totalWip.toLocaleString()}</p>
                  <p>Bottleneck util: {optimizerResult.before.bottleneckUtil.toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground font-sans font-medium text-xs uppercase tracking-wider">After</p>
                  <p className="text-primary font-semibold">
                    Avg MCT: {optimizerResult.after.avgMct.toFixed(2)} {mctUnit}s
                    ({((optimizerResult.after.avgMct - optimizerResult.before.avgMct) / optimizerResult.before.avgMct * 100).toFixed(0)}%)
                  </p>
                  <p className="text-primary font-semibold">
                    Total WIP: {optimizerResult.after.totalWip.toLocaleString()}
                    ({((optimizerResult.after.totalWip - optimizerResult.before.totalWip) / optimizerResult.before.totalWip * 100).toFixed(0)}%)
                  </p>
                  <p className="text-primary font-semibold">
                    Bottleneck util: {optimizerResult.after.bottleneckUtil.toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={applyAsWhatIf} className="bg-primary text-primary-foreground">
                  <Save className="h-4 w-4 mr-1" /> Apply as What-If
                </Button>
                <Button variant="outline" onClick={() => setStep(1)}>Re-configure</Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
