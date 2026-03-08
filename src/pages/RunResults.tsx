import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Lock } from 'lucide-react';
import { useSortableTable, type SortDir } from '@/hooks/useSortableTable';
import { useModelStore, type Model } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useResultsStore } from '@/stores/resultsStore';
import { getScenarioColor } from '@/lib/scenarioColors';
import { type CalcResults, type ProductResult, type EquipmentResult, type LaborResult, calculate } from '@/lib/calculationEngine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip as ShadTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Play, CheckCircle, AlertTriangle, Shield, XCircle, RotateCcw, Network, Gauge, RefreshCw, Clock,
  TrendingUp, BarChart3, Settings2, Square, ChevronRight, ToggleLeft, Layers,
} from 'lucide-react';
import IBOMOutput, { MCT_COLORS, TreeChart, TreeTable, PolesChart, PolesTable, MCTLegend, ZoomSelect, buildNodeTree, buildPoles } from '@/components/IBOMOutput';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useRunCalculation, type RunMode } from '@/hooks/useRunCalculation';
import { useUserLevelStore, isVisible } from '@/hooks/useUserLevel';
import { scenarioDb } from '@/lib/scenarioDb';
import ScenarioContextBar from '@/components/ScenarioContextBar';
import ChartScenarioLabel from '@/components/ChartScenarioLabel';

// ── Scenario color palettes for grouped charts ──
const SCENARIO_PALETTES = [
  { setup: 'hsl(217, 91%, 75%)', run: 'hsl(217, 91%, 55%)', repair: 'hsl(217, 70%, 40%)', waitLabor: 'hsl(217, 60%, 30%)', unavail: 'hsl(217, 30%, 50%)', lotWait: 'hsl(217, 91%, 80%)', queue: 'hsl(217, 70%, 45%)', single: 'hsl(217, 91%, 60%)' },
  { setup: 'hsl(160, 60%, 70%)', run: 'hsl(160, 60%, 45%)', repair: 'hsl(160, 50%, 35%)', waitLabor: 'hsl(160, 40%, 25%)', unavail: 'hsl(160, 25%, 45%)', lotWait: 'hsl(160, 60%, 75%)', queue: 'hsl(160, 50%, 40%)', single: 'hsl(160, 60%, 45%)' },
  { setup: 'hsl(30, 90%, 75%)', run: 'hsl(30, 90%, 55%)', repair: 'hsl(30, 70%, 40%)', waitLabor: 'hsl(30, 60%, 30%)', unavail: 'hsl(30, 30%, 50%)', lotWait: 'hsl(30, 90%, 80%)', queue: 'hsl(30, 70%, 45%)', single: 'hsl(30, 90%, 55%)' },
  { setup: 'hsl(280, 60%, 75%)', run: 'hsl(280, 60%, 55%)', repair: 'hsl(280, 50%, 40%)', waitLabor: 'hsl(280, 40%, 30%)', unavail: 'hsl(280, 25%, 45%)', lotWait: 'hsl(280, 60%, 80%)', queue: 'hsl(280, 50%, 45%)', single: 'hsl(280, 60%, 55%)' },
  { setup: 'hsl(0, 70%, 75%)', run: 'hsl(0, 70%, 55%)', repair: 'hsl(0, 55%, 40%)', waitLabor: 'hsl(0, 45%, 30%)', unavail: 'hsl(0, 25%, 45%)', lotWait: 'hsl(0, 70%, 80%)', queue: 'hsl(0, 55%, 45%)', single: 'hsl(0, 70%, 55%)' },
];

// Single-scenario colors — use consistent 5-segment MCT colours for product charts
const chartColors = {
  setup: MCT_COLORS.setup, run: MCT_COLORS.run,
  repair: 'hsl(0, 72%, 51%)', waitLabor: MCT_COLORS.waitLabor,
  unavail: 'hsl(220, 9%, 46%)', lotWait: MCT_COLORS.lotWait, queue: MCT_COLORS.waitEquip,
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

// Re-export RechartsTooltip as Tooltip for chart usage (ShadTooltip used for UI tooltips)
const Tooltip = RechartsTooltip;
const tooltipStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 };
const axisStyle = { fontSize: 11, fontFamily: 'JetBrains Mono' };

/* ─── Sortable Table Header ─── */
function SortHead({ label, sortKey, current, onSort, align = 'right' }: {
  label: string; sortKey: string; current: { key: string; dir: SortDir };
  onSort: (k: string) => void; align?: 'left' | 'right';
}) {
  const active = current.key === sortKey && current.dir !== 'default';
  return (
    <TableHead
      className={`font-mono text-xs cursor-pointer select-none hover:text-foreground transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          current.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-30" />
        )}
      </span>
    </TableHead>
  );
}

/* ─── Production Chart Data Builder ─── */
function buildProductionData(results: CalcResults, model: any) {
  return results.products.map(pr => {
    // Units consumed as components in other products' production
    const usedInAssembly = model.ibom
      .filter((e: any) => e.component_product_id === pr.id)
      .reduce((sum: number, e: any) => {
        const parent = results.products.find((p: any) => p.id === e.parent_product_id);
        return sum + (parent ? parent.goodMade * (e.units_per_assy || 1) : 0);
      }, 0);
    // Check if this product is a parent that ships as part of another assembly
    const isComponent = model.ibom.some((e: any) => e.component_product_id === pr.id);
    // Shipped directly = end demand; components have 0 direct shipments
    const shipped = isComponent ? 0 : pr.goodShipped;
    // Shipped in assembly = for parent products, this is the end-demand shipments going out as assemblies
    const isParent = model.ibom.some((e: any) => e.parent_product_id === pr.id);
    const shippedInAssembly = isParent ? pr.goodShipped : 0;
    const scrapInProd = pr.scrap;
    const total = shipped + usedInAssembly + shippedInAssembly + scrapInProd;
    return {
      name: pr.name,
      shipped: Math.round(shipped),
      usedInAssembly: Math.round(usedInAssembly),
      shippedInAssembly: Math.round(shippedInAssembly),
      scrapInProduction: Math.round(scrapInProd),
      total: Math.round(total),
    };
  });
}

// Extended run mode type for advanced modes
type ExtendedRunMode = RunMode | 'max_throughput' | 'lot_size_range' | 'tbatch_range' | 'optimize_lots';

const STANDARD_MODES: { mode: ExtendedRunMode; icon: typeof Play; label: string; description: string }[] = [
  { mode: 'full', icon: Play, label: 'Full Calculate', description: 'Complete queuing analysis with utilization, MCT, WIP, and queue times.' },
  { mode: 'verify', icon: Shield, label: 'Verify Data Only', description: 'Validates input data for errors without running calculations.' },
  { mode: 'util_only', icon: Gauge, label: 'Utilization Only', description: 'Equipment and labor utilization only — faster for capacity exploration.' },
];

const SCENARIO_MODES: { mode: ExtendedRunMode; icon: typeof Play; label: string; description: string }[] = [
  { mode: 'max_throughput', icon: TrendingUp, label: 'Max Throughput', description: 'Find the maximum achievable demand for a selected product.' },
];

const OPTIMIZATION_MODES: { mode: ExtendedRunMode; icon: typeof Play; label: string; description: string }[] = [
  { mode: 'lot_size_range', icon: BarChart3, label: 'Lot Size Range', description: 'Run a range of lot sizes and chart MCT vs lot size curve.' },
  { mode: 'tbatch_range', icon: Layers, label: 'Transfer Batch Range', description: 'Sweep transfer batch sizes for a product and chart MCT sensitivity.' },
  { mode: 'optimize_lots', icon: Settings2, label: 'Optimize Lot Sizes', description: 'Minimize total WIP by iteratively adjusting lot sizes and transfer batches.' },
];

export default function RunResults() {
  const model = useModelStore(s => s.getActiveModel());
  const allScenarios = useScenarioStore(s => s.scenarios);
  const activeScenarioId = useScenarioStore(s => s.activeScenarioId);
  const displayIds = useScenarioStore(s => s.displayScenarioIds);
  const { getResults } = useResultsStore();
  const selectedRunScenarioId = useResultsStore(s => s.selectedRunScenarioId);
  const setSelectedRunScenarioId = useResultsStore(s => s.setSelectedRunScenarioId);
  const { userLevel } = useUserLevelStore();

  const { isRunning, runLog, verifyMessages, handleRun } = useRunCalculation();

  const [extRunMode, setExtRunMode] = useState<ExtendedRunMode>('full');
  const runMode: RunMode = (extRunMode === 'full' || extRunMode === 'verify' || extRunMode === 'util_only') ? extRunMode : 'full';
  const [transposed, setTransposed] = useState(false);
  // ibomProduct state removed — now managed inside IBOMOutput component

  // Advanced mode state — must be before early return
  const [mtProduct, setMtProduct] = useState(model?.products[0]?.id || '');
  const [mtScenarioName, setMtScenarioName] = useState('');
  const [mtResult, setMtResult] = useState<{demand: number; limitingResource: string} | null>(null);
  const [lsrProduct, setLsrProduct] = useState(model?.products[0]?.id || '');
  const [lsrMin, setLsrMin] = useState(10);
  const [lsrMax, setLsrMax] = useState(200);
  const [lsrStep, setLsrStep] = useState(10);
  const [lsrResults, setLsrResults] = useState<{lotSize: number; mct: number}[]>([]);
  const [tbrProduct, setTbrProduct] = useState(model?.products[0]?.id || '');
  const [tbrMin, setTbrMin] = useState(1);
  const [tbrMax, setTbrMax] = useState(50);
  const [tbrStep, setTbrStep] = useState(5);
  const [tbrResults, setTbrResults] = useState<{tbatch: number; mct: number}[]>([]);
  const [optProducts, setOptProducts] = useState<Set<string>>(new Set(model?.products.map(p => p.id) || []));
  const [optResult, setOptResult] = useState<{original: {name:string;lot:number;wip:number}[]; optimized: {name:string;lot:number;wip:number}[]; wipReduction: number} | null>(null);
  const [advProgress, setAdvProgress] = useState<{current:number; total:number; label:string} | null>(null);
  const [advRunning, setAdvRunning] = useState(false);

  // Max Throughput + Lot Size Range modal state
  const [mtModalOpen, setMtModalOpen] = useState(false);
  const [mtModalMode, setMtModalMode] = useState<'max_throughput' | 'lot_size_range'>('max_throughput');
  const [mtModalProduct, setMtModalProduct] = useState(model?.products[0]?.id || '');
  const [mtModalName, setMtModalName] = useState('');
  const [mtModalLsFrom, setMtModalLsFrom] = useState(10);
  const [mtModalLsTo, setMtModalLsTo] = useState(200);
  const [mtModalLsStep, setMtModalLsStep] = useState(10);

  // Optimise Lot Sizes modal state
  const [olModalOpen, setOlModalOpen] = useState(false);
  const [olName, setOlName] = useState('Optimised Lot Sizes');
  const [olUnitValues, setOlUnitValues] = useState<Record<string, number>>({});
  const [olOptLot, setOlOptLot] = useState<Set<string>>(new Set());
  const [olOptTb, setOlOptTb] = useState<Set<string>>(new Set());
  const [olInitialWip, setOlInitialWip] = useState<number | null>(null);
  const [olCurrentWip, setOlCurrentWip] = useState<number | null>(null);

  const { createScenario } = useScenarioStore();
  const { setResults: setStoreResults } = useResultsStore();

  const activeScenario = model ? (allScenarios.find(s => s.id === activeScenarioId) || null) : null;
  const modelScenarios = model ? allScenarios.filter(s => s.modelId === model.id) : [];
  const resultKey = selectedRunScenarioId && selectedRunScenarioId !== 'basecase'
    ? selectedRunScenarioId
    : (activeScenario ? activeScenario.id : 'basecase');
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

  // ibomSelectedProduct removed — now managed inside IBOMOutput component

  // Render a mode card
  const renderModeCard = (opt: {mode: ExtendedRunMode; icon: typeof Play; label: string; description: string}) => {
    const Icon = opt.icon;
    const selected = extRunMode === opt.mode;
    return (
      <button
        key={opt.label}
        onClick={() => setExtRunMode(opt.mode)}
        className={`text-left p-3 rounded-lg border-2 transition-all ${
          selected ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/40 hover:bg-accent/30'
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className={`h-4 w-4 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`text-sm font-medium ${selected ? 'text-primary' : ''}`}>{opt.label}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{opt.description}</p>
      </button>
    );
  };

  // Advanced run handlers
  const handleAdvancedRun = useCallback(async () => {
    if (!model || advRunning) return;

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

    if (extRunMode === 'tbatch_range') {
      setAdvRunning(true);
      const product = model.products.find(p => p.id === tbrProduct);
      if (!product) { setAdvRunning(false); return; }
      const steps: number[] = [];
      for (let tb = tbrMin; tb <= tbrMax; tb += tbrStep) steps.push(tb);
      const curResults: {tbatch: number; mct: number}[] = [];

      for (let i = 0; i < steps.length; i++) {
        setAdvProgress({ current: i + 1, total: steps.length, label: `Transfer Batch: ${steps[i]}` });
        const testModel = { ...model, products: model.products.map(p => p.id === tbrProduct ? { ...p, tbatch_size: steps[i] } : p) };
        const r = calculate(testModel);
        const pr = r.products.find(p => p.id === tbrProduct);
        curResults.push({ tbatch: steps[i], mct: pr?.mct || 0 });

        const scName = `${product.name}-TBatch-${steps[i]}`;
        const scenarioId = await createScenario(model.id, scName);
        useScenarioStore.getState().applyScenarioChange(scenarioId, 'Product', tbrProduct, product.name, 'tbatch_size', 'Transfer Batch Size', steps[i]);
        const sc = useScenarioStore.getState().scenarios.find(s => s.id === scenarioId);
        if (sc) {
          setStoreResults(scenarioId, r);
          useScenarioStore.getState().markCalculated(scenarioId);
          scenarioDb.saveResults(scenarioId, r);
        }
        await new Promise(r => setTimeout(r, 0));
      }
      setTbrResults(curResults);
      setAdvProgress(null);
      setAdvRunning(false);
      toast.success(`Created ${steps.length} transfer batch scenarios for ${product.name}`);
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
  }, [model, extRunMode, advRunning, mtProduct, mtScenarioName, lsrProduct, lsrMin, lsrMax, lsrStep, tbrProduct, tbrMin, tbrMax, tbrStep, optProducts, createScenario, setStoreResults, handleRun]);

  const isAdvancedMode = ['max_throughput', 'lot_size_range', 'tbatch_range', 'optimize_lots'].includes(extRunMode);

  const [activeTab, setActiveTab] = useState('summary');
  const [equipSubTab, setEquipSubTab] = useState('util-chart');
  const [laborSubTab, setLaborSubTab] = useState('util-chart');
  const [productsSubTab, setProductsSubTab] = useState('mct-chart');
  const [ibomSubTab, setIbomSubTab] = useState('tree-chart');
  const [ibomZoom, setIbomZoom] = useState(100);

  // Detect if last run was util-only (MCT/WIP not available)
  const lastRunMode = runLog.length > 0 ? runLog[0].mode : null;
  const isUtilOnly = lastRunMode === 'util_only';

  // Auto-navigate to Summary on Full Calculate completion; toast on background recalc
  const prevRunLogLenRef = useRef(runLog.length);
  const wasViewingTabRef = useRef(activeTab);
  // Track which tab user is on before a run starts
  useEffect(() => { wasViewingTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => {
    if (runLog.length > prevRunLogLenRef.current) {
      const latest = runLog[0];
      if (latest && latest.mode === 'full' && latest.status !== 'error') {
        // If user was on summary or had no results, go to summary
        if (wasViewingTabRef.current === 'summary') {
          setActiveTab('summary');
        } else {
          // User is on a specific tab — don't navigate, just toast
          toast.success('Results updated', { duration: 2000 });
        }
      }
    }
    prevRunLogLenRef.current = runLog.length;
  }, [runLog.length]);

  if (!model) return (
    <div className="p-6 space-y-4">
      <div className="h-7 w-48 bg-muted animate-pulse rounded" />
      <div className="h-4 w-64 bg-muted animate-pulse rounded" />
      <div className="h-48 bg-muted animate-pulse rounded-lg mt-4" />
    </div>
  );

  const scenarioLabel = activeScenario ? activeScenario.name : 'Basecase';
  const modeLabel = extRunMode === 'full' ? 'Run Full Calculate' : extRunMode === 'verify' ? 'Verify Data' : extRunMode === 'util_only' ? 'Calculate Utilization' : extRunMode === 'max_throughput' ? 'Find Max Throughput' : extRunMode === 'lot_size_range' ? 'Run Lot Size Range' : extRunMode === 'tbatch_range' ? 'Run TBatch Range' : 'Run Optimize';

  // Status chip
  const statusChip = isRunning || advRunning
    ? { label: 'Running…', color: 'bg-info/15 text-info border-info/30', icon: <span className="animate-spin inline-block h-3 w-3 border-2 border-info border-t-transparent rounded-full" /> }
    : model.run_status === 'needs_recalc' && hasRun
    ? { label: 'Recalc Needed', color: 'bg-warning/15 text-warning border-warning/30', icon: <AlertTriangle className="h-3 w-3" /> }
    : { label: 'Ready', color: 'bg-muted text-muted-foreground border-border', icon: <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" /> };

  const lastRunText = model.last_run_at ? `Last run: ${new Date(model.last_run_at).toLocaleString()}` : 'Never run';

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in">
      {/* ── Page Header Row ── */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2 shrink-0">
        <h1 className="text-xl font-bold">Run &amp; Results</h1>
        {activeScenario && (
          <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning gap-1.5 text-xs font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-warning" />
            {activeScenario.name}
          </Badge>
        )}
      </div>

      {/* ── Run Control Bar ── */}
      <div className="h-[52px] shrink-0 flex items-center gap-3 px-6 bg-muted/40 border-b border-border">
        {/* Left — standard run buttons */}
        <Button size="sm" className="h-9 gap-1.5 px-4" onClick={() => handleRun('full')} disabled={isRunning || advRunning}>
          {isRunning || advRunning ? (
            <><span className="animate-spin h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full" /> Running…</>
          ) : (
            <><Play className="h-3.5 w-3.5" /> Full Calculate</>
          )}
        </Button>
        <Button size="sm" variant="outline" className="h-9 gap-1.5 px-3" onClick={() => handleRun('verify')} disabled={isRunning || advRunning}>
          <CheckCircle className="h-3.5 w-3.5" /> Verify Data
        </Button>
        {isVisible('calculate_util_only', userLevel) && (
          <ShadTooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 gap-1.5 px-3" onClick={() => handleRun('util_only')} disabled={isRunning || advRunning}>
                <Gauge className="h-3.5 w-3.5" /> Calc. Util Only
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Calculates equipment and labor utilisation only — faster than Full Calculate.</TooltipContent>
          </ShadTooltip>
        )}

        {/* Vertical divider before Advanced section */}
        {isVisible('max_throughput', userLevel) && (
          <div className="h-[60%] w-px bg-border self-center" />
        )}

        {/* Advanced dropdown — Advanced users only */}
        {isVisible('product_inclusion', userLevel) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-9 gap-1.5 px-3 text-xs">
                <Settings2 className="h-3.5 w-3.5" /> Advanced <ChevronRight className="h-3 w-3 rotate-90" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem onClick={() => {
                setMtModalProduct(model?.products[0]?.id || '');
                setMtModalName('');
                setMtModalMode('max_throughput');
                setMtModalLsFrom(10);
                setMtModalLsTo(200);
                setMtModalLsStep(10);
                setMtModalOpen(true);
              }}>
                <TrendingUp className="h-4 w-4 mr-2" /> Max Throughput + Lot Size Range…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const vals: Record<string, number> = {};
                model?.products.forEach(p => { vals[p.id] = 1; });
                setOlUnitValues(vals);
                setOlOptLot(new Set(model?.products.map(p => p.id) || []));
                setOlOptTb(new Set(model?.products.map(p => p.id) || []));
                setOlName('Optimised Lot Sizes');
                const baseCalc = calculate(model!);
                const initWip = baseCalc.products.reduce((s, pr) => s + pr.wip * (vals[pr.id] || 1), 0);
                setOlInitialWip(Math.round(initWip * 100) / 100);
                setOlCurrentWip(null);
                setOlModalOpen(true);
              }}>
                <Settings2 className="h-4 w-4 mr-2" /> Optimise Lot Sizes &amp; Transfer Batches…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {}}>
                <AlertTriangle className="h-4 w-4 mr-2" /> Errors &amp; Warning Messages
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Scenario context dropdown */}
        <div className="h-[60%] w-px bg-border self-center" />
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">Running for:</span>
          <Select value={selectedRunScenarioId} onValueChange={setSelectedRunScenarioId}>
            <SelectTrigger className={`h-7 w-auto min-w-[140px] max-w-[220px] text-xs gap-1 ${selectedRunScenarioId !== 'basecase' ? 'text-warning border-warning/40' : ''}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="basecase">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="h-3 w-3" /> Basecase
                </span>
              </SelectItem>
              {modelScenarios.map((sc, idx) => (
                <SelectItem key={sc.id} value={sc.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: getScenarioColor(idx) }} />
                    {sc.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1" />

        {/* Far right — status chip + last run */}
        <Badge variant="outline" className={`gap-1.5 text-xs font-medium ${statusChip.color}`}>
          {statusChip.icon}
          {statusChip.label}
        </Badge>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{lastRunText}</span>
      </div>

      {/* ── Primary Tab Bar ── */}
      <div className="shrink-0 px-6 border-b border-border">
        <div className="flex h-10 items-center gap-0">
          {(['summary', 'equipment', 'labor', 'products', 'ibom'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-10 px-4 text-sm font-medium capitalize relative transition-colors ${
                activeTab === tab
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'ibom' ? 'IBOM' : tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content Panel — scrolls internally ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Validation / Error banners (only when results exist) */}
        {results && results.overLimitResources.length > 0 && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
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
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
            <div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" /><span className="text-sm text-destructive font-semibold">Errors</span></div>
            <ul className="text-xs text-destructive/80 space-y-0.5 ml-6 list-disc mt-1">
              {results.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {verifyMessages && (
          <div className="mb-4 space-y-2">
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

        {/* ── Summary Tab ── */}
        {activeTab === 'summary' && (
          <>
            <ScenarioContextBar />
            {/* Quick Stats Row */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <QuickStatCard
                label="Most loaded equipment"
                value={results ? (() => { const top = [...results.equipment].sort((a, b) => b.totalUtil - a.totalUtil)[0]; return top ? top.name : '—'; })() : '—'}
                metric={results ? (() => { const top = [...results.equipment].sort((a, b) => b.totalUtil - a.totalUtil)[0]; return top ? `${top.totalUtil.toFixed(1)}%` : ''; })() : ''}
              />
              <QuickStatCard
                label="Most loaded labor"
                value={results ? (() => { const top = [...results.labor].sort((a, b) => b.totalUtil - a.totalUtil)[0]; return top ? top.name : '—'; })() : '—'}
                metric={results ? (() => { const top = [...results.labor].sort((a, b) => b.totalUtil - a.totalUtil)[0]; return top ? `${top.totalUtil.toFixed(1)}%` : ''; })() : ''}
              />
              <QuickStatCard
                label="Highest MCT product"
                value={results ? (() => { const top = [...results.products].sort((a, b) => b.mct - a.mct)[0]; return top ? top.name : '—'; })() : '—'}
                metric={results ? (() => { const top = [...results.products].sort((a, b) => b.mct - a.mct)[0]; return top ? top.mct.toFixed(4) : ''; })() : ''}
              />
              <QuickStatCard
                label="Total system WIP"
                value={results ? `${Math.round(results.products.reduce((s, p) => s + p.wip, 0)).toLocaleString()}` : '—'}
                metric={results ? 'pieces' : ''}
              />
            </div>

            {/* Pre-run empty state or Output Summary table */}
            {!hasRun ? (
              <NoResultsPlaceholder />
            ) : (
              <>
                {results && results.overLimitResources.length === 0 && results.errors.length === 0 && (
                  <div className="flex items-center gap-2 p-3 mb-4 bg-success/10 border border-success/30 rounded-md">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-sm text-success font-medium">All production targets can be achieved. Results are current.</span>
                  </div>
                )}
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
              </>
            )}
          </>
        )}

        {/* ── Equipment Tab ── */}
        {activeTab === 'equipment' && (
          !hasRun ? <NoResultsPlaceholder /> : (
            <div className="flex flex-col h-full">
              {/* Level 2 sub-tab bar */}
              <div className="flex h-8 items-center gap-0 border-b border-border/50 -mx-6 px-6 mb-6 shrink-0">
                {([
                  { key: 'util-chart', label: 'Util Chart' },
                  { key: 'results-table', label: 'Results Table' },
                  { key: 'wip-chart', label: 'WIP Chart' },
                  ...(isVisible('oper_details', userLevel) ? [{ key: 'oper-details', label: 'Oper Details' }] : []),
                ] as const).map(st => (
                  <button
                    key={st.key}
                    onClick={() => setEquipSubTab(st.key)}
                    className={`h-8 px-4 text-[13px] relative transition-colors ${
                      equipSubTab === st.key
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {st.label}
                    {equipSubTab === st.key && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/60" />
                    )}
                  </button>
                ))}
              </div>
              <ScenarioContextBar />

              {equipSubTab === 'util-chart' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Equipment Utilization</CardTitle>
                    <CardDescription>
                      {isMultiScenario
                        ? `Comparing ${chartScenarios.length} scenarios — grouped stacked bars`
                        : 'Stacked utilization breakdown by equipment group'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <ChartScenarioLabel />
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
                          {groupedEquip.bars.map((b) => (
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
              )}

              {equipSubTab === 'results-table' && (
                <EquipmentResultsTable equipment={results!.equipment} utilLimit={model.general.util_limit} />
              )}

              {equipSubTab === 'wip-chart' && (
                <EquipmentWIPChart results={results!} model={model} isMultiScenario={isMultiScenario} chartScenarios={chartScenarios} />
              )}

              {equipSubTab === 'oper-details' && isVisible('oper_details', userLevel) && (
                <EquipOperDetails model={model} results={results!} />
              )}
            </div>
          )
        )}

        {/* ── Labor Tab ── */}
        {activeTab === 'labor' && (
          !hasRun ? <NoResultsPlaceholder /> : (
            <div className="flex flex-col h-full">
              {/* Level 2 sub-tab bar */}
              <div className="flex h-8 items-center gap-0 border-b border-border/50 -mx-6 px-6 mb-6 shrink-0">
                {([
                  { key: 'util-chart', label: 'Util Chart' },
                  { key: 'results-table', label: 'Results Table' },
                  { key: 'equip-wait', label: 'Equip Wait Chart' },
                  ...(isVisible('oper_details', userLevel) ? [{ key: 'oper-details', label: 'Oper Details' }] : []),
                ] as const).map(st => (
                  <button
                    key={st.key}
                    onClick={() => setLaborSubTab(st.key)}
                    className={`h-8 px-4 text-[13px] relative transition-colors ${
                      laborSubTab === st.key
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {st.label}
                    {laborSubTab === st.key && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/60" />
                    )}
                  </button>
                ))}
              </div>
              <ScenarioContextBar />

              {laborSubTab === 'util-chart' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Labor Utilization</CardTitle>
                    <CardDescription>
                      {isMultiScenario
                        ? `Comparing ${chartScenarios.length} scenarios`
                        : 'Utilization breakdown by labor group'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative">
                    <ChartScenarioLabel />
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
              )}

              {laborSubTab === 'results-table' && (
                <LaborResultsTable labor={results!.labor} utilLimit={model.general.util_limit} />
              )}

              {laborSubTab === 'equip-wait' && (
                <>
                  <p className="text-xs text-muted-foreground mb-4">
                    Shows the average number of machines waiting for each labor group. Large values indicate understaffing or misallocated labor.
                  </p>
                  <LaborWaitChart results={results!} model={model} />
                </>
              )}

              {laborSubTab === 'oper-details' && isVisible('oper_details', userLevel) && (
                <LaborOperDetails model={model} results={results!} />
              )}
            </div>
          )
        )}

        {/* ── Products Tab ── */}
        {activeTab === 'products' && (
          !hasRun ? <NoResultsPlaceholder /> : (
            <div className="flex flex-col h-full">
              {/* Level 2 sub-tab bar */}
              <div className="flex h-8 items-center gap-0 border-b border-border/50 -mx-6 px-6 mb-6 shrink-0">
                {([
                  { key: 'mct-chart', label: 'MCT Chart' },
                  { key: 'results-table', label: 'Results Table' },
                  { key: 'production-chart', label: 'Production Chart' },
                  { key: 'wip-chart', label: 'WIP Chart' },
                  ...(isVisible('oper_details', userLevel) ? [{ key: 'oper-details', label: 'Oper Details' }] : []),
                ] as const).map(st => (
                  <button
                    key={st.key}
                    onClick={() => setProductsSubTab(st.key)}
                    className={`h-8 px-4 text-[13px] relative transition-colors ${
                      productsSubTab === st.key
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {st.label}
                    {productsSubTab === st.key && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/60" />
                    )}
                  </button>
                ))}
              </div>
              <ScenarioContextBar />

              {productsSubTab === 'mct-chart' && (
                <>
                  {isUtilOnly && <UtilOnlyBanner />}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Product MCT (Manufacturing Cycle Time)</CardTitle>
                      <CardDescription>
                        {isMultiScenario
                          ? `Comparing ${chartScenarios.length} scenarios — MCT in ${model.general.mct_time_unit}s`
                          : `MCT breakdown by product in ${model.general.mct_time_unit}s`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="relative">
                      <ChartScenarioLabel />
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
                            <Bar dataKey="lotWait" stackId="a" fill={chartColors.lotWait} name="Wait for Lot" />
                            <Bar dataKey="queue" stackId="a" fill={chartColors.queue} name="Wait for Equipment" />
                            <Bar dataKey="waitLabor" stackId="a" fill={chartColors.waitLabor} name="Wait for Labor" />
                            <Bar dataKey="setup" stackId="a" fill={chartColors.setup} name="Setup" />
                            <Bar dataKey="run" stackId="a" fill={chartColors.run} name="Run" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </>
              )}

              {productsSubTab === 'results-table' && (
                <ProductResultsTable results={results!} model={model} displayScenarioResults={displayScenarioResults} />
              )}

              {productsSubTab === 'production-chart' && (
                <ProductionChart results={results!} model={model} isMultiScenario={isMultiScenario} chartScenarios={chartScenarios} />
              )}

              {productsSubTab === 'wip-chart' && (
                <>
                  {isUtilOnly && <UtilOnlyBanner />}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Product WIP (Work In Progress)</CardTitle>
                    </CardHeader>
                    <CardContent className="relative">
                      <ChartScenarioLabel />
                      <ResponsiveContainer width="100%" height={300}>
                        {isMultiScenario && groupedWIP ? (
                          <BarChart data={groupedWIP.data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={axisStyle} stroke="hsl(var(--muted-foreground))" />
                            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: 'WIP Units', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            {groupedWIP.bars.map((b) => (
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
                </>
              )}

              {productsSubTab === 'oper-details' && isVisible('oper_details', userLevel) && (
                <>
                  {isUtilOnly && <UtilOnlyBanner />}
                  <ProductOperDetails model={model} results={results!} />
                </>
              )}
            </div>
          )
        )}

        {/* ── IBOM Tab ── */}
        {activeTab === 'ibom' && (
          !hasRun ? <NoResultsPlaceholder /> : (
            <>
            <ScenarioContextBar />
            <IBOMTabContent
              model={model}
              results={results!}
              basecaseResults={basecaseResults}
              isRunning={isRunning}
              isUtilOnly={isUtilOnly}
              ibomSubTab={ibomSubTab}
              setIbomSubTab={setIbomSubTab}
              ibomZoom={ibomZoom}
              setIbomZoom={setIbomZoom}
            />
            </>
          )
        )}

        {/* Run Log */}
        {runLog.length > 0 && (
          <Card className="mt-4">
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
      </div>

      {/* ── Max Throughput + Lot Size Range Modal ── */}
      <Dialog open={mtModalOpen} onOpenChange={setMtModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Max. Throughput + Lot Size Range</DialogTitle>
            <DialogDescription>Find max production or sweep lot sizes for a product.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Section 1 — Choose Product */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Choose Product</Label>
              <Select value={mtModalProduct} onValueChange={setMtModalProduct}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {model?.products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section 2 — What-if Name */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">What-if Name</Label>
              <Input
                value={mtModalName}
                onChange={e => setMtModalName(e.target.value)}
                placeholder={mtModalMode === 'max_throughput' ? 'Max Throughput' : 'Lot Size Range'}
              />
            </div>

            {/* Section 3 — Choose Mode */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Choose Mode</Label>
              <RadioGroup value={mtModalMode} onValueChange={(v) => setMtModalMode(v as any)}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="max_throughput" id="mt-mode-max" className="mt-0.5" />
                  <Label htmlFor="mt-mode-max" className="text-sm font-normal cursor-pointer">
                    <span className="font-medium">Maximise Production</span>
                    <span className="block text-xs text-muted-foreground">Finds the maximum possible production quantity given current constraints.</span>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="lot_size_range" id="mt-mode-ls" className="mt-0.5" />
                  <Label htmlFor="mt-mode-ls" className="text-sm font-normal cursor-pointer">
                    <span className="font-medium">Run a Range of Lot Sizes</span>
                    <span className="block text-xs text-muted-foreground">Runs a series of calculations across a range of lot sizes.</span>
                  </Label>
                </div>
              </RadioGroup>

              {mtModalMode === 'lot_size_range' && (
                <div className="ml-6 mt-2 space-y-3 p-3 bg-muted/40 rounded-md border border-border">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">From lot size</Label>
                      <Input type="number" min={1} value={mtModalLsFrom} onChange={e => setMtModalLsFrom(Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">To lot size</Label>
                      <Input type="number" min={1} value={mtModalLsTo} onChange={e => setMtModalLsTo(Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Step size</Label>
                      <Input type="number" min={1} value={mtModalLsStep} onChange={e => setMtModalLsStep(Number(e.target.value))} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Will run lot sizes: {(() => {
                      const sizes: number[] = [];
                      for (let s = mtModalLsFrom; s <= mtModalLsTo && sizes.length < 5; s += mtModalLsStep) sizes.push(s);
                      return sizes.join(', ') + (mtModalLsTo > (mtModalLsFrom + mtModalLsStep * 4) ? '…' : '') + ' (one What-if per lot size)';
                    })()}
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMtModalOpen(false)}>Cancel</Button>
            <Button
              disabled={!mtModalProduct || advRunning}
              onClick={async () => {
                setMtModalOpen(false);
                if (!model) return;
                const product = model.products.find(p => p.id === mtModalProduct);
                if (!product) return;

                if (mtModalMode === 'max_throughput') {
                  // Inline max throughput logic
                  setAdvRunning(true);
                  let demand = product.demand > 0 ? product.demand : 100;
                  let lastValidDemand = demand;
                  let limitingResource = '';
                  const step = Math.max(1, Math.round(demand * 0.1));
                  let iterations = 0;
                  const maxIter = 200;

                  while (iterations < maxIter) {
                    iterations++;
                    setAdvProgress({ current: iterations, total: maxIter, label: `Testing demand: ${Math.round(demand)}` });
                    const testModel = { ...model, products: model.products.map(p => p.id === mtModalProduct ? { ...p, demand } : p) };
                    const r = calculate(testModel);
                    if (r.overLimitResources.length > 0) {
                      limitingResource = r.overLimitResources[0];
                      let lo = lastValidDemand, hi = demand;
                      for (let i = 0; i < 20; i++) {
                        const mid = Math.round((lo + hi) / 2);
                        const tr = calculate({ ...model, products: model.products.map(p => p.id === mtModalProduct ? { ...p, demand: mid } : p) });
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

                  const name = mtModalName || `Max Throughput — ${product.name}`;
                  const scenarioId = await createScenario(model.id, name);
                  useScenarioStore.getState().applyScenarioChange(scenarioId, 'Product', mtModalProduct, product.name, 'demand', 'Demand', lastValidDemand);
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
                } else {
                  // Inline lot size range logic
                  setAdvRunning(true);
                  const steps: number[] = [];
                  for (let ls = mtModalLsFrom; ls <= mtModalLsTo; ls += mtModalLsStep) steps.push(ls);
                  const curResults: {lotSize: number; mct: number}[] = [];

                  for (let i = 0; i < steps.length; i++) {
                    setAdvProgress({ current: i + 1, total: steps.length, label: `Lot size: ${steps[i]}` });
                    const testModel = { ...model, products: model.products.map(p => p.id === mtModalProduct ? { ...p, lot_size: steps[i] } : p) };
                    const r = calculate(testModel);
                    const pr = r.products.find(p => p.id === mtModalProduct);
                    curResults.push({ lotSize: steps[i], mct: pr?.mct || 0 });

                    const scName = `${mtModalName || product.name} — Lot ${steps[i]}`;
                    const scenarioId = await createScenario(model.id, scName);
                    useScenarioStore.getState().applyScenarioChange(scenarioId, 'Product', mtModalProduct, product.name, 'lot_size', 'Lot Size', steps[i]);
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
                }
              }}
            >
              Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Optimise Lot Sizes Modal ── */}
      <Dialog open={olModalOpen} onOpenChange={setOlModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Optimise Lot Sizes and Transfer Batches</DialogTitle>
            <DialogDescription>MPX will iteratively adjust lot sizes and transfer batches to minimise weighted WIP.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">What-if Name</Label>
              <Input value={olName} onChange={e => setOlName(e.target.value)} placeholder="Optimised Lot Sizes" />
            </div>

            <div className="flex gap-4">
              {/* Product table */}
              <div className="flex-1 border border-border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Product Name</TableHead>
                      <TableHead className="text-xs text-right w-28">Total Unit Value</TableHead>
                      <TableHead className="text-xs text-center w-24">Opt. Lot Size</TableHead>
                      <TableHead className="text-xs text-center w-24">Opt. T-Batch</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model?.products.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm py-1.5">{p.name}</TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            type="number" min={0} step={0.01}
                            className="h-7 text-xs text-right w-24 ml-auto"
                            value={olUnitValues[p.id] ?? 1}
                            onChange={e => setOlUnitValues(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                          />
                        </TableCell>
                        <TableCell className="text-center py-1.5">
                          <Checkbox
                            checked={olOptLot.has(p.id)}
                            onCheckedChange={checked => {
                              setOlOptLot(prev => { const n = new Set(prev); if (checked) n.add(p.id); else n.delete(p.id); return n; });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-center py-1.5">
                          <Checkbox
                            checked={olOptTb.has(p.id)}
                            onCheckedChange={checked => {
                              setOlOptTb(prev => { const n = new Set(prev); if (checked) n.add(p.id); else n.delete(p.id); return n; });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Right-side buttons */}
              <div className="flex flex-col gap-2 shrink-0 w-44">
                <Button size="sm" variant="outline" className="text-xs justify-start" onClick={() => setOlOptLot(new Set(model?.products.map(p => p.id) || []))}>Select All Lot Sizes</Button>
                <Button size="sm" variant="outline" className="text-xs justify-start" onClick={() => setOlOptLot(new Set())}>Deselect All Lot Sizes</Button>
                <Button size="sm" variant="outline" className="text-xs justify-start mt-2" onClick={() => setOlOptTb(new Set(model?.products.map(p => p.id) || []))}>Select All Transfer Batches</Button>
                <Button size="sm" variant="outline" className="text-xs justify-start" onClick={() => setOlOptTb(new Set())}>Deselect All Transfer Batches</Button>
              </div>
            </div>

            {/* WIP displays */}
            <div className="flex gap-6 text-sm">
              <div><span className="text-muted-foreground">Initial WIP Total Unit Value:</span> <span className="font-mono font-medium">{olInitialWip != null ? olInitialWip.toLocaleString() : '—'}</span></div>
              <div><span className="text-muted-foreground">Current WIP Total Unit Value:</span> <span className="font-mono font-medium">{olCurrentWip != null ? olCurrentWip.toLocaleString() : '—'}</span></div>
            </div>

            <p className="text-xs text-muted-foreground">
              Results will be real numbers. Round up to whole numbers when applying to your model. The function is flat near the optimum so nearby values give similar results.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOlModalOpen(false)}>Cancel</Button>
            <Button
              disabled={advRunning || (olOptLot.size === 0 && olOptTb.size === 0)}
              onClick={async () => {
                setOlModalOpen(false);
                if (!model) return;
                setAdvRunning(true);

                const selectedIds = new Set([...olOptLot, ...olOptTb]);
                const selectedProducts = model.products.filter(p => selectedIds.has(p.id));
                if (selectedProducts.length === 0) { setAdvRunning(false); return; }

                const baseCalc = calculate(model);
                const weightedWip = (r: CalcResults) => r.products.reduce((s, pr) => s + pr.wip * (olUnitValues[pr.id] || 1), 0);
                let bestWip = weightedWip(baseCalc);

                let bestLots: Record<string, number> = {};
                let bestTBatches: Record<string, number> = {};
                model.products.forEach(p => { bestLots[p.id] = p.lot_size; bestTBatches[p.id] = p.tbatch_size; });

                const maxIter = 60;
                for (let iter = 0; iter < maxIter; iter++) {
                  setAdvProgress({ current: iter + 1, total: maxIter, label: `Weighted WIP: ${Math.round(bestWip)} (iter ${iter + 1})` });
                  setOlCurrentWip(Math.round(bestWip * 100) / 100);
                  let improved = false;

                  for (const p of selectedProducts) {
                    // Try lot size changes
                    if (olOptLot.has(p.id)) {
                      for (const delta of [-Math.max(1, Math.round(bestLots[p.id] * 0.1)), Math.max(1, Math.round(bestLots[p.id] * 0.1))]) {
                        const newLot = Math.max(1, bestLots[p.id] + delta);
                        if (newLot === bestLots[p.id]) continue;
                        const testModel = { ...model, products: model.products.map(pp => ({
                          ...pp,
                          lot_size: pp.id === p.id ? newLot : (bestLots[pp.id] ?? pp.lot_size),
                          tbatch_size: bestTBatches[pp.id] ?? pp.tbatch_size,
                        })) };
                        const r = calculate(testModel);
                        const w = weightedWip(r);
                        if (w < bestWip && r.overLimitResources.length === 0) {
                          bestLots[p.id] = newLot; bestWip = w; improved = true;
                        }
                      }
                    }
                    // Try transfer batch changes
                    if (olOptTb.has(p.id)) {
                      for (const delta of [-Math.max(1, Math.round(Math.abs(bestTBatches[p.id]) * 0.15)), Math.max(1, Math.round(Math.abs(bestTBatches[p.id]) * 0.15))]) {
                        const newTb = Math.max(1, bestTBatches[p.id] + delta);
                        if (newTb === bestTBatches[p.id]) continue;
                        const testModel = { ...model, products: model.products.map(pp => ({
                          ...pp,
                          lot_size: bestLots[pp.id] ?? pp.lot_size,
                          tbatch_size: pp.id === p.id ? newTb : (bestTBatches[pp.id] ?? pp.tbatch_size),
                        })) };
                        const r = calculate(testModel);
                        const w = weightedWip(r);
                        if (w < bestWip && r.overLimitResources.length === 0) {
                          bestTBatches[p.id] = newTb; bestWip = w; improved = true;
                        }
                      }
                    }
                  }
                  if (!improved) break;
                  await new Promise(r => setTimeout(r, 0));
                }

                // Save as What-if
                const scenarioId = await createScenario(model.id, olName || 'Optimised Lot Sizes');
                for (const p of selectedProducts) {
                  if (olOptLot.has(p.id) && bestLots[p.id] !== p.lot_size) {
                    useScenarioStore.getState().applyScenarioChange(scenarioId, 'Product', p.id, p.name, 'lot_size', 'Lot Size', bestLots[p.id]);
                  }
                  if (olOptTb.has(p.id) && bestTBatches[p.id] !== p.tbatch_size) {
                    useScenarioStore.getState().applyScenarioChange(scenarioId, 'Product', p.id, p.name, 'tbatch_size', 'Transfer Batch Size', bestTBatches[p.id]);
                  }
                }
                const scenario = useScenarioStore.getState().scenarios.find(s => s.id === scenarioId);
                if (scenario) {
                  const r = calculate(model, scenario);
                  setStoreResults(scenarioId, r);
                  useScenarioStore.getState().markCalculated(scenarioId);
                  scenarioDb.saveResults(scenarioId, r);
                }
                setOlCurrentWip(Math.round(bestWip * 100) / 100);
                setAdvProgress(null);
                setAdvRunning(false);
                const reduction = olInitialWip ? Math.round((1 - bestWip / olInitialWip) * 100) : 0;
                toast.success(`Optimisation complete — weighted WIP reduced by ${reduction}%`);
              }}
            >
              Run Optimisation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

/* ─── Util-Only Banner ─── */
function UtilOnlyBanner({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 p-3 mb-4 bg-warning/10 border border-warning/30 rounded-md">
      <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
      <span className="text-sm text-warning font-medium">{message || 'WIP and MCT results require Full Calculate. These results show utilisation data only.'}</span>
    </div>
  );
}

/* ─── IBOM Tab Content ─── */
function IBOMTabContent({ model, results, basecaseResults, isRunning, isUtilOnly, ibomSubTab, setIbomSubTab, ibomZoom, setIbomZoom }: {
  model: Model; results: CalcResults; basecaseResults: CalcResults | undefined; isRunning: boolean; isUtilOnly: boolean;
  ibomSubTab: string; setIbomSubTab: (t: string) => void; ibomZoom: number; setIbomZoom: (z: number) => void;
}) {
  const allScenarios = useScenarioStore(s => s.scenarios);
  const modelScenarios = allScenarios.filter(s => s.modelId === model.id);
  const { getResults } = useResultsStore();

  // Find final assemblies
  const finalAssemblies = useMemo(() => {
    const parentIds = new Set(model.ibom.map(e => e.parent_product_id));
    const componentIds = new Set(model.ibom.map(e => e.component_product_id));
    const topLevel = model.products.filter(p => parentIds.has(p.id) && !componentIds.has(p.id));
    return topLevel.length > 0 ? topLevel : model.products.filter(p => parentIds.has(p.id));
  }, [model]);

  const [selectedProductId, setSelectedProductId] = useState(() => finalAssemblies[0]?.id || '');
  const [scenarioId, setScenarioId] = useState('basecase');

  const ibomResults = getResults(scenarioId) || results;
  const scenario = allScenarios.find(s => s.id === scenarioId);
  const scenarioLabel = scenarioId === 'basecase' ? 'Basecase results' : `${scenario?.name || 'What-if'} results`;
  const mctUnit = model.general.mct_time_unit.toLowerCase() + 's';
  const runScenarios = modelScenarios.filter(s => getResults(s.id));

  // No IBOM structure
  if (model.ibom.length === 0 || finalAssemblies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Network className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-base font-medium text-muted-foreground mb-1">No IBOM structure defined</p>
        <p className="text-sm text-muted-foreground/70">Go to Input → IBOM to add component relationships between products.</p>
      </div>
    );
  }

  const hasChildren = model.ibom.some(e => e.parent_product_id === selectedProductId);
  const tree = hasChildren ? buildNodeTree(model, ibomResults, selectedProductId, 0, new Set()) : null;
  const poles = tree ? buildPoles(tree) : [];
  const showZoom = ibomSubTab === 'tree-chart' || ibomSubTab === 'poles-chart';

  return (
    <div className="flex flex-col h-full">
      {/* Level 2 sub-tab bar */}
      <div className="flex h-8 items-center gap-0 border-b border-border/50 -mx-6 px-6 mb-0 shrink-0">
        {([
          { key: 'tree-chart', label: 'Tree Chart' },
          { key: 'tree-table', label: 'Tree Table' },
          { key: 'poles-chart', label: 'Poles Chart' },
          { key: 'poles-table', label: 'Poles Table' },
        ] as const).map(st => (
          <button
            key={st.key}
            onClick={() => setIbomSubTab(st.key)}
            className={`h-8 px-4 text-[13px] relative transition-colors ${
              ibomSubTab === st.key
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {st.label}
            {ibomSubTab === st.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/60" />
            )}
          </button>
        ))}
      </div>

      {/* Shared IBOM control bar */}
      <div className="flex items-center gap-3 py-3 -mx-6 px-6 border-b border-border/30 mb-4">
        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Select assembly..." /></SelectTrigger>
          <SelectContent>
            {finalAssemblies.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Select value={scenarioId} onValueChange={setScenarioId}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="basecase">Basecase</SelectItem>
            {runScenarios.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <span className="text-sm font-medium text-primary whitespace-nowrap">{scenarioLabel}</span>

        {showZoom && <ZoomSelect zoom={ibomZoom} setZoom={setIbomZoom} />}
      </div>

      {/* Util-only banner for all IBOM sub-tabs */}
      {isUtilOnly && <UtilOnlyBanner message="IBOM MCT results require Full Calculate." />}

      {/* No children for selected product */}
      {!tree ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">This product has no components. Select a product with sub-assemblies to view the IBOM tree.</p>
        </div>
      ) : (
        <>
          {ibomSubTab === 'tree-chart' && (
            <>
              <TreeChart model={model} results={ibomResults} tree={tree} mctUnit={mctUnit} zoom={ibomZoom} />
              <MCTLegend />
            </>
          )}
          {ibomSubTab === 'tree-table' && (
            <TreeTable model={model} results={ibomResults} tree={tree} mctUnit={mctUnit} />
          )}
          {ibomSubTab === 'poles-chart' && (
            <>
              <PolesChart model={model} poles={poles} mctUnit={mctUnit} zoom={ibomZoom} />
              <MCTLegend />
            </>
          )}
          {ibomSubTab === 'poles-table' && (
            <PolesTable model={model} poles={poles} mctUnit={mctUnit} />
          )}
        </>
      )}
    </div>
  );
}

/* ─── Product Results Table ─── */
function ProductResultsTable({ results, model, displayScenarioResults }: {
  results: CalcResults; model: any;
  displayScenarioResults: { id: string; scenario: any; results: CalcResults }[];
}) {
  const { sorted, sort, handleSort } = useSortableTable(results.products, 'mct', 'desc');
  const hasScenarios = displayScenarioResults.length > 0;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Product Results Table</CardTitle></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <SortHead label="Product" sortKey="name" current={sort} onSort={handleSort} align="left" />
            <SortHead label="Demand" sortKey="demand" current={sort} onSort={handleSort} />
            <SortHead label="Good Made" sortKey="goodMade" current={sort} onSort={handleSort} />
            <SortHead label="Good Shipped" sortKey="goodShipped" current={sort} onSort={handleSort} />
            <SortHead label="Started" sortKey="started" current={sort} onSort={handleSort} />
            <SortHead label="Scrap" sortKey="scrap" current={sort} onSort={handleSort} />
            <SortHead label="WIP" sortKey="wip" current={sort} onSort={handleSort} />
            <SortHead label="MCT" sortKey="mct" current={sort} onSort={handleSort} />
            {hasScenarios && displayScenarioResults.map(sr => (
              <React.Fragment key={sr.id}>
                <TableHead className="font-mono text-xs text-right">{sr.scenario.name} WIP</TableHead>
                <TableHead className="font-mono text-xs text-right">{sr.scenario.name} MCT</TableHead>
              </React.Fragment>
            ))}
          </TableRow></TableHeader>
          <TableBody>
            {sorted.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono font-medium">{row.name}</TableCell>
                <TableCell className="font-mono text-right">{row.demand?.toLocaleString()}</TableCell>
                <TableCell className="font-mono text-right">{row.goodMade.toLocaleString()}</TableCell>
                <TableCell className="font-mono text-right">{row.goodShipped.toLocaleString()}</TableCell>
                <TableCell className="font-mono text-right">{row.started.toLocaleString()}</TableCell>
                <TableCell className="font-mono text-right">{row.scrap > 0 ? row.scrap.toLocaleString() : '—'}</TableCell>
                <TableCell className="font-mono text-right">{row.wip}</TableCell>
                <TableCell className="font-mono text-right font-medium">{row.mct.toFixed(4)}</TableCell>
                {hasScenarios && displayScenarioResults.map(sr => {
                  const sp = sr.results.products.find((p: any) => p.id === row.id);
                  return (
                    <React.Fragment key={sr.id}>
                      <TableCell className="font-mono text-right text-xs">{sp?.wip ?? '—'}</TableCell>
                      <TableCell className={`font-mono text-right text-xs ${sp && sp.mct < row.mct ? 'text-success' : sp && sp.mct > row.mct ? 'text-destructive' : ''}`}>
                        {sp?.mct.toFixed(4) || '—'}
                      </TableCell>
                    </React.Fragment>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ─── Product Oper Details (for Products tab sub-tab) ─── */
function ProductOperDetails({ model, results }: { model: Model; results: CalcResults }) {
  const [selectedId, setSelectedId] = useState('');
  const [showTimeUnits, setShowTimeUnits] = useState(false);

  const g = model.general;
  const conv1 = Math.max(g.conv1, 0.001);
  const conv2 = Math.max(g.conv2, 0.001);
  const opsPerPeriod = conv1 * conv2;

  const allMetrics = useMemo(() => {
    return model.operations.map(op => {
      const eq = model.equipment.find(e => e.id === op.equip_id);
      const prod = model.products.find(p => p.id === op.product_id);
      const pr = results.products.find(p => p.id === op.product_id);
      const er = eq ? results.equipment.find(e => e.id === eq.id) : null;
      const lab = eq ? model.labor.find(l => l.id === eq.labor_group_id) : null;
      if (!prod || !pr || !eq) return null;
      const demand = pr.demand;
      if (demand <= 0) return null;
      const lotSize = Math.max(1, prod.lot_size * prod.lot_factor);
      const tbatchSize = prod.tbatch_size === -1 ? lotSize : Math.max(1, prod.tbatch_size);
      const numTbatches = Math.ceil(lotSize / tbatchSize);
      const assignFrac = op.pct_assigned / 100;
      const numLots = (demand / lotSize) * assignFrac;
      const prodSetupFactor = prod.setup_factor || 1;
      const eqSetupTime = numLots * (op.equip_setup_lot + op.equip_setup_piece * lotSize + op.equip_setup_tbatch * numTbatches) * eq.setup_factor * prodSetupFactor;
      const eqRunTime = numLots * (op.equip_run_piece * lotSize + op.equip_run_lot + op.equip_run_tbatch * numTbatches) * eq.run_factor;
      const eqCount = eq.count > 0 ? eq.count : 1;
      const eqAvail = eqCount * (1 + eq.overtime_pct / 100) * (1 - (eq.unavail_pct || 0) / 100) * opsPerPeriod;
      let repairFrac = 0;
      if (eq.mttf > 0 && eq.mttr > 0) repairFrac = eq.mttr / (eq.mttf + eq.mttr);
      const eqEffAvail = eqAvail * (1 - repairFrac);
      const eqSetupUtil = eqEffAvail > 0 ? (eqSetupTime / eqEffAvail) * 100 : 0;
      const eqRunUtil = eqEffAvail > 0 ? (eqRunTime / eqEffAvail) * 100 : 0;
      const labSetupTime = lab ? numLots * (op.labor_setup_lot + op.labor_setup_piece * lotSize + op.labor_setup_tbatch * numTbatches) * lab.setup_factor * prodSetupFactor : 0;
      const labRunTime = lab ? numLots * (op.labor_run_piece * lotSize + op.labor_run_lot + op.labor_run_tbatch * numTbatches) * lab.run_factor : 0;
      const labAvail = lab ? lab.count * (1 + lab.overtime_pct / 100) * (1 - lab.unavail_pct / 100) * opsPerPeriod : 0;
      const labSetupUtil = labAvail > 0 ? (labSetupTime / labAvail) * 100 : 0;
      const labRunUtil = labAvail > 0 ? (labRunTime / labAvail) * 100 : 0;
      const allOpsForProd = model.operations.filter(o => o.product_id === op.product_id);
      const wipShare = pr.wip / Math.max(1, allOpsForProd.length);
      const perPieceSetup = numLots > 0 ? (eqSetupTime / numLots) / lotSize : 0;
      const perPieceRun = numLots > 0 ? (eqRunTime / numLots) / lotSize : 0;
      const mctAtOp = ((perPieceSetup + perPieceRun) / conv1) * assignFrac;
      return {
        opId: op.id, opName: op.op_name, opNumber: op.op_number,
        productName: prod.name, productId: prod.id,
        equipName: eq.name, equipId: eq.id,
        laborName: lab?.name || '—', laborId: lab?.id || '',
        pctAssigned: op.pct_assigned,
        eqSetupUtil: Math.round(eqSetupUtil * 10) / 10,
        eqRunUtil: Math.round(eqRunUtil * 10) / 10,
        eqSetupTime: Math.round(eqSetupTime * 1000) / 1000,
        eqRunTime: Math.round(eqRunTime * 1000) / 1000,
        waitLaborUtil: er?.waitLaborUtil || 0,
        labSetupUtil: Math.round(labSetupUtil * 10) / 10,
        labRunUtil: Math.round(labRunUtil * 10) / 10,
        labSetupTime: Math.round(labSetupTime * 1000) / 1000,
        labRunTime: Math.round(labRunTime * 1000) / 1000,
        wip: Math.round(wipShare * 10) / 10,
        mctAtOp: Math.round(mctAtOp * 10000) / 10000,
      };
    }).filter(Boolean) as any[];
  }, [model, results, conv1, opsPerPeriod]);

  const fmtVal = (pct: number, time: number) => showTimeUnits ? time.toFixed(3) : pct.toString();
  const unitSuffix = showTimeUnits ? ` (${g.ops_time_unit})` : ' %';

  const prodOps = useMemo(() => allMetrics.filter((m: any) => m.productId === selectedId), [allMetrics, selectedId]);
  const prodSort = useSortableTable(prodOps, 'opNumber', 'asc');

  const prod = model.products.find((p: any) => p.id === selectedId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Oper Details — By Product</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="Select product…" /></SelectTrigger>
            <SelectContent>
              {model.products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant={showTimeUnits ? 'secondary' : 'outline'} size="sm" className="text-xs gap-1 h-7" onClick={() => setShowTimeUnits(!showTimeUnits)}>
            <Clock className="h-3 w-3" />
            {showTimeUnits ? `Time (${g.ops_time_unit})` : '% Time'}
          </Button>
        </div>
        {!prod ? (
          <p className="text-sm text-muted-foreground text-center py-8">Select a product to view operation details.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <SortHead label="Operation" sortKey="opName" current={prodSort.sort} onSort={prodSort.handleSort} align="left" />
                <SortHead label="Equipment" sortKey="equipName" current={prodSort.sort} onSort={prodSort.handleSort} align="left" />
                <SortHead label="Labor" sortKey="laborName" current={prodSort.sort} onSort={prodSort.handleSort} align="left" />
                <SortHead label="% Assign" sortKey="pctAssigned" current={prodSort.sort} onSort={prodSort.handleSort} />
                <SortHead label={`Eq Setup${unitSuffix}`} sortKey="eqSetupUtil" current={prodSort.sort} onSort={prodSort.handleSort} />
                <SortHead label={`Eq Run${unitSuffix}`} sortKey="eqRunUtil" current={prodSort.sort} onSort={prodSort.handleSort} />
                <SortHead label={`Wait Labor${unitSuffix}`} sortKey="waitLaborUtil" current={prodSort.sort} onSort={prodSort.handleSort} />
                <SortHead label={`Lab Setup${unitSuffix}`} sortKey="labSetupUtil" current={prodSort.sort} onSort={prodSort.handleSort} />
                <SortHead label={`Lab Run${unitSuffix}`} sortKey="labRunUtil" current={prodSort.sort} onSort={prodSort.handleSort} />
                <SortHead label="WIP" sortKey="wip" current={prodSort.sort} onSort={prodSort.handleSort} />
                <SortHead label="MCT at Op" sortKey="mctAtOp" current={prodSort.sort} onSort={prodSort.handleSort} />
              </TableRow></TableHeader>
              <TableBody>
                {prodSort.sorted.map((m: any) => (
                  <TableRow key={m.opId}>
                    <TableCell className="font-mono text-xs font-medium">{m.opName}</TableCell>
                    <TableCell className="font-mono text-xs">{m.equipName}</TableCell>
                    <TableCell className="font-mono text-xs">{m.laborName}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.pctAssigned}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{fmtVal(m.eqSetupUtil, m.eqSetupTime)}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{fmtVal(m.eqRunUtil, m.eqRunTime)}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.waitLaborUtil}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{fmtVal(m.labSetupUtil, m.labSetupTime)}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{fmtVal(m.labRunUtil, m.labRunTime)}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.wip}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.mctAtOp.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Shared sub-components ─── */

function NoResultsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-3" />
      <p className="text-base font-medium text-muted-foreground mb-1">No results yet</p>
      <p className="text-sm text-muted-foreground/70">Run Full Calculate to see results.</p>
    </div>
  );
}

function QuickStatCard({ label, value, metric }: { label: string; value: string; metric: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
      {metric && <p className="text-sm font-mono text-muted-foreground mt-0.5">{metric}</p>}
      <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
    </div>
  );
}

/* ─── Summary sub-components ─── */

function NormalSummary({ results, model, scenarioResults }: {
  results: CalcResults; model: any;
  scenarioResults: { id: string; scenario: any; results: CalcResults }[];
}) {
  const hasScenarios = scenarioResults.length > 0;

  // Group products by dept_code for subtotals
  const groups = useMemo(() => {
    const map = new Map<string, ProductResult[]>();
    results.products.forEach(pr => {
      const prod = model.products.find((p: any) => p.id === pr.id);
      const group = prod?.dept_code || '';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(pr);
    });
    return map;
  }, [results, model]);
  const hasGroups = [...groups.keys()].some(k => k !== '');

  const renderProductRow = (row: ProductResult) => (
    <TableRow key={row.id}>
      <TableCell className="font-mono font-medium">{row.name}</TableCell>
      <TableCell className="font-mono text-right">{row.goodMade.toLocaleString()}</TableCell>
      <TableCell className="font-mono text-right">{row.goodShipped.toLocaleString()}</TableCell>
      <TableCell className="font-mono text-right">{row.started.toLocaleString()}</TableCell>
      <TableCell className="font-mono text-right">{row.scrap > 0 ? row.scrap.toLocaleString() : '—'}</TableCell>
      <TableCell className="font-mono text-right">{row.wip}</TableCell>
      <TableCell className="font-mono text-right font-medium">{row.mct.toFixed(4)}</TableCell>
      {hasScenarios && scenarioResults.map(sr => {
        const sp = sr.results.products.find(p => p.id === row.id);
        return (
          <React.Fragment key={sr.id}>
            <TableCell className="font-mono text-right text-xs">{sp?.wip ?? '—'}</TableCell>
            <TableCell className={`font-mono text-right text-xs ${sp && sp.mct < row.mct ? 'text-success' : sp && sp.mct > row.mct ? 'text-destructive' : ''}`}>
              {sp?.mct.toFixed(4) || '—'}
              {sp && sp.mct !== row.mct && <span className="ml-1 text-[10px]">({(sp.mct - row.mct) > 0 ? '+' : ''}{(sp.mct - row.mct).toFixed(4)})</span>}
            </TableCell>
          </React.Fragment>
        );
      })}
    </TableRow>
  );

  const renderSubtotal = (label: string, products: ProductResult[]) => (
    <TableRow key={`sub-${label}`} className="bg-muted/50 font-medium">
      <TableCell className="font-mono text-xs">{label} subtotal</TableCell>
      <TableCell className="font-mono text-right text-xs">{products.reduce((s, r) => s + r.goodMade, 0).toLocaleString()}</TableCell>
      <TableCell className="font-mono text-right text-xs">{products.reduce((s, r) => s + r.goodShipped, 0).toLocaleString()}</TableCell>
      <TableCell className="font-mono text-right text-xs">{products.reduce((s, r) => s + r.started, 0).toLocaleString()}</TableCell>
      <TableCell className="font-mono text-right text-xs">{products.reduce((s, r) => s + r.scrap, 0).toLocaleString()}</TableCell>
      <TableCell className="font-mono text-right text-xs">{products.reduce((s, r) => s + r.wip, 0).toFixed(1)}</TableCell>
      <TableCell className="font-mono text-right text-xs">{Math.min(...products.map(p => p.mct)).toFixed(4)}–{Math.max(...products.map(p => p.mct)).toFixed(4)}</TableCell>
      {hasScenarios && scenarioResults.map(sr => <React.Fragment key={sr.id}><TableCell /><TableCell /></React.Fragment>)}
    </TableRow>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-mono text-xs">Product</TableHead>
          <TableHead className="font-mono text-xs text-right">Good Made</TableHead>
          <TableHead className="font-mono text-xs text-right">Good Shipped</TableHead>
          <TableHead className="font-mono text-xs text-right">Started</TableHead>
          <TableHead className="font-mono text-xs text-right">Scrap</TableHead>
          <TableHead className="font-mono text-xs text-right">WIP</TableHead>
          <TableHead className="font-mono text-xs text-right">MCT ({model.general.mct_time_unit})</TableHead>
          {hasScenarios && scenarioResults.map(sr => (
            <React.Fragment key={sr.id}>
              <TableHead className="font-mono text-xs text-right text-primary">WIP {sr.scenario.name}</TableHead>
              <TableHead className="font-mono text-xs text-right text-primary">MCT {sr.scenario.name}</TableHead>
            </React.Fragment>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {hasGroups ? (
          [...groups.entries()].map(([group, products]) => (
            <React.Fragment key={`grp-${group}`}>{products.map(renderProductRow)}{group && renderSubtotal(group, products)}</React.Fragment>
          ))
        ) : (
          results.products.map(renderProductRow)
        )}
        <TableRow className="border-t-2 font-medium">
          <TableCell className="font-mono">TOTAL</TableCell>
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.goodMade, 0).toLocaleString()}</TableCell>
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.goodShipped, 0).toLocaleString()}</TableCell>
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.started, 0).toLocaleString()}</TableCell>
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.scrap, 0).toLocaleString()}</TableCell>
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.wip, 0).toFixed(1)}</TableCell>
          <TableCell className="font-mono text-right">—</TableCell>
          {hasScenarios && scenarioResults.map(sr => <React.Fragment key={sr.id}><TableCell /><TableCell /></React.Fragment>)}
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

/* Old IBOM sub-components removed — now in src/components/IBOMOutput.tsx */

/* ─── Equipment WIP Chart ─── */
function EquipmentWIPChart({ results, model, isMultiScenario, chartScenarios }: {
  results: CalcResults; model: Model; isMultiScenario: boolean; chartScenarios: ScenarioEntry[];
}) {
  const [showTable, setShowTable] = useState(false);

  // Compute WIP per equipment group from product results and operations
  const wipData = useMemo(() => {
    const equipWip: Record<string, { name: string; inProcess: number; waiting: number }> = {};
    model.equipment.forEach(eq => { equipWip[eq.id] = { name: eq.name, inProcess: 0, waiting: 0 }; });

    results.products.forEach(pr => {
      const ops = model.operations.filter(o => o.product_id === pr.id);
      if (ops.length === 0 || pr.wip <= 0) return;
      const wipPerOp = pr.wip / ops.length;
      ops.forEach(op => {
        if (op.equip_id && equipWip[op.equip_id]) {
          const eqResult = results.equipment.find(e => e.id === op.equip_id);
          const totalUtil = eqResult?.totalUtil || 0;
          const runFrac = totalUtil > 0 ? ((eqResult?.runUtil || 0) / totalUtil) : 0.5;
          equipWip[op.equip_id].inProcess += wipPerOp * runFrac;
          equipWip[op.equip_id].waiting += wipPerOp * (1 - runFrac);
        }
      });
    });
    return Object.values(equipWip).filter(e => e.inProcess > 0 || e.waiting > 0)
      .map(e => ({ name: e.name, inProcess: Math.round(e.inProcess * 10) / 10, waiting: Math.round(e.waiting * 10) / 10, total: Math.round((e.inProcess + e.waiting) * 10) / 10 }));
  }, [results, model]);

  if (wipData.length === 0) return (
    <Card><CardContent className="py-12 text-center"><BarChart3 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">Run the model to see Equipment WIP results.</p></CardContent></Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Equipment WIP</CardTitle>
        <CardDescription>Work-in-progress at each equipment group</CardDescription>
      </CardHeader>
      <CardContent className="relative">
        <ChartScenarioLabel />
        {showTable ? (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="font-mono text-xs">Equipment</TableHead>
              <TableHead className="font-mono text-xs text-right">In-Process</TableHead>
              <TableHead className="font-mono text-xs text-right">Waiting</TableHead>
              <TableHead className="font-mono text-xs text-right">Total WIP</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {wipData.map(e => (
                <TableRow key={e.name}>
                  <TableCell className="font-mono font-medium">{e.name}</TableCell>
                  <TableCell className="font-mono text-right">{e.inProcess}</TableCell>
                  <TableCell className="font-mono text-right">{e.waiting}</TableCell>
                  <TableCell className="font-mono text-right font-medium">{e.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={wipData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={axisStyle} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: 'WIP (units)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="inProcess" fill="hsl(270, 50%, 60%)" name="In Process" />
              <Bar dataKey="waiting" fill="hsl(38, 92%, 50%)" name="Waiting" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Labor Equipment Wait Chart ─── */
function LaborWaitChart({ results, model }: { results: CalcResults; model: Model }) {
  const [showTable, setShowTable] = useState(false);

  const waitData = useMemo(() => {
    return model.labor.map(lab => {
      const equipGroups = model.equipment.filter(eq => eq.labor_group_id === lab.id);
      const laborResult = results.labor.find(l => l.id === lab.id);
      const totalUtil = laborResult?.totalUtil || 0;
      const machinesTended = equipGroups.reduce((sum, eq) => {
        const er = results.equipment.find(e => e.id === eq.id);
        return sum + (er ? Math.min(1, (er.setupUtil + er.runUtil) / 100) * eq.count : 0);
      }, 0);
      const machinesWaiting = equipGroups.reduce((sum, eq) => {
        const er = results.equipment.find(e => e.id === eq.id);
        return sum + (er ? (er.waitLaborUtil / 100) * eq.count : 0);
      }, 0);
      return {
        name: lab.name,
        tended: Math.round(machinesTended * 10) / 10,
        waiting: Math.round(machinesWaiting * 10) / 10,
        waitLaborUtil: equipGroups.reduce((sum, eq) => {
          const er = results.equipment.find(e => e.id === eq.id);
          return sum + (er?.waitLaborUtil || 0);
        }, 0) / Math.max(1, equipGroups.length),
        idle: laborResult?.idle || 0,
      };
    }).filter(d => d.tended > 0 || d.waiting > 0);
  }, [results, model]);

  if (waitData.length === 0) return (
    <Card><CardContent className="py-12 text-center"><BarChart3 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">Run the model to see Equipment Wait results.</p></CardContent></Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Equipment Wait Chart</CardTitle>
        <CardDescription>High 'Waiting' bars indicate a labor shortage — machines are idle waiting for operators.</CardDescription>
      </CardHeader>
      <CardContent className="relative">
        <ChartScenarioLabel />
        {showTable ? (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="font-mono text-xs">Labor Group</TableHead>
              <TableHead className="font-mono text-xs text-right">Avg Machines Tended</TableHead>
              <TableHead className="font-mono text-xs text-right">Avg Machines Waiting</TableHead>
              <TableHead className="font-mono text-xs text-right">Wait Labor %</TableHead>
              <TableHead className="font-mono text-xs text-right">Idle %</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {waitData.map(d => (
                <TableRow key={d.name}>
                  <TableCell className="font-mono font-medium">{d.name}</TableCell>
                  <TableCell className="font-mono text-right">{d.tended}</TableCell>
                  <TableCell className="font-mono text-right">{d.waiting}</TableCell>
                  <TableCell className="font-mono text-right">{Math.round(d.waitLaborUtil * 10) / 10}</TableCell>
                  <TableCell className="font-mono text-right text-muted-foreground">{d.idle}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={waitData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={axisStyle} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: 'Machines', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="tended" fill="hsl(142, 71%, 45%)" name="Avg Machines Tended" />
              <Bar dataKey="waiting" fill="hsl(0, 72%, 51%)" name="Avg Machines Waiting" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Oper Details Tab ─── */
function OperDetailsTab({ model, results }: { model: Model; results: CalcResults }) {
  const [subTab, setSubTab] = useState<'equipment' | 'labor' | 'product'>('equipment');
  const [selectedId, setSelectedId] = useState('');
  const [showTimeUnits, setShowTimeUnits] = useState(false);

  const g = model.general;
  const conv1 = Math.max(g.conv1, 0.001);
  const conv2 = Math.max(g.conv2, 0.001);
  const opsPerPeriod = conv1 * conv2;

  // Compute per-operation metrics
  const allMetrics = useMemo(() => {
    return model.operations.map(op => {
      const eq = model.equipment.find(e => e.id === op.equip_id);
      const prod = model.products.find(p => p.id === op.product_id);
      const pr = results.products.find(p => p.id === op.product_id);
      const er = eq ? results.equipment.find(e => e.id === eq.id) : null;
      const lab = eq ? model.labor.find(l => l.id === eq.labor_group_id) : null;
      if (!prod || !pr || !eq) return null;
      const demand = pr.demand;
      if (demand <= 0) return null;
      const lotSize = Math.max(1, prod.lot_size * prod.lot_factor);
      const tbatchSize = prod.tbatch_size === -1 ? lotSize : Math.max(1, prod.tbatch_size);
      const numTbatches = Math.ceil(lotSize / tbatchSize);
      const assignFrac = op.pct_assigned / 100;
      const numLots = (demand / lotSize) * assignFrac;
      const prodSetupFactor = prod.setup_factor || 1;
      const eqSetupTime = numLots * (op.equip_setup_lot + op.equip_setup_piece * lotSize + op.equip_setup_tbatch * numTbatches) * eq.setup_factor * prodSetupFactor;
      const eqRunTime = numLots * (op.equip_run_piece * lotSize + op.equip_run_lot + op.equip_run_tbatch * numTbatches) * eq.run_factor;
      const eqCount = eq.count > 0 ? eq.count : 1;
      const eqAvail = eqCount * (1 + eq.overtime_pct / 100) * (1 - (eq.unavail_pct || 0) / 100) * opsPerPeriod;
      let repairFrac = 0;
      if (eq.mttf > 0 && eq.mttr > 0) repairFrac = eq.mttr / (eq.mttf + eq.mttr);
      const eqEffAvail = eqAvail * (1 - repairFrac);
      const eqSetupUtil = eqEffAvail > 0 ? (eqSetupTime / eqEffAvail) * 100 : 0;
      const eqRunUtil = eqEffAvail > 0 ? (eqRunTime / eqEffAvail) * 100 : 0;
      const labSetupTime = lab ? numLots * (op.labor_setup_lot + op.labor_setup_piece * lotSize + op.labor_setup_tbatch * numTbatches) * lab.setup_factor * prodSetupFactor : 0;
      const labRunTime = lab ? numLots * (op.labor_run_piece * lotSize + op.labor_run_lot + op.labor_run_tbatch * numTbatches) * lab.run_factor : 0;
      const labAvail = lab ? lab.count * (1 + lab.overtime_pct / 100) * (1 - lab.unavail_pct / 100) * opsPerPeriod : 0;
      const labSetupUtil = labAvail > 0 ? (labSetupTime / labAvail) * 100 : 0;
      const labRunUtil = labAvail > 0 ? (labRunTime / labAvail) * 100 : 0;
      const allOpsForProd = model.operations.filter(o => o.product_id === op.product_id);
      const wipShare = pr.wip / Math.max(1, allOpsForProd.length);
      const perPieceSetup = numLots > 0 ? (eqSetupTime / numLots) / lotSize : 0;
      const perPieceRun = numLots > 0 ? (eqRunTime / numLots) / lotSize : 0;
      const mctAtOp = ((perPieceSetup + perPieceRun) / conv1) * assignFrac;
      const visits = demand > 0 ? (numLots * lotSize / demand) * 100 : 100;
      return {
        opId: op.id, opName: op.op_name, opNumber: op.op_number,
        productName: prod.name, productId: prod.id,
        equipName: eq.name, equipId: eq.id,
        laborName: lab?.name || '—', laborId: lab?.id || '',
        pctAssigned: op.pct_assigned,
        eqSetupUtil: Math.round(eqSetupUtil * 10) / 10,
        eqRunUtil: Math.round(eqRunUtil * 10) / 10,
        eqSetupTime: Math.round(eqSetupTime * 1000) / 1000,
        eqRunTime: Math.round(eqRunTime * 1000) / 1000,
        waitLaborUtil: er?.waitLaborUtil || 0,
        repairUtil: er?.repairUtil || 0,
        labSetupUtil: Math.round(labSetupUtil * 10) / 10,
        labRunUtil: Math.round(labRunUtil * 10) / 10,
        labSetupTime: Math.round(labSetupTime * 1000) / 1000,
        labRunTime: Math.round(labRunTime * 1000) / 1000,
        wip: Math.round(wipShare * 10) / 10,
        mctAtOp: Math.round(mctAtOp * 10000) / 10000,
        visits: Math.round(visits * 10) / 10,
      };
    }).filter(Boolean) as any[];
  }, [model, results, conv1, opsPerPeriod]);

  const fmtVal = (pct: number, time: number) => showTimeUnits ? time.toFixed(3) : pct.toString();
  const unitSuffix = showTimeUnits ? ` (${g.ops_time_unit})` : ' %';

  // Sort hooks must be called before render functions that use them
  const eqOps = useMemo(() => allMetrics.filter((m: any) => m.equipId === selectedId), [allMetrics, selectedId]);
  const labOps = useMemo(() => allMetrics.filter((m: any) => m.laborId === selectedId), [allMetrics, selectedId]);
  const prodOps = useMemo(() => allMetrics.filter((m: any) => m.productId === selectedId), [allMetrics, selectedId]);
  const eqSort = useSortableTable(eqOps, 'opNumber', 'asc');
  const labSort = useSortableTable(labOps, 'opNumber', 'asc');
  const prodSort = useSortableTable(prodOps, 'opNumber', 'asc');

  const renderByEquipment = () => {
    const eq = model.equipment.find(e => e.id === selectedId);
    if (!eq) return <p className="text-sm text-muted-foreground text-center py-8">Select an equipment group to view operation details.</p>;
    return (
      <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <SortHead label="Product" sortKey="productName" current={eqSort.sort} onSort={eqSort.handleSort} align="left" />
          <SortHead label="Operation" sortKey="opName" current={eqSort.sort} onSort={eqSort.handleSort} align="left" />
          <SortHead label="Op #" sortKey="opNumber" current={eqSort.sort} onSort={eqSort.handleSort} />
          <SortHead label="% Assign" sortKey="pctAssigned" current={eqSort.sort} onSort={eqSort.handleSort} />
          <SortHead label={`Eq Setup${unitSuffix}`} sortKey="eqSetupUtil" current={eqSort.sort} onSort={eqSort.handleSort} />
          <SortHead label={`Eq Run${unitSuffix}`} sortKey="eqRunUtil" current={eqSort.sort} onSort={eqSort.handleSort} />
          <SortHead label={`Wait Labor${unitSuffix}`} sortKey="waitLaborUtil" current={eqSort.sort} onSort={eqSort.handleSort} />
          <SortHead label={`Repair${unitSuffix}`} sortKey="repairUtil" current={eqSort.sort} onSort={eqSort.handleSort} />
          <SortHead label={`Lab Setup${unitSuffix}`} sortKey="labSetupUtil" current={eqSort.sort} onSort={eqSort.handleSort} />
          <SortHead label={`Lab Run${unitSuffix}`} sortKey="labRunUtil" current={eqSort.sort} onSort={eqSort.handleSort} />
          <SortHead label="WIP" sortKey="wip" current={eqSort.sort} onSort={eqSort.handleSort} />
          <SortHead label="MCT at Op" sortKey="mctAtOp" current={eqSort.sort} onSort={eqSort.handleSort} />
          <SortHead label="Visits/100" sortKey="visits" current={eqSort.sort} onSort={eqSort.handleSort} />
        </TableRow></TableHeader>
        <TableBody>
          {eqSort.sorted.map((m: any) => (
            <TableRow key={m.opId}>
              <TableCell className="font-mono text-xs">{m.productName}</TableCell>
              <TableCell className="font-mono text-xs font-medium">{m.opName}</TableCell>
              <TableCell className="font-mono text-xs text-right">{m.opNumber}</TableCell>
              <TableCell className="font-mono text-xs text-right">{m.pctAssigned}</TableCell>
              <TableCell className="font-mono text-xs text-right">{fmtVal(m.eqSetupUtil, m.eqSetupTime)}</TableCell>
              <TableCell className="font-mono text-xs text-right">{fmtVal(m.eqRunUtil, m.eqRunTime)}</TableCell>
              <TableCell className="font-mono text-xs text-right">{m.waitLaborUtil}</TableCell>
              <TableCell className="font-mono text-xs text-right">{m.repairUtil}</TableCell>
              <TableCell className="font-mono text-xs text-right">{fmtVal(m.labSetupUtil, m.labSetupTime)}</TableCell>
              <TableCell className="font-mono text-xs text-right">{fmtVal(m.labRunUtil, m.labRunTime)}</TableCell>
              <TableCell className="font-mono text-xs text-right">{m.wip}</TableCell>
              <TableCell className="font-mono text-xs text-right">{m.mctAtOp.toFixed(4)}</TableCell>
              <TableCell className="font-mono text-xs text-right">{m.visits}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    );
  };

  const renderByLabor = () => {
    const lab = model.labor.find(l => l.id === selectedId);
    if (!lab) return <p className="text-sm text-muted-foreground text-center py-8">Select a labor group to view operation details.</p>;
    return (
      <Table>
        <TableHeader><TableRow>
          <SortHead label="Product" sortKey="productName" current={labSort.sort} onSort={labSort.handleSort} align="left" />
          <SortHead label="Operation" sortKey="opName" current={labSort.sort} onSort={labSort.handleSort} align="left" />
          <SortHead label="Equipment" sortKey="equipName" current={labSort.sort} onSort={labSort.handleSort} align="left" />
          <SortHead label="% Assign" sortKey="pctAssigned" current={labSort.sort} onSort={labSort.handleSort} />
          <SortHead label={`Lab Setup${unitSuffix}`} sortKey="labSetupUtil" current={labSort.sort} onSort={labSort.handleSort} />
          <SortHead label={`Lab Run${unitSuffix}`} sortKey="labRunUtil" current={labSort.sort} onSort={labSort.handleSort} />
          <SortHead label="Eq Tended" sortKey="eqRunUtil" current={labSort.sort} onSort={labSort.handleSort} />
          <SortHead label="Eq Waiting" sortKey="waitLaborUtil" current={labSort.sort} onSort={labSort.handleSort} />
          <SortHead label="WIP" sortKey="wip" current={labSort.sort} onSort={labSort.handleSort} />
          <SortHead label="MCT at Op" sortKey="mctAtOp" current={labSort.sort} onSort={labSort.handleSort} />
        </TableRow></TableHeader>
        <TableBody>
          {labSort.sorted.map((m: any) => {
            const eqResult = results.equipment.find(e => e.name === m.equipName);
            const eqModel = model.equipment.find(e => e.id === m.equipId);
            const tended = eqResult ? Math.min(1, (eqResult.setupUtil + eqResult.runUtil) / 100) * (eqModel?.count || 1) : 0;
            const waiting = eqResult ? (eqResult.waitLaborUtil / 100) * (eqModel?.count || 1) : 0;
            return (
              <TableRow key={m.opId}>
                <TableCell className="font-mono text-xs">{m.productName}</TableCell>
                <TableCell className="font-mono text-xs font-medium">{m.opName}</TableCell>
                <TableCell className="font-mono text-xs">{m.equipName}</TableCell>
                <TableCell className="font-mono text-xs text-right">{m.pctAssigned}</TableCell>
                <TableCell className="font-mono text-xs text-right">{fmtVal(m.labSetupUtil, m.labSetupTime)}</TableCell>
                <TableCell className="font-mono text-xs text-right">{fmtVal(m.labRunUtil, m.labRunTime)}</TableCell>
                <TableCell className="font-mono text-xs text-right">{Math.round(tended * 10) / 10}</TableCell>
                <TableCell className="font-mono text-xs text-right">{Math.round(waiting * 10) / 10}</TableCell>
                <TableCell className="font-mono text-xs text-right">{m.wip}</TableCell>
                <TableCell className="font-mono text-xs text-right">{m.mctAtOp.toFixed(4)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const renderByProduct = () => {
    const prod = model.products.find(p => p.id === selectedId);
    if (!prod) return <p className="text-sm text-muted-foreground text-center py-8">Select a product to view operation details.</p>;
    return (
      <Table>
        <TableHeader><TableRow>
          <SortHead label="Operation" sortKey="opName" current={prodSort.sort} onSort={prodSort.handleSort} align="left" />
          <SortHead label="Equipment" sortKey="equipName" current={prodSort.sort} onSort={prodSort.handleSort} align="left" />
          <SortHead label="Labor" sortKey="laborName" current={prodSort.sort} onSort={prodSort.handleSort} align="left" />
          <SortHead label="% Assign" sortKey="pctAssigned" current={prodSort.sort} onSort={prodSort.handleSort} />
          <SortHead label={`Eq Setup${unitSuffix}`} sortKey="eqSetupUtil" current={prodSort.sort} onSort={prodSort.handleSort} />
          <SortHead label={`Eq Run${unitSuffix}`} sortKey="eqRunUtil" current={prodSort.sort} onSort={prodSort.handleSort} />
          <SortHead label={`Wait Labor${unitSuffix}`} sortKey="waitLaborUtil" current={prodSort.sort} onSort={prodSort.handleSort} />
          <SortHead label={`Lab Setup${unitSuffix}`} sortKey="labSetupUtil" current={prodSort.sort} onSort={prodSort.handleSort} />
          <SortHead label={`Lab Run${unitSuffix}`} sortKey="labRunUtil" current={prodSort.sort} onSort={prodSort.handleSort} />
          <SortHead label="WIP" sortKey="wip" current={prodSort.sort} onSort={prodSort.handleSort} />
          <SortHead label="MCT at Op" sortKey="mctAtOp" current={prodSort.sort} onSort={prodSort.handleSort} />
        </TableRow></TableHeader>
        <TableBody>
          {prodSort.sorted.map((m: any) => (
            <TableRow key={m.opId}>
              <TableCell className="font-mono text-xs font-medium">{m.opName}</TableCell>
              <TableCell className="font-mono text-xs">{m.equipName}</TableCell>
              <TableCell className="font-mono text-xs">{m.laborName}</TableCell>
              <TableCell className="font-mono text-xs text-right">{m.pctAssigned}</TableCell>
              <TableCell className="font-mono text-xs text-right">{fmtVal(m.eqSetupUtil, m.eqSetupTime)}</TableCell>
              <TableCell className="font-mono text-xs text-right">{fmtVal(m.eqRunUtil, m.eqRunTime)}</TableCell>
              <TableCell className="font-mono text-xs text-right">{m.waitLaborUtil}</TableCell>
              <TableCell className="font-mono text-xs text-right">{fmtVal(m.labSetupUtil, m.labSetupTime)}</TableCell>
              <TableCell className="font-mono text-xs text-right">{fmtVal(m.labRunUtil, m.labRunTime)}</TableCell>
              <TableCell className="font-mono text-xs text-right">{m.wip}</TableCell>
              <TableCell className="font-mono text-xs text-right">{m.mctAtOp.toFixed(4)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Oper Details</CardTitle>
        <CardDescription>Per-operation breakdown by resource or product</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={subTab} onValueChange={(v) => { setSubTab(v as any); setSelectedId(''); eqSort.reset(); labSort.reset(); prodSort.reset(); }}>
          <div className="flex items-center justify-between mb-4">
            <TabsList className="h-8">
              <TabsTrigger value="equipment" className="text-xs h-6">By Equipment</TabsTrigger>
              <TabsTrigger value="labor" className="text-xs h-6">By Labor</TabsTrigger>
              <TabsTrigger value="product" className="text-xs h-6">By Product</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-3">
              <Button
                variant={showTimeUnits ? 'secondary' : 'outline'}
                size="sm"
                className="text-xs gap-1 h-7"
                onClick={() => setShowTimeUnits(!showTimeUnits)}
              >
                <Clock className="h-3 w-3" />
                {showTimeUnits ? `Time (${g.ops_time_unit})` : '% Time'}
              </Button>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder={`Select ${subTab}...`} /></SelectTrigger>
                <SelectContent>
                  {subTab === 'equipment' && model.equipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                  {subTab === 'labor' && model.labor.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  {subTab === 'product' && model.products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <TabsContent value="equipment" className="p-0 overflow-x-auto">{renderByEquipment()}</TabsContent>
          <TabsContent value="labor" className="p-0 overflow-x-auto">{renderByLabor()}</TabsContent>
          <TabsContent value="product" className="p-0 overflow-x-auto">{renderByProduct()}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* ─── Equipment Oper Details (for Equipment tab sub-tab) ─── */
function EquipOperDetails({ model, results }: { model: Model; results: CalcResults }) {
  const [selectedId, setSelectedId] = useState('');
  const [showTimeUnits, setShowTimeUnits] = useState(false);

  const g = model.general;
  const conv1 = Math.max(g.conv1, 0.001);
  const conv2 = Math.max(g.conv2, 0.001);
  const opsPerPeriod = conv1 * conv2;

  const allMetrics = useMemo(() => {
    return model.operations.map(op => {
      const eq = model.equipment.find(e => e.id === op.equip_id);
      const prod = model.products.find(p => p.id === op.product_id);
      const pr = results.products.find(p => p.id === op.product_id);
      const er = eq ? results.equipment.find(e => e.id === eq.id) : null;
      const lab = eq ? model.labor.find(l => l.id === eq.labor_group_id) : null;
      if (!prod || !pr || !eq) return null;
      const demand = pr.demand;
      if (demand <= 0) return null;
      const lotSize = Math.max(1, prod.lot_size * prod.lot_factor);
      const tbatchSize = prod.tbatch_size === -1 ? lotSize : Math.max(1, prod.tbatch_size);
      const numTbatches = Math.ceil(lotSize / tbatchSize);
      const assignFrac = op.pct_assigned / 100;
      const numLots = (demand / lotSize) * assignFrac;
      const prodSetupFactor = prod.setup_factor || 1;
      const eqSetupTime = numLots * (op.equip_setup_lot + op.equip_setup_piece * lotSize + op.equip_setup_tbatch * numTbatches) * eq.setup_factor * prodSetupFactor;
      const eqRunTime = numLots * (op.equip_run_piece * lotSize + op.equip_run_lot + op.equip_run_tbatch * numTbatches) * eq.run_factor;
      const eqCount = eq.count > 0 ? eq.count : 1;
      const eqAvail = eqCount * (1 + eq.overtime_pct / 100) * (1 - (eq.unavail_pct || 0) / 100) * opsPerPeriod;
      let repairFrac = 0;
      if (eq.mttf > 0 && eq.mttr > 0) repairFrac = eq.mttr / (eq.mttf + eq.mttr);
      const eqEffAvail = eqAvail * (1 - repairFrac);
      const eqSetupUtil = eqEffAvail > 0 ? (eqSetupTime / eqEffAvail) * 100 : 0;
      const eqRunUtil = eqEffAvail > 0 ? (eqRunTime / eqEffAvail) * 100 : 0;
      const labSetupTime = lab ? numLots * (op.labor_setup_lot + op.labor_setup_piece * lotSize + op.labor_setup_tbatch * numTbatches) * lab.setup_factor * prodSetupFactor : 0;
      const labRunTime = lab ? numLots * (op.labor_run_piece * lotSize + op.labor_run_lot + op.labor_run_tbatch * numTbatches) * lab.run_factor : 0;
      const labAvail = lab ? lab.count * (1 + lab.overtime_pct / 100) * (1 - lab.unavail_pct / 100) * opsPerPeriod : 0;
      const labSetupUtil = labAvail > 0 ? (labSetupTime / labAvail) * 100 : 0;
      const labRunUtil = labAvail > 0 ? (labRunTime / labAvail) * 100 : 0;
      const allOpsForProd = model.operations.filter(o => o.product_id === op.product_id);
      const wipShare = pr.wip / Math.max(1, allOpsForProd.length);
      const perPieceSetup = numLots > 0 ? (eqSetupTime / numLots) / lotSize : 0;
      const perPieceRun = numLots > 0 ? (eqRunTime / numLots) / lotSize : 0;
      const mctAtOp = ((perPieceSetup + perPieceRun) / conv1) * assignFrac;
      const visits = demand > 0 ? (numLots * lotSize / demand) * 100 : 100;
      return {
        opId: op.id, opName: op.op_name, opNumber: op.op_number,
        productName: prod.name, productId: prod.id,
        equipName: eq.name, equipId: eq.id,
        laborName: lab?.name || '—', laborId: lab?.id || '',
        pctAssigned: op.pct_assigned,
        eqSetupUtil: Math.round(eqSetupUtil * 10) / 10,
        eqRunUtil: Math.round(eqRunUtil * 10) / 10,
        eqSetupTime: Math.round(eqSetupTime * 1000) / 1000,
        eqRunTime: Math.round(eqRunTime * 1000) / 1000,
        waitLaborUtil: er?.waitLaborUtil || 0,
        repairUtil: er?.repairUtil || 0,
        labSetupUtil: Math.round(labSetupUtil * 10) / 10,
        labRunUtil: Math.round(labRunUtil * 10) / 10,
        labSetupTime: Math.round(labSetupTime * 1000) / 1000,
        labRunTime: Math.round(labRunTime * 1000) / 1000,
        wip: Math.round(wipShare * 10) / 10,
        mctAtOp: Math.round(mctAtOp * 10000) / 10000,
        visits: Math.round(visits * 10) / 10,
      };
    }).filter(Boolean) as any[];
  }, [model, results, conv1, opsPerPeriod]);

  const fmtVal = (pct: number, time: number) => showTimeUnits ? time.toFixed(3) : pct.toString();
  const unitSuffix = showTimeUnits ? ` (${g.ops_time_unit})` : ' %';

  const eqOps = useMemo(() => allMetrics.filter((m: any) => m.equipId === selectedId), [allMetrics, selectedId]);
  const eqSort = useSortableTable(eqOps, 'opNumber', 'asc');

  const eq = model.equipment.find(e => e.id === selectedId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Oper Details — By Equipment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="Select equipment group…" /></SelectTrigger>
            <SelectContent>
              {model.equipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant={showTimeUnits ? 'secondary' : 'outline'} size="sm" className="text-xs gap-1 h-7" onClick={() => setShowTimeUnits(!showTimeUnits)}>
            <Clock className="h-3 w-3" />
            {showTimeUnits ? `Time (${g.ops_time_unit})` : '% Time'}
          </Button>
        </div>
        {!eq ? (
          <p className="text-sm text-muted-foreground text-center py-8">Select an equipment group to view operation details.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <SortHead label="Product" sortKey="productName" current={eqSort.sort} onSort={eqSort.handleSort} align="left" />
                <SortHead label="Operation" sortKey="opName" current={eqSort.sort} onSort={eqSort.handleSort} align="left" />
                <SortHead label="Op #" sortKey="opNumber" current={eqSort.sort} onSort={eqSort.handleSort} />
                <SortHead label="% Assign" sortKey="pctAssigned" current={eqSort.sort} onSort={eqSort.handleSort} />
                <SortHead label={`Eq Setup${unitSuffix}`} sortKey="eqSetupUtil" current={eqSort.sort} onSort={eqSort.handleSort} />
                <SortHead label={`Eq Run${unitSuffix}`} sortKey="eqRunUtil" current={eqSort.sort} onSort={eqSort.handleSort} />
                <SortHead label={`Wait Labor${unitSuffix}`} sortKey="waitLaborUtil" current={eqSort.sort} onSort={eqSort.handleSort} />
                <SortHead label={`Repair${unitSuffix}`} sortKey="repairUtil" current={eqSort.sort} onSort={eqSort.handleSort} />
                <SortHead label={`Lab Setup${unitSuffix}`} sortKey="labSetupUtil" current={eqSort.sort} onSort={eqSort.handleSort} />
                <SortHead label={`Lab Run${unitSuffix}`} sortKey="labRunUtil" current={eqSort.sort} onSort={eqSort.handleSort} />
                <SortHead label="WIP" sortKey="wip" current={eqSort.sort} onSort={eqSort.handleSort} />
                <SortHead label="MCT at Op" sortKey="mctAtOp" current={eqSort.sort} onSort={eqSort.handleSort} />
                <SortHead label="Visits/100" sortKey="visits" current={eqSort.sort} onSort={eqSort.handleSort} />
              </TableRow></TableHeader>
              <TableBody>
                {eqSort.sorted.map((m: any) => (
                  <TableRow key={m.opId}>
                    <TableCell className="font-mono text-xs">{m.productName}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">{m.opName}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.opNumber}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.pctAssigned}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{fmtVal(m.eqSetupUtil, m.eqSetupTime)}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{fmtVal(m.eqRunUtil, m.eqRunTime)}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.waitLaborUtil}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.repairUtil}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{fmtVal(m.labSetupUtil, m.labSetupTime)}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{fmtVal(m.labRunUtil, m.labRunTime)}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.wip}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.mctAtOp.toFixed(4)}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.visits}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Labor Oper Details (for Labor tab sub-tab) ─── */
function LaborOperDetails({ model, results }: { model: Model; results: CalcResults }) {
  const [selectedId, setSelectedId] = useState('');
  const [showTimeUnits, setShowTimeUnits] = useState(false);

  const g = model.general;
  const conv1 = Math.max(g.conv1, 0.001);
  const conv2 = Math.max(g.conv2, 0.001);
  const opsPerPeriod = conv1 * conv2;

  const allMetrics = useMemo(() => {
    return model.operations.map(op => {
      const eq = model.equipment.find(e => e.id === op.equip_id);
      const prod = model.products.find(p => p.id === op.product_id);
      const pr = results.products.find(p => p.id === op.product_id);
      const er = eq ? results.equipment.find(e => e.id === eq.id) : null;
      const lab = eq ? model.labor.find(l => l.id === eq.labor_group_id) : null;
      if (!prod || !pr || !eq || !lab) return null;
      const demand = pr.demand;
      if (demand <= 0) return null;
      const lotSize = Math.max(1, prod.lot_size * prod.lot_factor);
      const tbatchSize = prod.tbatch_size === -1 ? lotSize : Math.max(1, prod.tbatch_size);
      const numTbatches = Math.ceil(lotSize / tbatchSize);
      const assignFrac = op.pct_assigned / 100;
      const numLots = (demand / lotSize) * assignFrac;
      const prodSetupFactor = prod.setup_factor || 1;
      const labSetupTime = numLots * (op.labor_setup_lot + op.labor_setup_piece * lotSize + op.labor_setup_tbatch * numTbatches) * lab.setup_factor * prodSetupFactor;
      const labRunTime = numLots * (op.labor_run_piece * lotSize + op.labor_run_lot + op.labor_run_tbatch * numTbatches) * lab.run_factor;
      const labAvail = lab.count * (1 + lab.overtime_pct / 100) * (1 - lab.unavail_pct / 100) * opsPerPeriod;
      const labSetupUtil = labAvail > 0 ? (labSetupTime / labAvail) * 100 : 0;
      const labRunUtil = labAvail > 0 ? (labRunTime / labAvail) * 100 : 0;
      const eqModel = model.equipment.find(e => e.id === eq.id);
      const tended = er ? Math.min(1, (er.setupUtil + er.runUtil) / 100) * (eqModel?.count || 1) : 0;
      const waiting = er ? (er.waitLaborUtil / 100) * (eqModel?.count || 1) : 0;
      const allOpsForProd = model.operations.filter(o => o.product_id === op.product_id);
      const wipShare = pr.wip / Math.max(1, allOpsForProd.length);
      const perPieceSetup = numLots > 0 ? ((numLots * (op.equip_setup_lot + op.equip_setup_piece * lotSize + op.equip_setup_tbatch * numTbatches) * eq.setup_factor * prodSetupFactor) / numLots) / lotSize : 0;
      const perPieceRun = numLots > 0 ? ((numLots * (op.equip_run_piece * lotSize + op.equip_run_lot + op.equip_run_tbatch * numTbatches) * eq.run_factor) / numLots) / lotSize : 0;
      const mctAtOp = ((perPieceSetup + perPieceRun) / conv1) * assignFrac;
      return {
        opId: op.id, opName: op.op_name, opNumber: op.op_number,
        productName: prod.name, productId: prod.id,
        equipName: eq.name, equipId: eq.id,
        laborName: lab.name, laborId: lab.id,
        pctAssigned: op.pct_assigned,
        labSetupUtil: Math.round(labSetupUtil * 10) / 10,
        labRunUtil: Math.round(labRunUtil * 10) / 10,
        labSetupTime: Math.round(labSetupTime * 1000) / 1000,
        labRunTime: Math.round(labRunTime * 1000) / 1000,
        eqTended: Math.round(tended * 10) / 10,
        eqWaiting: Math.round(waiting * 10) / 10,
        wip: Math.round(wipShare * 10) / 10,
        mctAtOp: Math.round(mctAtOp * 10000) / 10000,
      };
    }).filter(Boolean) as any[];
  }, [model, results, conv1, opsPerPeriod]);

  const fmtVal = (pct: number, time: number) => showTimeUnits ? time.toFixed(3) : pct.toString();
  const unitSuffix = showTimeUnits ? ` (${g.ops_time_unit})` : ' %';

  const labOps = useMemo(() => allMetrics.filter((m: any) => m.laborId === selectedId), [allMetrics, selectedId]);
  const labSort = useSortableTable(labOps, 'opNumber', 'asc');

  const lab = model.labor.find(l => l.id === selectedId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Oper Details — By Labor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="Select labor group…" /></SelectTrigger>
            <SelectContent>
              {model.labor.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant={showTimeUnits ? 'secondary' : 'outline'} size="sm" className="text-xs gap-1 h-7" onClick={() => setShowTimeUnits(!showTimeUnits)}>
            <Clock className="h-3 w-3" />
            {showTimeUnits ? `Time (${g.ops_time_unit})` : '% Time'}
          </Button>
        </div>
        {!lab ? (
          <p className="text-sm text-muted-foreground text-center py-8">Select a labor group to view operation details.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <SortHead label="Product" sortKey="productName" current={labSort.sort} onSort={labSort.handleSort} align="left" />
                <SortHead label="Operation" sortKey="opName" current={labSort.sort} onSort={labSort.handleSort} align="left" />
                <SortHead label="Equipment" sortKey="equipName" current={labSort.sort} onSort={labSort.handleSort} align="left" />
                <SortHead label="% Assign" sortKey="pctAssigned" current={labSort.sort} onSort={labSort.handleSort} />
                <SortHead label={`Lab Setup${unitSuffix}`} sortKey="labSetupUtil" current={labSort.sort} onSort={labSort.handleSort} />
                <SortHead label={`Lab Run${unitSuffix}`} sortKey="labRunUtil" current={labSort.sort} onSort={labSort.handleSort} />
                <SortHead label="Eq Tended" sortKey="eqTended" current={labSort.sort} onSort={labSort.handleSort} />
                <SortHead label="Eq Waiting" sortKey="eqWaiting" current={labSort.sort} onSort={labSort.handleSort} />
                <SortHead label="WIP" sortKey="wip" current={labSort.sort} onSort={labSort.handleSort} />
                <SortHead label="MCT at Op" sortKey="mctAtOp" current={labSort.sort} onSort={labSort.handleSort} />
              </TableRow></TableHeader>
              <TableBody>
                {labSort.sorted.map((m: any) => (
                  <TableRow key={m.opId}>
                    <TableCell className="font-mono text-xs">{m.productName}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">{m.opName}</TableCell>
                    <TableCell className="font-mono text-xs">{m.equipName}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.pctAssigned}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{fmtVal(m.labSetupUtil, m.labSetupTime)}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{fmtVal(m.labRunUtil, m.labRunTime)}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.eqTended}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.eqWaiting}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.wip}</TableCell>
                    <TableCell className="font-mono text-xs text-right">{m.mctAtOp.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function EquipmentResultsTable({ equipment, utilLimit }: { equipment: EquipmentResult[]; utilLimit: number }) {
  const { sorted, sort, handleSort } = useSortableTable(equipment, 'totalUtil', 'desc');
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Equipment Results Table</CardTitle></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <SortHead label="Equipment" sortKey="name" current={sort} onSort={handleSort} align="left" />
            <SortHead label="Count" sortKey="count" current={sort} onSort={handleSort} />
            <SortHead label="Setup %" sortKey="setupUtil" current={sort} onSort={handleSort} />
            <SortHead label="Run %" sortKey="runUtil" current={sort} onSort={handleSort} />
            <SortHead label="Repair %" sortKey="repairUtil" current={sort} onSort={handleSort} />
            <SortHead label="Wait Labor %" sortKey="waitLaborUtil" current={sort} onSort={handleSort} />
            <SortHead label="Total %" sortKey="totalUtil" current={sort} onSort={handleSort} />
            <SortHead label="Idle %" sortKey="idle" current={sort} onSort={handleSort} />
            <SortHead label="Labor" sortKey="laborGroup" current={sort} onSort={handleSort} align="left" />
          </TableRow></TableHeader>
          <TableBody>
            {sorted.map(eq => (
              <TableRow key={eq.id}>
                <TableCell className="font-mono font-medium">{eq.name}</TableCell>
                <TableCell className="font-mono text-right">{eq.count}</TableCell>
                <TableCell className="font-mono text-right">{eq.setupUtil}</TableCell>
                <TableCell className="font-mono text-right">{eq.runUtil}</TableCell>
                <TableCell className="font-mono text-right">{eq.repairUtil}</TableCell>
                <TableCell className="font-mono text-right">{eq.waitLaborUtil}</TableCell>
                <TableCell className={`font-mono text-right font-medium ${eq.totalUtil > utilLimit ? 'text-destructive' : ''}`}>{eq.totalUtil}</TableCell>
                <TableCell className="font-mono text-right text-muted-foreground">{eq.idle}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{eq.laborGroup}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ─── Labor Results Table (sortable) ─── */
function LaborResultsTable({ labor, utilLimit }: { labor: LaborResult[]; utilLimit: number }) {
  const { sorted, sort, handleSort } = useSortableTable(labor, 'totalUtil', 'desc');
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Labor Results Table</CardTitle></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <SortHead label="Labor Group" sortKey="name" current={sort} onSort={handleSort} align="left" />
            <SortHead label="Count" sortKey="count" current={sort} onSort={handleSort} />
            <SortHead label="Setup %" sortKey="setupUtil" current={sort} onSort={handleSort} />
            <SortHead label="Run %" sortKey="runUtil" current={sort} onSort={handleSort} />
            <SortHead label="Unavail %" sortKey="unavailPct" current={sort} onSort={handleSort} />
            <SortHead label="Total %" sortKey="totalUtil" current={sort} onSort={handleSort} />
            <SortHead label="Idle %" sortKey="idle" current={sort} onSort={handleSort} />
          </TableRow></TableHeader>
          <TableBody>
            {sorted.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-mono font-medium">{l.name}</TableCell>
                <TableCell className="font-mono text-right">{l.count}</TableCell>
                <TableCell className="font-mono text-right">{l.setupUtil}</TableCell>
                <TableCell className="font-mono text-right">{l.runUtil}</TableCell>
                <TableCell className="font-mono text-right">{l.unavailPct}</TableCell>
                <TableCell className={`font-mono text-right font-medium ${l.totalUtil > utilLimit ? 'text-destructive' : ''}`}>{l.totalUtil}</TableCell>
                <TableCell className="font-mono text-right text-muted-foreground">{l.idle}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ─── Production Chart (2G) ─── */
const prodChartColors = {
  shipped: 'hsl(217, 91%, 60%)',
  usedInAssembly: 'hsl(142, 71%, 45%)',
  shippedInAssembly: 'hsl(38, 92%, 50%)',
  scrapInProduction: 'hsl(0, 72%, 51%)',
};

function ProductionChart({ results, model, isMultiScenario, chartScenarios }: {
  results: CalcResults; model: any; isMultiScenario: boolean; chartScenarios: ScenarioEntry[];
}) {
  const [showTable, setShowTable] = useState(false);
  const data = useMemo(() => buildProductionData(results, model), [results, model]);
  const { sorted, sort, handleSort } = useSortableTable(data, 'total', 'desc');

  if (data.length === 0) return (
    <Card><CardContent className="py-12 text-center"><BarChart3 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">Run the model to see production breakdown.</p></CardContent></Card>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Production Chart</CardTitle>
            <CardDescription>Breakdown of production by disposition</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowTable(!showTable)}>
            {showTable ? 'Show Chart' : 'Show as Table'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative">
        <ChartScenarioLabel />
        {showTable ? (
          <Table>
            <TableHeader><TableRow>
              <SortHead label="Product" sortKey="name" current={sort} onSort={handleSort} align="left" />
              <SortHead label="Shipped" sortKey="shipped" current={sort} onSort={handleSort} />
              <SortHead label="Used in Assy" sortKey="usedInAssembly" current={sort} onSort={handleSort} />
              <SortHead label="Shipped in Assy" sortKey="shippedInAssembly" current={sort} onSort={handleSort} />
              <SortHead label="Scrap" sortKey="scrapInProduction" current={sort} onSort={handleSort} />
              <SortHead label="Total" sortKey="total" current={sort} onSort={handleSort} />
            </TableRow></TableHeader>
            <TableBody>
              {sorted.map(d => (
                <TableRow key={d.name}>
                  <TableCell className="font-mono font-medium">{d.name}</TableCell>
                  <TableCell className="font-mono text-right">{d.shipped.toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-right">{d.usedInAssembly.toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-right">{d.shippedInAssembly.toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-right">{d.scrapInProduction.toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-right font-medium">{d.total.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={axisStyle} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: 'Units', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="shipped" stackId="a" fill={prodChartColors.shipped} name="Shipped Production" />
              <Bar dataKey="usedInAssembly" stackId="a" fill={prodChartColors.usedInAssembly} name="Used in Assembly" />
              <Bar dataKey="shippedInAssembly" stackId="a" fill={prodChartColors.shippedInAssembly} name="Shipped in Assembly" />
              <Bar dataKey="scrapInProduction" stackId="a" fill={prodChartColors.scrapInProduction} name="Scrap in Production" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
