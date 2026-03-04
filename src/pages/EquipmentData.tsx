import { useState } from 'react';
import { useModelStore, type EquipmentGroup } from '@/stores/modelStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, LayoutGrid, List } from 'lucide-react';

export default function EquipmentData() {
  const model = useModelStore((s) => s.getActiveModel());
  const addEquipment = useModelStore((s) => s.addEquipment);
  const updateEquipment = useModelStore((s) => s.updateEquipment);
  const deleteEquipment = useModelStore((s) => s.deleteEquipment);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'form'>('table');

  if (!model) return null;

  const handleAdd = () => {
    if (!newName.trim()) return;
    addEquipment(model.id, {
      id: crypto.randomUUID(), name: newName.trim().toUpperCase(), equip_type: 'standard', count: 1,
      mttf: 0, mttr: 0, overtime_pct: 0, labor_group_id: '', dept_code: '',
      setup_factor: 1, run_factor: 1, var_factor: 1, comments: '',
    });
    setNewName('');
    setShowAdd(false);
  };

  const handleCellChange = (id: string, field: keyof EquipmentGroup, value: any) => {
    // Auto-set count when switching to delay type
    if (field === 'equip_type' && value === 'delay') {
      updateEquipment(model.id, id, { [field]: value, count: -1 });
    } else {
      updateEquipment(model.id, id, { [field]: value });
    }
  };

  const laborName = (id: string) => model.labor.find((l) => l.id === id)?.name || '—';

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Equipment Groups</h1>
          <p className="text-sm text-muted-foreground">{model.equipment.length} groups defined</p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-md overflow-hidden">
            <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('table')}><List className="h-4 w-4" /></Button>
            <Button variant={viewMode === 'form' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('form')}><LayoutGrid className="h-4 w-4" /></Button>
          </div>
          <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Equipment</Button>
        </div>
      </div>

      {model.equipment.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><p>No equipment groups defined yet.</p><Button className="mt-4" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Add First Equipment</Button></CardContent></Card>
      ) : viewMode === 'table' ? (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-xs">Name</TableHead>
                  <TableHead className="font-mono text-xs">Type</TableHead>
                  <TableHead className="font-mono text-xs">Count</TableHead>
                  <TableHead className="font-mono text-xs">MTTF</TableHead>
                  <TableHead className="font-mono text-xs">MTTR</TableHead>
                  <TableHead className="font-mono text-xs">OT %</TableHead>
                  <TableHead className="font-mono text-xs">Labor</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.equipment.map((eq) => (
                  <TableRow key={eq.id}>
                    <TableCell className="font-mono font-medium">{eq.name}</TableCell>
                    <TableCell>
                      <Select value={eq.equip_type} onValueChange={(v) => handleCellChange(eq.id, 'equip_type', v)}>
                        <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="delay">Delay</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" className="h-8 w-16 font-mono" value={eq.count} disabled={eq.equip_type === 'delay'} onChange={(e) => handleCellChange(eq.id, 'count', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className="h-8 w-20 font-mono" value={eq.mttf} onChange={(e) => handleCellChange(eq.id, 'mttf', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className="h-8 w-20 font-mono" value={eq.mttr} onChange={(e) => handleCellChange(eq.id, 'mttr', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className="h-8 w-16 font-mono" value={eq.overtime_pct} onChange={(e) => handleCellChange(eq.id, 'overtime_pct', +e.target.value)} /></TableCell>
                    <TableCell>
                      <Select value={eq.labor_group_id || 'none'} onValueChange={(v) => handleCellChange(eq.id, 'labor_group_id', v === 'none' ? '' : v)}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {model.labor.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteEquipment(model.id, eq.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {model.equipment.map((eq) => (
            <Card key={eq.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono">{eq.name}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteEquipment(model.id, eq.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Count</Label><Input type="number" className="h-8 font-mono" value={eq.count} onChange={(e) => handleCellChange(eq.id, 'count', +e.target.value)} /></div>
                  <div><Label className="text-xs">MTTF</Label><Input type="number" className="h-8 font-mono" value={eq.mttf} onChange={(e) => handleCellChange(eq.id, 'mttf', +e.target.value)} /></div>
                  <div><Label className="text-xs">MTTR</Label><Input type="number" className="h-8 font-mono" value={eq.mttr} onChange={(e) => handleCellChange(eq.id, 'mttr', +e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Overtime %</Label><Input type="number" className="h-8 font-mono" value={eq.overtime_pct} onChange={(e) => handleCellChange(eq.id, 'overtime_pct', +e.target.value)} /></div>
                  <div>
                    <Label className="text-xs">Labor Group</Label>
                    <Select value={eq.labor_group_id || 'none'} onValueChange={(v) => handleCellChange(eq.id, 'labor_group_id', v === 'none' ? '' : v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {model.labor.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Equipment Group</DialogTitle></DialogHeader>
          <div><Label>Equipment Group Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., VT_LATHE" autoFocus /></div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!newName.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
