import { useState } from 'react';
import { useModelStore, type Product } from '@/stores/modelStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, LayoutGrid, List } from 'lucide-react';

export default function ProductData() {
  const model = useModelStore((s) => s.getActiveModel());
  const addProduct = useModelStore((s) => s.addProduct);
  const updateProduct = useModelStore((s) => s.updateProduct);
  const deleteProduct = useModelStore((s) => s.deleteProduct);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'form'>('table');

  if (!model) return null;

  const handleAdd = () => {
    if (!newName.trim()) return;
    addProduct(model.id, {
      id: crypto.randomUUID(), name: newName.trim().toUpperCase(), demand: 0, lot_size: 1,
      tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1,
      make_to_stock: false, gather_tbatches: true, comments: '',
    });
    setNewName('');
    setShowAdd(false);
  };

  const handleCellChange = (id: string, field: keyof Product, value: any) => {
    updateProduct(model.id, id, { [field]: value });
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">{model.products.length} products defined</p>
        </div>
        <div className="flex gap-2">
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
                  <TableHead className="font-mono text-xs">TBatch</TableHead>
                  <TableHead className="font-mono text-xs">Demand Fac</TableHead>
                  <TableHead className="font-mono text-xs">Lot Fac</TableHead>
                  <TableHead className="font-mono text-xs">Comments</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono font-medium">{p.name}</TableCell>
                    <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.demand} onChange={(e) => handleCellChange(p.id, 'demand', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.lot_size} onChange={(e) => handleCellChange(p.id, 'lot_size', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.tbatch_size} onChange={(e) => handleCellChange(p.id, 'tbatch_size', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.demand_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'demand_factor', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className="h-8 w-20 font-mono" value={p.lot_factor} step="0.1" onChange={(e) => handleCellChange(p.id, 'lot_factor', +e.target.value)} /></TableCell>
                    <TableCell><Input className="h-8 w-32" value={p.comments} onChange={(e) => handleCellChange(p.id, 'comments', e.target.value)} /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProduct(model.id, p.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
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
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProduct(model.id, p.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Demand</Label><Input type="number" className="h-8 font-mono" value={p.demand} onChange={(e) => handleCellChange(p.id, 'demand', +e.target.value)} /></div>
                  <div><Label className="text-xs">Lot Size</Label><Input type="number" className="h-8 font-mono" value={p.lot_size} onChange={(e) => handleCellChange(p.id, 'lot_size', +e.target.value)} /></div>
                </div>
                <div><Label className="text-xs">Comments</Label><Input className="h-8" value={p.comments} onChange={(e) => handleCellChange(p.id, 'comments', e.target.value)} /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
          <div><Label>Product Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., HUB1" autoFocus /></div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!newName.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
