import React, { useState, useMemo } from 'react';
import { useModelStore, type Model } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useResultsStore } from '@/stores/resultsStore';
import { type CalcResults, type ProductResult } from '@/lib/calculationEngine';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Network, Star, Package } from 'lucide-react';

// ── 5-Segment MCT Colours (Section 1) ──
const MCT_SEGMENTS = [
  { key: 'waitEquip', label: 'Wait for Equipment', color: 'hsl(0, 72%, 51%)' },    // Red
  { key: 'waitLabor', label: 'Wait for Labor', color: 'hsl(45, 93%, 47%)' },        // Yellow
  { key: 'setup', label: 'Setup', color: 'hsl(217, 91%, 60%)' },                    // Blue
  { key: 'run', label: 'Run', color: 'hsl(142, 71%, 45%)' },                        // Green
  { key: 'lotWait', label: 'Wait for Lot', color: 'hsl(270, 50%, 60%)' },           // Purple
] as const;

type SegmentKey = typeof MCT_SEGMENTS[number]['key'];

interface MCTBreakdown {
  waitEquip: number;
  waitLabor: number;
  setup: number;
  run: number;
  lotWait: number;
  total: number;
}

function getBreakdown(pr: ProductResult | undefined, product: any): MCTBreakdown {
  if (!pr || product?.make_to_stock) {
    return { waitEquip: 0, waitLabor: 0, setup: 0, run: 0, lotWait: 0, total: 0 };
  }
  return {
    waitEquip: pr.mctQueue,
    waitLabor: pr.mctWaitLabor,
    setup: pr.mctSetup,
    run: pr.mctRun,
    lotWait: pr.mctLotWait,
    total: pr.mct,
  };
}

// ── Shared Header ──
function IBOMHeader({
  model, finalAssemblies, selectedProductId, onProductChange,
  scenarioId, onScenarioChange, scenarioLabel,
}: {
  model: Model;
  finalAssemblies: { id: string; name: string }[];
  selectedProductId: string;
  onProductChange: (id: string) => void;
  scenarioId: string;
  onScenarioChange: (id: string) => void;
  scenarioLabel: string;
}) {
  const allScenarios = useScenarioStore(s => s.scenarios);
  const modelScenarios = allScenarios.filter(s => s.modelId === model.id);
  const { getResults } = useResultsStore();
  const runScenarios = modelScenarios.filter(s => getResults(s.id));

  return (
    <div className="flex flex-wrap items-center gap-3 mb-2">
      <Select value={selectedProductId} onValueChange={onProductChange}>
        <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Select assembly..." /></SelectTrigger>
        <SelectContent>
          {finalAssemblies.map(p => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={scenarioId} onValueChange={onScenarioChange}>
        <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="basecase">Basecase</SelectItem>
          {runScenarios.map(s => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-sm font-medium text-primary ml-1">{scenarioLabel}</span>
    </div>
  );
}

// ── Zoom Dropdown ──
function ZoomSelect({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
  return (
    <Select value={String(zoom)} onValueChange={v => setZoom(Number(v))}>
      <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        {[50, 75, 100, 125, 150].map(z => (
          <SelectItem key={z} value={String(z)}>{z}%</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── MCT Legend ──
function MCTLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 py-2 px-1 border-t mt-4">
      {MCT_SEGMENTS.map(s => (
        <div key={s.key} className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
          <span className="text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stacked Bar (horizontal) ──
function StackedMCTBar({
  breakdown, maxMCT, mctUnit, productName, isMTS = false, minWidth = 2,
}: {
  breakdown: MCTBreakdown; maxMCT: number; mctUnit: string; productName: string; isMTS?: boolean; minWidth?: number;
}) {
  if (isMTS) {
    return <Badge variant="secondary" className="text-[10px] font-mono bg-muted text-muted-foreground">MTS</Badge>;
  }
  if (breakdown.total <= 0 || maxMCT <= 0) {
    return <div className="h-5 w-1 bg-muted rounded" />;
  }
  const barWidth = Math.max(minWidth, (breakdown.total / maxMCT) * 100);
  const segments: { key: SegmentKey; value: number; color: string; label: string }[] = MCT_SEGMENTS
    .map(s => ({ key: s.key, value: breakdown[s.key], color: s.color, label: s.label }))
    .filter(s => s.value > 0);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-5 rounded overflow-hidden" style={{ width: `${barWidth}%`, minWidth: `${minWidth}px` }}>
        {segments.map(seg => {
          const pct = (seg.value / breakdown.total) * 100;
          return (
            <Tooltip key={seg.key}>
              <TooltipTrigger asChild>
                <div
                  className="h-full transition-all hover:brightness-110 cursor-default"
                  style={{ width: `${pct}%`, backgroundColor: seg.color, minWidth: seg.value > 0 ? '1px' : 0 }}
                />
              </TooltipTrigger>
              <TooltipContent className="text-xs font-mono">
                <p className="font-semibold">{productName} — {seg.label}: {seg.value.toFixed(2)} {mctUnit}</p>
                <p className="text-muted-foreground">Total MCT: {breakdown.total.toFixed(2)} {mctUnit}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// ── Color dot for table headers ──
function ColorDot({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 rounded-full mr-1 shrink-0" style={{ backgroundColor: color }} />;
}

// ── IBOM tree node with breakdown ──
interface IBOMNodeData {
  productId: string;
  name: string;
  breakdown: MCTBreakdown;
  isMTS: boolean;
  unitsPerAssy: number;
  level: number;
  children: IBOMNodeData[];
}

function buildNodeTree(model: Model, results: CalcResults, rootId: string, level: number, visited: Set<string>): IBOMNodeData {
  const product = model.products.find(p => p.id === rootId);
  const pr = results.products.find(p => p.id === rootId);
  const isMTS = product?.make_to_stock ?? false;
  const breakdown = getBreakdown(pr, product);
  const nextVisited = new Set(visited);
  nextVisited.add(rootId);
  const children = model.ibom
    .filter(e => e.parent_product_id === rootId && !visited.has(e.component_product_id))
    .map(e => ({
      ...buildNodeTree(model, results, e.component_product_id, level + 1, nextVisited),
      unitsPerAssy: e.units_per_assy,
    }));

  return { productId: rootId, name: product?.name || '?', breakdown, isMTS, unitsPerAssy: 1, level, children };
}

function getMaxMCT(node: IBOMNodeData): number {
  return Math.max(node.breakdown.total, ...node.children.map(c => getMaxMCT(c)));
}

// Find critical path (longest MCT chain)
function findCriticalPath(node: IBOMNodeData): Set<string> {
  const path = new Set<string>();
  function traverse(n: IBOMNodeData): number {
    if (n.children.length === 0) {
      path.add(n.productId);
      return n.breakdown.total;
    }
    let bestChild: IBOMNodeData | null = null;
    let bestMCT = -1;
    for (const c of n.children) {
      const cMCT = getCumulativeMCT(c);
      if (cMCT > bestMCT) { bestMCT = cMCT; bestChild = c; }
    }
    path.add(n.productId);
    if (bestChild) traverse(bestChild);
    return n.breakdown.total + bestMCT;
  }
  traverse(node);
  return path;
}

function getCumulativeMCT(node: IBOMNodeData): number {
  if (node.children.length === 0) return node.breakdown.total;
  return node.breakdown.total + Math.max(...node.children.map(c => getCumulativeMCT(c)));
}

// Flatten tree depth-first for table
function flattenTree(node: IBOMNodeData): IBOMNodeData[] {
  const result: IBOMNodeData[] = [node];
  node.children.forEach(c => result.push(...flattenTree(c)));
  return result;
}

// Build poles (all root-to-leaf paths)
interface Pole {
  path: { productId: string; name: string; breakdown: MCTBreakdown; isMTS: boolean }[];
  totalBreakdown: MCTBreakdown;
}

function buildPoles(node: IBOMNodeData): Pole[] {
  const poles: Pole[] = [];
  function traverse(n: IBOMNodeData, currentPath: Pole['path']) {
    const step = { productId: n.productId, name: n.name, breakdown: n.breakdown, isMTS: n.isMTS };
    const newPath = [...currentPath, step];
    if (n.children.length === 0) {
      const totalBreakdown: MCTBreakdown = {
        waitEquip: newPath.reduce((s, p) => s + p.breakdown.waitEquip, 0),
        waitLabor: newPath.reduce((s, p) => s + p.breakdown.waitLabor, 0),
        setup: newPath.reduce((s, p) => s + p.breakdown.setup, 0),
        run: newPath.reduce((s, p) => s + p.breakdown.run, 0),
        lotWait: newPath.reduce((s, p) => s + p.breakdown.lotWait, 0),
        total: newPath.reduce((s, p) => s + p.breakdown.total, 0),
      };
      poles.push({ path: newPath, totalBreakdown });
    } else {
      n.children.forEach(c => traverse(c, newPath));
    }
  }
  traverse(node, []);
  return poles.sort((a, b) => b.totalBreakdown.total - a.totalBreakdown.total);
}

// ════════════════════════════════════════════════════════════
//  TREE CHART (Section 2)
// ════════════════════════════════════════════════════════════
function TreeChart({ model, results, tree, mctUnit, zoom }: {
  model: Model; results: CalcResults; tree: IBOMNodeData; mctUnit: string; zoom: number;
}) {
  const maxMCT = useMemo(() => getMaxMCT(tree), [tree]);
  const criticalPath = useMemo(() => findCriticalPath(tree), [tree]);
  const scale = zoom / 100;

  const renderNode = (node: IBOMNodeData, depth: number) => {
    const isCritical = criticalPath.has(node.productId);
    return (
      <div key={`${node.productId}-${depth}`} style={{ marginLeft: depth > 0 ? 24 * scale : 0 }}>
        <div className={`flex items-center gap-2 py-1 px-2 rounded-md mb-0.5 ${
          isCritical ? 'border-l-2 border-amber-400 bg-amber-50/40 dark:bg-amber-900/10' : ''
        }`}>
          <span className="text-xs font-mono font-medium shrink-0 w-20 truncate" style={{ fontSize: 12 * scale }}>
            {node.name}
          </span>
          {node.unitsPerAssy > 1 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1" style={{ fontSize: 9 * scale }}>×{node.unitsPerAssy}</Badge>
          )}
          <div className="flex-1 max-w-md">
            <StackedMCTBar breakdown={node.breakdown} maxMCT={maxMCT} mctUnit={mctUnit} productName={node.name} isMTS={node.isMTS} />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap" style={{ fontSize: 10 * scale }}>
            {node.isMTS ? '' : `${node.breakdown.total.toFixed(2)} ${mctUnit}`}
          </span>
          {isCritical && depth === 0 && (
            <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-600 gap-0.5">
              <Star className="h-2.5 w-2.5" /> Critical Path
            </Badge>
          )}
        </div>
        {node.children.length > 0 && (
          <div className="border-l border-border ml-3" style={{ marginLeft: 12 * scale }}>
            {node.children.map((c, i) => renderNode(c, 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      {renderNode(tree, 0)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  TREE TABLE (Section 3)
// ════════════════════════════════════════════════════════════
function TreeTable({ model, results, tree, mctUnit }: {
  model: Model; results: CalcResults; tree: IBOMNodeData; mctUnit: string;
}) {
  const rows = useMemo(() => flattenTree(tree), [tree]);
  const criticalPath = useMemo(() => findCriticalPath(tree), [tree]);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono text-xs">Product</TableHead>
            <TableHead className="font-mono text-xs text-center">Level</TableHead>
            <TableHead className="font-mono text-xs text-right">Total MCT</TableHead>
            <TableHead className="font-mono text-xs text-right"><ColorDot color={MCT_SEGMENTS[0].color} />Wait Equip</TableHead>
            <TableHead className="font-mono text-xs text-right"><ColorDot color={MCT_SEGMENTS[1].color} />Wait Labor</TableHead>
            <TableHead className="font-mono text-xs text-right"><ColorDot color={MCT_SEGMENTS[2].color} />Setup</TableHead>
            <TableHead className="font-mono text-xs text-right"><ColorDot color={MCT_SEGMENTS[3].color} />Run</TableHead>
            <TableHead className="font-mono text-xs text-right"><ColorDot color={MCT_SEGMENTS[4].color} />Wait Lot</TableHead>
            <TableHead className="font-mono text-xs text-center">MTS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const isCrit = criticalPath.has(r.productId);
            const isMTS = r.isMTS;
            const muted = isMTS ? 'text-muted-foreground' : '';
            return (
              <TableRow key={`${r.productId}-${i}`} className={isCrit ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''}>
                <TableCell className="font-mono text-xs" style={{ paddingLeft: 12 + r.level * 16 }}>
                  <span className={r.level === 0 ? 'font-bold' : ''}>{r.name}</span>
                </TableCell>
                <TableCell className="font-mono text-xs text-center">{r.level + 1}</TableCell>
                <TableCell className={`font-mono text-xs text-right ${muted}`}>{r.breakdown.total.toFixed(2)} {mctUnit}</TableCell>
                <TableCell className={`font-mono text-xs text-right ${muted}`}>{r.breakdown.waitEquip.toFixed(2)}</TableCell>
                <TableCell className={`font-mono text-xs text-right ${muted}`}>{r.breakdown.waitLabor.toFixed(2)}</TableCell>
                <TableCell className={`font-mono text-xs text-right ${muted}`}>{r.breakdown.setup.toFixed(2)}</TableCell>
                <TableCell className={`font-mono text-xs text-right ${muted}`}>{r.breakdown.run.toFixed(2)}</TableCell>
                <TableCell className={`font-mono text-xs text-right ${muted}`}>{r.breakdown.lotWait.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                  {isMTS && <Badge variant="secondary" className="text-[9px] bg-muted">MTS</Badge>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  POLES CHART (Section 4)
// ════════════════════════════════════════════════════════════
function PolesChart({ model, poles, mctUnit, zoom }: {
  model: Model; poles: Pole[]; mctUnit: string; zoom: number;
}) {
  const maxMCT = poles[0]?.totalBreakdown.total || 1;
  const scale = zoom / 100;
  const barMinWidth = 48 * scale;

  if (poles.length === 0) return null;

  const criticalDesc = poles[0].path.map(p => p.name).reverse().join(' → ');

  return (
    <div>
      <div className="flex items-end gap-3 overflow-x-auto pb-2" style={{ minHeight: 200 * scale }}>
        {poles.map((pole, i) => {
          const heightPct = (pole.totalBreakdown.total / maxMCT) * 100;
          const isCritical = i === 0;
          const segments = MCT_SEGMENTS
            .map(s => ({ key: s.key, value: pole.totalBreakdown[s.key], color: s.color, label: s.label }))
            .filter(s => s.value > 0);

          return (
            <TooltipProvider key={i} delayDuration={100}>
              <div className="flex flex-col items-center shrink-0" style={{ minWidth: barMinWidth }}>
                {isCritical && (
                  <Badge variant="outline" className="text-[8px] border-amber-400 text-amber-600 mb-1 whitespace-nowrap" style={{ fontSize: 8 * scale }}>
                    Critical Path
                  </Badge>
                )}
                <div
                  className={`flex flex-col-reverse rounded overflow-hidden ${isCritical ? 'ring-2 ring-amber-400' : ''}`}
                  style={{ height: `${Math.max(4, heightPct * 1.8)}px`, width: barMinWidth }}
                >
                  {segments.map(seg => {
                    const segPct = (seg.value / pole.totalBreakdown.total) * 100;
                    return (
                      <Tooltip key={seg.key}>
                        <TooltipTrigger asChild>
                          <div
                            className="w-full transition-all hover:brightness-110 cursor-default"
                            style={{ height: `${segPct}%`, backgroundColor: seg.color, minHeight: seg.value > 0 ? 1 : 0 }}
                          />
                        </TooltipTrigger>
                        <TooltipContent className="text-xs font-mono">
                          <p>{seg.label}: {seg.value.toFixed(2)} {mctUnit}</p>
                          <p className="text-muted-foreground">Total: {pole.totalBreakdown.total.toFixed(2)} {mctUnit}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <span className="text-[9px] font-mono text-muted-foreground mt-1 text-center" style={{ fontSize: 9 * scale, maxWidth: barMinWidth + 20 }}>
                  {pole.totalBreakdown.total.toFixed(2)}
                </span>
                <span className="text-[8px] font-mono text-muted-foreground text-center leading-tight mt-0.5" style={{ fontSize: 8 * scale, maxWidth: barMinWidth + 30 }}>
                  {pole.path.map(p => p.name).reverse().join(' / ')}
                </span>
              </div>
            </TooltipProvider>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-2 italic">
        The critical path is <span className="font-medium text-foreground">{criticalDesc}</span>. Focus MCT reduction efforts here first.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  POLES TABLE (Section 5)
// ════════════════════════════════════════════════════════════
function PolesTable({ model, poles, mctUnit }: {
  model: Model; poles: Pole[]; mctUnit: string;
}) {
  if (poles.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono text-xs w-12">Rank</TableHead>
            <TableHead className="font-mono text-xs">Path</TableHead>
            <TableHead className="font-mono text-xs text-right">Total MCT</TableHead>
            <TableHead className="font-mono text-xs text-right"><ColorDot color={MCT_SEGMENTS[0].color} />Wait Equip</TableHead>
            <TableHead className="font-mono text-xs text-right"><ColorDot color={MCT_SEGMENTS[1].color} />Wait Labor</TableHead>
            <TableHead className="font-mono text-xs text-right"><ColorDot color={MCT_SEGMENTS[2].color} />Setup</TableHead>
            <TableHead className="font-mono text-xs text-right"><ColorDot color={MCT_SEGMENTS[3].color} />Run</TableHead>
            <TableHead className="font-mono text-xs text-right"><ColorDot color={MCT_SEGMENTS[4].color} />Wait Lot</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {poles.map((pole, i) => {
            const isCrit = i === 0;
            const pathDesc = pole.path.map(p => p.name).reverse().join(' → ');
            return (
              <TableRow key={i} className={isCrit ? 'font-bold border-l-2 border-amber-400 bg-amber-50/30 dark:bg-amber-900/5' : ''}>
                <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                <TableCell className="font-mono text-xs">{pathDesc}</TableCell>
                <TableCell className="font-mono text-xs text-right">{pole.totalBreakdown.total.toFixed(2)} {mctUnit}</TableCell>
                <TableCell className="font-mono text-xs text-right">{pole.totalBreakdown.waitEquip.toFixed(2)}</TableCell>
                <TableCell className="font-mono text-xs text-right">{pole.totalBreakdown.waitLabor.toFixed(2)}</TableCell>
                <TableCell className="font-mono text-xs text-right">{pole.totalBreakdown.setup.toFixed(2)}</TableCell>
                <TableCell className="font-mono text-xs text-right">{pole.totalBreakdown.run.toFixed(2)}</TableCell>
                <TableCell className="font-mono text-xs text-right">{pole.totalBreakdown.lotWait.toFixed(2)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="border-t px-3 py-2 text-xs font-mono">
        <span className="font-semibold">Critical path MCT: {poles[0].totalBreakdown.total.toFixed(2)} {mctUnit}</span>
        <span className="text-muted-foreground"> — {poles[0].path.map(p => p.name).reverse().join(' → ')}</span>
      </div>
    </div>
  );
}

// Export sub-components and utilities for use in RunResults IBOM tab
export { TreeChart, TreeTable, PolesChart, PolesTable, MCTLegend, ZoomSelect, buildNodeTree, buildPoles, getMaxMCT };
export type { IBOMNodeData, Pole };

// ════════════════════════════════════════════════════════════
//  MAIN IBOM OUTPUT COMPONENT (legacy, kept for compatibility)
// ════════════════════════════════════════════════════════════
export default function IBOMOutput({ model, isRunning }: { model: Model; isRunning?: boolean }) {
  const { getResults } = useResultsStore();
  const allScenarios = useScenarioStore(s => s.scenarios);

  // Find final assemblies: products that are parents but not components of other products
  const finalAssemblies = useMemo(() => {
    const parentIds = new Set(model.ibom.map(e => e.parent_product_id));
    const componentIds = new Set(model.ibom.map(e => e.component_product_id));
    // Products that are parents but not children
    const topLevel = model.products.filter(p => parentIds.has(p.id) && !componentIds.has(p.id));
    // If none, fall back to products with demand > 0 that are parents
    if (topLevel.length === 0) {
      return model.products.filter(p => parentIds.has(p.id));
    }
    return topLevel;
  }, [model]);

  const [selectedProductId, setSelectedProductId] = useState(() => finalAssemblies[0]?.id || '');
  const [scenarioId, setScenarioId] = useState('basecase');
  const [activeTab, setActiveTab] = useState('tree-chart');
  const [zoom, setZoom] = useState(100);

  const results = getResults(scenarioId);
  const scenario = allScenarios.find(s => s.id === scenarioId);
  const scenarioLabel = scenarioId === 'basecase' ? 'Basecase results' : `${scenario?.name || 'What-if'} results`;
  const mctUnit = model.general.mct_time_unit.toLowerCase() + 's';

  // No IBOM structure
  if (model.ibom.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Network className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground font-medium">No IBOM structure defined.</p>
          <p className="text-xs text-muted-foreground">Go to Input → IBOM to add component relationships between products.</p>
        </CardContent>
      </Card>
    );
  }

  // No final assemblies
  if (finalAssemblies.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Package className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No IBOM structure defined. Go to Input → IBOM to add component relationships.</p>
        </CardContent>
      </Card>
    );
  }

  // No results
  if (!results) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          {isRunning ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48 mx-auto" />
              <Skeleton className="h-4 w-64 mx-auto" />
              <Skeleton className="h-40 w-full max-w-lg mx-auto" />
            </div>
          ) : (
            <>
              <Network className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground font-medium">No results yet</p>
              <p className="text-xs text-muted-foreground">Run Full Calculate to generate IBOM output.</p>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Selected product has no children
  const hasChildren = model.ibom.some(e => e.parent_product_id === selectedProductId);
  if (!hasChildren && selectedProductId) {
    return (
      <Card>
        <CardContent className="pt-4">
          <IBOMHeader
            model={model} finalAssemblies={finalAssemblies}
            selectedProductId={selectedProductId} onProductChange={setSelectedProductId}
            scenarioId={scenarioId} onScenarioChange={setScenarioId}
            scenarioLabel={scenarioLabel}
          />
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">This product has no components. Select a product with sub-assemblies to view the IBOM tree.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tree = buildNodeTree(model, results, selectedProductId, 0, new Set());
  const poles = buildPoles(tree);
  const showZoom = activeTab === 'tree-chart' || activeTab === 'poles-chart';

  return (
    <Card>
      <CardContent className="pt-4">
        <IBOMHeader
          model={model} finalAssemblies={finalAssemblies}
          selectedProductId={selectedProductId} onProductChange={setSelectedProductId}
          scenarioId={scenarioId} onScenarioChange={setScenarioId}
          scenarioLabel={scenarioLabel}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-3">
            <TabsList>
              <TabsTrigger value="tree-chart" className="text-xs">Tree Chart</TabsTrigger>
              <TabsTrigger value="tree-table" className="text-xs">Tree Table</TabsTrigger>
              <TabsTrigger value="poles-chart" className="text-xs">Poles Chart</TabsTrigger>
              <TabsTrigger value="poles-table" className="text-xs">Poles Table</TabsTrigger>
            </TabsList>
            {showZoom && <ZoomSelect zoom={zoom} setZoom={setZoom} />}
          </div>

          <TabsContent value="tree-chart">
            <TreeChart model={model} results={results} tree={tree} mctUnit={mctUnit} zoom={zoom} />
            <MCTLegend />
          </TabsContent>

          <TabsContent value="tree-table">
            <TreeTable model={model} results={results} tree={tree} mctUnit={mctUnit} />
          </TabsContent>

          <TabsContent value="poles-chart">
            <PolesChart model={model} poles={poles} mctUnit={mctUnit} zoom={zoom} />
            <MCTLegend />
          </TabsContent>

          <TabsContent value="poles-table">
            <PolesTable model={model} poles={poles} mctUnit={mctUnit} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Export the standard 5 MCT segment colours for use in Product MCT chart
export const MCT_COLORS = {
  waitEquip: MCT_SEGMENTS[0].color,  // Red - Wait for Equipment (queue)
  waitLabor: MCT_SEGMENTS[1].color,  // Yellow - Wait for Labor
  setup: MCT_SEGMENTS[2].color,      // Blue - Setup
  run: MCT_SEGMENTS[3].color,        // Green - Run
  lotWait: MCT_SEGMENTS[4].color,    // Purple - Wait for Lot
};
