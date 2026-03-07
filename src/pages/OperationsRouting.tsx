import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useModelStore, type Operation, type RoutingEntry } from '@/stores/modelStore';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmInline } from '@/components/DeleteConfirmInline';
import { useScenarioStore } from '@/stores/scenarioStore';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUserLevelStore, isVisible } from '@/hooks/useUserLevel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Wand2, AlertTriangle, SortAsc, FlaskConical, Calculator, FunctionSquare, Eye, Edit, Lock, Zap, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { FormulaBuilder } from '@/components/FormulaBuilder';
import { InterpolateCalculator } from '@/components/InterpolateCalculator';
import { ProductSelectorBar } from '@/components/ProductSelectorBar';
import { OperationsEmptyState } from '@/components/OperationsEmptyState';

import { InlineRoutingEditor } from '@/components/InlineRoutingEditor';

const SYSTEM_OPS = ['DOCK', 'STOCK', 'SCRAP'];

export default function OperationsRouting() {
  usePageTitle('Operations & Routing');
  const model = useModelStore((s) => s.getActiveModel());
  const addOperation = useModelStore((s) => s.addOperation);
  const updateOperation = useModelStore((s) => s.updateOperation);
  const deleteOperation = useModelStore((s) => s.deleteOperation);
  const addRouting = useModelStore((s) => s.addRouting);
  const updateRouting = useModelStore((s) => s.updateRouting);
  const deleteRouting = useModelStore((s) => s.deleteRouting);
  const setRouting = useModelStore((s) => s.setRouting);

  const activeScenarioId = useScenarioStore(s => s.activeScenarioId);
  const activeScenario = useScenarioStore(s => s.scenarios.find(sc => sc.id === s.activeScenarioId));
  const applyScenarioChange = useScenarioStore(s => s.applyScenarioChange);

  const { userLevel } = useUserLevelStore();
  const showFormulaBuilder = isVisible('formula_builder', userLevel);

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProductId = searchParams.get('product') || '';
  const [showAddOp, setShowAddOp] = useState(false);
  const [newOpName, setNewOpName] = useState('');
  const [newOpNumber, setNewOpNumber] = useState(10);
  const [newOpEquip, setNewOpEquip] = useState('');
  const [showAdvancedTimes, setShowAdvancedTimes] = useState(false);
  const [viewActualTimes, setViewActualTimes] = useState(false);
  const [expandedRoutingOp, setExpandedRoutingOp] = useState<string | null>(null);
  const { pendingDeleteId, requestDelete, cancelDelete, confirmDelete } = useDeleteConfirmation();

  const newOpNameRef = useRef<HTMLInputElement>(null);

  // Formula Builder state
  const [formulaTarget, setFormulaTarget] = useState<{ op: Operation; field: string; label: string; value: number } | null>(null);
  const [showInterpolator, setShowInterpolator] = useState(false);

  // Auto-select first product if none selected
  const effectiveProductId = selectedProductId && model?.products.find(p => p.id === selectedProductId)
    ? selectedProductId
    : model?.products[0]?.id || '';

  const effectiveProduct = model?.products.find(p => p.id === effectiveProductId);

  // Filter out STOCK/SCRAP from operations display — they are routing-only destinations
  const productOps = useMemo(
    () => (model?.operations ?? [])
      .filter((o) => o.product_id === effectiveProductId && o.op_name !== 'STOCK' && o.op_name !== 'SCRAP')
      .sort((a, b) => a.op_number - b.op_number),
    [model?.operations, effectiveProductId]
  );

  // User-added operations = everything except DOCK
  const userOps = useMemo(() => productOps.filter(o => o.op_name !== 'DOCK'), [productOps]);
  const hasUserOps = userOps.length > 0;
  const showEmptyState = !hasUserOps;

  // Clean up orphaned DOCK-only state (e.g. from removed "Direct to Stock" feature)
  useEffect(() => {
    if (!model || !effectiveProductId || hasUserOps) return;
    const dockOp = productOps.find(o => o.op_name === 'DOCK');
    if (dockOp) {
      deleteOperation(model.id, dockOp.id);
      const orphanedRouting = (model.routing ?? []).filter(r => r.product_id === effectiveProductId);
      orphanedRouting.forEach(r => deleteRouting(model.id, r.id));
    }
  }, [model?.id, effectiveProductId, hasUserOps, productOps]);

  const productRouting = useMemo(
    () => (model?.routing ?? []).filter((r) => r.product_id === effectiveProductId),
    [model?.routing, effectiveProductId]
  );

  // All user op names (for routing destination dropdowns)
  const userOpNames = useMemo(() => productOps.map(o => o.op_name).filter(n => n !== 'DOCK'), [productOps]);

  // Get routes for a specific op
  const getRoutesForOp = (opName: string) => productRouting.filter(r => r.from_op_name === opName);

  // ── Routing completeness ────────────────────────────────────
  const routingStatus = useMemo(() => {
    // Only user ops (not DOCK) need routing
    const opsNeedingRouting = productOps.filter(o => o.op_name !== 'DOCK');
    // Plus DOCK itself needs outgoing routing
    const allFromOps = ['DOCK', ...opsNeedingRouting.map(o => o.op_name)];

    if (allFromOps.length <= 1 && productOps.length <= 1) return 'empty';

    let complete = true;

    // Condition D: No operation has % Assign > 100
    for (const op of opsNeedingRouting) {
      if (op.pct_assigned > 100) { complete = false; break; }
    }

    for (const opName of allFromOps) {
      if (opName === 'DOCK' && productOps.length <= 1) continue;
      const routes = productRouting.filter(r => r.from_op_name === opName);
      // Condition A: every op has at least one outgoing path
      if (routes.length === 0) { complete = false; break; }
      // Condition B: sum of % Routed must be exactly 100 (integer check)
      const total = routes.reduce((s, r) => s + r.pct_routed, 0);
      if (total !== 100) { complete = false; break; }
      // Condition C: no duplicate destinations
      const destSet = new Set(routes.map(r => r.to_op_name));
      if (destSet.size !== routes.length) { complete = false; break; }
    }

    // Check all paths reach STOCK or SCRAP (dead-end check)
    if (complete) {
      const opsWithOutgoing = new Set(productRouting.map(r => r.from_op_name));
      const allTargets = new Set(productRouting.map(r => r.to_op_name));
      allTargets.forEach(name => {
        if (name === 'STOCK' || name === 'SCRAP') return;
        if (!opsWithOutgoing.has(name)) complete = false;
      });
    }

    return complete ? 'complete' : 'incomplete';
  }, [productOps, productRouting]);

  const hasAnyRouting = productRouting.length > 0;
  const [showAutoRouteConfirm, setShowAutoRouteConfirm] = useState(false);

  // Compute actual times
  const getActualTimes = (op: Operation) => {
    if (!model) return null;
    const eq = model.equipment.find(e => e.id === op.equip_id);
    const prod = model.products.find(p => p.id === op.product_id);
    const eqSetupF = eq?.setup_factor ?? 1;
    const eqRunF = eq?.run_factor ?? 1;
    const labGroup = eq ? model.labor.find(l => l.id === eq.labor_group_id) : null;
    const labSetupF = labGroup?.setup_factor ?? 1;
    const labRunF = labGroup?.run_factor ?? 1;
    const prodSetupF = prod?.setup_factor ?? 1;
    return {
      equip_setup_lot: Math.round(op.equip_setup_lot * eqSetupF * prodSetupF * 1000) / 1000,
      equip_run_piece: Math.round(op.equip_run_piece * eqRunF * 1000) / 1000,
      labor_setup_lot: Math.round(op.labor_setup_lot * labSetupF * prodSetupF * 1000) / 1000,
      labor_run_piece: Math.round(op.labor_run_piece * labRunF * 1000) / 1000,
    };
  };

  if (!model) return null;

  // ── Handlers ────────────────────────────────────────────────
  const handleAddFirstOps = () => {
    // DOCK will be auto-created when the first user op is added (see handleAddOp)
    setNewOpNumber(10);
    setShowAddOp(true);
  };


  const handleAddOp = () => {
    if (!newOpName.trim()) return;
    if (SYSTEM_OPS.includes(newOpName.trim().toUpperCase())) {
      toast.error(`"${newOpName.trim().toUpperCase()}" is a reserved system operation`);
      return;
    }
    // Auto-create DOCK if no operations exist yet
    const hasDock = productOps.some(o => o.op_name === 'DOCK');
    if (!hasDock) {
      addOperation(model.id, {
        id: crypto.randomUUID(), product_id: effectiveProductId,
        op_name: 'DOCK', op_number: 0,
        equip_id: '', pct_assigned: 100,
        equip_setup_lot: 0, equip_setup_piece: 0, equip_setup_tbatch: 0,
        equip_run_piece: 0, equip_run_lot: 0, equip_run_tbatch: 0,
        labor_setup_lot: 0, labor_setup_piece: 0, labor_setup_tbatch: 0,
        labor_run_piece: 0, labor_run_lot: 0, labor_run_tbatch: 0,
        oper1: 0, oper2: 0, oper3: 0, oper4: 0,
      });
    }
    addOperation(model.id, {
      id: crypto.randomUUID(), product_id: effectiveProductId,
      op_name: newOpName.trim().toUpperCase(), op_number: newOpNumber,
      equip_id: newOpEquip, pct_assigned: 100,
      equip_setup_lot: 0, equip_setup_piece: 0, equip_setup_tbatch: 0,
      equip_run_piece: 0, equip_run_lot: 0, equip_run_tbatch: 0,
      labor_setup_lot: 0, labor_setup_piece: 0, labor_setup_tbatch: 0,
      labor_run_piece: 0, labor_run_lot: 0, labor_run_tbatch: 0,
      oper1: 0, oper2: 0, oper3: 0, oper4: 0,
    });
    setNewOpNumber(newOpNumber + 10);
    setNewOpName('');
    setNewOpEquip('');
    setShowAddOp(false);
    toast.success('Operation added');
  };

  const handleAutoRoute = () => {
    const sorted = productOps.filter(o => o.op_name !== 'DOCK').sort((a, b) => a.op_number - b.op_number);
    const entries: RoutingEntry[] = [];
    if (sorted.length === 0) {
      // Only DOCK exists → route DOCK → STOCK
      entries.push({ id: crypto.randomUUID(), product_id: effectiveProductId, from_op_name: 'DOCK', to_op_name: 'STOCK', pct_routed: 100 });
    } else {
      // DOCK → first op
      entries.push({ id: crypto.randomUUID(), product_id: effectiveProductId, from_op_name: 'DOCK', to_op_name: sorted[0].op_name, pct_routed: 100 });
    for (let i = 0; i < sorted.length - 1; i++) {
      entries.push({ id: crypto.randomUUID(), product_id: effectiveProductId, from_op_name: sorted[i].op_name, to_op_name: sorted[i + 1].op_name, pct_routed: 100 });
    }
      entries.push({ id: crypto.randomUUID(), product_id: effectiveProductId, from_op_name: sorted[sorted.length - 1].op_name, to_op_name: 'STOCK', pct_routed: 100 });
    }
    setRouting(model.id, effectiveProductId, entries);
    toast.success('Default routing generated. Review and edit branches as needed.');
  };

  const handleResort = () => {
    const nonDock = productOps.filter(o => o.op_name !== 'DOCK');
    nonDock.forEach((op, i) => updateOperation(model.id, op.id, { op_number: (i + 1) * 10 }));
    toast.success('Operations re-sorted');
  };

  // Handle deleting an operation — if it's the last user op, also remove DOCK and all routing
  const handleDeleteOperation = (opId: string) => {
    const op = productOps.find(o => o.id === opId);
    if (!op || op.op_name === 'DOCK') return;

    const remainingUserOps = userOps.filter(o => o.id !== opId);
    if (remainingUserOps.length === 0) {
      // Last user op — remove DOCK too and clear routing
      const dockOp = productOps.find(o => o.op_name === 'DOCK');
      deleteOperation(model.id, opId);
      if (dockOp) deleteOperation(model.id, dockOp.id);
      setRouting(model.id, effectiveProductId, []);
      setExpandedRoutingOp(null);
      toast.success(`All operations cleared. ${effectiveProduct?.name} has no operations defined.`);
    } else {
      deleteOperation(model.id, opId);
    }
  };

  const handleOpFieldChange = (op: Operation, field: string, value: number) => {
    if (activeScenarioId && activeScenario) {
      const productName = model.products.find(p => p.id === op.product_id)?.name || '';
      const entityName = `${productName}: ${op.op_name}`;
      applyScenarioChange(activeScenarioId, 'Routing', op.id, entityName, field, field, value);
    }
    updateOperation(model.id, op.id, { [field]: value });
  };

  const handleAddInlineRoute = (fromOpName: string, toOpName: string, pct: number) => {
    addRouting(model.id, {
      id: crypto.randomUUID(), product_id: effectiveProductId,
      from_op_name: fromOpName, to_op_name: toOpName, pct_routed: pct,
    });
  };

  const handleUpdateInlineRoute = (routeId: string, data: Partial<RoutingEntry>) => {
    if (activeScenarioId && activeScenario && data.pct_routed !== undefined) {
      const route = productRouting.find(r => r.id === routeId);
      if (route) {
        const entityName = `${effectiveProduct?.name}: ${route.from_op_name}→${route.to_op_name}`;
        applyScenarioChange(activeScenarioId, 'Routing', routeId, entityName, 'pct_routed', 'Routing %', data.pct_routed);
      }
    }
    updateRouting(model.id, routeId, data);
  };

  const openFormulaBuilder = (op: Operation, field: string, label: string) => {
    setFormulaTarget({ op, field, label, value: (op as any)[field] || 0 });
  };

  const handleFormulaApply = (value: number, _formula: string) => {
    if (!formulaTarget) return;
    handleOpFieldChange(formulaTarget.op, formulaTarget.field, value);
    toast.success(`Formula applied: ${formulaTarget.label} = ${value}`);
  };

  const pn = model.param_names;

  const timeFields = [
    { field: 'equip_setup_lot', label: 'E.Setup/Lot' },
    { field: 'equip_run_piece', label: 'E.Run/Pc' },
    { field: 'labor_setup_lot', label: 'L.Setup/Lot' },
    { field: 'labor_run_piece', label: 'L.Run/Pc' },
  ];

  // Calculate total columns for inline editor colSpan
  const baseColCount = 10; // lock/# + op# + name + equip + %assign + 4 times + routing
  const advancedColCount = showAdvancedTimes ? 12 : 0;
  const formulaColCount = showFormulaBuilder && !showAdvancedTimes ? 1 : (showFormulaBuilder && showAdvancedTimes ? 1 : 0);
  const deleteColCount = 1;
  const totalCols = baseColCount + advancedColCount + formulaColCount + deleteColCount;

  // Routing completeness pill — only show when user ops exist
  const routingPill = hasUserOps ? (
    routingStatus === 'complete' ? (
      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-300 font-mono text-[11px] gap-1">
        <CheckCircle className="h-3 w-3" /> Routing complete
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-300 font-mono text-[11px] gap-1">
        <AlertTriangle className="h-3 w-3" /> Routing incomplete
      </Badge>
    )
  ) : null;

  return (
    <div className="p-6 animate-fade-in">
      {activeScenarioId && activeScenario && (
        <div className="mb-4 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md">
          <FlaskConical className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-700 font-medium">
            Changes are being recorded to <span className="font-semibold">{activeScenario.name}</span>
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Operations & Routing</h1>
          <p className="text-sm text-muted-foreground">Define operations and routing flow per product</p>
        </div>
        <div className="flex items-center gap-2">
          {showFormulaBuilder && (
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setShowInterpolator(true)}>
              <Calculator className="h-3.5 w-3.5" /> Interpolate
            </Button>
          )}
        </div>
      </div>

      {/* Product Selector Bar with routing status pill */}
      <ProductSelectorBar
        products={model.products}
        operations={model.operations}
        selectedProductId={effectiveProductId}
        onSelect={(id) => { setSearchParams({ product: id }); setExpandedRoutingOp(null); }}
        statusPill={routingPill}
      />

      {!effectiveProduct ? (
        <Card className="mt-6">
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">No products defined</p>
            <p className="text-sm mt-1">Add products in the Products tab first.</p>
          </CardContent>
        </Card>
      ) : showEmptyState ? (
        <Card className="mt-6">
          <CardContent className="p-0">
            <OperationsEmptyState
              productName={effectiveProduct.name}
              onAddOperations={handleAddFirstOps}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 mt-4">
          {/* Default routing banner */}
          {showDefaultRoutingBanner && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-md bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2 text-[13px] text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  No routing defined. Generate a linear route: DOCK →{' '}
                  {productOps.filter(o => o.op_name !== 'DOCK').map(o => o.op_name).join(' → ')} → STOCK
                </span>
              </div>
              <Button size="sm" className="gap-1.5 shrink-0" onClick={handleAutoRoute}>
                <Zap className="h-3.5 w-3.5" /> Generate Default Routing
              </Button>
            </div>
          )}

          {/* Unified Operations + Routing Table */}
          <Card className={activeScenarioId ? 'border-l-[3px] border-l-amber-400' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Operations for <span className="font-mono text-primary">{effectiveProduct.name}</span>
                  </CardTitle>
                  <CardDescription>{userOps.length} operations defined</CardDescription>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex border rounded-md overflow-hidden">
                    <Button
                      variant={!viewActualTimes ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 rounded-none gap-1 text-xs px-3"
                      onClick={() => setViewActualTimes(false)}
                    >
                      <Edit className="h-3 w-3" /> Edit Operation Times
                    </Button>
                    <Button
                      variant={viewActualTimes ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 rounded-none gap-1 text-xs px-3"
                      onClick={() => setViewActualTimes(true)}
                    >
                      <Eye className="h-3 w-3" /> View Actual Times
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setShowAdvancedTimes(!showAdvancedTimes)}>
                    {showAdvancedTimes ? 'Hide Advanced' : 'Show Advanced'}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleResort} disabled={productOps.length <= 1}>
                    <SortAsc className="h-3.5 w-3.5" /> Re-sort
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-xs w-10"></TableHead>
                    <TableHead className="font-mono text-xs w-16">Op #</TableHead>
                    <TableHead className="font-mono text-xs">Op Name</TableHead>
                    <TableHead className="font-mono text-xs">Equipment</TableHead>
                    <TableHead className="font-mono text-xs w-20">% Assign</TableHead>
                    <TableHead className="font-mono text-xs">
                      E.Setup/Lot
                      {viewActualTimes && <span className="text-[9px] text-muted-foreground ml-0.5">(actual)</span>}
                    </TableHead>
                    <TableHead className="font-mono text-xs">
                      E.Run/Pc
                      {viewActualTimes && <span className="text-[9px] text-muted-foreground ml-0.5">(actual)</span>}
                    </TableHead>
                    <TableHead className="font-mono text-xs">
                      L.Setup/Lot
                      {viewActualTimes && <span className="text-[9px] text-muted-foreground ml-0.5">(actual)</span>}
                    </TableHead>
                    <TableHead className="font-mono text-xs">
                      L.Run/Pc
                      {viewActualTimes && <span className="text-[9px] text-muted-foreground ml-0.5">(actual)</span>}
                    </TableHead>
                    {showAdvancedTimes && (
                      <>
                        <TableHead className="font-mono text-xs">E.Setup/Pc</TableHead>
                        <TableHead className="font-mono text-xs">E.Setup/TB</TableHead>
                        <TableHead className="font-mono text-xs">E.Run/Lot</TableHead>
                        <TableHead className="font-mono text-xs">E.Run/TB</TableHead>
                        <TableHead className="font-mono text-xs">L.Setup/Pc</TableHead>
                        <TableHead className="font-mono text-xs">L.Setup/TB</TableHead>
                        <TableHead className="font-mono text-xs">L.Run/Lot</TableHead>
                        <TableHead className="font-mono text-xs">L.Run/TB</TableHead>
                        <TableHead className="font-mono text-xs">{pn.oper1_name}</TableHead>
                        <TableHead className="font-mono text-xs">{pn.oper2_name}</TableHead>
                        <TableHead className="font-mono text-xs">{pn.oper3_name}</TableHead>
                        <TableHead className="font-mono text-xs">{pn.oper4_name}</TableHead>
                      </>
                    )}
                    <TableHead className="font-mono text-xs">Routing</TableHead>
                    {showFormulaBuilder && <TableHead className="font-mono text-xs w-10">ƒ</TableHead>}
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productOps.map((op) => {
                    const actual = viewActualTimes ? getActualTimes(op) : null;
                    const isDock = op.op_name === 'DOCK';
                    const opRoutes = getRoutesForOp(op.op_name);
                    const isExpanded = expandedRoutingOp === op.op_name;
                    const isConfirming = !isDock && pendingDeleteId === op.id;

                    return (
                      <>
                        <TableRow key={op.id} className={isConfirming ? 'bg-destructive/10' : ''}>
                          {isConfirming ? (
                            <TableCell colSpan={totalCols}>
                              <DeleteConfirmInline
                                message={`Delete operation ${op.op_name}?`}
                                onConfirm={() => confirmDelete(op.id, () => handleDeleteOperation(op.id))}
                                onCancel={cancelDelete}
                              />
                            </TableCell>
                          ) : (<>
                          {/* Lock / row indicator */}
                          <TableCell className="w-10 text-center">
                            {isDock && <Lock className="h-3 w-3 text-muted-foreground inline-block" />}
                          </TableCell>
                          {/* Op # */}
                          <TableCell>
                            {isDock ? (
                              <span className="font-mono text-xs text-muted-foreground">0</span>
                            ) : (
                              <Input type="number" className="h-8 w-16 font-mono" value={op.op_number} onChange={(e) => handleOpFieldChange(op, 'op_number', +e.target.value)} />
                            )}
                          </TableCell>
                          {/* Op Name */}
                          <TableCell className={`font-mono font-medium ${isDock ? 'text-muted-foreground' : ''}`}>
                            {op.op_name}
                          </TableCell>
                          {/* Equipment */}
                          <TableCell>
                            {isDock ? (
                              <span className="font-mono text-xs text-muted-foreground">—</span>
                            ) : (
                              <Select value={op.equip_id || 'none'} onValueChange={(v) => updateOperation(model.id, op.id, { equip_id: v === 'none' ? '' : v })}>
                                <SelectTrigger className="h-8 w-32 font-mono text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {model.equipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          {/* % Assign */}
                          <TableCell>
                            {isDock ? (
                              <span className="font-mono text-xs text-muted-foreground">—</span>
                            ) : (
                              <Input type="number" className={`h-8 w-16 font-mono ${op.pct_assigned > 100 ? 'border-red-500 focus-visible:ring-red-500' : ''}`} value={op.pct_assigned} onChange={(e) => handleOpFieldChange(op, 'pct_assigned', +e.target.value)} />
                            )}
                          </TableCell>

                          {/* Main time fields */}
                          {isDock ? (
                            <>
                              <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                            </>
                          ) : viewActualTimes && actual ? (
                            <>
                              <TableCell className="font-mono text-xs text-muted-foreground bg-muted/30">{actual.equip_setup_lot}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground bg-muted/30">{actual.equip_run_piece}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground bg-muted/30">{actual.labor_setup_lot}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground bg-muted/30">{actual.labor_run_piece}</TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.equip_setup_lot} step="0.1" onChange={(e) => handleOpFieldChange(op, 'equip_setup_lot', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.equip_run_piece} step="0.01" onChange={(e) => handleOpFieldChange(op, 'equip_run_piece', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.labor_setup_lot} step="0.1" onChange={(e) => handleOpFieldChange(op, 'labor_setup_lot', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.labor_run_piece} step="0.01" onChange={(e) => handleOpFieldChange(op, 'labor_run_piece', +e.target.value)} /></TableCell>
                            </>
                          )}

                          {/* Advanced time fields */}
                          {showAdvancedTimes && (
                            isDock ? (
                              <>
                                {Array.from({ length: 12 }).map((_, i) => (
                                  <TableCell key={i} className="font-mono text-xs text-muted-foreground">—</TableCell>
                                ))}
                              </>
                            ) : (
                              <>
                                <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.equip_setup_piece} step="0.01" onChange={(e) => handleOpFieldChange(op, 'equip_setup_piece', +e.target.value)} /></TableCell>
                                <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.equip_setup_tbatch} step="0.1" onChange={(e) => handleOpFieldChange(op, 'equip_setup_tbatch', +e.target.value)} /></TableCell>
                                <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.equip_run_lot} step="0.1" onChange={(e) => handleOpFieldChange(op, 'equip_run_lot', +e.target.value)} /></TableCell>
                                <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.equip_run_tbatch} step="0.01" onChange={(e) => handleOpFieldChange(op, 'equip_run_tbatch', +e.target.value)} /></TableCell>
                                <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.labor_setup_piece} step="0.01" onChange={(e) => handleOpFieldChange(op, 'labor_setup_piece', +e.target.value)} /></TableCell>
                                <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.labor_setup_tbatch} step="0.1" onChange={(e) => handleOpFieldChange(op, 'labor_setup_tbatch', +e.target.value)} /></TableCell>
                                <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.labor_run_lot} step="0.1" onChange={(e) => handleOpFieldChange(op, 'labor_run_lot', +e.target.value)} /></TableCell>
                                <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.labor_run_tbatch} step="0.01" onChange={(e) => handleOpFieldChange(op, 'labor_run_tbatch', +e.target.value)} /></TableCell>
                                <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.oper1} step="0.01" onChange={(e) => handleOpFieldChange(op, 'oper1', +e.target.value)} /></TableCell>
                                <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.oper2} step="0.01" onChange={(e) => handleOpFieldChange(op, 'oper2', +e.target.value)} /></TableCell>
                                <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.oper3} step="0.01" onChange={(e) => handleOpFieldChange(op, 'oper3', +e.target.value)} /></TableCell>
                                <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.oper4} step="0.01" onChange={(e) => handleOpFieldChange(op, 'oper4', +e.target.value)} /></TableCell>
                              </>
                            )
                          )}

                          {/* Routing column */}
                          <TableCell className="py-0">
                            {!isDock && op.pct_assigned > 100 ? (
                              <span className="text-sm text-red-600 whitespace-nowrap block">
                                ⚠ % Assign &gt; 100
                              </span>
                            ) : (
                            <span
                              className={`text-sm truncate cursor-pointer whitespace-nowrap block ${
                                opRoutes.length === 0
                                  ? 'text-amber-600'
                                  : 'text-muted-foreground'
                              } ${isExpanded ? 'font-medium' : ''}`}
                              onClick={() => {
                                const name = isDock ? 'DOCK' : op.op_name;
                                setExpandedRoutingOp(isExpanded ? null : name);
                              }}
                            >
                              {opRoutes.length === 0
                                ? '⚠ No routing'
                                : opRoutes.length === 1
                                  ? `→ ${opRoutes[0].to_op_name}`
                                  : `→ ${opRoutes.length} paths`}
                            </span>
                            )}
                          </TableCell>

                          {/* Formula Builder trigger */}
                          {showFormulaBuilder && (
                            <TableCell>
                              {!isDock && (
                                <Select onValueChange={(field) => {
                                  const tf = timeFields.find(f => f.field === field);
                                  if (tf) openFormulaBuilder(op, tf.field, tf.label);
                                }}>
                                  <SelectTrigger className="h-7 w-9 px-1 border-none">
                                    <FunctionSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {timeFields.map(f => (
                                      <SelectItem key={f.field} value={f.field} className="text-xs">{f.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                          )}

                          {/* Delete */}
                          <TableCell>
                            {!isDock && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => requestDelete(op.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                          </>)}
                        </TableRow>

                        {/* Inline routing editor */}
                        {isExpanded && (
                          <InlineRoutingEditor
                            key={`route-${op.op_name}`}
                            opName={op.op_name}
                            routes={opRoutes}
                            allOpNames={userOpNames}
                            onAddRoute={(to, pct) => handleAddInlineRoute(op.op_name, to, pct)}
                            onUpdateRoute={handleUpdateInlineRoute}
                            onDeleteRoute={(id) => deleteRouting(model.id, id)}
                            colSpan={totalCols}
                            hideDelete={isDock}
                          />
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>

              {/* + Add Operation button below table */}
              <div className="px-4 py-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    setNewOpNumber(productOps.length > 0 ? productOps[productOps.length - 1].op_number + 10 : 10);
                    setShowAddOp(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Operation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Operation Dialog */}
      <Dialog open={showAddOp} onOpenChange={setShowAddOp}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Operation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Operation Name</Label><Input ref={newOpNameRef} value={newOpName} onChange={(e) => setNewOpName(e.target.value)} placeholder="e.g., RFTURN" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleAddOp()} /></div>
              <div><Label>Op Number</Label><Input type="number" value={newOpNumber} onChange={(e) => setNewOpNumber(+e.target.value)} /></div>
            </div>
            <div>
              <Label>Equipment Group</Label>
              <Select value={newOpEquip || 'none'} onValueChange={(v) => setNewOpEquip(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {model.equipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddOp(false)}>Cancel</Button>
            <Button onClick={handleAddOp} disabled={!newOpName.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Formula Builder Modal */}
      {formulaTarget && (
        <FormulaBuilder
          open={!!formulaTarget}
          onClose={() => setFormulaTarget(null)}
          model={model}
          operation={formulaTarget.op}
          field={formulaTarget.field}
          fieldLabel={formulaTarget.label}
          currentValue={formulaTarget.value}
          onApply={handleFormulaApply}
        />
      )}

      {/* Interpolate Calculator */}
      <InterpolateCalculator
        open={showInterpolator}
        onClose={() => setShowInterpolator(false)}
        onApply={(value) => toast.success(`Interpolated value: ${value} — use it in a time field`)}
      />
    </div>
  );
}
