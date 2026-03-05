import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useModelStore } from '@/stores/modelStore';
import { useScenarioStore, type Scenario, type ScenarioChange } from '@/stores/scenarioStore';
import { useResultsStore } from '@/stores/resultsStore';
import { calculate } from '@/lib/calculationEngine';
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
    markCalculated,
  } = useScenarioStore();
  const { setResults } = useResultsStore();

  // Lazy-init demo scenarios
  const [initialized, setInitialized] = useState(false);
  const loadScenariosFromDb = useScenarioStore(s => s.loadScenariosFromDb);
  useEffect(() => {
    if (modelId && !initialized) {
      loadScenariosFromDb(modelId);
      setInitialized(true);
    }
  }, [modelId, initialized, loadScenariosFromDb]);

  const scenarios = allScenarios.filter(sc => sc.modelId === modelId);
  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || null;



  const [newName, setNewName] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (!model || !modelId) return null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await createScenario(modelId, newName.trim());
    setActiveScenario(id);
    setNewName('');
    setShowNewModal(false);
    toast.success(`Scenario "${newName.trim()}" created`);
  };

  const handleRunScenario = (scenario: Scenario) => {
    // Calculate basecase first if not already done
    const basecaseResults = useResultsStore.getState().getResults('basecase');
    if (!basecaseResults) {
      const bcResults = calculate(model, null);
      setResults('basecase', bcResults);
    }
    const results = calculate(model, scenario);
    setResults(scenario.id, results);
    markCalculated(scenario.id);
    toast.success(`Scenario "${scenario.name}" calculated`);
  };

  const handleRecalcAll = () => {
    // Calculate basecase
    const bcResults = calculate(model, null);
    setResults('basecase', bcResults);
    // Calculate all scenarios for this model
    let count = 0;
    scenarios.forEach(sc => {
      const results = calculate(model, sc);
      setResults(sc.id, results);
      markCalculated(sc.id);
      count++;
    });
    toast.success(`Recalculated basecase + ${count} scenario(s)`);
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
          <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={handleRecalcAll}>
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
            onRunScenario={handleRunScenario}
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
  scenario, model, onUpdateDescription, onRename, onRemoveChange, onPromote, onRunScenario,
}: {
  scenario: Scenario;
  model: any;
  onUpdateDescription: (id: string, desc: string) => void;
  onRename: (id: string, name: string) => void;
  onRemoveChange: (scenarioId: string, changeId: string) => void;
  onPromote: () => void;
  onRunScenario: (scenario: Scenario) => void;
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
        <Button size="sm" className="h-8 text-xs" onClick={() => onRunScenario(scenario)}>
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
  const { updateLabor, updateEquipment, updateProduct, updateRouting } = useModelStore();
  const { applyScenarioChange } = useScenarioStore();
  const [selectedRoutingProduct, setSelectedRoutingProduct] = useState('');

  if (!model) return null;

  const handleEdit = (
    dataType: ScenarioChange['dataType'],
    entityId: string,
    entityName: string,
    field: string,
    fieldLabel: string,
    value: number | string,
  ) => {
    if (activeScenarioId) {
      applyScenarioChange(activeScenarioId, dataType, entityId, entityName, field, fieldLabel, value);
    } else {
      // Direct basecase edit
      if (dataType === 'Labor') updateLabor(modelId, entityId, { [field]: value });
      else if (dataType === 'Equipment') updateEquipment(modelId, entityId, { [field]: value });
      else if (dataType === 'Product') updateProduct(modelId, entityId, { [field]: value });
      else if (dataType === 'Routing') updateRouting(modelId, entityId, { [field]: value });
    }
  };

  // Compute scrap rate per product (sum of routing % to SCRAP)
  const getScrapRate = (productId: string) => {
    return model.routing
      .filter(r => r.product_id === productId && r.to_op_name === 'SCRAP')
      .reduce((sum, r) => sum + r.pct_routed, 0);
  };

  // Handle scrap rate edit: adjust routing to SCRAP proportionally
  const handleScrapRateEdit = (productId: string, productName: string, newRate: number) => {
    const scrapRoutes = model.routing.filter(r => r.product_id === productId && r.to_op_name === 'SCRAP');
    if (scrapRoutes.length === 0) {
      toast.error(`No SCRAP routing exists for ${productName}. Add one on the Operations screen first.`);
      return;
    }
    const currentTotal = scrapRoutes.reduce((s, r) => s + r.pct_routed, 0);
    const scale = currentTotal > 0 ? newRate / currentTotal : 1;
    scrapRoutes.forEach(r => {
      const newPct = Math.round(r.pct_routed * scale * 10) / 10;
      const entityName = `${productName}: ${r.from_op_name}→SCRAP`;
      handleEdit('Routing', r.id, entityName, 'pct_routed', 'Routing %', newPct);
    });
  };

  const routingProductId = selectedRoutingProduct || model.products[0]?.id || '';
  const routingProduct = model.products.find(p => p.id === routingProductId);
  const routingEntries = model.routing.filter(r => r.product_id === routingProductId);

  return (
    <Tabs defaultValue="labor" className="flex-1 flex flex-col overflow-hidden">
      <TabsList className="mx-3 mt-2 grid grid-cols-4 h-8">
        <TabsTrigger value="labor" className="text-xs gap-1"><Users className="h-3 w-3" /> Labor</TabsTrigger>
        <TabsTrigger value="equipment" className="text-xs gap-1"><Wrench className="h-3 w-3" /> Equip</TabsTrigger>
        <TabsTrigger value="products" className="text-xs gap-1"><Package className="h-3 w-3" /> Products</TabsTrigger>
        <TabsTrigger value="routing" className="text-xs gap-1"><ChevronRight className="h-3 w-3" /> Routing</TabsTrigger>
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
        {/* Scrap Rate section */}
        <div className="mt-3 pt-3 border-t border-border">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase mb-2">Scrap Rate</h4>
          <div className="rounded border border-border overflow-hidden text-xs">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left p-1.5 font-medium">Product</th>
                  <th className="text-right p-1.5 font-medium">Scrap %</th>
                </tr>
              </thead>
              <tbody>
                {model.products.filter(p => {
                  // Only show products that have SCRAP routes
                  return model.routing.some(r => r.product_id === p.id && r.to_op_name === 'SCRAP');
                }).map(p => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-1.5 font-mono font-medium truncate max-w-[80px]">{p.name}</td>
                    <td className="p-1 text-right">
                      <input
                        type="number"
                        value={getScrapRate(p.id)}
                        onChange={e => handleScrapRateEdit(p.id, p.name, Number(e.target.value))}
                        className="w-full text-right bg-transparent border rounded px-1 py-0.5 text-xs font-mono border-transparent hover:border-border focus:border-primary focus:outline-none"
                        step="0.1"
                      />
                    </td>
                  </tr>
                ))}
                {!model.products.some(p => model.routing.some(r => r.product_id === p.id && r.to_op_name === 'SCRAP')) && (
                  <tr><td colSpan={2} className="p-2 text-muted-foreground text-center">No products with SCRAP routing</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="routing" className="flex-1 overflow-y-auto p-2 mt-0">
        <div className="mb-2">
          <select
            className="w-full text-xs border rounded px-2 py-1 bg-background"
            value={routingProductId}
            onChange={e => setSelectedRoutingProduct(e.target.value)}
          >
            {model.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {routingEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2 text-center">No routing defined for {routingProduct?.name}</p>
        ) : (
          <div className="rounded border border-border overflow-hidden text-xs">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left p-1.5 font-medium">From→To</th>
                  <th className="text-right p-1.5 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {routingEntries.map(r => {
                  const entityName = `${routingProduct?.name}: ${r.from_op_name}→${r.to_op_name}`;
                  const scenario = activeScenarioId ? useScenarioStore.getState().scenarios.find(s => s.id === activeScenarioId) : null;
                  const change = scenario?.changes.find(c => c.entityId === r.id && c.field === 'pct_routed');
                  const displayVal = change ? Number(change.whatIfValue) : r.pct_routed;
                  const changed = !!change;
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-1.5 font-mono truncate max-w-[120px]">{r.from_op_name}→{r.to_op_name}</td>
                      <td className="p-1 text-right">
                        <input
                          type="number"
                          value={displayVal}
                          onChange={e => handleEdit('Routing', r.id, entityName, 'pct_routed', 'Routing %', Number(e.target.value))}
                          className={`w-full text-right bg-transparent border rounded px-1 py-0.5 text-xs font-mono
                            ${changed ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-transparent hover:border-border'}
                            focus:border-primary focus:outline-none`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
