import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModelStore, type Product } from '@/stores/modelStore';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmInline } from '@/components/DeleteConfirmInline';
import { useScenarioStore } from '@/stores/scenarioStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, LayoutGrid, List, Copy, GitBranch, Network, ChevronDown, ChevronUp, Info, FlaskConical, Save, Check } from 'lucide-react';

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[280px] text-xs">{text}</TooltipContent></Tooltip></TooltipProvider>
  );
}


import { useUserLevelStore, isVisible } from '@/hooks/useUserLevel';
import { toast } from 'sonner';
import { UnsavedChangesGuard } from '@/components/UnsavedChangesGuard';
import { DeptCodeSelect } from '@/components/DeptCodeSelect';

const FIELD_LABELS: Record<string, string> = {
  demand: 'End Demand', lot_size: 'Lot Size', tbatch_size: 'TBatch Size',
  demand_factor: 'Demand Factor', lot_factor: 'Lot Factor', var_factor: 'Var Factor',
  setup_factor: 'Setup Factor', make_to_stock: 'Make to Stock', gather_tbatches: 'Gather TBatches',
  dept_code: 'Dept/Area', prod1: 'Prod1', prod2: 'Prod2', prod3: 'Prod3', prod4: 'Prod4', comments: 'Comments',
};

export default function ProductData() {
  const model = useModelStore((s) => s.getActiveModel());
  const addProduct = useModelStore((s) => s.addProduct);
  const updateProduct = useModelStore((s) => s.updateProduct);
  const deleteProduct = useModelStore((s) => s.deleteProduct);
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'form'>('table');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const { pendingDeleteId, requestDelete, cancelDelete, confirmDelete } = useDeleteConfirmation();
  const { userLevel } = useUserLevelStore();
  const showAdvancedParams = isVisible('advanced_parameters', userLevel);
  const activeScenarioId = useScenarioStore(s => s.activeScenarioId);
  const activeScenario = useScenarioStore(s => s.scenarios.find(sc => sc.id === s.activeScenarioId));
  const applyScenarioChange = useScenarioStore(s => s.applyScenarioChange);

  if (!model) return (
    <div className="p-6 space-y-4">
      <div className="h-7 w-48 bg-muted animate-pulse rounded" />
      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
    </div>
  );

  const handleAdd = () => {
    if (!newName.trim()) return;
    if (model.products.some((p) => p.name.toLowerCase() === newName.trim().toLowerCase())) {
      toast.error('A product with this name already exists');
      return;
    }
    addProduct(model.id, {
      id: crypto.randomUUID(), name: newName.trim().toUpperCase(), demand: 0, lot_size: 1,
      tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, setup_factor: 1,
      make_to_stock: false, gather_tbatches: true, dept_code: '',
      prod1: 0, prod2: 0, prod3: 0, prod4: 0, comments: '',
    });
    setNewName('');
    setShowAdd(false);
    toast.success(`Product "${newName.trim().toUpperCase()}" added`);
  };

  const handleCopy = (p: Product) => {
    const newP: Product = { ...p, id: crypto.randomUUID(), name: `${p.name}_COPY` };
    addProduct(model.id, newP);
    toast.success(`Product "${newP.name}" created as copy`);
  };

  const handleCellChange = (id: string, field: keyof Product, value: any) => {
    if (activeScenarioId && activeScenario) {
      const prod = model.products.find(p => p.id === id);
      const entityName = prod?.name || id;
      const fieldLabel = FIELD_LABELS[field] || field;
      applyScenarioChange(activeScenarioId, 'Product', id, entityName, field, fieldLabel, value as string | number);
    }
    updateProduct(model.id, id, { [field]: value });
    setIsDirty(true);
    setJustSaved(false);
  };

  const handleSave = () => {
    setIsDirty(false);
    setJustSaved(true);
    toast.success('Saved');
    setTimeout(() => setJustSaved(false), 2000);
  };

  const goToOps = (productId: string) => {
    navigate(`/models/${model.id}/operations?product=${productId}`);
  };

  const opsCount = (productId: string) => model.operations.filter((o) => o.product_id === productId).length;

  const ibomCount = (productId: string) => model.ibom.filter(e => e.parent_product_id === productId).length;

  return (
    <>
    <UnsavedChangesGuard isDirty={isDirty} onSave={handleSave} />
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
          <h1 className="text-xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">{model.products.length} products defined</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="gap-1 text-xs">
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
          </Button>
          <div className="flex border rounded-md overflow-hidden">
            <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('table')}><List className="h-4 w-4" /></Button>
            <Button variant={viewMode === 'form' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('form')}><LayoutGrid className="h-4 w-4" /></Button>
          </div>
          <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Product</Button>
          <Button size="sm" className="gap-1" variant={isDirty ? 'default' : 'outline'} disabled={!isDirty && !justSaved} onClick={handleSave}>
            {justSaved ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" /> Save</>}
          </Button>
        </div>
      </div>

      {model.products.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><p>No products defined.</p><Button className="mt-4" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Add First Product</Button></CardContent></Card>
      ) : viewMode === 'table' ? (
        <Card className={activeScenarioId ? 'border-l-[3px] border-l-amber-400' : ''}>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-xs">Name</TableHead>
                  <TableHead className="font-mono text-xs">
                    <TooltipProvider delayDuration={400}><Tooltip><TooltipTrigger asChild><span className="cursor-help">End Demand</span></TooltipTrigger><TooltipContent className="max-w-[260px] text-xs">Quantity shipped directly to customers. Set to 0 for components used only within assemblies; their production quantity will be calculated automatically from the IBOM.</TooltipContent></Tooltip></TooltipProvider>
                  </TableHead>
                  <TableHead className="font-mono text-xs">Lot Size</TableHead>
                  {showAdvanced && <>
                    <TableHead className="font-mono text-xs">TBatch</TableHead>
                    <TableHead className="font-mono text-xs">Dept/Area</TableHead>
                    <TableHead className="font-mono text-xs">Demand Fac</TableHead>
                    <TableHead className="font-mono text-xs">Lot Fac</TableHead>
                    <TableHead className="font-mono text-xs">Var Fac</TableHead>
                    
                    <TableHead className="font-mono text-xs">MTS</TableHead>
                    <TableHead className="font-mono text-xs">Gather</TableHead>
                    <TableHead className="font-mono text-xs">{model.param_names.prod1_name}</TableHead>
                    <TableHead className="font-mono text-xs">{model.param_names.prod2_name}</TableHead>
                    <TableHead className="font-mono text-xs">{model.param_names.prod3_name}</TableHead>
                    <TableHead className="font-mono text-xs">{model.param_names.prod4_name}</TableHead>
                  </>}
                  <TableHead className="font-mono text-xs">Ops</TableHead>
                  <TableHead className="font-mono text-xs">IBOM</TableHead>
                  <TableHead className="font-mono text-xs">Comments</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.products.map((p) => {
                  const isConfirming = pendingDeleteId === p.id;
                  return (
                  <TableRow key={p.id} className={isConfirming ? 'bg-destructive/10' : ''}>
                    {isConfirming ? (
                      <TableCell colSpan={showAdvanced ? 18 : 8}>
                        <DeleteConfirmInline
                          message={`Delete ${p.name}? This will remove its operations and IBOM data.`}
                          onConfirm={() => confirmDelete(p.id, () => deleteProduct(model.id, p.id))}
                          onCancel={cancelDelete}
                        />
                      </TableCell>
                    ) : (<>
                    <TableCell className="font-mono font-medium">{p.name}</TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${p.demand < 0 ? 'border-destructive' : ''}`} value={p.demand} onChange={(e) => handleCellChange(p.id, 'demand', +e.target.value)} /></TableCell>
                    <TableCell>
                      <Input type="number" className={`h-8 w-20 font-mono ${p.lot_size < 1 ? 'border-destructive' : ''}`} value={p.lot_size} onChange={(e) => handleCellChange(p.id, 'lot_size', +e.target.value)} />
                      {p.lot_size < 1 && <span className="text-[10px] text-destructive">≥ 1</span>}
                    </TableCell>
                    {showAdvanced && <>
                      <TableCell>
                        <Input type="number" className="h-8 w-20 font-mono" value={p.tbatch_size} onChange={(e) => handleCellChange(p.id, 'tbatch_size', +e.target.value)} />
                        <span className="text-[9px] text-muted-foreground">-1 = lot size</span>
                      </TableCell>
                      <TableCell>
                        <DeptCodeSelect modelId={model.id} value={p.dept_code} onChange={(v) => handleCellChange(p.id, 'dept_code', v)} section="product" className="h-8 w-28" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input type="number" className="h-8 w-20 font-mono" value={p.demand_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'demand_factor', +e.target.value)} />
                          <InfoTip text="Scales the product demand without changing the stored demand value. Set to 0 to effectively exclude this product from calculations while keeping its data." />
                        </div>
                      </TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.lot_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'lot_factor', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.var_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'var_factor', +e.target.value)} /></TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Switch checked={p.make_to_stock} onCheckedChange={(v) => handleCellChange(p.id, 'make_to_stock', v)} />
                          <InfoTip text="When checked, this component is assumed to be held in stock. Its MCT does not add to the parent assembly MCT. Use for Assemble-to-Order scenarios." />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Switch checked={p.gather_tbatches} onCheckedChange={(v) => handleCellChange(p.id, 'gather_tbatches', v)} />
                          <InfoTip text="When checked, the first transfer batch waits for the full lot before moving to stock. Uncheck if transfer batches are sent forward immediately as completed." />
                        </div>
                      </TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.prod1} onChange={(e) => handleCellChange(p.id, 'prod1', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.prod2} onChange={(e) => handleCellChange(p.id, 'prod2', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.prod3} onChange={(e) => handleCellChange(p.id, 'prod3', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.prod4} onChange={(e) => handleCellChange(p.id, 'prod4', +e.target.value)} /></TableCell>
                    </>}
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs font-mono" onClick={() => goToOps(p.id)}>
                        <GitBranch className="h-3 w-3" />{opsCount(p.id)}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider delayDuration={400}><Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className={`h-7 gap-1 text-xs font-mono ${ibomCount(p.id) === 0 ? 'text-muted-foreground' : ''}`} onClick={() => navigate(`/models/${model.id}/ibom?product=${p.id}`)}>
                          <Network className="h-3 w-3" />{ibomCount(p.id)}
                        </Button>
                      </TooltipTrigger><TooltipContent className="text-xs">View IBOM for {p.name}</TooltipContent></Tooltip></TooltipProvider>
                    </TableCell>
                    <TableCell><Input className="h-8 w-32" value={p.comments} onChange={(e) => handleCellChange(p.id, 'comments', e.target.value)} /></TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(p)} title="Duplicate"><Copy className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => requestDelete(p.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                    </>)}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {model.products.map((p) => (
            <Card key={p.id} className={activeScenarioId ? 'border-l-[3px] border-l-amber-400' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono">{p.name}</CardTitle>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(p)}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(`Delete ${p.name}? This will remove its operations and IBOM data.`)) deleteProduct(model.id, p.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <TooltipProvider delayDuration={400}><Tooltip><TooltipTrigger asChild><Label className="text-xs cursor-help">End Demand</Label></TooltipTrigger><TooltipContent className="max-w-[260px] text-xs">Quantity shipped directly to customers. Set to 0 for components used only within assemblies; their production quantity will be calculated automatically from the IBOM.</TooltipContent></Tooltip></TooltipProvider>
                      <Input type="number" className="h-8 font-mono" value={p.demand} onChange={(e) => handleCellChange(p.id, 'demand', +e.target.value)} />
                    </div>
                    <div><Label className="text-xs">Lot Size</Label><Input type="number" className="h-8 font-mono" value={p.lot_size} onChange={(e) => handleCellChange(p.id, 'lot_size', +e.target.value)} /></div>
                  </div>
                  <div><Label className="text-xs">Comments</Label><Input className="h-8" value={p.comments} onChange={(e) => handleCellChange(p.id, 'comments', e.target.value)} /></div>
                  <Button variant="outline" size="sm" className="w-full gap-1 text-xs" onClick={() => goToOps(p.id)}>
                    <GitBranch className="h-3.5 w-3.5" /> Operations ({opsCount(p.id)})
                  </Button>
                  <Button variant="outline" size="sm" className="w-full gap-1 text-xs" onClick={() => navigate(`/models/${model.id}/ibom?product=${p.id}`)}>
                    <Network className="h-3.5 w-3.5" /> IBOM ({ibomCount(p.id)})
                  </Button>

                  {showAdvanced && (
                    <div className="pt-3 border-t border-border space-y-3">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Advanced Parameters</Label>
                      <div className="grid grid-cols-2 gap-3">
                         <div>
                            <Label className="text-xs">Transfer Batch</Label>
                            <Input type="number" className="h-8 font-mono" value={p.tbatch_size} onChange={(e) => handleCellChange(p.id, 'tbatch_size', +e.target.value)} />
                            <span className="text-[9px] text-muted-foreground">-1 = same as lot size (default)</span>
                          </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs">Demand Factor</Label>
                            <InfoTip text="Scales the product demand without changing the stored demand value. Set to 0 to effectively exclude this product from calculations while keeping its data." />
                          </div>
                          <Input type="number" className="h-8 font-mono" value={p.demand_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'demand_factor', +e.target.value)} />
                        </div>
                        <div><Label className="text-xs">Lot Factor</Label><Input type="number" className="h-8 font-mono" value={p.lot_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'lot_factor', +e.target.value)} /></div>
                        <div><Label className="text-xs">Var Factor</Label><Input type="number" className="h-8 font-mono" value={p.var_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'var_factor', +e.target.value)} /></div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Make to Stock</Label>
                          <InfoTip text="When checked, this component is assumed to be held in stock. Its MCT does not add to the parent assembly MCT. Use for Assemble-to-Order scenarios." />
                        </div>
                        <Switch checked={p.make_to_stock} onCheckedChange={(v) => handleCellChange(p.id, 'make_to_stock', v)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Gather Transfer Batches</Label>
                          <InfoTip text="When checked, the first transfer batch waits for the full lot before moving to stock. Uncheck if transfer batches are sent forward immediately as completed." />
                        </div>
                        <Switch checked={p.gather_tbatches} onCheckedChange={(v) => handleCellChange(p.id, 'gather_tbatches', v)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Group / Dept / Area</Label>
                          <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent className="max-w-[200px] text-xs">Products with the same Group label will be subtotalled together in the Output Summary.</TooltipContent></Tooltip></TooltipProvider>
                        </div>
                        <DeptCodeSelect modelId={model.id} value={p.dept_code} onChange={(v) => handleCellChange(p.id, 'dept_code', v)} section="product" className="h-8" />
                      </div>
                      {/* Prod1-4 parameter variables */}
                      <div className="pt-2 border-t border-border">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">Parameter Variables <InfoTip text="Use Display Name to rename the variable. The new label appears across the app and in the Formula Builder." /></Label>
                        <div className="grid grid-cols-4 gap-3 mt-1.5">
                          {(['prod1', 'prod2', 'prod3', 'prod4'] as const).map(key => (
                            <div key={key}>
                              <Label className="text-xs">{model.param_names[`${key}_name` as keyof typeof model.param_names]}</Label>
                              <Input type="number" className="h-8 font-mono" value={p[key]} onChange={(e) => handleCellChange(p.id, key, +e.target.value)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
          <div><Label>Product Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., HUB1" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleAdd()} /></div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!newName.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}