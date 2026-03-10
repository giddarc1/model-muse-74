import { useState, useMemo } from 'react';
import type { Model, Operation } from '@/stores/modelStore';
import { useModelStore } from '@/stores/modelStore';
import type { Scenario } from '@/stores/scenarioStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useUserLevelStore, isVisible } from '@/hooks/useUserLevel';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { ProductSelectorBar } from '@/components/ProductSelectorBar';

function cc(scenario: Scenario, entityId: string, field: string): string {
  return scenario.changes.some(c => c.entityId === entityId && c.field === field)
    ? 'ring-2 ring-amber-400 bg-amber-500/5' : '';
}

export function WhatIfOperationsTab({ model, scenario }: { model: Model; scenario: Scenario }) {
  const [selectedProductId, setSelectedProductId] = useState(model.products[0]?.id || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const updateOperation = useModelStore(s => s.updateOperation);
  const updateRouting = useModelStore(s => s.updateRouting);
  const applyScenarioChange = useScenarioStore(s => s.applyScenarioChange);
  const { userLevel } = useUserLevelStore();
  const pn = model.param_names;

  const effectiveProduct = model.products.find(p => p.id === selectedProductId);

  const productOps = useMemo(
    () => (model.operations ?? [])
      .filter(o => o.product_id === selectedProductId && o.op_name !== 'STOCK' && o.op_name !== 'SCRAP')
      .sort((a, b) => a.op_number - b.op_number),
    [model.operations, selectedProductId]
  );

  const productRouting = useMemo(
    () => (model.routing ?? []).filter(r => r.product_id === selectedProductId),
    [model.routing, selectedProductId]
  );

  const userOps = useMemo(() => productOps.filter(o => o.op_name !== 'DOCK'), [productOps]);

  const handleOpFieldChange = (op: Operation, field: string, value: number) => {
    const productName = model.products.find(p => p.id === op.product_id)?.name || '';
    const entityName = `${productName}: ${op.op_name}`;
    applyScenarioChange(scenario.id, 'Routing', op.id, entityName, field, field, value);
    updateOperation(model.id, op.id, { [field]: value });
  };

  const handleRoutingPctChange = (routeId: string, fromOpName: string, toOpName: string, pct: number) => {
    const entityName = `${effectiveProduct?.name}: ${fromOpName}→${toOpName}`;
    applyScenarioChange(scenario.id, 'Routing', routeId, entityName, 'pct_routed', 'Routing %', pct);
    updateRouting(model.id, routeId, { pct_routed: pct });
  };

  if (!model.products.length) {
    return <div className="py-12 text-center text-sm text-muted-foreground">No products defined</div>;
  }

  return (
    <div className="space-y-4">
      <ProductSelectorBar
        products={model.products}
        operations={model.operations}
        selectedProductId={selectedProductId}
        onSelect={setSelectedProductId}
      />

      {!effectiveProduct ? (
        <p className="text-sm text-muted-foreground">Select a product above.</p>
      ) : userOps.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No operations defined for {effectiveProduct.name}</div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{userOps.length} operations for <span className="font-mono text-foreground">{effectiveProduct.name}</span></p>
            <Button variant="outline" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="gap-1 text-xs">
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
            </Button>
          </div>

          <Card className="border-l-[3px] border-l-amber-400">
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-xs w-10"></TableHead>
                    <TableHead className="font-mono text-xs w-16">Op #</TableHead>
                    <TableHead className="font-mono text-xs">Op Name</TableHead>
                    <TableHead className="font-mono text-xs">Equipment</TableHead>
                    <TableHead className="font-mono text-xs w-20">% Assign</TableHead>
                    <TableHead className="font-mono text-xs">E.Setup/Lot</TableHead>
                    <TableHead className="font-mono text-xs">E.Run/Pc</TableHead>
                    <TableHead className="font-mono text-xs">L.Setup/Lot</TableHead>
                    <TableHead className="font-mono text-xs">L.Run/Pc</TableHead>
                    {showAdvanced && <>
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
                    </>}
                    <TableHead className="font-mono text-xs">Routing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productOps.map((op) => {
                    const isDock = op.op_name === 'DOCK';
                    const opRoutes = productRouting.filter(r => r.from_op_name === op.op_name);
                    const routingSummary = opRoutes.length > 0
                      ? opRoutes.map(r => `${r.to_op_name} ${r.pct_routed}%`).join(', ')
                      : '—';

                    return (
                      <TableRow key={op.id}>
                        <TableCell className="w-10 text-center">
                          {isDock && <Lock className="h-3 w-3 text-muted-foreground inline-block" />}
                        </TableCell>
                        <TableCell>
                          {isDock ? (
                            <span className="font-mono text-xs text-muted-foreground">0</span>
                          ) : (
                            <span className="font-mono text-xs">{op.op_number}</span>
                          )}
                        </TableCell>
                        <TableCell className={`font-mono font-medium ${isDock ? 'text-muted-foreground' : ''}`}>
                          {op.op_name}
                        </TableCell>
                        <TableCell>
                          {isDock ? (
                            <span className="font-mono text-xs text-muted-foreground">—</span>
                          ) : (
                            <Select value={op.equip_id || 'none'} onValueChange={(v) => {
                              const val = v === 'none' ? '' : v;
                              handleOpFieldChange(op, 'equip_id', val as any);
                            }}>
                              <SelectTrigger className={`h-8 w-32 font-mono text-xs ${cc(scenario, op.id, 'equip_id')}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {model.equipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          {isDock ? (
                            <span className="font-mono text-xs text-muted-foreground">—</span>
                          ) : (
                            <Input type="number" className={`h-8 w-16 font-mono ${cc(scenario, op.id, 'pct_assigned')}`} value={op.pct_assigned} onChange={(e) => handleOpFieldChange(op, 'pct_assigned', +e.target.value)} />
                          )}
                        </TableCell>
                        {isDock ? (
                          <>
                            <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'equip_setup_lot')}`} value={op.equip_setup_lot} step="0.1" onChange={(e) => handleOpFieldChange(op, 'equip_setup_lot', +e.target.value)} /></TableCell>
                            <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'equip_run_piece')}`} value={op.equip_run_piece} step="0.01" onChange={(e) => handleOpFieldChange(op, 'equip_run_piece', +e.target.value)} /></TableCell>
                            <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'labor_setup_lot')}`} value={op.labor_setup_lot} step="0.1" onChange={(e) => handleOpFieldChange(op, 'labor_setup_lot', +e.target.value)} /></TableCell>
                            <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'labor_run_piece')}`} value={op.labor_run_piece} step="0.01" onChange={(e) => handleOpFieldChange(op, 'labor_run_piece', +e.target.value)} /></TableCell>
                          </>
                        )}
                        {showAdvanced && (
                          isDock ? (
                            Array.from({ length: 12 }).map((_, i) => (
                              <TableCell key={i} className="font-mono text-xs text-muted-foreground">—</TableCell>
                            ))
                          ) : (
                            <>
                              <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'equip_setup_piece')}`} value={op.equip_setup_piece} step="0.1" onChange={(e) => handleOpFieldChange(op, 'equip_setup_piece', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'equip_setup_tbatch')}`} value={op.equip_setup_tbatch} step="0.1" onChange={(e) => handleOpFieldChange(op, 'equip_setup_tbatch', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'equip_run_lot')}`} value={op.equip_run_lot} step="0.1" onChange={(e) => handleOpFieldChange(op, 'equip_run_lot', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'equip_run_tbatch')}`} value={op.equip_run_tbatch} step="0.1" onChange={(e) => handleOpFieldChange(op, 'equip_run_tbatch', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'labor_setup_piece')}`} value={op.labor_setup_piece} step="0.1" onChange={(e) => handleOpFieldChange(op, 'labor_setup_piece', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'labor_setup_tbatch')}`} value={op.labor_setup_tbatch} step="0.1" onChange={(e) => handleOpFieldChange(op, 'labor_setup_tbatch', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'labor_run_lot')}`} value={op.labor_run_lot} step="0.1" onChange={(e) => handleOpFieldChange(op, 'labor_run_lot', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'labor_run_tbatch')}`} value={op.labor_run_tbatch} step="0.1" onChange={(e) => handleOpFieldChange(op, 'labor_run_tbatch', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'oper1')}`} value={op.oper1} onChange={(e) => handleOpFieldChange(op, 'oper1', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'oper2')}`} value={op.oper2} onChange={(e) => handleOpFieldChange(op, 'oper2', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'oper3')}`} value={op.oper3} onChange={(e) => handleOpFieldChange(op, 'oper3', +e.target.value)} /></TableCell>
                              <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, op.id, 'oper4')}`} value={op.oper4} onChange={(e) => handleOpFieldChange(op, 'oper4', +e.target.value)} /></TableCell>
                            </>
                          )
                        )}
                        <TableCell>
                          {opRoutes.length > 0 ? (
                            <div className="space-y-0.5">
                              {opRoutes.map(r => (
                                <div key={r.id} className="flex items-center gap-1">
                                  <span className="text-[11px] font-mono text-muted-foreground">{r.to_op_name}</span>
                                  <Input type="number" className={`h-6 w-14 font-mono text-[11px] ${cc(scenario, r.id, 'pct_routed')}`}
                                    value={r.pct_routed}
                                    onChange={(e) => handleRoutingPctChange(r.id, r.from_op_name, r.to_op_name, +e.target.value)}
                                  />
                                  <span className="text-[10px] text-muted-foreground">%</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
