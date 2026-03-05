import { useState, useMemo, useCallback } from 'react';
import { useModelStore, type Model } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useResultsStore } from '@/stores/resultsStore';
import { type CalcResults, type ProductResult, type EquipmentResult, calculate } from '@/lib/calculationEngine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Play, CheckCircle, AlertTriangle, Shield, XCircle, RotateCcw, Network, Gauge, ListChecks, RefreshCw, Clock,
  TrendingUp, BarChart3, Settings2, Square, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useRunCalculation, type RunMode } from '@/hooks/useRunCalculation';
import { useUserLevelStore, canAccess } from '@/hooks/useUserLevel';
import { scenarioDb } from '@/lib/scenarioDb';

// ── Scenario color palettes for grouped charts ──
const SCENARIO_PALETTES = [
  { setup: 'hsl(217, 91%, 75%)', run: 'hsl(217, 91%, 55%)', repair: 'hsl(217, 70%, 40%)', waitLabor: 'hsl(217, 60%, 30%)', unavail: 'hsl(217, 30%, 50%)', lotWait: 'hsl(217, 91%, 80%)', queue: 'hsl(217, 70%, 45%)', single: 'hsl(217, 91%, 60%)' },
  { setup: 'hsl(160, 60%, 70%)', run: 'hsl(160, 60%, 45%)', repair: 'hsl(160, 50%, 35%)', waitLabor: 'hsl(160, 40%, 25%)', unavail: 'hsl(160, 25%, 45%)', lotWait: 'hsl(160, 60%, 75%)', queue: 'hsl(160, 50%, 40%)', single: 'hsl(160, 60%, 45%)' },
  { setup: 'hsl(30, 90%, 75%)', run: 'hsl(30, 90%, 55%)', repair: 'hsl(30, 70%, 40%)', waitLabor: 'hsl(30, 60%, 30%)', unavail: 'hsl(30, 30%, 50%)', lotWait: 'hsl(30, 90%, 80%)', queue: 'hsl(30, 70%, 45%)', single: 'hsl(30, 90%, 55%)' },
  { setup: 'hsl(280, 60%, 75%)', run: 'hsl(280, 60%, 55%)', repair: 'hsl(280, 50%, 40%)', waitLabor: 'hsl(280, 40%, 30%)', unavail: 'hsl(280, 25%, 45%)', lotWait: 'hsl(280, 60%, 80%)', queue: 'hsl(280, 50%, 45%)', single: 'hsl(280, 60%, 55%)' },
  { setup: 'hsl(0, 70%, 75%)', run: 'hsl(0, 70%, 55%)', repair: 'hsl(0, 55%, 40%)', waitLabor: 'hsl(0, 45%, 30%)', unavail: 'hsl(0, 25%, 45%)', lotWait: 'hsl(0, 70%, 80%)', queue: 'hsl(0, 55%, 45%)', single: 'hsl(0, 70%, 55%)' },
];

// Single-scenario colors (legacy)
const chartColors = {
  setup: 'hsl(217, 91%, 60%)', run: 'hsl(142, 71%, 45%)',
  repair: 'hsl(0, 72%, 51%)', waitLabor: 'hsl(38, 92%, 50%)',
  unavail: 'hsl(220, 9%, 46%)', lotWait: 'hsl(270, 50%, 60%)', queue: 'hsl(0, 72%, 51%)',
};

type ScenarioEntry = { id: string; name: string; results: CalcResults };

function buildGroupedEquipData(scenarios: ScenarioEntry[]) {
  if (scenarios.length === 0) return { data: [], bars: [] };
  const names = scenarios[0].results.equipment.map(e => e.name);
  const data = names.map(name => {
    const row: Record<string, any> = { name };
    scenarios.forEach((s, i) => {
      const eq = s.results.equipment.find(e => e.name === name);
      const prefix = `s${i}_`;
      row[prefix + 'setup'] = eq?.setupUtil || 0;
      row[prefix + 'run'] = eq?.runUtil || 0;
      row[prefix + 'repair'] = eq?.repairUtil || 0;
      row[prefix + 'waitLabor'] = eq?.waitLaborUtil || 0;
    });
    return row;
  });
  const bars = scenarios.map((s, i) => ({
    prefix: `s${i}_`,
    stackId: `s${i}`,
    name: s.name,
    palette: SCENARIO_PALETTES[i % SCENARIO_PALETTES.length],
  }));
  return { data, bars };
}

function buildGroupedLaborData(scenarios: ScenarioEntry[]) {
  if (scenarios.length === 0) return { data: [], bars: [] };
  const names = scenarios[0].results.labor.map(l => l.name);
  const data = names.map(name => {
    const row: Record<string, any> = { name };
    scenarios.forEach((s, i) => {
      const l = s.results.labor.find(l => l.name === name);
      const prefix = `s${i}_`;
      row[prefix + 'setup'] = l?.setupUtil || 0;
      row[prefix + 'run'] = l?.runUtil || 0;
      row[prefix + 'unavail'] = l?.unavailPct || 0;
    });
    return row;
  });
  const bars = scenarios.map((s, i) => ({
    prefix: `s${i}_`,
    stackId: `s${i}`,
    name: s.name,
    palette: SCENARIO_PALETTES[i % SCENARIO_PALETTES.length],
  }));
  return { data, bars };
}

function buildGroupedProductMCTData(scenarios: ScenarioEntry[]) {
  if (scenarios.length === 0) return { data: [], bars: [] };
  const names = scenarios[0].results.products.map(p => p.name);
  const data = names.map(name => {
    const row: Record<string, any> = { name };
    scenarios.forEach((s, i) => {
      const p = s.results.products.find(p => p.name === name);
      const prefix = `s${i}_`;
      row[prefix + 'lotWait'] = p?.mctLotWait || 0;
      row[prefix + 'queue'] = p?.mctQueue || 0;
      row[prefix + 'waitLabor'] = p?.mctWaitLabor || 0;
      row[prefix + 'setup'] = p?.mctSetup || 0;
      row[prefix + 'run'] = p?.mctRun || 0;
    });
    return row;
  });
  const bars = scenarios.map((s, i) => ({
    prefix: `s${i}_`,
    stackId: `s${i}`,
    name: s.name,
    palette: SCENARIO_PALETTES[i % SCENARIO_PALETTES.length],
  }));
  return { data, bars };
}

function buildGroupedProductWIPData(scenarios: ScenarioEntry[]) {
  if (scenarios.length === 0) return { data: [], bars: [] };
  const names = scenarios[0].results.products.map(p => p.name);
  const data = names.map(name => {
    const row: Record<string, any> = { name };
    scenarios.forEach((s, i) => {
      const p = s.results.products.find(p => p.name === name);
      row[`s${i}_wip`] = p?.wip || 0;
    });
    return row;
  });
  const bars = scenarios.map((s, i) => ({
    prefix: `s${i}_`,
    stackId: `s${i}`,
    name: s.name,
    palette: SCENARIO_PALETTES[i % SCENARIO_PALETTES.length],
  }));
  return { data, bars };
}

const tooltipStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 };
const axisStyle = { fontSize: 11, fontFamily: 'JetBrains Mono' };

// Extended run mode type for advanced modes
type ExtendedRunMode = RunMode | 'product_inclusion' | 'max_throughput' | 'lot_size_range' | 'optimize_lots';

const STANDARD_MODES: { mode: ExtendedRunMode; icon: typeof Play; label: string; description: string }[] = [
  { mode: 'full', icon: Play, label: 'Full Calculate', description: 'Complete queuing analysis with utilization, MCT, WIP, and queue times.' },
  { mode: 'verify', icon: Shield, label: 'Verify Data Only', description: 'Validates input data for errors without running calculations.' },
  { mode: 'util_only', icon: Gauge, label: 'Utilization Only', description: 'Equipment and labor utilization only — faster for capacity exploration.' },
];

const SCENARIO_MODES: { mode: ExtendedRunMode; icon: typeof Play; label: string; description: string }[] = [
  { mode: 'product_inclusion', icon: ListChecks, label: 'Product Inclusion', description: 'Select which products to include. Saves as a What-If scenario.' },
  { mode: 'max_throughput', icon: TrendingUp, label: 'Max Throughput', description: 'Find the maximum achievable demand for a selected product.' },
];

const OPTIMIZATION_MODES: { mode: ExtendedRunMode; icon: typeof Play; label: string; description: string }[] = [
  { mode: 'lot_size_range', icon: BarChart3, label: 'Lot Size Range', description: 'Run a range of lot sizes and chart MCT vs lot size curve.' },
  { mode: 'optimize_lots', icon: Settings2, label: 'Optimize Lot Sizes', description: 'Minimize total WIP by iteratively adjusting lot sizes and transfer batches.' },
];

export default function RunResults() {
  const model = useModelStore(s => s.getActiveModel());
  const allScenarios = useScenarioStore(s => s.scenarios);
  const activeScenarioId = useScenarioStore(s => s.activeScenarioId);
  const displayIds = useScenarioStore(s => s.displayScenarioIds);
  const { getResults } = useResultsStore();
  const { userLevel } = useUserLevelStore();

  const { isRunning, runLog, verifyMessages, handleRun } = useRunCalculation();

  const [extRunMode, setExtRunMode] = useState<ExtendedRunMode>('full');
  const runMode: RunMode = (extRunMode === 'full' || extRunMode === 'verify' || extRunMode === 'util_only') ? extRunMode : 'full';
  const [transposed, setTransposed] = useState(false);
  const [ibomProduct, setIbomProduct] = useState('');

  // Advanced mode state — must be before early return
  const [piSelectedProducts, setPiSelectedProducts] = useState<Set<string>>(new Set(model?.products.map(p => p.id) || []));
  const [piScenarioName, setPiScenarioName] = useState('Product Inclusion');
  const [mtProduct, setMtProduct] = useState(model?.products[0]?.id || '');
  const [mtScenarioName, setMtScenarioName] = useState('');
  const [mtResult, setMtResult] = useState<{demand: number; limitingResource: string} | null>(null);
  const [lsrProduct, setLsrProduct] = useState(model?.products[0]?.id || '');
  const [lsrMin, setLsrMin] = useState(10);
  const [lsrMax, setLsrMax] = useState(200);
  const [lsrStep, setLsrStep] = useState(10);
  const [lsrResults, setLsrResults] = useState<{lotSize: number; mct: number}[]>([]);
  const [optProducts, setOptProducts] = useState<Set<string>>(new Set(model?.products.map(p => p.id) || []));
  const [optResult, setOptResult] = useState<{original: {name:string;lot:number;wip:number}[]; optimized: {name:string;lot:number;wip:number}[]; wipReduction: number} | null>(null);
  const [advProgress, setAdvProgress] = useState<{current:number; total:number; label:string} | null>(null);
  const [advRunning, setAdvRunning] = useState(false);

  const { createScenario } = useScenarioStore();
  const { setResults: setStoreResults } = useResultsStore();

  const activeScenario = model ? (allScenarios.find(s => s.id === activeScenarioId) || null) : null;
  const modelScenarios = model ? allScenarios.filter(s => s.modelId === model.id) : [];
  const resultKey = activeScenario ? activeScenario.id : 'basecase';
  const results = getResults(resultKey);
  const basecaseResults = getResults('basecase');
  const hasRun = !!results;

  // Build list of scenarios to display in charts
  const chartScenarios: ScenarioEntry[] = useMemo(() => {
    const entries: ScenarioEntry[] = [];
    if (basecaseResults) {
      entries.push({ id: 'basecase', name: 'Basecase', results: basecaseResults });
    }
    displayIds.forEach(id => {
      const sc = modelScenarios.find(s => s.id === id);
      const r = getResults(id);
      if (sc && r && id !== 'basecase') {
        entries.push({ id, name: sc.name, results: r });
      }
    });
    return entries;
  }, [basecaseResults, displayIds, modelScenarios, getResults]);

  const isMultiScenario = chartScenarios.length > 1;

  const displayScenarioResults = useMemo(() => displayIds
    .map(id => ({ id, scenario: modelScenarios.find(s => s.id === id), results: getResults(id) }))
    .filter(d => d.scenario && d.results) as { id: string; scenario: typeof modelScenarios[0]; results: CalcResults }[],
    [displayIds, modelScenarios, getResults]);

  // Single-scenario chart data
  const equipChartData = useMemo(() => results?.equipment.map(e => ({
    name: e.name, setup: e.setupUtil, run: e.runUtil, repair: e.repairUtil, waitLabor: e.waitLaborUtil,
  })) || [], [results]);

  const laborChartData = useMemo(() => results?.labor.map(l => ({
    name: l.name, setup: l.setupUtil, run: l.runUtil, unavail: l.unavailPct,
  })) || [], [results]);

  const productChartData = useMemo(() => results?.products.map(p => ({
    name: p.name, lotWait: p.mctLotWait, queue: p.mctQueue, waitLabor: p.mctWaitLabor, setup: p.mctSetup, run: p.mctRun,
  })) || [], [results]);

  // Grouped chart data
  const groupedEquip = useMemo(() => isMultiScenario ? buildGroupedEquipData(chartScenarios) : null, [isMultiScenario, chartScenarios]);
  const groupedLabor = useMemo(() => isMultiScenario ? buildGroupedLaborData(chartScenarios) : null, [isMultiScenario, chartScenarios]);
  const groupedMCT = useMemo(() => isMultiScenario ? buildGroupedProductMCTData(chartScenarios) : null, [isMultiScenario, chartScenarios]);
  const groupedWIP = useMemo(() => isMultiScenario ? buildGroupedProductWIPData(chartScenarios) : null, [isMultiScenario, chartScenarios]);

  const ibomSelectedProduct = ibomProduct || (model?.products.find(p => p.demand > 0)?.id || '');

  // Render a mode card
  const renderModeCard = (opt: {mode: ExtendedRunMode; icon: typeof Play; label: string; description: string}, isAdvancedOnly = false) => {
    const Icon = opt.icon;
    const isDisabled = isAdvancedOnly && userLevel !== 'advanced';
    const selected = !isDisabled && extRunMode === opt.mode;
    return (
      <button
        key={opt.label}
        onClick={() => !isDisabled && setExtRunMode(opt.mode)}
        disabled={isDisabled}
        className={`text-left p-3 rounded-lg border-2 transition-all ${
          isDisabled ? 'border-border opacity-50 cursor-not-allowed'
          : selected ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/40 hover:bg-accent/30'
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className={`h-4 w-4 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`text-sm font-medium ${selected ? 'text-primary' : ''}`}>{opt.label}</span>
          {isAdvancedOnly && userLevel !== 'advanced' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground">Advanced</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{opt.description}</p>
      </button>
    );
  };

  // Advanced run handlers
  const handleAdvancedRun = useCallback(async () => {
    if (!model || advRunning) return;

    if (extRunMode === 'product_inclusion') {
      const excluded = model.products.filter(p => !piSelectedProducts.has(p.id));
      if (excluded.length === 0) { handleRun('full'); return; }
      const scenarioId = await createScenario(model.id, piScenarioName || 'Product Inclusion');
      excluded.forEach(p => {
        useScenarioStore.getState().applyScenarioChange(scenarioId, 'Product Inclusion', p.id, p.name, 'included', 'Included in Run', 'No');
      });
      const scenario = useScenarioStore.getState().scenarios.find(s => s.id === scenarioId);
      if (scenario) {
        const calcResults = calculate(model, scenario);
        setStoreResults(scenarioId, calcResults);
        useScenarioStore.getState().markCalculated(scenarioId);
        scenarioDb.saveResults(scenarioId, calcResults);
      }
      toast.success(`Product Inclusion scenario saved with ${excluded.length} product(s) excluded`);
      return;
    }

    if (extRunMode === 'max_throughput') {
      setAdvRunning(true);
      const product = model.products.find(p => p.id === mtProduct);
      if (!product) { setAdvRunning(false); return; }
      let demand = product.demand > 0 ? product.demand : 100;
      let lastValidDemand = demand;
      let limitingResource = '';
      const step = Math.max(1, Math.round(demand * 0.1));
      let iterations = 0;
      const maxIter = 200;

      while (iterations < maxIter) {
        iterations++;
        setAdvProgress({ current: iterations, total: maxIter, label: `Testing demand: ${Math.round(demand)}` });
        const testModel = { ...model, products: model.products.map(p => p.id === mtProduct ? { ...p, demand } : p) };
        const r = calculate(testModel);
        if (r.overLimitResources.length > 0) {
          limitingResource = r.overLimitResources[0];
          // Binary search refinement
          let lo = lastValidDemand, hi = demand;
          for (let i = 0; i < 20; i++) {
            const mid = Math.round((lo + hi) / 2);
            const tr = calculate({ ...model, products: model.products.map(p => p.id === mtProduct ? { ...p, demand: mid } : p) });
            if (tr.overLimitResources.length > 0) { hi = mid; limitingResource = tr.overLimitResources[0]; }
            else { lo = mid; lastValidDemand = mid; }
            if (hi - lo <= 1) break;
          }
          break;
        }
        lastValidDemand = demand;
        demand += step;
        await new Promise(r => setTimeout(r, 0));
      }

      const name = mtScenarioName || `Max Throughput — ${product.name}`;
      const scenarioId = await createScenario(model.id, name);
      useScenarioStore.getState().applyScenarioChange(scenarioId, 'Product', mtProduct, product.name, 'demand', 'Demand', lastValidDemand);
      const scenario = useScenarioStore.getState().scenarios.find(s => s.id === scenarioId);
      if (scenario) {
        const r = calculate(model, scenario);
        setStoreResults(scenarioId, r);
        useScenarioStore.getState().markCalculated(scenarioId);
        scenarioDb.saveResults(scenarioId, r);
      }
      setMtResult({ demand: lastValidDemand, limitingResource });
      setAdvProgress(null);
      setAdvRunning(false);
      toast.success(`Max throughput for ${product.name}: ${lastValidDemand} units`);
      return;
    }

    if (extRunMode === 'lot_size_range') {
      setAdvRunning(true);
      const product = model.products.find(p => p.id === lsrProduct);
      if (!product) { setAdvRunning(false); return; }
      const steps: number[] = [];
      for (let ls = lsrMin; ls <= lsrMax; ls += lsrStep) steps.push(ls);
      const curResults: {lotSize: number; mct: number}[] = [];

      for (let i = 0; i < steps.length; i++) {
        setAdvProgress({ current: i + 1, total: steps.length, label: `Lot size: ${steps[i]}` });
        const testModel = { ...model, products: model.products.map(p => p.id === lsrProduct ? { ...p, lot_size: steps[i] } : p) };
        const r = calculate(testModel);
        const pr = r.products.find(p => p.id === lsrProduct);
        curResults.push({ lotSize: steps[i], mct: pr?.mct || 0 });

        const scName = `${product.name}-LotSize-${steps[i]}`;
        const scenarioId = await createScenario(model.id, scName);
        useScenarioStore.getState().applyScenarioChange(scenarioId, 'Product', lsrProduct, product.name, 'lot_size', 'Lot Size', steps[i]);
        const sc = useScenarioStore.getState().scenarios.find(s => s.id === scenarioId);
        if (sc) {
          setStoreResults(scenarioId, r);
          useScenarioStore.getState().markCalculated(scenarioId);
          scenarioDb.saveResults(scenarioId, r);
        }
        await new Promise(r => setTimeout(r, 0));
      }
      setLsrResults(curResults);
      setAdvProgress(null);
      setAdvRunning(false);
      toast.success(`Created ${steps.length} lot size scenarios for ${product.name}`);
      return;
    }

    if (extRunMode === 'optimize_lots') {
      setAdvRunning(true);
      const selectedProducts = model.products.filter(p => optProducts.has(p.id));
      if (selectedProducts.length === 0) { setAdvRunning(false); return; }

      const baseCalc = calculate(model);
      const original = selectedProducts.map(p => {
        const pr = baseCalc.products.find(pp => pp.id === p.id);
        return { name: p.name, lot: p.lot_size, wip: pr?.wip || 0 };
      });
      const baseWip = baseCalc.products.reduce((s, p) => s + p.wip, 0);

      let bestLots: Record<string,number> = {};
      selectedProducts.forEach(p => { bestLots[p.id] = p.lot_size; });
      let bestWip = baseWip;
      const maxIter = 50;

      for (let iter = 0; iter < maxIter; iter++) {
        setAdvProgress({ current: iter + 1, total: maxIter, label: `WIP: ${Math.round(bestWip)} (iter ${iter + 1})` });
        let improved = false;
        for (const p of selectedProducts) {
          for (const delta of [-Math.max(1, Math.round(bestLots[p.id] * 0.1)), Math.max(1, Math.round(bestLots[p.id] * 0.1))]) {
            const newLot = Math.max(1, bestLots[p.id] + delta);
            if (newLot === bestLots[p.id]) continue;
            const testModel = { ...model, products: model.products.map(pp => ({ ...pp, lot_size: bestLots[pp.id] !== undefined ? (pp.id === p.id ? newLot : bestLots[pp.id]) : pp.lot_size })) };
            const r = calculate(testModel);
            const totalWip = r.products.reduce((s, pp) => s + pp.wip, 0);
            if (totalWip < bestWip && r.overLimitResources.length === 0) {
              bestLots[p.id] = newLot;
              bestWip = totalWip;
              improved = true;
            }
          }
        }
        if (!improved) break;
        await new Promise(r => setTimeout(r, 0));
      }

      const scenarioId = await createScenario(model.id, 'Optimized Lot Sizes');
      for (const p of selectedProducts) {
        if (bestLots[p.id] !== p.lot_size) {
          useScenarioStore.getState().applyScenarioChange(scenarioId, 'Product', p.id, p.name, 'lot_size', 'Lot Size', bestLots[p.id]);
        }
      }
      const scenario = useScenarioStore.getState().scenarios.find(s => s.id === scenarioId);
      if (scenario) {
        const r = calculate(model, scenario);
        setStoreResults(scenarioId, r);
        useScenarioStore.getState().markCalculated(scenarioId);
        scenarioDb.saveResults(scenarioId, r);
        const optimized = selectedProducts.map(p => {
          const pr = r.products.find(pp => pp.id === p.id);
          return { name: p.name, lot: bestLots[p.id], wip: pr?.wip || 0 };
        });
        setOptResult({ original, optimized, wipReduction: Math.round((1 - bestWip / baseWip) * 1000) / 10 });
      }
      setAdvProgress(null);
      setAdvRunning(false);
      toast.success(`Optimization complete — WIP reduced by ${Math.round((1 - bestWip / baseWip) * 100)}%`);
      return;
    }
  }, [model, extRunMode, advRunning, piSelectedProducts, piScenarioName, mtProduct, mtScenarioName, lsrProduct, lsrMin, lsrMax, lsrStep, optProducts, createScenario, setStoreResults, handleRun]);

  const isAdvancedMode = ['product_inclusion', 'max_throughput', 'lot_size_range', 'optimize_lots'].includes(extRunMode);

  if (!model) return (
    <div className="p-6 space-y-4">
      <div className="h-7 w-48 bg-muted animate-pulse rounded" />
      <div className="h-4 w-64 bg-muted animate-pulse rounded" />
      <div className="h-48 bg-muted animate-pulse rounded-lg mt-4" />
    </div>
  );

  const scenarioLabel = activeScenario ? activeScenario.name : 'Basecase';
  const modeLabel = extRunMode === 'full' ? 'Run Full Calculate' : extRunMode === 'verify' ? 'Verify Data' : extRunMode === 'util_only' ? 'Calculate Utilization' : extRunMode === 'product_inclusion' ? 'Run Product Inclusion' : extRunMode === 'max_throughput' ? 'Find Max Throughput' : extRunMode === 'lot_size_range' ? 'Run Lot Size Range' : 'Run Optimize';

  return (
    <div className="p-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-0.5">Run Model</h1>
        <p className="text-sm text-muted-foreground">
          Active scenario: <span className="font-medium text-foreground">{scenarioLabel}</span>
        </p>
      </div>

      {/* ── Stale Results Banner ── */}
      {model.run_status === 'needs_recalc' && hasRun && (
        <div className="mb-4 flex items-center justify-between gap-2 p-3 bg-warning/10 border border-warning/30 rounded-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-sm text-warning font-medium">
              These results are from {model.last_run_at ? new Date(model.last_run_at).toLocaleString() : 'a previous run'}. Data has changed since — recalculate to update.
            </span>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 text-xs border-warning/40 text-warning hover:bg-warning/10" onClick={() => handleRun('full')}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Recalculate Now
          </Button>
        </div>
      )}

      {/* ── Run Control Panel ── */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Run Mode</CardTitle>
          <CardDescription>Select a calculation mode and run</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Standard Analysis ── */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Standard Analysis</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {STANDARD_MODES.map(opt => {
                if (opt.mode === 'util_only' && userLevel === 'novice') return null;
                return renderModeCard(opt);
              })}
            </div>
          </div>

          {/* ── Scenario Analysis ── */}
          {userLevel !== 'novice' && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scenario Analysis</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SCENARIO_MODES.map(opt => renderModeCard(opt, true))}
              </div>
            </div>
          )}

          {/* ── Optimization ── */}
          {userLevel !== 'novice' && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Optimization</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OPTIMIZATION_MODES.map(opt => renderModeCard(opt, true))}
              </div>
            </div>
          )}

          {/* ── Advanced Mode Config Panels ── */}
          {isAdvancedMode && extRunMode === 'product_inclusion' && model && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <Label className="text-sm font-medium">Select products to include:</Label>
              <div className="space-y-1.5">
                {model.products.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={piSelectedProducts.has(p.id)} onCheckedChange={(v) => {
                      const next = new Set(piSelectedProducts);
                      v ? next.add(p.id) : next.delete(p.id);
                      setPiSelectedProducts(next);
                    }} />
                    <span className="font-mono">{p.name}</span>
                    {p.demand > 0 && <span className="text-xs text-muted-foreground">({p.demand})</span>}
                  </label>
                ))}
              </div>
              <div><Label className="text-xs">Scenario Name</Label><Input value={piScenarioName} onChange={e => setPiScenarioName(e.target.value)} className="h-8 mt-1" /></div>
            </div>
          )}

          {isAdvancedMode && extRunMode === 'max_throughput' && model && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <div><Label className="text-xs">Maximize throughput for</Label>
                <Select value={mtProduct} onValueChange={v => { setMtProduct(v); setMtScenarioName(`Max Throughput — ${model.products.find(p=>p.id===v)?.name||''}`); }}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{model.products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Scenario Name</Label><Input value={mtScenarioName} onChange={e => setMtScenarioName(e.target.value)} className="h-8 mt-1" /></div>
              {mtResult && (
                <div className="p-3 bg-success/10 border border-success/30 rounded-md">
                  <p className="text-sm font-medium text-success">Max demand: {mtResult.demand} units</p>
                  <p className="text-xs text-muted-foreground">Limiting: {mtResult.limitingResource}</p>
                </div>
              )}
            </div>
          )}

          {isAdvancedMode && extRunMode === 'lot_size_range' && model && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <div><Label className="text-xs">Product</Label>
                <Select value={lsrProduct} onValueChange={setLsrProduct}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{model.products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Min</Label><Input type="number" value={lsrMin} onChange={e => setLsrMin(+e.target.value)} className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Max</Label><Input type="number" value={lsrMax} onChange={e => setLsrMax(+e.target.value)} className="h-8 mt-1" /></div>
                <div><Label className="text-xs">Step</Label><Input type="number" value={lsrStep} onChange={e => setLsrStep(+e.target.value)} className="h-8 mt-1" /></div>
              </div>
              {lsrResults.length > 0 && (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lsrResults}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="lotSize" label={{value:'Lot Size',position:'bottom'}} style={axisStyle} /><YAxis label={{value:'MCT',angle:-90,position:'insideLeft'}} style={axisStyle} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="mct" stroke="hsl(var(--primary))" strokeWidth={2} dot={{r:3}} /></LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {isAdvancedMode && extRunMode === 'optimize_lots' && model && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <Label className="text-sm font-medium">Select products to optimize:</Label>
              <div className="flex gap-2 mb-2">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setOptProducts(new Set(model.products.map(p=>p.id)))}>Select All</Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setOptProducts(new Set())}>Deselect All</Button>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {model.products.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={optProducts.has(p.id)} onCheckedChange={v => { const n = new Set(optProducts); v ? n.add(p.id) : n.delete(p.id); setOptProducts(n); }} />
                    <span className="font-mono text-xs">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">Lot: {p.lot_size}</span>
                  </label>
                ))}
              </div>
              {optResult && (
                <div className="p-3 bg-success/10 border border-success/30 rounded-md space-y-2">
                  <p className="text-sm font-medium text-success">WIP reduced by {optResult.wipReduction}%</p>
                  <table className="w-full text-xs"><thead><tr className="text-muted-foreground"><th className="text-left">Product</th><th className="text-right">Old Lot</th><th className="text-right">New Lot</th></tr></thead>
                    <tbody>{optResult.original.map((o,i) => <tr key={o.name}><td className="font-mono">{o.name}</td><td className="text-right">{o.lot}</td><td className="text-right font-semibold text-primary">{optResult.optimized[i]?.lot}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Progress bar for advanced runs */}
          {advProgress && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{advProgress.label}</span>
                <span>{advProgress.current}/{advProgress.total}</span>
              </div>
              <Progress value={(advProgress.current / advProgress.total) * 100} className="h-2" />
            </div>
          )}

          {/* Run Button */}
          <div className="flex items-center gap-4">
            {isAdvancedMode ? (
              <Button size="lg" onClick={handleAdvancedRun} disabled={isRunning || advRunning} className="gap-2 px-8">
                {advRunning ? (
                  <><span className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" /> Running...</>
                ) : (
                  <><Play className="h-4 w-4" /> {modeLabel}</>
                )}
              </Button>
            ) : (
              <Button size="lg" onClick={() => handleRun(runMode)} disabled={isRunning} className="gap-2 px-8">
                {isRunning ? (
                  <><span className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" /> Calculating...</>
                ) : (
                  <><Play className="h-4 w-4" /> {modeLabel}</>
                )}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">on <span className="font-medium">{scenarioLabel}</span></span>
          </div>

          {/* Validation / Error panels */}
          {results && results.overLimitResources.length > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive font-semibold">Resources exceed utilization limit ({model.general.util_limit}%)</span>
              </div>
              <ul className="text-xs text-destructive/80 space-y-0.5 ml-6 list-disc">
                {results.overLimitResources.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {results && results.errors.length > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
              <div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" /><span className="text-sm text-destructive font-semibold">Errors</span></div>
              <ul className="text-xs text-destructive/80 space-y-0.5 ml-6 list-disc mt-1">
                {results.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {results && results.overLimitResources.length === 0 && results.errors.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-md">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm text-success font-medium">All production targets can be achieved. Results are current.</span>
            </div>
          )}

          {verifyMessages && (
            <div className="space-y-2">
              {verifyMessages.errors.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" /> {e}</div>
              ))}
              {verifyMessages.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5" /> {w}</div>
              ))}
              {verifyMessages.errors.length === 0 && verifyMessages.warnings.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-success"><CheckCircle className="h-3.5 w-3.5" /> No issues found.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Run Log ── */}
      {runLog.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Recent Runs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Mode</TableHead>
                  <TableHead className="text-xs">Scenario</TableHead>
                  <TableHead className="text-xs text-right">Duration</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runLog.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs font-mono">{new Date(entry.timestamp).toLocaleTimeString()}</TableCell>
                    <TableCell className="text-xs capitalize">{entry.mode === 'full' ? 'Full Calculate' : entry.mode === 'verify' ? 'Verify Data' : 'Util Only'}</TableCell>
                    <TableCell className="text-xs">{entry.scenarioName}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{entry.durationMs < 1000 ? `${entry.durationMs}ms` : `${(entry.durationMs / 1000).toFixed(1)}s`}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${
                        entry.status === 'success' ? 'border-success/40 text-success' :
                        entry.status === 'warning' ? 'border-warning/40 text-warning' :
                        'border-destructive/40 text-destructive'
                      }`}>
                        {entry.status === 'success' ? <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> :
                         entry.status === 'warning' ? <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> :
                         <XCircle className="h-2.5 w-2.5 mr-0.5" />}
                        {entry.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Results Area */}
      {!hasRun && (
        <Card>
          <CardContent className="py-16 text-center">
            <Play className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium mb-1">No results yet</p>
            <p className="text-sm text-muted-foreground/70 mb-4">Select a run mode above and click Run to calculate model results.</p>
          </CardContent>
        </Card>
      )}

      {hasRun && (
        <Tabs defaultValue="equipment">
          <TabsList>
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
            <TabsTrigger value="labor">Labor</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            {canAccess(userLevel, 'oper-details') && <TabsTrigger value="operdetails">Oper Details</TabsTrigger>}
            <TabsTrigger value="ibom">IBOM</TabsTrigger>
          </TabsList>

          {/* Equipment Tab */}
          <TabsContent value="equipment" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Equipment Utilization</CardTitle>
                <CardDescription>
                  {isMultiScenario
                    ? `Comparing ${chartScenarios.length} scenarios — grouped stacked bars`
                    : 'Stacked utilization breakdown by equipment group'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  {isMultiScenario && groupedEquip ? (
                    <BarChart data={groupedEquip.data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={axisStyle} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: '% Utilization', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine y={model.general.util_limit} stroke="hsl(0, 72%, 51%)" strokeDasharray="5 5" label={{ value: `Limit ${model.general.util_limit}%`, position: 'right', style: { fontSize: 10, fill: 'hsl(0, 72%, 51%)' } }} />
                      {groupedEquip.bars.map(b => (
                        <Bar key={b.prefix + 'setup'} dataKey={b.prefix + 'setup'} stackId={b.stackId} fill={b.palette.setup} name={`${b.name} Setup`} />
                      ))}
                      {groupedEquip.bars.map(b => (
                        <Bar key={b.prefix + 'run'} dataKey={b.prefix + 'run'} stackId={b.stackId} fill={b.palette.run} name={`${b.name} Run`} />
                      ))}
                      {groupedEquip.bars.map(b => (
                        <Bar key={b.prefix + 'repair'} dataKey={b.prefix + 'repair'} stackId={b.stackId} fill={b.palette.repair} name={`${b.name} Repair`} />
                      ))}
                      {groupedEquip.bars.map((b, i) => (
                        <Bar key={b.prefix + 'waitLabor'} dataKey={b.prefix + 'waitLabor'} stackId={b.stackId} fill={b.palette.waitLabor} name={`${b.name} Wait Labor`} radius={[2, 2, 0, 0]} />
                      ))}
                    </BarChart>
                  ) : (
                    <BarChart data={equipChartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={axisStyle} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: '% Utilization', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine y={model.general.util_limit} stroke="hsl(0, 72%, 51%)" strokeDasharray="5 5" label={{ value: `Limit ${model.general.util_limit}%`, position: 'right', style: { fontSize: 10, fill: 'hsl(0, 72%, 51%)' } }} />
                      <Bar dataKey="setup" stackId="a" fill={chartColors.setup} name="Setup" />
                      <Bar dataKey="run" stackId="a" fill={chartColors.run} name="Run" />
                      <Bar dataKey="repair" stackId="a" fill={chartColors.repair} name="Repair" />
                      <Bar dataKey="waitLabor" stackId="a" fill={chartColors.waitLabor} name="Wait for Labor" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Equipment Results Table</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-xs">Equipment</TableHead>
                      <TableHead className="font-mono text-xs text-right">Count</TableHead>
                      <TableHead className="font-mono text-xs text-right">Setup %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Run %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Repair %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Wait Labor %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Total %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Idle %</TableHead>
                      <TableHead className="font-mono text-xs">Labor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results!.equipment.map(eq => (
                      <TableRow key={eq.id}>
                        <TableCell className="font-mono font-medium">{eq.name}</TableCell>
                        <TableCell className="font-mono text-right">{eq.count}</TableCell>
                        <TableCell className="font-mono text-right">{eq.setupUtil}</TableCell>
                        <TableCell className="font-mono text-right">{eq.runUtil}</TableCell>
                        <TableCell className="font-mono text-right">{eq.repairUtil}</TableCell>
                        <TableCell className="font-mono text-right">{eq.waitLaborUtil}</TableCell>
                        <TableCell className={`font-mono text-right font-medium ${eq.totalUtil > model.general.util_limit ? 'text-destructive' : ''}`}>{eq.totalUtil}</TableCell>
                        <TableCell className="font-mono text-right text-muted-foreground">{eq.idle}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{eq.laborGroup}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Equipment WIP Chart */}
            {canAccess(userLevel, 'equip-wip-chart') && (
              <EquipmentWIPChart results={results!} model={model} isMultiScenario={isMultiScenario} chartScenarios={chartScenarios} />
            )}
          </TabsContent>

          {/* Labor Tab */}
          <TabsContent value="labor" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Labor Utilization</CardTitle>
                <CardDescription>
                  {isMultiScenario
                    ? `Comparing ${chartScenarios.length} scenarios`
                    : 'Utilization breakdown by labor group'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  {isMultiScenario && groupedLabor ? (
                    <BarChart data={groupedLabor.data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={axisStyle} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine y={model.general.util_limit} stroke="hsl(0, 72%, 51%)" strokeDasharray="5 5" />
                      {groupedLabor.bars.map(b => (
                        <Bar key={b.prefix + 'setup'} dataKey={b.prefix + 'setup'} stackId={b.stackId} fill={b.palette.setup} name={`${b.name} Setup`} />
                      ))}
                      {groupedLabor.bars.map(b => (
                        <Bar key={b.prefix + 'run'} dataKey={b.prefix + 'run'} stackId={b.stackId} fill={b.palette.run} name={`${b.name} Run`} />
                      ))}
                      {groupedLabor.bars.map(b => (
                        <Bar key={b.prefix + 'unavail'} dataKey={b.prefix + 'unavail'} stackId={b.stackId} fill={b.palette.unavail} name={`${b.name} Unavail`} radius={[2, 2, 0, 0]} />
                      ))}
                    </BarChart>
                  ) : (
                    <BarChart data={laborChartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={axisStyle} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine y={model.general.util_limit} stroke="hsl(0, 72%, 51%)" strokeDasharray="5 5" />
                      <Bar dataKey="setup" stackId="a" fill={chartColors.setup} name="Setup" />
                      <Bar dataKey="run" stackId="a" fill={chartColors.run} name="Run" />
                      <Bar dataKey="unavail" stackId="a" fill={chartColors.unavail} name="Unavailable" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Labor Results Table</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-xs">Labor Group</TableHead>
                      <TableHead className="font-mono text-xs text-right">Count</TableHead>
                      <TableHead className="font-mono text-xs text-right">Setup %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Run %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Unavail %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Total %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Idle %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results!.labor.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono font-medium">{l.name}</TableCell>
                        <TableCell className="font-mono text-right">{l.count}</TableCell>
                        <TableCell className="font-mono text-right">{l.setupUtil}</TableCell>
                        <TableCell className="font-mono text-right">{l.runUtil}</TableCell>
                        <TableCell className="font-mono text-right">{l.unavailPct}</TableCell>
                        <TableCell className={`font-mono text-right font-medium ${l.totalUtil > model.general.util_limit ? 'text-destructive' : ''}`}>{l.totalUtil}</TableCell>
                        <TableCell className="font-mono text-right text-muted-foreground">{l.idle}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Labor Equipment Wait Chart */}
            {canAccess(userLevel, 'labor-wait-chart') && (
              <LaborWaitChart results={results!} model={model} />
            )}
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product MCT (Manufacturing Cycle Time)</CardTitle>
                <CardDescription>
                  {isMultiScenario
                    ? `Comparing ${chartScenarios.length} scenarios — MCT in ${model.general.mct_time_unit}s`
                    : `MCT breakdown by product in ${model.general.mct_time_unit}s`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  {isMultiScenario && groupedMCT ? (
                    <BarChart data={groupedMCT.data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={axisStyle} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: `MCT (${model.general.mct_time_unit})`, angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {groupedMCT.bars.map(b => (
                        <Bar key={b.prefix + 'lotWait'} dataKey={b.prefix + 'lotWait'} stackId={b.stackId} fill={b.palette.lotWait} name={`${b.name} Lot Wait`} />
                      ))}
                      {groupedMCT.bars.map(b => (
                        <Bar key={b.prefix + 'queue'} dataKey={b.prefix + 'queue'} stackId={b.stackId} fill={b.palette.queue} name={`${b.name} Queue`} />
                      ))}
                      {groupedMCT.bars.map(b => (
                        <Bar key={b.prefix + 'waitLabor'} dataKey={b.prefix + 'waitLabor'} stackId={b.stackId} fill={b.palette.waitLabor} name={`${b.name} Wait Labor`} />
                      ))}
                      {groupedMCT.bars.map(b => (
                        <Bar key={b.prefix + 'setup'} dataKey={b.prefix + 'setup'} stackId={b.stackId} fill={b.palette.setup} name={`${b.name} Setup`} />
                      ))}
                      {groupedMCT.bars.map(b => (
                        <Bar key={b.prefix + 'run'} dataKey={b.prefix + 'run'} stackId={b.stackId} fill={b.palette.run} name={`${b.name} Run`} radius={[2, 2, 0, 0]} />
                      ))}
                    </BarChart>
                  ) : (
                    <BarChart data={productChartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={axisStyle} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: `MCT (${model.general.mct_time_unit})`, angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="lotWait" stackId="a" fill={chartColors.lotWait} name="Lot Waiting" />
                      <Bar dataKey="queue" stackId="a" fill={chartColors.queue} name="Queue" />
                      <Bar dataKey="waitLabor" stackId="a" fill={chartColors.waitLabor} name="Wait for Labor" />
                      <Bar dataKey="setup" stackId="a" fill={chartColors.setup} name="Setup" />
                      <Bar dataKey="run" stackId="a" fill={chartColors.run} name="Run" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* WIP Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product WIP (Work In Progress)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  {isMultiScenario && groupedWIP ? (
                    <BarChart data={groupedWIP.data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={axisStyle} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: 'WIP Units', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {groupedWIP.bars.map((b, i) => (
                        <Bar key={b.prefix + 'wip'} dataKey={b.prefix + 'wip'} fill={b.palette.single} name={`${b.name} WIP`} radius={[2, 2, 0, 0]} />
                      ))}
                    </BarChart>
                  ) : (
                    <BarChart data={results?.products.map(p => ({ name: p.name, wip: p.wip })) || []} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={axisStyle} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: 'WIP Units', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="wip" fill={chartColors.setup} name="WIP" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Enhanced Summary Tab */}
          <TabsContent value="summary" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Output Summary</CardTitle>
                    <CardDescription>
                      Consolidated production metrics
                      {displayScenarioResults.length > 0 && ` — comparing ${displayScenarioResults.length} scenario(s)`}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setTransposed(!transposed)}>
                    <RotateCcw className="h-3.5 w-3.5" /> {transposed ? 'Normal View' : 'Transpose'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {transposed ? (
                  <TransposedSummary results={results!} model={model} scenarioResults={displayScenarioResults} />
                ) : (
                  <NormalSummary results={results!} model={model} scenarioResults={displayScenarioResults} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* IBOM Tab */}
          <TabsContent value="ibom" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Network className="h-4 w-4 text-primary" /> IBOM Analysis
                    </CardTitle>
                    <CardDescription>Bill of Materials MCT contribution tree</CardDescription>
                  </div>
                  <Select value={ibomSelectedProduct} onValueChange={setIbomProduct}>
                    <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {model.products.filter(p => p.demand > 0).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="tree">
                  <TabsList className="mb-4">
                    <TabsTrigger value="tree" className="text-xs">Tree</TabsTrigger>
                    <TabsTrigger value="poles" className="text-xs">Poles</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tree">
                    <IBOMTreeView model={model} results={results!} selectedProductId={ibomSelectedProduct} />
                  </TabsContent>
                  <TabsContent value="poles">
                    <IBOMPolesView model={model} results={results!} selectedProductId={ibomSelectedProduct} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!hasRun && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Play className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No results yet</p>
            <p className="text-sm mt-1">Click "Run Full Calculate" above to compute MCT, WIP, and utilization metrics.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Summary sub-components ─── */

function NormalSummary({ results, model, scenarioResults }: {
  results: CalcResults; model: any;
  scenarioResults: { id: string; scenario: any; results: CalcResults }[];
}) {
  const hasScenarios = scenarioResults.length > 0;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-mono text-xs">Product</TableHead>
          <TableHead className="font-mono text-xs text-right">Demand</TableHead>
          <TableHead className="font-mono text-xs text-right">Lot Size</TableHead>
          <TableHead className="font-mono text-xs text-right">Good Made</TableHead>
          <TableHead className="font-mono text-xs text-right">Started</TableHead>
          <TableHead className="font-mono text-xs text-right">Scrap</TableHead>
          <TableHead className="font-mono text-xs text-right">WIP</TableHead>
          <TableHead className="font-mono text-xs text-right">MCT ({model.general.mct_time_unit})</TableHead>
          {hasScenarios && scenarioResults.map(sr => (
            <TableHead key={sr.id} className="font-mono text-xs text-right text-primary">
              MCT {sr.scenario.name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.products.map(row => (
          <TableRow key={row.id}>
            <TableCell className="font-mono font-medium">{row.name}</TableCell>
            <TableCell className="font-mono text-right">{row.demand.toLocaleString()}</TableCell>
            <TableCell className="font-mono text-right">{row.lotSize}</TableCell>
            <TableCell className="font-mono text-right">{row.goodMade.toLocaleString()}</TableCell>
            <TableCell className="font-mono text-right">{row.started.toLocaleString()}</TableCell>
            <TableCell className="font-mono text-right">{row.scrap > 0 ? row.scrap.toLocaleString() : '—'}</TableCell>
            <TableCell className="font-mono text-right">{row.wip}</TableCell>
            <TableCell className="font-mono text-right font-medium">{row.mct.toFixed(4)}</TableCell>
            {hasScenarios && scenarioResults.map(sr => {
              const sp = sr.results.products.find(p => p.id === row.id);
              const diff = sp ? sp.mct - row.mct : 0;
              return (
                <TableCell key={sr.id} className={`font-mono text-right text-xs ${diff < 0 ? 'text-success' : diff > 0 ? 'text-destructive' : ''}`}>
                  {sp?.mct.toFixed(4) || '—'}
                  {diff !== 0 && <span className="ml-1 text-[10px]">({diff > 0 ? '+' : ''}{diff.toFixed(4)})</span>}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
        <TableRow className="border-t-2 font-medium">
          <TableCell className="font-mono">TOTAL</TableCell>
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.demand, 0).toLocaleString()}</TableCell>
          <TableCell />
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.goodMade, 0).toLocaleString()}</TableCell>
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.started, 0).toLocaleString()}</TableCell>
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.scrap, 0).toLocaleString()}</TableCell>
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.wip, 0).toFixed(1)}</TableCell>
          <TableCell className="font-mono text-right">—</TableCell>
          {hasScenarios && scenarioResults.map(sr => <TableCell key={sr.id} className="font-mono text-right">—</TableCell>)}
        </TableRow>
      </TableBody>
    </Table>
  );
}

function TransposedSummary({ results, model, scenarioResults }: {
  results: CalcResults; model: any;
  scenarioResults: { id: string; scenario: any; results: CalcResults }[];
}) {
  const fields = [
    { key: 'demand', label: 'Demand', fmt: (v: number) => v.toLocaleString() },
    { key: 'lotSize', label: 'Lot Size', fmt: (v: number) => v.toString() },
    { key: 'goodMade', label: 'Good Made', fmt: (v: number) => v.toLocaleString() },
    { key: 'started', label: 'Started', fmt: (v: number) => v.toLocaleString() },
    { key: 'scrap', label: 'Scrap', fmt: (v: number) => v > 0 ? v.toLocaleString() : '—' },
    { key: 'wip', label: 'WIP', fmt: (v: number) => v.toString() },
    { key: 'mct', label: `MCT (${model.general.mct_time_unit})`, fmt: (v: number) => v.toFixed(4) },
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-mono text-xs">Metric</TableHead>
          {results.products.map(p => (
            <TableHead key={p.id} className="font-mono text-xs text-right">{p.name}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map(f => (
          <TableRow key={f.key}>
            <TableCell className="font-mono font-medium text-xs">{f.label}</TableCell>
            {results.products.map(p => (
              <TableCell key={p.id} className="font-mono text-right text-xs">
                {f.fmt((p as any)[f.key])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ─── IBOM sub-components ─── */

interface IBOMNode {
  productId: string;
  productName: string;
  mct: number;
  unitsPerAssy: number;
  children: IBOMNode[];
}

function buildIBOMTree(model: any, results: CalcResults, rootId: string): IBOMNode {
  const product = model.products.find((p: any) => p.id === rootId);
  const pr = results.products.find(p => p.id === rootId);
  const children = model.ibom
    .filter((e: any) => e.parent_product_id === rootId)
    .map((e: any) => ({
      ...buildIBOMTree(model, results, e.component_product_id),
      unitsPerAssy: e.units_per_assy,
    }));

  return {
    productId: rootId,
    productName: product?.name || '?',
    mct: pr?.mct || 0,
    unitsPerAssy: 1,
    children,
  };
}

function IBOMTreeView({ model, results, selectedProductId }: { model: any; results: CalcResults; selectedProductId: string }) {
  const tree = useMemo(() => buildIBOMTree(model, results, selectedProductId), [model, results, selectedProductId]);

  const renderNode = (node: IBOMNode, depth: number, isLongest: boolean) => (
    <div key={node.productId} className="ml-4" style={{ marginLeft: depth * 24 }}>
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono mb-1 ${
        isLongest ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border bg-card'
      }`}>
        <span>{node.productName}</span>
        {node.unitsPerAssy > 1 && <Badge variant="secondary" className="text-[9px] h-4">×{node.unitsPerAssy}</Badge>}
        <span className="text-muted-foreground">{node.mct.toFixed(4)} {model.general.mct_time_unit}</span>
      </div>
      {node.children.length > 0 && (
        <div className="border-l border-border ml-4 pl-1">
          {node.children.map(child => {
            const longestChild = node.children.reduce((a, b) => a.mct > b.mct ? a : b);
            return renderNode(child, 0, child.productId === longestChild.productId);
          })}
        </div>
      )}
    </div>
  );

  if (model.ibom.filter((e: any) => e.parent_product_id === selectedProductId).length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No IBOM entries for this product. Add components in the IBOM screen.
      </div>
    );
  }

  return <div className="py-2">{renderNode(tree, 0, true)}</div>;
}

function IBOMPolesView({ model, results, selectedProductId }: { model: any; results: CalcResults; selectedProductId: string }) {
  // Build all paths from root to leaf
  const paths = useMemo(() => {
    const allPaths: { path: string[]; totalMCT: number }[] = [];

    function traverse(nodeId: string, currentPath: string[], currentMCT: number) {
      const pr = results.products.find(p => p.id === nodeId);
      const mct = pr?.mct || 0;
      const product = model.products.find((p: any) => p.id === nodeId);
      const name = product?.name || '?';
      const newPath = [...currentPath, name];
      const newMCT = currentMCT + mct;

      const children = model.ibom.filter((e: any) => e.parent_product_id === nodeId);
      if (children.length === 0) {
        allPaths.push({ path: newPath, totalMCT: newMCT });
      } else {
        children.forEach((c: any) => traverse(c.component_product_id, newPath, newMCT));
      }
    }

    traverse(selectedProductId, [], 0);
    return allPaths.sort((a, b) => b.totalMCT - a.totalMCT);
  }, [model, results, selectedProductId]);

  if (paths.length <= 1 && paths[0]?.path.length <= 1) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No IBOM paths to display. Add components in the IBOM screen.
      </div>
    );
  }

  const maxMCT = paths[0]?.totalMCT || 1;

  return (
    <div className="space-y-2 py-2">
      {paths.map((p, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-40 text-xs font-mono text-right truncate text-muted-foreground">
            {p.path.join(' → ')}
          </div>
          <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
            <div
              className={`h-full rounded transition-all ${i === 0 ? 'bg-primary' : 'bg-primary/40'}`}
              style={{ width: `${(p.totalMCT / maxMCT) * 100}%` }}
            />
            <span className="absolute right-2 top-0.5 text-[10px] font-mono">
              {p.totalMCT.toFixed(4)} {model.general.mct_time_unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
