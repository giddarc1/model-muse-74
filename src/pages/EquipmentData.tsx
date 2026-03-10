import { useState } from 'react';
import { useModelStore, type EquipmentGroup } from '@/stores/modelStore';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmInline } from '@/components/DeleteConfirmInline';
import { useScenarioStore } from '@/stores/scenarioStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, LayoutGrid, List, Cpu, Info, ChevronDown, ChevronUp, FlaskConical, Save, Check } from 'lucide-react';
import { toast } from 'sonner';
import { UnsavedChangesGuard } from '@/components/UnsavedChangesGuard';
import { DeptCodeSelect } from '@/components/DeptCodeSelect';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserLevelStore, isVisible } from '@/hooks/useUserLevel';

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[280px] text-xs">{text}</TooltipContent></Tooltip></TooltipProvider>
  );
}



const FIELD_LABELS: Record<string, string> = {
  count: 'Count', equip_type: 'Type', mttf: 'MTTF', mttr: 'MTTR',
  overtime_pct: 'OT %', labor_group_id: 'Labor Group', dept_code: 'Dept/Area',
  out_of_area: 'Out of Area', unavail_pct: 'Unavail %',
  setup_factor: 'Setup Factor', run_factor: 'Run Factor', var_factor: 'Var Factor',
  eq1: 'Eq1', eq2: 'Eq2', eq3: 'Eq3', eq4: 'Eq4', comments: 'Comments',
};

export default function EquipmentData() {
  const model = useModelStore((s) => s.getActiveModel());
  const addEquipment = useModelStore((s) => s.addEquipment);
  const updateEquipment = useModelStore((s) => s.updateEquipment);
  const deleteEquipment = useModelStore((s) => s.deleteEquipment);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'form'>('table');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const { pendingDeleteId, requestDelete, cancelDelete, confirmDelete } = useDeleteConfirmation();
  const { userLevel } = useUserLevelStore();
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

  const opsTimeUnit = model.general.ops_time_unit || 'MIN';

  const handleAdd = () => {
    if (!newName.trim()) return;
    addEquipment(model.id, {
      id: crypto.randomUUID(), name: newName.trim().toUpperCase(), equip_type: 'standard', count: 1,
      mttf: 0, mttr: 0, overtime_pct: 0, labor_group_id: '', dept_code: '',
      out_of_area: false, unavail_pct: 0,
      setup_factor: 1, run_factor: 1, var_factor: 1,
      eq1: 0, eq2: 0, eq3: 0, eq4: 0, comments: '',
    });
    setNewName('');
    setShowAdd(false);
  };

  const handleCellChange = (id: string, field: keyof EquipmentGroup, value: any) => {
    if (activeScenarioId && activeScenario) {
      const eq = model.equipment.find(e => e.id === id);
      const entityName = eq?.name || id;
      const fieldLabel = FIELD_LABELS[field] || field;
      applyScenarioChange(activeScenarioId, 'Equipment', id, entityName, field, fieldLabel, value as string | number);
    }
    if (field === 'equip_type' && value === 'delay') {
      updateEquipment(model.id, id, { [field]: value, count: -1 });
    } else if (field === 'dept_code') {
      const isOutOfArea = typeof value === 'string' && value.toLowerCase() === 'out of area';
      updateEquipment(model.id, id, { [field]: value, out_of_area: isOutOfArea });
    } else {
      updateEquipment(model.id, id, { [field]: value });
    }
    setIsDirty(true);
    setJustSaved(false);
  };

  const handleSave = () => {
    setIsDirty(false);
    setJustSaved(true);
    toast.success('Saved');
    setTimeout(() => setJustSaved(false), 2000);
  };

  const laborName = (id: string) => model.labor.find((l) => l.id === id)?.name || '—';

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
          <h1 className="text-xl font-bold">Equipment Groups</h1>
          <p className="text-sm text-muted-foreground">{model.equipment.length} groups defined</p>
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
          <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Equipment</Button>
          <Button size="sm" className="gap-1" variant={isDirty ? 'default' : 'outline'} disabled={!isDirty && !justSaved} onClick={handleSave}>
            {justSaved ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" /> Save</>}
          </Button>
        </div>
      </div>

      {model.equipment.length === 0 ? (
        <Card><CardContent className="py-16 text-center"><Cpu className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground font-medium mb-1">No equipment groups defined</p><p className="text-sm text-muted-foreground/70 mb-4">Add equipment groups to define workstations and machines.</p><Button onClick={() => setShowAdd(true)} className="gap-1"><Plus className="h-4 w-4" /> Add First Equipment</Button></CardContent></Card>
      ) : viewMode === 'table' ? (
        <Card className={activeScenarioId ? 'border-l-[3px] border-l-amber-400' : ''}>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-xs">Name</TableHead>
                  <TableHead className="font-mono text-xs">
                    <div className="flex items-center gap-1">Type <InfoTip text="Standard: normal equipment with capacity and queue. Delay: use for operations where capacity is not a constraint (e.g. transit, heat treat). Setting to Delay disables No. in Group." /></div>
                  </TableHead>
                  <TableHead className="font-mono text-xs">Count</TableHead>
                  <TableHead className="font-mono text-xs">MTTF ({opsTimeUnit})</TableHead>
                  <TableHead className="font-mono text-xs">MTTR ({opsTimeUnit})</TableHead>
                  <TableHead className="font-mono text-xs">OT %</TableHead>
                   <TableHead className="font-mono text-xs">Labor</TableHead>
                   <TableHead className="font-mono text-xs">Comments</TableHead>
                  {showAdvanced && <>
                     <TableHead className="font-mono text-xs">Dept/Area</TableHead>
                     <TableHead className="font-mono text-xs">Unavail %</TableHead>
                    <TableHead className="font-mono text-xs">Setup Fac</TableHead>
                    <TableHead className="font-mono text-xs">Run Fac</TableHead>
                    <TableHead className="font-mono text-xs">Var Fac</TableHead>
                    <TableHead className="font-mono text-xs">{model.param_names.eq1_name}</TableHead>
                    <TableHead className="font-mono text-xs">{model.param_names.eq2_name}</TableHead>
                    <TableHead className="font-mono text-xs">{model.param_names.eq3_name}</TableHead>
                    <TableHead className="font-mono text-xs">{model.param_names.eq4_name}</TableHead>
                  </>}
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.equipment.map((eq) => {
                  const isConfirming = pendingDeleteId === eq.id;
                  return (
                  <TableRow key={eq.id} className={isConfirming ? 'bg-destructive/10' : ''}>
                    {isConfirming ? (
                      <TableCell colSpan={showAdvanced ? 18 : 9}>
                        <DeleteConfirmInline
                          message={`Delete ${eq.name}? This will remove its operations and labor assignments.`}
                          onConfirm={() => confirmDelete(eq.id, () => deleteEquipment(model.id, eq.id))}
                          onCancel={cancelDelete}
                        />
                      </TableCell>
                    ) : (<>
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
                    <TableCell><Input className="h-8 w-32" value={eq.comments} onChange={(e) => handleCellChange(eq.id, 'comments', e.target.value)} placeholder="Notes…" /></TableCell>
                    {showAdvanced && <>
                      <TableCell>
                        <DeptCodeSelect modelId={model.id} value={eq.dept_code} onChange={(v) => handleCellChange(eq.id, 'dept_code', v)} section="equipment" className="h-8 w-28" />
                      </TableCell>
                       <TableCell><Input type="number" className="h-8 w-20 font-mono" value={eq.unavail_pct} onChange={(e) => handleCellChange(eq.id, 'unavail_pct', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={eq.setup_factor} step="0.1" onChange={(e) => handleCellChange(eq.id, 'setup_factor', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={eq.run_factor} step="0.1" onChange={(e) => handleCellChange(eq.id, 'run_factor', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={eq.var_factor} step="0.1" onChange={(e) => handleCellChange(eq.id, 'var_factor', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={eq.eq1} onChange={(e) => handleCellChange(eq.id, 'eq1', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={eq.eq2} onChange={(e) => handleCellChange(eq.id, 'eq2', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={eq.eq3} onChange={(e) => handleCellChange(eq.id, 'eq3', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={eq.eq4} onChange={(e) => handleCellChange(eq.id, 'eq4', +e.target.value)} /></TableCell>
                    </>}
                    <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => requestDelete(eq.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </>)}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {model.equipment.map((eq) => (
            <Card key={eq.id} className={activeScenarioId ? 'border-l-[3px] border-l-amber-400' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono">{eq.name}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm(`Delete ${eq.name}? This will remove its operations and labor assignments.`)) deleteEquipment(model.id, eq.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Count</Label><Input type="number" className="h-8 font-mono" value={eq.count} disabled={eq.equip_type === 'delay'} onChange={(e) => handleCellChange(eq.id, 'count', +e.target.value)} /></div>
                  <div><Label className="text-xs">MTTF ({opsTimeUnit})</Label><Input type="number" className="h-8 font-mono" value={eq.mttf} onChange={(e) => handleCellChange(eq.id, 'mttf', +e.target.value)} /></div>
                  <div><Label className="text-xs">MTTR ({opsTimeUnit})</Label><Input type="number" className="h-8 font-mono" value={eq.mttr} onChange={(e) => handleCellChange(eq.id, 'mttr', +e.target.value)} /></div>
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
                <div>
                  <Label className="text-xs">Comments</Label>
                  <Textarea rows={3} className="text-sm" value={eq.comments} onChange={(e) => handleCellChange(eq.id, 'comments', e.target.value)} placeholder="Add notes about this equipment group…" />
                </div>
                {showAdvanced && (
                  <>
                    <div className="pt-2 border-t border-border space-y-3">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Advanced Parameters</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs">Equipment Type</Label>
                            <InfoTip text="Standard: normal equipment with capacity and queue. Delay: use for operations where capacity is not a constraint (e.g. transit, heat treat). Setting to Delay disables No. in Group." />
                          </div>
                          <Select value={eq.equip_type} onValueChange={(v) => handleCellChange(eq.id, 'equip_type', v)}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="delay">Delay Station</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label className="text-xs">% Time Unavailable</Label><Input type="number" className="h-8 font-mono" value={eq.unavail_pct} onChange={(e) => handleCellChange(eq.id, 'unavail_pct', +e.target.value)} /></div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Scaling Factors</Label>
                      <div className="grid grid-cols-3 gap-3 mt-1.5">
                        <div><Label className="text-xs">Setup</Label><Input type="number" className="h-8 font-mono" value={eq.setup_factor} step="0.1" onChange={(e) => handleCellChange(eq.id, 'setup_factor', +e.target.value)} /><span className="text-[10px] text-muted-foreground">× {eq.setup_factor} = {Math.round(eq.setup_factor * 100)}%</span></div>
                        <div><Label className="text-xs">Run</Label><Input type="number" className="h-8 font-mono" value={eq.run_factor} step="0.1" onChange={(e) => handleCellChange(eq.id, 'run_factor', +e.target.value)} /><span className="text-[10px] text-muted-foreground">× {eq.run_factor} = {Math.round(eq.run_factor * 100)}%</span></div>
                        <div>
                          <Label className="text-xs">Variability</Label>
                          <Input type="number" className="h-8 font-mono" value={eq.var_factor} step="0.1" onChange={(e) => handleCellChange(eq.id, 'var_factor', +e.target.value)} />
                          <span className="text-[10px] text-muted-foreground">Effective: {model.general.var_equip}% × {eq.var_factor} = {(model.general.var_equip * eq.var_factor).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border space-y-3">
                      <div>
                        <Label className="text-xs">Group / Dept / Area</Label>
                        <DeptCodeSelect modelId={model.id} value={eq.dept_code} onChange={(v) => handleCellChange(eq.id, 'dept_code', v)} section="equipment" className="h-8" />
                      </div>
                    </div>
                    {/* Eq1-4 parameter variables */}
                    <div className="pt-2 border-t border-border">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">Parameter Variables <InfoTip text="Use Display Name to rename the variable. The new label appears across the app and in the Formula Builder." /></Label>
                      <div className="grid grid-cols-4 gap-3 mt-1.5">
                        {(['eq1', 'eq2', 'eq3', 'eq4'] as const).map((key, i) => (
                          <div key={key}>
                            <Label className="text-xs">{model.param_names[`${key}_name` as keyof typeof model.param_names]}</Label>
                            <Input type="number" className="h-8 font-mono" value={eq[key]} onChange={(e) => handleCellChange(eq.id, key, +e.target.value)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
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
    </>
  );
}
