import { useState } from 'react';
import { useModelStore, type LaborGroup } from '@/stores/modelStore';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmInline } from '@/components/DeleteConfirmInline';
import { useScenarioStore } from '@/stores/scenarioStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, LayoutGrid, List, Users, Info, ChevronDown, ChevronUp, FlaskConical, Save, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserLevelStore, isVisible } from '@/hooks/useUserLevel';
import { toast } from 'sonner';
import { UnsavedChangesGuard } from '@/components/UnsavedChangesGuard';
import { DeptCodeSelect } from '@/components/DeptCodeSelect';

const FIELD_LABELS: Record<string, string> = {
  count: 'Count', overtime_pct: 'Overtime %', unavail_pct: 'Unavail %',
  dept_code: 'Dept/Area', setup_factor: 'Setup Factor', run_factor: 'Run Factor',
  var_factor: 'Var Factor', prioritize_use: 'Prioritize Use',
  lab1: 'Lab1', lab2: 'Lab2', lab3: 'Lab3', lab4: 'Lab4', comments: 'Comments',
};



function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[280px] text-xs">{text}</TooltipContent></Tooltip></TooltipProvider>
  );
}

export default function LaborData() {
  const model = useModelStore((s) => s.getActiveModel());
  const addLabor = useModelStore((s) => s.addLabor);
  const updateLabor = useModelStore((s) => s.updateLabor);
  const deleteLabor = useModelStore((s) => s.deleteLabor);
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

  const handleAdd = () => {
    if (!newName.trim()) return;
    addLabor(model.id, {
      id: crypto.randomUUID(), name: newName.trim().toUpperCase(), count: 1,
      overtime_pct: 0, unavail_pct: 0, dept_code: '', prioritize_use: false,
      setup_factor: 1, run_factor: 1, var_factor: 1,
      lab1: 0, lab2: 0, lab3: 0, lab4: 0, comments: '',
    });
    setNewName('');
    setShowAdd(false);
  };

  const handleCellChange = (id: string, field: keyof LaborGroup, value: string | number | boolean) => {
    if (activeScenarioId && activeScenario) {
      const labor = model.labor.find(l => l.id === id);
      const entityName = labor?.name || id;
      const fieldLabel = FIELD_LABELS[field] || field;
      applyScenarioChange(activeScenarioId, 'Labor', id, entityName, field, fieldLabel, value as string | number);
    }
    updateLabor(model.id, id, { [field]: value });
    setIsDirty(true);
    setJustSaved(false);
  };

  const handleSave = () => {
    setIsDirty(false);
    setJustSaved(true);
    toast.success('Saved');
    setTimeout(() => setJustSaved(false), 2000);
  };

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
          <h1 className="text-xl font-bold">Labor Groups</h1>
          <p className="text-sm text-muted-foreground">{model.labor.length} groups defined</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="gap-1 text-xs">
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
          </Button>
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
          <Button
            size="sm"
            className="gap-1"
            variant={isDirty ? 'default' : 'outline'}
            disabled={!isDirty && !justSaved}
            onClick={handleSave}
          >
            {justSaved ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" /> Save</>}
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
        <Card className={activeScenarioId ? 'border-l-[3px] border-l-amber-400' : ''}>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-xs">Name</TableHead>
                  <TableHead className="font-mono text-xs">Count</TableHead>
                  <TableHead className="font-mono text-xs">Overtime %</TableHead>
                  <TableHead className="font-mono text-xs">Unavail %</TableHead>
                  {showAdvanced && <>
                    <TableHead className="font-mono text-xs">Dept/Area</TableHead>
                    <TableHead className="font-mono text-xs">Setup Fac</TableHead>
                    <TableHead className="font-mono text-xs">Run Fac</TableHead>
                    <TableHead className="font-mono text-xs">Var Fac</TableHead>
                    <TableHead className="font-mono text-xs">
                      <div className="flex items-center gap-1">Prioritize <InfoTip text="When enabled, MPX shifts labor time toward more heavily utilised equipment groups served by this labor group, reducing wait-for-labor time at bottlenecks." /></div>
                    </TableHead>
                    <TableHead className="font-mono text-xs">{model.param_names.lab1_name}</TableHead>
                    <TableHead className="font-mono text-xs">{model.param_names.lab2_name}</TableHead>
                    <TableHead className="font-mono text-xs">{model.param_names.lab3_name}</TableHead>
                    <TableHead className="font-mono text-xs">{model.param_names.lab4_name}</TableHead>
                  </>}
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.labor.map((l) => {
                  const isConfirming = pendingDeleteId === l.id;
                  return (
                  <TableRow key={l.id} className={isConfirming ? 'bg-destructive/10' : ''}>
                    {isConfirming ? (
                      <TableCell colSpan={showAdvanced ? 14 : 5}>
                        <DeleteConfirmInline
                          message={`Delete ${l.name}? This will remove it from any equipment assignments.`}
                          onConfirm={() => confirmDelete(l.id, () => deleteLabor(model.id, l.id))}
                          onCancel={cancelDelete}
                        />
                      </TableCell>
                    ) : (<>
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
                    {showAdvanced && <>
                      <TableCell>
                        <DeptCodeSelect modelId={model.id} value={l.dept_code} onChange={(v) => handleCellChange(l.id, 'dept_code', v)} section="labor" className="h-8 w-28" />
                      </TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={l.setup_factor} step="0.1" onChange={(e) => handleCellChange(l.id, 'setup_factor', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={l.run_factor} step="0.1" onChange={(e) => handleCellChange(l.id, 'run_factor', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={l.var_factor} step="0.1" onChange={(e) => handleCellChange(l.id, 'var_factor', +e.target.value)} /></TableCell>
                      <TableCell><Switch checked={l.prioritize_use} onCheckedChange={(v) => handleCellChange(l.id, 'prioritize_use', v)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={l.lab1} onChange={(e) => handleCellChange(l.id, 'lab1', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={l.lab2} onChange={(e) => handleCellChange(l.id, 'lab2', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={l.lab3} onChange={(e) => handleCellChange(l.id, 'lab3', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className="h-8 w-20 font-mono" value={l.lab4} onChange={(e) => handleCellChange(l.id, 'lab4', +e.target.value)} /></TableCell>
                    </>}
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => requestDelete(l.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {model.labor.map((l) => (
            <Card key={l.id} className={activeScenarioId ? 'border-l-[3px] border-l-amber-400' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono">{l.name}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm(`Delete ${l.name}? This will remove it from any equipment assignments.`)) deleteLabor(model.id, l.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Count</Label><Input type="number" className="h-8 font-mono" value={l.count} onChange={(e) => handleCellChange(l.id, 'count', +e.target.value)} /></div>
                  <div><Label className="text-xs">Overtime %</Label><Input type="number" className="h-8 font-mono" value={l.overtime_pct} onChange={(e) => handleCellChange(l.id, 'overtime_pct', +e.target.value)} /></div>
                  <div><Label className="text-xs">Unavail %</Label><Input type="number" className="h-8 font-mono" value={l.unavail_pct} onChange={(e) => handleCellChange(l.id, 'unavail_pct', +e.target.value)} /></div>
                   <div><Label className="text-xs">Dept Code</Label>
                     <DeptCodeSelect modelId={model.id} value={l.dept_code} onChange={(v) => handleCellChange(l.id, 'dept_code', v)} section="labor" className="h-8" />
                   </div>
                </div>
                <div><Label className="text-xs">Comments</Label><Input className="h-8" value={l.comments} onChange={(e) => handleCellChange(l.id, 'comments', e.target.value)} /></div>
                {showAdvanced && (
                  <div className="pt-2 border-t border-border space-y-3">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Advanced Parameters</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label className="text-xs">Setup Factor</Label><Input type="number" className="h-8 font-mono" value={l.setup_factor} step="0.1" onChange={(e) => handleCellChange(l.id, 'setup_factor', +e.target.value)} /><span className="text-[10px] text-muted-foreground">× {l.setup_factor} = {Math.round(l.setup_factor * 100)}%</span></div>
                      <div><Label className="text-xs">Run Factor</Label><Input type="number" className="h-8 font-mono" value={l.run_factor} step="0.1" onChange={(e) => handleCellChange(l.id, 'run_factor', +e.target.value)} /><span className="text-[10px] text-muted-foreground">× {l.run_factor} = {Math.round(l.run_factor * 100)}%</span></div>
                      <div>
                        <Label className="text-xs">Variability</Label>
                        <Input type="number" className="h-8 font-mono" value={l.var_factor} step="0.1" onChange={(e) => handleCellChange(l.id, 'var_factor', +e.target.value)} />
                        <span className="text-[10px] text-muted-foreground">Effective: {model.general.var_labor}% × {l.var_factor} = {(model.general.var_labor * l.var_factor).toFixed(1)}%</span>
                      </div>
                    </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Group / Dept / Area</Label>
                          <InfoTip text="Optional organisational label. No direct effect on calculations — provided for reference and model documentation." />
                        </div>
                        <DeptCodeSelect modelId={model.id} value={l.dept_code} onChange={(v) => handleCellChange(l.id, 'dept_code', v)} section="labor" className="h-8" />
                      </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Prioritize Use</Label>
                        <InfoTip text="When enabled, MPX shifts labor time toward more heavily utilised equipment groups served by this labor group, reducing wait-for-labor time at bottlenecks." />
                      </div>
                      <Switch checked={l.prioritize_use} onCheckedChange={(v) => handleCellChange(l.id, 'prioritize_use', v)} />
                    </div>
                    {/* Lab1-4 parameter variables */}
                    <div className="pt-2 border-t border-border">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">Parameter Variables <InfoTip text="Use Display Name to rename the variable. The new label appears across the app and in the Formula Builder." /></Label>
                      <div className="grid grid-cols-4 gap-3 mt-1.5">
                        {(['lab1', 'lab2', 'lab3', 'lab4'] as const).map(key => (
                          <div key={key}>
                            <Label className="text-xs">{model.param_names[`${key}_name` as keyof typeof model.param_names]}</Label>
                            <Input type="number" className="h-8 font-mono" value={l[key]} onChange={(e) => handleCellChange(l.id, key, +e.target.value)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
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
    </>
  );
}
