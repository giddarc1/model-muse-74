import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useModelStore } from '@/stores/modelStore';
import { useScenarioStore, type Scenario, type ScenarioChange } from '@/stores/scenarioStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus, MoreVertical, Play, Save, ArrowUpCircle, RefreshCw,
  FlaskConical, Shield, Pencil, Trash2, Copy, Eye, ChevronRight,
  Users, Wrench, Package,
} from 'lucide-react';
import { toast } from 'sonner';

export default function WhatIfStudio() {
  const { modelId } = useParams<{ modelId: string }>();
  const model = useModelStore(s => s.models.find(m => m.id === modelId));

  const allScenarios = useScenarioStore(s => s.scenarios);
  const activeScenarioId = useScenarioStore(s => s.activeScenarioId);
  const displayIds = useScenarioStore(s => s.displayScenarioIds);
  const {
    setActiveScenario, createScenario, duplicateScenario, renameScenario,
    updateScenarioDescription, deleteScenario, toggleDisplayScenario,
    applyScenarioChange, removeChange, promoteToBasecase, getScenariosForModel,
  } = useScenarioStore();

  // Lazy-init demo scenarios
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (modelId && !initialized) {
      getScenariosForModel(modelId);
      setInitialized(true);
    }
  }, [modelId, initialized, getScenariosForModel]);

  const scenarios = allScenarios.filter(sc => sc.modelId === modelId);
  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || null;



  const [newName, setNewName] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (!model || !modelId) return null;

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = createScenario(modelId, newName.trim());
    setActiveScenario(id);
    setNewName('');
    setShowNewModal(false);
    toast.success(`Scenario "${newName.trim()}" created`);
  };

  const handlePromote = () => {
    if (!activeScenarioId) return;
    promoteToBasecase(activeScenarioId);
    setShowPromoteModal(false);
    toast.success('Scenario promoted to Basecase');
  };

  const handleRename = (id: string) => {
    if (!renameValue.trim()) return;
    renameScenario(id, renameValue.trim());
    setRenamingId(null);
    toast.success('Scenario renamed');
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT PANEL — Scenario Library */}
      <div className="w-72 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <FlaskConical className="h-4 w-4 text-primary" /> Scenarios
          </h2>
          <Button size="sm" className="h-7 text-xs" onClick={() => setShowNewModal(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Basecase */}
          <button
            onClick={() => setActiveScenario(null)}
            className={`w-full text-left rounded-md p-2.5 transition-colors ${
              activeScenarioId === null
                ? 'bg-primary/10 border border-primary/30'
                : 'hover:bg-muted border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-semibold">Basecase</span>
              <Badge className="ml-auto bg-primary/20 text-primary text-[10px] border-0">BASE</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Reference model data</p>
          </button>

          {/* Scenarios */}
          {scenarios.map(sc => (
            <div key={sc.id}>
              {renamingId === sc.id ? (
                <div className="p-2 flex gap-1">
                  <Input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(sc.id); if (e.key === 'Escape') setRenamingId(null); }}
                    className="h-7 text-xs"
                    autoFocus
                  />
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleRename(sc.id)}>OK</Button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveScenario(sc.id)}
                  className={`w-full text-left rounded-md p-2.5 transition-colors group ${
                    activeScenarioId === sc.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium truncate flex-1">{sc.name}</span>
                    <Badge className={`text-[10px] border-0 ${
                      sc.status === 'calculated'
                        ? 'bg-success/20 text-success'
                        : 'bg-warning/20 text-warning'
                    }`}>
                      {sc.status === 'calculated' ? 'Calculated' : 'Recalc'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setActiveScenario(sc.id)}>
                          <Play className="h-3.5 w-3.5 mr-2" /> Activate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateScenario(sc.id)}>
                          <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setRenamingId(sc.id); setRenameValue(sc.name); }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setActiveScenario(sc.id); }}>
                          <Eye className="h-3.5 w-3.5 mr-2" /> View Changes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setActiveScenario(sc.id); setShowPromoteModal(true); }}>
                          <ArrowUpCircle className="h-3.5 w-3.5 mr-2" /> Promote to Basecase
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => { deleteScenario(sc.id); toast.success('Scenario deleted'); }}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">
                    {sc.changes.length} change{sc.changes.length !== 1 ? 's' : ''}
                  </p>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Display Control */}
        <div className="border-t border-border p-3 space-y-2">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Chart Display</h3>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked disabled /> Basecase
            </label>
            {scenarios.map(sc => (
              <label key={sc.id} className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={displayIds.includes(sc.id)}
                  onCheckedChange={() => toggleDisplayScenario(sc.id)}
                />
                {sc.name}
              </label>
            ))}
          </div>
          <Button size="sm" variant="outline" className="w-full h-7 text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Recalc All
          </Button>
        </div>
      </div>

      {/* CENTER PANEL — Scenario Editor */}
      <div className="flex-1 overflow-y-auto bg-background">
        {activeScenarioId === null ? (
          <BasecaseView />
        ) : activeScenario ? (
          <ScenarioEditorPanel
            scenario={activeScenario}
            model={model}
            onUpdateDescription={updateScenarioDescription}
            onRename={renameScenario}
            onRemoveChange={removeChange}
            onPromote={() => setShowPromoteModal(true)}
          />
        ) : (
          <div className="p-8 text-center text-muted-foreground">Select a scenario</div>
        )}
      </div>

      {/* RIGHT PANEL — Quick Input */}
      <div className="w-80 shrink-0 border-l border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold">Quick Input</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {activeScenarioId ? 'Edits tracked as scenario changes' : 'Editing Basecase directly'}
          </p>
        </div>
        <QuickInputPanel modelId={modelId} activeScenarioId={activeScenarioId} />
      </div>

      {/* Modals */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Scenario</DialogTitle>
            <DialogDescription>Create a What-If scenario to explore changes without affecting the Basecase.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Scenario name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Create & Activate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPromoteModal} onOpenChange={setShowPromoteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to Basecase</DialogTitle>
            <DialogDescription>
              This will apply all changes from "{activeScenario?.name}" to the Basecase and clear this scenario's change list. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromoteModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handlePromote}>Promote</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BasecaseView() {
  return (
    <div className="p-8 flex flex-col items-center justify-center h-full text-center">
      <Shield className="h-12 w-12 text-primary/30 mb-4" />
      <h2 className="text-lg font-semibold mb-2">Basecase Active</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        You are viewing the Basecase — the reference state of your model. Create or select a What-If scenario from the left panel to explore changes.
      </p>
    </div>
  );
}

function ScenarioEditorPanel({
  scenario, model, onUpdateDescription, onRename, onRemoveChange, onPromote,
}: {
  scenario: Scenario;
  model: any;
  onUpdateDescription: (id: string, desc: string) => void;
  onRename: (id: string, name: string) => void;
  onRemoveChange: (scenarioId: string, changeId: string) => void;
  onPromote: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(scenario.name);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { onRename(scenario.id, nameVal); setEditingName(false); }
                  if (e.key === 'Escape') setEditingName(false);
                }}
                className="h-8 text-lg font-semibold"
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={() => { onRename(scenario.id, nameVal); setEditingName(false); }}>Save</Button>
            </div>
          ) : (
            <h1
              className="text-xl font-bold cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
              onClick={() => { setNameVal(scenario.name); setEditingName(true); }}
            >
              <FlaskConical className="h-5 w-5 text-primary" />
              {scenario.name}
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </h1>
          )}
          <Textarea
            value={scenario.description}
            onChange={e => onUpdateDescription(scenario.id, e.target.value)}
            placeholder="Add a description…"
            className="mt-2 text-sm min-h-[48px] resize-none"
          />
        </div>
        <Badge className={`ml-4 shrink-0 text-xs border-0 ${
          scenario.status === 'calculated'
            ? 'bg-success/20 text-success'
            : 'bg-warning/20 text-warning'
        }`}>
          {scenario.status === 'calculated' ? 'Calculated' : 'Needs Recalc'}
        </Badge>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-8 text-xs">
          <Play className="h-3.5 w-3.5 mr-1" /> Run This Scenario
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs">
          <Save className="h-3.5 w-3.5 mr-1" /> Save
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onPromote}>
          <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Promote to Basecase
        </Button>
      </div>

      {/* Changes List */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Changes from Basecase ({scenario.changes.length})</h3>
        {scenario.changes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No changes yet. Use the Quick Input panel on the right to make edits.
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-xs">
                  <th className="text-left p-2.5 font-medium">Data Type</th>
                  <th className="text-left p-2.5 font-medium">Entity</th>
                  <th className="text-left p-2.5 font-medium">Field</th>
                  <th className="text-right p-2.5 font-medium">Basecase</th>
                  <th className="text-right p-2.5 font-medium">What-If</th>
                  <th className="p-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {scenario.changes.map(c => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-2.5">
                      <Badge variant="outline" className="text-[10px] font-mono">{c.dataType}</Badge>
                    </td>
                    <td className="p-2.5 font-mono text-xs">{c.entityName}</td>
                    <td className="p-2.5 text-xs">{c.fieldLabel}</td>
                    <td className="p-2.5 text-right font-mono text-xs text-muted-foreground">{c.basecaseValue}</td>
                    <td className="p-2.5 text-right font-mono text-xs font-semibold text-primary">{c.whatIfValue}</td>
                    <td className="p-2.5">
                      <button
                        onClick={() => onRemoveChange(scenario.id, c.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── Quick Input Panel ───────── */

function QuickInputPanel({ modelId, activeScenarioId }: { modelId: string; activeScenarioId: string | null }) {
  const model = useModelStore(s => s.models.find(m => m.id === modelId));
  const { updateLabor, updateEquipment, updateProduct } = useModelStore();
  const { applyScenarioChange } = useScenarioStore();

  if (!model) return null;

  const handleEdit = (
    dataType: ScenarioChange['dataType'],
    entityId: string,
    entityName: string,
    field: string,
    fieldLabel: string,
    value: number,
  ) => {
    if (activeScenarioId) {
      applyScenarioChange(activeScenarioId, dataType, entityId, entityName, field, fieldLabel, value);
    } else {
      // Direct basecase edit
      if (dataType === 'Labor') updateLabor(modelId, entityId, { [field]: value });
      else if (dataType === 'Equipment') updateEquipment(modelId, entityId, { [field]: value });
      else if (dataType === 'Product') updateProduct(modelId, entityId, { [field]: value });
    }
  };

  return (
    <Tabs defaultValue="labor" className="flex-1 flex flex-col overflow-hidden">
      <TabsList className="mx-3 mt-2 grid grid-cols-3 h-8">
        <TabsTrigger value="labor" className="text-xs gap-1"><Users className="h-3 w-3" /> Labor</TabsTrigger>
        <TabsTrigger value="equipment" className="text-xs gap-1"><Wrench className="h-3 w-3" /> Equip</TabsTrigger>
        <TabsTrigger value="products" className="text-xs gap-1"><Package className="h-3 w-3" /> Products</TabsTrigger>
      </TabsList>

      <TabsContent value="labor" className="flex-1 overflow-y-auto p-2 mt-0">
        <QuickTable
          rows={model.labor.map(l => ({
            id: l.id, name: l.name,
            fields: [
              { key: 'count', label: 'Count', value: l.count },
              { key: 'overtime_pct', label: 'OT %', value: l.overtime_pct },
              { key: 'unavail_pct', label: 'Unavail %', value: l.unavail_pct },
            ],
          }))}
          dataType="Labor"
          onEdit={handleEdit}
          activeScenarioId={activeScenarioId}
        />
      </TabsContent>

      <TabsContent value="equipment" className="flex-1 overflow-y-auto p-2 mt-0">
        <QuickTable
          rows={model.equipment.map(e => ({
            id: e.id, name: e.name,
            fields: [
              { key: 'count', label: 'Count', value: e.count },
              { key: 'mttf', label: 'MTTF', value: e.mttf },
              { key: 'mttr', label: 'MTTR', value: e.mttr },
              { key: 'setup_factor', label: 'Setup F.', value: e.setup_factor },
            ],
          }))}
          dataType="Equipment"
          onEdit={handleEdit}
          activeScenarioId={activeScenarioId}
        />
      </TabsContent>

      <TabsContent value="products" className="flex-1 overflow-y-auto p-2 mt-0">
        <QuickTable
          rows={model.products.map(p => ({
            id: p.id, name: p.name,
            fields: [
              { key: 'demand', label: 'Demand', value: p.demand },
              { key: 'lot_size', label: 'Lot Size', value: p.lot_size },
              { key: 'demand_factor', label: 'Demand F.', value: p.demand_factor },
            ],
          }))}
          dataType="Product"
          onEdit={handleEdit}
          activeScenarioId={activeScenarioId}
        />
      </TabsContent>
    </Tabs>
  );
}

interface QuickRow {
  id: string;
  name: string;
  fields: { key: string; label: string; value: number }[];
}

function QuickTable({
  rows, dataType, onEdit, activeScenarioId,
}: {
  rows: QuickRow[];
  dataType: ScenarioChange['dataType'];
  onEdit: (dataType: ScenarioChange['dataType'], entityId: string, entityName: string, field: string, fieldLabel: string, value: number) => void;
  activeScenarioId: string | null;
}) {
  const scenario = useScenarioStore(s => s.scenarios.find(sc => sc.id === activeScenarioId));

  const getDisplayValue = (entityId: string, field: string, baseValue: number): number => {
    if (!scenario) return baseValue;
    const change = scenario.changes.find(c => c.entityId === entityId && c.field === field);
    return change ? Number(change.whatIfValue) : baseValue;
  };

  const isChanged = (entityId: string, field: string): boolean => {
    if (!scenario) return false;
    return scenario.changes.some(c => c.entityId === entityId && c.field === field);
  };

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground p-2">No data</p>;
  }

  const allFields = rows[0].fields;

  return (
    <div className="rounded border border-border overflow-hidden text-xs">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            <th className="text-left p-1.5 font-medium">Name</th>
            {allFields.map(f => (
              <th key={f.key} className="text-right p-1.5 font-medium">{f.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-t border-border">
              <td className="p-1.5 font-mono font-medium truncate max-w-[80px]">{row.name}</td>
              {row.fields.map(f => {
                const displayVal = getDisplayValue(row.id, f.key, f.value);
                const changed = isChanged(row.id, f.key);
                return (
                  <td key={f.key} className="p-1 text-right">
                    <input
                      type="number"
                      value={displayVal}
                      onChange={e => onEdit(dataType, row.id, row.name, f.key, f.label, Number(e.target.value))}
                      className={`w-full text-right bg-transparent border rounded px-1 py-0.5 text-xs font-mono
                        ${changed ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-transparent hover:border-border'}
                        focus:border-primary focus:outline-none`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
