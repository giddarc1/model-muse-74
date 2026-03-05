import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModelStore, type Product } from '@/stores/modelStore';
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
import { Plus, Trash2, LayoutGrid, List, Copy, GitBranch, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react';
import { useUserLevelStore, canAccess } from '@/hooks/useUserLevel';
import { toast } from 'sonner';

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
  const { userLevel } = useUserLevelStore();
  const showAdvancedParams = canAccess(userLevel, 'advanced-params');

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
    const newP: Product = {
      ...p,
      id: crypto.randomUUID(),
      name: `${p.name}_COPY`,
    };
    addProduct(model.id, newP);
    toast.success(`Product "${newP.name}" created as copy`);
  };

  const handleCellChange = (id: string, field: keyof Product, value: any) => {
    updateProduct(model.id, id, { [field]: value });
  };

  const goToOps = (productId: string) => {
    navigate(`/models/${model.id}/operations?product=${productId}`);
  };

  const opsCount = (productId: string) => model.operations.filter((o) => o.product_id === productId).length;

  // Calculate scrap rate: sum of all routing % to SCRAP nodes for a product
  const getScrapRate = (productId: string) => {
    const routes = model.routing.filter(r => r.product_id === productId && r.to_op_name === 'SCRAP');
    return routes.reduce((sum, r) => sum + r.pct_routed, 0);
  };

  return (
    <div className="p-6 animate-fade-in">
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
        </div>
      </div>

      {model.products.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><p>No products defined.</p><Button className="mt-4" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Add First Product</Button></CardContent></Card>
      ) : viewMode === 'table' ? (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-xs">Name</TableHead>
                  <TableHead className="font-mono text-xs">Demand</TableHead>
                  <TableHead className="font-mono text-xs">Lot Size</TableHead>
                  {showAdvanced && <>
                    <TableHead className="font-mono text-xs">TBatch</TableHead>
                    <TableHead className="font-mono text-xs">Demand Fac</TableHead>
                    <TableHead className="font-mono text-xs">Lot Fac</TableHead>
                    <TableHead className="font-mono text-xs">Var Fac</TableHead>
                    <TableHead className="font-mono text-xs">MTS</TableHead>
                    <TableHead className="font-mono text-xs">Gather</TableHead>
                  </>}
                  <TableHead className="font-mono text-xs">Scrap %</TableHead>
                  <TableHead className="font-mono text-xs">Ops</TableHead>
                  <TableHead className="font-mono text-xs">Comments</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono font-medium">{p.name}</TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${p.demand < 0 ? 'border-destructive' : ''}`} value={p.demand} onChange={(e) => handleCellChange(p.id, 'demand', +e.target.value)} /></TableCell>
                    <TableCell>
                      <Input type="number" className={`h-8 w-20 font-mono ${p.lot_size < 1 ? 'border-destructive' : ''}`} value={p.lot_size} onChange={(e) => handleCellChange(p.id, 'lot_size', +e.target.value)} />
                      {p.lot_size < 1 && <span className="text-[10px] text-destructive">≥ 1</span>}
                    </TableCell>
                    {showAdvanced && <>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.tbatch_size} onChange={(e) => handleCellChange(p.id, 'tbatch_size', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.demand_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'demand_factor', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.lot_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'lot_factor', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.var_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'var_factor', +e.target.value)} /></TableCell>
                      <TableCell><Switch checked={p.make_to_stock} onCheckedChange={(v) => handleCellChange(p.id, 'make_to_stock', v)} /></TableCell>
                      <TableCell><Switch checked={p.gather_tbatches} onCheckedChange={(v) => handleCellChange(p.id, 'gather_tbatches', v)} /></TableCell>
                    </>}
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs font-mono" onClick={() => goToOps(p.id)}>
                              {getScrapRate(p.id) > 0 ? `${getScrapRate(p.id)}%` : '—'}
                              <ExternalLink className="h-3 w-3 ml-0.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit routing to change scrap rate</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs font-mono" onClick={() => goToOps(p.id)}>
                        <GitBranch className="h-3 w-3" />{opsCount(p.id)}
                      </Button>
                    </TableCell>
                    <TableCell><Input className="h-8 w-32" value={p.comments} onChange={(e) => handleCellChange(p.id, 'comments', e.target.value)} /></TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(p)} title="Duplicate"><Copy className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteProduct(model.id, p.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {model.products.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono">{p.name}</CardTitle>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(p)}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteProduct(model.id, p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="basic">
                  <TabsList className="h-8">
                    <TabsTrigger value="basic" className="text-xs h-6">Basic</TabsTrigger>
                    <TabsTrigger value="advanced" className="text-xs h-6">Advanced</TabsTrigger>
                  </TabsList>
                  <TabsContent value="basic" className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">Demand</Label><Input type="number" className="h-8 font-mono" value={p.demand} onChange={(e) => handleCellChange(p.id, 'demand', +e.target.value)} /></div>
                      <div><Label className="text-xs">Lot Size</Label><Input type="number" className="h-8 font-mono" value={p.lot_size} onChange={(e) => handleCellChange(p.id, 'lot_size', +e.target.value)} /></div>
                    </div>
                    <div><Label className="text-xs">Comments</Label><Input className="h-8" value={p.comments} onChange={(e) => handleCellChange(p.id, 'comments', e.target.value)} /></div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Scrap Rate</Label>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs font-mono" onClick={() => goToOps(p.id)}>
                        {getScrapRate(p.id) > 0 ? `${getScrapRate(p.id)}%` : '—'} <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button variant="outline" size="sm" className="w-full gap-1 text-xs" onClick={() => goToOps(p.id)}>
                      <GitBranch className="h-3.5 w-3.5" /> Operations ({opsCount(p.id)})
                    </Button>
                  </TabsContent>
                  <TabsContent value="advanced" className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">Transfer Batch</Label><Input type="number" className="h-8 font-mono" value={p.tbatch_size} onChange={(e) => handleCellChange(p.id, 'tbatch_size', +e.target.value)} /></div>
                      <div><Label className="text-xs">Var Factor</Label><Input type="number" className="h-8 font-mono" value={p.var_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'var_factor', +e.target.value)} /></div>
                      <div><Label className="text-xs">Demand Factor</Label><Input type="number" className="h-8 font-mono" value={p.demand_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'demand_factor', +e.target.value)} /></div>
                      <div><Label className="text-xs">Lot Factor</Label><Input type="number" className="h-8 font-mono" value={p.lot_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'lot_factor', +e.target.value)} /></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Make to Stock</Label>
                      <Switch checked={p.make_to_stock} onCheckedChange={(v) => handleCellChange(p.id, 'make_to_stock', v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Gather Transfer Batches</Label>
                        <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent className="max-w-[240px] text-xs">When checked, the first transfer batch waits for the full lot to complete before moving to STOCK. Affects MCT calculation.</TooltipContent></Tooltip></TooltipProvider>
                      </div>
                      <Switch checked={p.gather_tbatches} onCheckedChange={(v) => handleCellChange(p.id, 'gather_tbatches', v)} />
                    </div>
                    {showAdvancedParams && (
                      <>
                        <div><Label className="text-xs">Setup Time Factor</Label><Input type="number" className="h-8 font-mono" value={p.setup_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'setup_factor', +e.target.value)} /></div>
                        <div>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs">Group / Dept / Area</Label>
                            <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent className="max-w-[200px] text-xs">Products with the same Group label will be subtotalled together in the Output Summary.</TooltipContent></Tooltip></TooltipProvider>
                          </div>
                          <Input className="h-8" value={p.dept_code} placeholder="e.g. Hubs, Components" onChange={(e) => handleCellChange(p.id, 'dept_code', e.target.value)} />
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
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
  );
}
