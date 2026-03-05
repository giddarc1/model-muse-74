import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useModelStore, type Operation, type RoutingEntry } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Wand2, ArrowDown, AlertTriangle, SortAsc, CheckCircle, XCircle, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';

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

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProductId = searchParams.get('product') || '';
  const [showAddOp, setShowAddOp] = useState(false);
  const [newOpName, setNewOpName] = useState('');
  const [newOpNumber, setNewOpNumber] = useState(10);
  const [newOpEquip, setNewOpEquip] = useState('');
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [routeFromOp, setRouteFromOp] = useState('');
  const [routeToOp, setRouteToOp] = useState('');
  const [routePct, setRoutePct] = useState(100);

  const selectedProduct = model?.products.find((p) => p.id === selectedProductId);
  const productOps = useMemo(
    () => (model?.operations ?? []).filter((o) => o.product_id === selectedProductId).sort((a, b) => a.op_number - b.op_number),
    [model?.operations, selectedProductId]
  );
  const productRouting = useMemo(
    () => (model?.routing ?? []).filter((r) => r.product_id === selectedProductId),
    [model?.routing, selectedProductId]
  );

  const allOpNames = useMemo(() => {
    const userOps = productOps.map((o) => o.op_name);
    return ['DOCK', ...userOps, 'STOCK', 'SCRAP'];
  }, [productOps]);

  // Per-from-op routing sum with status
  const routingSums = useMemo(() => {
    const sums: Record<string, number> = {};
    productRouting.forEach((r) => {
      sums[r.from_op_name] = (sums[r.from_op_name] || 0) + r.pct_routed;
    });
    return sums;
  }, [productRouting]);

  const routingWarnings = useMemo(() => {
    const warnings: string[] = [];
    Object.entries(routingSums).forEach(([fromOp, total]) => {
      if (Math.abs(total - 100) > 0.01) {
        warnings.push(`${fromOp}: routes sum to ${total}% (should be 100%)`);
      }
    });
    return warnings;
  }, [routingSums]);

  if (!model) return null;

  const handleAddOp = () => {
    if (!newOpName.trim()) return;
    if (SYSTEM_OPS.includes(newOpName.trim().toUpperCase())) {
      toast.error(`"${newOpName.trim().toUpperCase()}" is a reserved system operation`);
      return;
    }
    addOperation(model.id, {
      id: crypto.randomUUID(), product_id: selectedProductId,
      op_name: newOpName.trim().toUpperCase(), op_number: newOpNumber,
      equip_id: newOpEquip, pct_assigned: 100,
      equip_setup_lot: 0, equip_run_piece: 0, labor_setup_lot: 0, labor_run_piece: 0,
    });
    setNewOpNumber(newOpNumber + 10); setNewOpName(''); setNewOpEquip('');
    setShowAddOp(false);
    toast.success('Operation added');
  };

  const handleAddRoute = () => {
    if (!routeFromOp || !routeToOp) return;
    addRouting(model.id, {
      id: crypto.randomUUID(), product_id: selectedProductId,
      from_op_name: routeFromOp, to_op_name: routeToOp, pct_routed: routePct,
    });
    setShowAddRoute(false); setRouteFromOp(''); setRouteToOp(''); setRoutePct(100);
  };

  const handleAutoRoute = () => {
    if (productOps.length === 0) { toast.error('Add operations first'); return; }
    const sorted = [...productOps].sort((a, b) => a.op_number - b.op_number);
    const entries: RoutingEntry[] = [];
    entries.push({ id: crypto.randomUUID(), product_id: selectedProductId, from_op_name: 'DOCK', to_op_name: sorted[0].op_name, pct_routed: 100 });
    for (let i = 0; i < sorted.length - 1; i++) {
      entries.push({ id: crypto.randomUUID(), product_id: selectedProductId, from_op_name: sorted[i].op_name, to_op_name: sorted[i + 1].op_name, pct_routed: 100 });
    }
    entries.push({ id: crypto.randomUUID(), product_id: selectedProductId, from_op_name: sorted[sorted.length - 1].op_name, to_op_name: 'STOCK', pct_routed: 100 });
    setRouting(model.id, selectedProductId, entries);
    toast.success(`Default routing generated: DOCK → ${sorted.map(o => o.op_name).join(' → ')} → STOCK`);
  };

  const handleResort = () => {
    productOps.forEach((op, i) => updateOperation(model.id, op.id, { op_number: (i + 1) * 10 }));
    toast.success('Operations re-sorted');
  };

  const routingSumIndicator = (fromOp: string) => {
    const sum = routingSums[fromOp];
    if (sum === undefined) return null;
    if (Math.abs(sum - 100) < 0.01) {
      return <span className="flex items-center gap-0.5 text-xs text-success font-mono"><CheckCircle className="h-3 w-3" /> 100%</span>;
    }
    if (sum < 100) {
      return <span className="flex items-center gap-0.5 text-xs text-warning font-mono"><AlertTriangle className="h-3 w-3" /> {sum}%</span>;
    }
    return <span className="flex items-center gap-0.5 text-xs text-destructive font-mono"><XCircle className="h-3 w-3" /> {sum}%</span>;
  };

  // Helper to track routing changes in active scenario
  const handleRoutingChange = (routeId: string, field: string, value: number, route: typeof productRouting[0]) => {
    updateRouting(model.id, routeId, { [field]: value });
    if (activeScenarioId && activeScenario) {
      const productName = selectedProduct?.name || '';
      const entityName = `${productName}: ${route.from_op_name}→${route.to_op_name}`;
      applyScenarioChange(activeScenarioId, 'Routing', routeId, entityName, field, field === 'pct_routed' ? 'Routing %' : field, value);
    }
  };

  return (
    <div className="p-6 animate-fade-in">
      {activeScenarioId && activeScenario && (
        <div className="mb-4 flex items-center gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-md">
          <FlaskConical className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm text-primary font-medium">
            Changes are being recorded to <span className="font-semibold">{activeScenario.name}</span>
          </span>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Operations & Routing</h1>
          <p className="text-sm text-muted-foreground">Define operations and routing flow per product</p>
        </div>
      </div>

      {/* Product Selector */}
      <div className="mb-6">
        <Label className="text-xs text-muted-foreground mb-1.5 block">Select Product</Label>
        <div className="flex gap-2 flex-wrap">
          {model.products.map((p) => (
            <Button key={p.id} variant={p.id === selectedProductId ? 'default' : 'outline'} size="sm" className="font-mono text-xs" onClick={() => setSearchParams({ product: p.id })}>
              {p.name}
              <Badge variant="secondary" className="ml-1.5 text-xs h-4 px-1">{model.operations.filter(o => o.product_id === p.id).length}</Badge>
            </Button>
          ))}
        </div>
      </div>

      {!selectedProduct ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">Select a product above</p>
            <p className="text-sm mt-1">Choose a product to view and edit its operations and routing.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Operations Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Operations for <span className="font-mono text-primary">{selectedProduct.name}</span></CardTitle>
                  <CardDescription>{productOps.length} operations defined</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleResort} disabled={productOps.length === 0}>
                    <SortAsc className="h-3.5 w-3.5" /> Re-sort
                  </Button>
                  <Button size="sm" className="gap-1 text-xs" onClick={() => { setShowAddOp(true); setNewOpNumber(productOps.length > 0 ? productOps[productOps.length - 1].op_number + 10 : 10); }}>
                    <Plus className="h-3.5 w-3.5" /> Add Operation
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {productOps.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  No operations yet. Click "Add Operation" to define the first step.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-xs w-16">Op #</TableHead>
                      <TableHead className="font-mono text-xs">Op Name</TableHead>
                      <TableHead className="font-mono text-xs">Equipment</TableHead>
                      <TableHead className="font-mono text-xs w-20">% Assign</TableHead>
                      <TableHead className="font-mono text-xs">E.Setup/Lot</TableHead>
                      <TableHead className="font-mono text-xs">E.Run/Pc</TableHead>
                      <TableHead className="font-mono text-xs">L.Setup/Lot</TableHead>
                      <TableHead className="font-mono text-xs">L.Run/Pc</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productOps.map((op) => (
                      <TableRow key={op.id}>
                        <TableCell><Input type="number" className="h-8 w-16 font-mono" value={op.op_number} onChange={(e) => updateOperation(model.id, op.id, { op_number: +e.target.value })} /></TableCell>
                        <TableCell className="font-mono font-medium">{op.op_name}</TableCell>
                        <TableCell>
                          <Select value={op.equip_id || 'none'} onValueChange={(v) => updateOperation(model.id, op.id, { equip_id: v === 'none' ? '' : v })}>
                            <SelectTrigger className="h-8 w-32 font-mono text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {model.equipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input type="number" className="h-8 w-16 font-mono" value={op.pct_assigned} onChange={(e) => updateOperation(model.id, op.id, { pct_assigned: +e.target.value })} /></TableCell>
                        <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.equip_setup_lot} step="0.1" onChange={(e) => updateOperation(model.id, op.id, { equip_setup_lot: +e.target.value })} /></TableCell>
                        <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.equip_run_piece} step="0.01" onChange={(e) => updateOperation(model.id, op.id, { equip_run_piece: +e.target.value })} /></TableCell>
                        <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.labor_setup_lot} step="0.1" onChange={(e) => updateOperation(model.id, op.id, { labor_setup_lot: +e.target.value })} /></TableCell>
                        <TableCell><Input type="number" className="h-8 w-20 font-mono" value={op.labor_run_piece} step="0.01" onChange={(e) => updateOperation(model.id, op.id, { labor_run_piece: +e.target.value })} /></TableCell>
                        <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteOperation(model.id, op.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Routing Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Routing</CardTitle>
                  <CardDescription>Define the flow from operation to operation. Each "from" node's outgoing routes must sum to 100%.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleAutoRoute} disabled={productOps.length === 0}>
                    <Wand2 className="h-3.5 w-3.5" /> Auto-Generate
                  </Button>
                  <Button size="sm" className="gap-1 text-xs" onClick={() => setShowAddRoute(true)} disabled={productOps.length === 0}>
                    <Plus className="h-3.5 w-3.5" /> Add Route
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {routingWarnings.length > 0 && (
                <div className="mx-4 mb-3 p-3 bg-warning/10 border border-warning/30 rounded-md">
                  {routingWarnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-warning">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
              {productRouting.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  No routing defined. Click "Auto-Generate" for sequential routing or "Add Route" manually.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-xs">From Operation</TableHead>
                      <TableHead className="font-mono text-xs w-16">Sum</TableHead>
                      <TableHead className="font-mono text-xs w-10"></TableHead>
                      <TableHead className="font-mono text-xs">To Operation</TableHead>
                      <TableHead className="font-mono text-xs w-24">% Routed</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productRouting
                      .sort((a, b) => allOpNames.indexOf(a.from_op_name) - allOpNames.indexOf(b.from_op_name))
                      .map((r, i, arr) => {
                        const showFromHeader = i === 0 || arr[i - 1].from_op_name !== r.from_op_name;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono font-medium">
                              {showFromHeader ? r.from_op_name : <span className="text-muted-foreground/30">↳</span>}
                            </TableCell>
                            <TableCell>
                              {showFromHeader ? routingSumIndicator(r.from_op_name) : null}
                            </TableCell>
                            <TableCell><ArrowDown className="h-3.5 w-3.5 text-muted-foreground rotate-[-90deg]" /></TableCell>
                            <TableCell>
                              <Select value={r.to_op_name} onValueChange={(v) => updateRouting(model.id, r.id, { to_op_name: v })}>
                                <SelectTrigger className="h-8 w-32 font-mono text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {allOpNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="h-8 w-20 font-mono" value={r.pct_routed} onChange={(e) => updateRouting(model.id, r.id, { pct_routed: +e.target.value })} />
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRouting(model.id, r.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
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
              <div><Label>Operation Name</Label><Input value={newOpName} onChange={(e) => setNewOpName(e.target.value)} placeholder="e.g., RFTURN" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleAddOp()} /></div>
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

      {/* Add Route Dialog */}
      <Dialog open={showAddRoute} onOpenChange={setShowAddRoute}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Routing Entry</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From Operation</Label>
                <Select value={routeFromOp} onValueChange={setRouteFromOp}>
                  <SelectTrigger><SelectValue placeholder="From..." /></SelectTrigger>
                  <SelectContent>{allOpNames.filter(n => n !== 'STOCK' && n !== 'SCRAP').map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>To Operation</Label>
                <Select value={routeToOp} onValueChange={setRouteToOp}>
                  <SelectTrigger><SelectValue placeholder="To..." /></SelectTrigger>
                  <SelectContent>{allOpNames.filter(n => n !== 'DOCK').map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>% Routed</Label><Input type="number" value={routePct} onChange={(e) => setRoutePct(+e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddRoute(false)}>Cancel</Button>
            <Button onClick={handleAddRoute} disabled={!routeFromOp || !routeToOp}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
