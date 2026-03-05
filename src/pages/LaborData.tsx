import { useState } from 'react';
import { useModelStore, type LaborGroup } from '@/stores/modelStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, LayoutGrid, List, Users } from 'lucide-react';

export default function LaborData() {
  const model = useModelStore((s) => s.getActiveModel());
  const addLabor = useModelStore((s) => s.addLabor);
  const updateLabor = useModelStore((s) => s.updateLabor);
  const deleteLabor = useModelStore((s) => s.deleteLabor);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'form'>('table');

  if (!model) return (
    <div className="p-6 space-y-4">
      <div className="h-7 w-48 bg-muted animate-pulse rounded" />
      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
    </div>
  );

  const handleAdd = () => {
    if (!newName.trim()) return;
    addLabor(model.id, {
      id: crypto.randomUUID(), name: newName.trim().toUpperCase(), count: 1,
      overtime_pct: 0, unavail_pct: 0, dept_code: '', prioritize_use: false,
      setup_factor: 1, run_factor: 1, var_factor: 1, comments: '',
    });
    setNewName('');
    setShowAdd(false);
  };

  const handleCellChange = (id: string, field: keyof LaborGroup, value: string | number) => {
    updateLabor(model.id, id, { [field]: value });
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Labor Groups</h1>
          <p className="text-sm text-muted-foreground">{model.labor.length} groups defined</p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-md overflow-hidden">
            <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('table')}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'form' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('form')}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Add Labor Group
          </Button>
        </div>
      </div>

      {model.labor.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium mb-1">No labor groups defined</p>
            <p className="text-sm text-muted-foreground/70 mb-4">Add labor groups to define worker pools for your operations.</p>
            <Button onClick={() => setShowAdd(true)} className="gap-1"><Plus className="h-4 w-4" /> Add First Labor Group</Button>
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-xs">Name</TableHead>
                  <TableHead className="font-mono text-xs">Count</TableHead>
                  <TableHead className="font-mono text-xs">Overtime %</TableHead>
                  <TableHead className="font-mono text-xs">Unavail %</TableHead>
                  <TableHead className="font-mono text-xs">Setup Factor</TableHead>
                  <TableHead className="font-mono text-xs">Run Factor</TableHead>
                  <TableHead className="font-mono text-xs">Var Factor</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.labor.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono font-medium">{l.name}</TableCell>
                    <TableCell>
                      <Input type="number" className="h-8 w-20 font-mono" value={l.count} onChange={(e) => handleCellChange(l.id, 'count', +e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" className="h-8 w-20 font-mono" value={l.overtime_pct} onChange={(e) => handleCellChange(l.id, 'overtime_pct', +e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" className="h-8 w-20 font-mono" value={l.unavail_pct} onChange={(e) => handleCellChange(l.id, 'unavail_pct', +e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" className="h-8 w-20 font-mono" value={l.setup_factor} step="0.1" onChange={(e) => handleCellChange(l.id, 'setup_factor', +e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" className="h-8 w-20 font-mono" value={l.run_factor} step="0.1" onChange={(e) => handleCellChange(l.id, 'run_factor', +e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" className="h-8 w-20 font-mono" value={l.var_factor} step="0.1" onChange={(e) => handleCellChange(l.id, 'var_factor', +e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteLabor(model.id, l.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {model.labor.map((l) => (
            <Card key={l.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono">{l.name}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteLabor(model.id, l.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Count</Label><Input type="number" className="h-8 font-mono" value={l.count} onChange={(e) => handleCellChange(l.id, 'count', +e.target.value)} /></div>
                  <div><Label className="text-xs">Overtime %</Label><Input type="number" className="h-8 font-mono" value={l.overtime_pct} onChange={(e) => handleCellChange(l.id, 'overtime_pct', +e.target.value)} /></div>
                  <div><Label className="text-xs">Unavail %</Label><Input type="number" className="h-8 font-mono" value={l.unavail_pct} onChange={(e) => handleCellChange(l.id, 'unavail_pct', +e.target.value)} /></div>
                  <div><Label className="text-xs">Dept Code</Label><Input className="h-8" value={l.dept_code} onChange={(e) => handleCellChange(l.id, 'dept_code', e.target.value)} /></div>
                </div>
                <div><Label className="text-xs">Comments</Label><Input className="h-8" value={l.comments} onChange={(e) => handleCellChange(l.id, 'comments', e.target.value)} /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Labor Group</DialogTitle></DialogHeader>
          <div><Label>Labor Group Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., MACHINST" autoFocus /></div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!newName.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
