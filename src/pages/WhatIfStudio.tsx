import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useModelStore, type Model } from '@/stores/modelStore';
import { useScenarioStore, type Scenario, type ScenarioChange } from '@/stores/scenarioStore';
import { useResultsStore } from '@/stores/resultsStore';
import { useUserLevelStore, isVisible, type UserLevel } from '@/hooks/useUserLevel';
import { calculate } from '@/lib/calculationEngine';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus, Play, Save, ArrowUpCircle, ArrowLeft,
  FlaskConical, Pencil, Trash2, Copy, Eye, EyeOff, Lock,
  AlertTriangle, Circle, CircleAlert, CircleCheck,
} from 'lucide-react';
import { getScenarioColor } from '@/lib/scenarioColors';
import { toast } from 'sonner';

export default function WhatIfStudio() {
  const { modelId } = useParams<{ modelId: string }>();
  const model = useModelStore(s => s.models.find(m => m.id === modelId));
  const { userLevel } = useUserLevelStore();

  const allScenarios = useScenarioStore(s => s.scenarios);
  const activeScenarioId = useScenarioStore(s => s.activeScenarioId);
  const displayIds = useScenarioStore(s => s.displayScenarioIds);
  const {
    setActiveScenario, createScenario, duplicateScenario, renameScenario,
    updateScenarioDescription, deleteScenario, toggleDisplayScenario,
    promoteToBasecase, markCalculated,
  } = useScenarioStore();
  const { setResults } = useResultsStore();

  const [initialized, setInitialized] = useState(false);
  const loadScenariosFromDb = useScenarioStore(s => s.loadScenariosFromDb);
  useEffect(() => {
    if (modelId && !initialized) {
      loadScenariosFromDb(modelId);
      setInitialized(true);
    }
  }, [modelId, initialized, loadScenariosFromDb]);

  const scenarios = allScenarios.filter(sc => sc.modelId === modelId);

  // "selected" tracks which row is highlighted in the left panel.
  // null = nothing selected (empty state). 'basecase' = basecase row. string = scenario id.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // New what-if inline form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newComment, setNewComment] = useState('');

  if (!model || !modelId) return null;

  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || null;
  const selectedScenario = selectedId && selectedId !== 'basecase'
    ? scenarios.find(s => s.id === selectedId) || null
    : null;

  // ── Handlers ──
  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await createScenario(modelId, newName.trim(), newComment.trim());
    setActiveScenario(id);
    setSelectedId(id);
    const nm = newName.trim();
    setNewName('');
    setNewComment('');
    setShowNewForm(false);
    toast.success(`What-if "${nm}" created and active.`);
  };

  const handleRunScenario = (scenario: Scenario) => {
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

  const handlePromote = () => {
    if (!activeScenarioId || !activeScenario) return;
    const nm = activeScenario.name;
    promoteToBasecase(activeScenarioId);
    setShowPromoteModal(false);
    setSelectedId('basecase');
    toast.success(`Basecase updated from "${nm}".`);
  };

  const handleReturnToBasecase = () => {
    if (activeScenario && activeScenario.changes.length > 0) {
      setShowReturnModal(true);
    } else {
      setActiveScenario(null);
      setSelectedId('basecase');
    }
  };

  const handleSaveAs = async (scenario: Scenario) => {
    const newId = await duplicateScenario(scenario.id);
    setActiveScenario(newId);
    setSelectedId(newId);
    toast.success(`Saved as copy of "${scenario.name}"`);
  };

  const handleLeftClick = (id: string | 'basecase') => {
    setSelectedId(id);
    setShowNewForm(false);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ═══ LEFT PANEL — 240px Scenarios ═══ */}
      <div className="w-[240px] shrink-0 border-r border-border flex flex-col bg-muted/20">
        <div className="h-10 flex items-center px-3 border-b border-border shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scenarios</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Basecase row */}
          <button
            onClick={() => handleLeftClick('basecase')}
            className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors border-b border-border/50 ${
              selectedId === 'basecase' ? 'bg-primary/5' : 'hover:bg-muted/50'
            }`}
          >
            <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium flex-1 truncate">Basecase</span>
            {!activeScenarioId ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 text-[10px] border-0 shrink-0">Active</Badge>
            ) : null}
            <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>

          {/* What-if rows */}
          {scenarios.map((sc, idx) => {
            const dotColor = getScenarioColor(idx);
            const isActive = activeScenarioId === sc.id;
            const isSelected = selectedId === sc.id;
            const isDisplayed = displayIds.includes(sc.id);
            const hasResults = useResultsStore.getState().getResults(sc.id) != null;

            let statusBadge: React.ReactNode;
            if (isActive) {
              statusBadge = (
                <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[10px] shrink-0 gap-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" /> Active
                </Badge>
              );
            } else if (sc.status === 'needs_recalc' && hasResults) {
              statusBadge = (
                <Badge variant="outline" className="border-amber-400 text-amber-600 text-[10px] shrink-0 gap-0.5">
                  <CircleAlert className="h-2.5 w-2.5" /> Stale
                </Badge>
              );
            } else if (sc.status === 'calculated') {
              statusBadge = (
                <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px] shrink-0 gap-0.5">
                  <CircleCheck className="h-2.5 w-2.5" /> Current
                </Badge>
              );
            } else {
              statusBadge = (
                <Badge variant="secondary" className="text-[10px] shrink-0 gap-0.5">
                  <Circle className="h-2.5 w-2.5" /> Not Run
                </Badge>
              );
            }

            return (
              <button
                key={sc.id}
                onClick={() => handleLeftClick(sc.id)}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors border-b border-border/30 ${
                  isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                <span className="text-sm font-medium flex-1 truncate">{sc.name}</span>
                {statusBadge}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleDisplayScenario(sc.id); }}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  title={isDisplayed ? 'Hide from charts' : 'Show in charts'}
                >
                  {isDisplayed ? (
                    <Eye className="h-3.5 w-3.5" style={{ color: dotColor }} />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                </button>
              </button>
            );
          })}
        </div>

        {/* Bottom: + New What-if */}
        <div className="p-3 border-t border-border shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={() => { setShowNewForm(true); setSelectedId(null); }}
                    disabled={activeScenarioId !== null}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> New What-if
                  </Button>
                </div>
              </TooltipTrigger>
              {activeScenarioId !== null && (
                <TooltipContent side="top">
                  <p className="text-xs">Save or return to Basecase first.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* ═══ CENTRE PANEL ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {showNewForm ? (
          <NewWhatIfForm
            newName={newName}
            newComment={newComment}
            setNewName={setNewName}
            setNewComment={setNewComment}
            onSubmit={handleCreate}
            onCancel={() => { setShowNewForm(false); setNewName(''); setNewComment(''); }}
          />
        ) : selectedId === 'basecase' ? (
          <BasecaseView model={model} />
        ) : selectedScenario ? (
          <ScenarioView
            model={model}
            modelId={modelId}
            scenario={selectedScenario}
            isActive={activeScenarioId === selectedScenario.id}
            activeScenario={activeScenario}
            onActivate={() => { setActiveScenario(selectedScenario.id); }}
            onDelete={() => setShowDeleteModal(selectedScenario.id)}
            onRename={renameScenario}
            onUpdateDescription={updateScenarioDescription}
            onRunScenario={handleRunScenario}
            onSaveAs={handleSaveAs}
            onReturnToBasecase={handleReturnToBasecase}
            onPromote={() => setShowPromoteModal(true)}
            userLevel={userLevel}
          />
        ) : (
          <EmptyState onNew={() => { setShowNewForm(true); }} disabled={activeScenarioId !== null} />
        )}
      </div>

      {/* ── Modals ── */}
      {showDeleteModal && (() => {
        const sc = scenarios.find(s => s.id === showDeleteModal);
        if (!sc) return null;
        return (
          <DeleteConfirmModal
            scenario={sc}
            onConfirm={() => {
              deleteScenario(showDeleteModal);
              if (selectedId === showDeleteModal) setSelectedId(null);
              setShowDeleteModal(null);
              toast.success(`"${sc.name}" deleted`);
            }}
            onCancel={() => setShowDeleteModal(null)}
          />
        );
      })()}

      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return to Basecase?</DialogTitle>
            <DialogDescription>
              You have unsaved changes in "{activeScenario?.name}". What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setShowReturnModal(false)}>Stay in What-if</Button>
            <Button variant="secondary" className="border border-amber-400 text-amber-700" onClick={() => {
              setActiveScenario(null);
              setShowReturnModal(false);
              setSelectedId('basecase');
            }}>Discard Changes and Return</Button>
            <Button onClick={() => {
              if (activeScenario) handleRunScenario(activeScenario);
              setActiveScenario(null);
              setShowReturnModal(false);
              setSelectedId('basecase');
            }}>Save and Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showPromoteModal && activeScenario && (
        <PromoteModal
          scenario={activeScenario}
          onConfirm={handlePromote}
          onCancel={() => setShowPromoteModal(false)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════════════════════
function EmptyState({ onNew, disabled }: { onNew: () => void; disabled: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
      <FlaskConical className="h-12 w-12 mb-4 opacity-30" />
      <p className="text-sm mb-4">Select a scenario to view or edit it</p>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button size="lg" onClick={onNew} disabled={disabled}>
                <Plus className="h-4 w-4 mr-2" /> New What-if
              </Button>
            </div>
          </TooltipTrigger>
          {disabled && (
            <TooltipContent><p className="text-xs">Save or return to Basecase first.</p></TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// New What-if inline form (centre panel)
// ═══════════════════════════════════════════════════════════════════════
function NewWhatIfForm({ newName, newComment, setNewName, setNewComment, onSubmit, onCancel }: {
  newName: string; newComment: string;
  setNewName: (v: string) => void; setNewComment: (v: string) => void;
  onSubmit: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md rounded-lg border border-primary/30 bg-primary/5 p-6 space-y-4">
        <h3 className="text-base font-semibold">New What-if</h3>
        <div>
          <Label className="text-xs">Name</Label>
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) onSubmit(); if (e.key === 'Escape') onCancel(); }}
            placeholder="e.g. Higher demand scenario"
            className="h-9 mt-1"
            autoFocus
          />
        </div>
        <div>
          <Label className="text-xs">Comment (optional)</Label>
          <Textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Describe what you want to explore…"
            className="mt-1 text-sm min-h-[48px] resize-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onSubmit} disabled={!newName.trim()}>
            <Play className="h-3.5 w-3.5 mr-1" /> Create & Activate
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Basecase View — read-only tabs
// ═══════════════════════════════════════════════════════════════════════
function BasecaseView({ model }: { model: Model }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Basecase</h2>
        <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px] ml-2">Read-only</Badge>
      </div>
      <div className="px-6 py-2 text-xs text-muted-foreground border-b border-border shrink-0">
        To edit Basecase data, use the Input screens in the main navigation.
      </div>
      <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 shrink-0 w-fit">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="labor">Labor</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="ibom">IBOM</TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <TabsContent value="general"><GeneralTab model={model} /></TabsContent>
          <TabsContent value="labor"><LaborTab model={model} /></TabsContent>
          <TabsContent value="equipment"><EquipmentTab model={model} /></TabsContent>
          <TabsContent value="products"><ProductsTab model={model} /></TabsContent>
          <TabsContent value="operations"><OperationsTab model={model} /></TabsContent>
          <TabsContent value="ibom"><IBOMTab model={model} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ── Read-only tab content helpers ──
function ReadOnlyTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            {headers.map(h => <th key={h} className="text-left p-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((cell, j) => (
                <td key={j} className={`p-2 ${j === 0 ? 'font-medium' : 'text-muted-foreground font-mono'}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KVGrid({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
      {items.map(i => (
        <div key={i.label}>
          <span className="text-xs text-muted-foreground">{i.label}</span>
          <p className="text-sm font-mono">{i.value}</p>
        </div>
      ))}
    </div>
  );
}

function GeneralTab({ model }: { model: Model }) {
  const g = model.general;
  return (
    <KVGrid items={[
      { label: 'Model Title', value: g.model_title || '—' },
      { label: 'Author', value: g.author || '—' },
      { label: 'Ops Time Unit', value: g.ops_time_unit },
      { label: 'MCT Time Unit', value: g.mct_time_unit },
      { label: 'Production Period', value: g.prod_period_unit },
      { label: 'Conv1', value: g.conv1 },
      { label: 'Conv2', value: g.conv2 },
      { label: 'Utilisation Limit', value: `${g.util_limit}%` },
      { label: 'Var Equip', value: `${g.var_equip}%` },
      { label: 'Var Labor', value: `${g.var_labor}%` },
      { label: 'Var Prod', value: `${g.var_prod}%` },
    ]} />
  );
}

function LaborTab({ model }: { model: Model }) {
  if (!model.labor.length) return <p className="text-sm text-muted-foreground">No labor groups.</p>;
  return (
    <ReadOnlyTable
      headers={['Name', 'Count', 'OT%', 'Unavail%', 'Dept']}
      rows={model.labor.map(l => [l.name, l.count, l.overtime_pct, l.unavail_pct, l.dept_code || '—'])}
    />
  );
}

function EquipmentTab({ model }: { model: Model }) {
  if (!model.equipment.length) return <p className="text-sm text-muted-foreground">No equipment.</p>;
  return (
    <ReadOnlyTable
      headers={['Name', 'Type', 'Count', 'MTTF', 'MTTR', 'Unavail%']}
      rows={model.equipment.map(e => [e.name, e.equip_type, e.count, e.mttf, e.mttr, e.unavail_pct])}
    />
  );
}

function ProductsTab({ model }: { model: Model }) {
  if (!model.products.length) return <p className="text-sm text-muted-foreground">No products.</p>;
  return (
    <ReadOnlyTable
      headers={['Name', 'Demand', 'Lot Size', 'TBatch', 'Dept']}
      rows={model.products.map(p => [p.name, p.demand, p.lot_size, p.tbatch_size, p.dept_code || '—'])}
    />
  );
}

function OperationsTab({ model }: { model: Model }) {
  if (!model.operations.length) return <p className="text-sm text-muted-foreground">No operations.</p>;
  const prodMap = Object.fromEntries(model.products.map(p => [p.id, p.name]));
  const eqMap = Object.fromEntries(model.equipment.map(e => [e.id, e.name]));
  return (
    <ReadOnlyTable
      headers={['Product', 'Op#', 'Op Name', 'Equipment', 'Eq Setup/Lot', 'Eq Run/Pc', 'Lab Setup/Lot', 'Lab Run/Pc']}
      rows={model.operations.map(o => [
        prodMap[o.product_id] || '—', o.op_number, o.op_name, eqMap[o.equip_id] || '—',
        o.equip_setup_lot, o.equip_run_piece, o.labor_setup_lot, o.labor_run_piece,
      ])}
    />
  );
}

function IBOMTab({ model }: { model: Model }) {
  if (!model.ibom.length) return <p className="text-sm text-muted-foreground">No IBOM entries.</p>;
  const prodMap = Object.fromEntries(model.products.map(p => [p.id, p.name]));
  return (
    <ReadOnlyTable
      headers={['Parent', 'Component', 'Units/Assy']}
      rows={model.ibom.map(b => [prodMap[b.parent_product_id] || '—', prodMap[b.component_product_id] || '—', b.units_per_assy])}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Scenario View (selected, may or may not be active)
// ═══════════════════════════════════════════════════════════════════════
function ScenarioView({
  model, modelId, scenario, isActive, activeScenario,
  onActivate, onDelete, onRename, onUpdateDescription,
  onRunScenario, onSaveAs, onReturnToBasecase, onPromote, userLevel,
}: {
  model: Model; modelId: string; scenario: Scenario; isActive: boolean;
  activeScenario: Scenario | null;
  onActivate: () => void; onDelete: () => void;
  onRename: (id: string, name: string) => void;
  onUpdateDescription: (id: string, desc: string) => void;
  onRunScenario: (s: Scenario) => void; onSaveAs: (s: Scenario) => void;
  onReturnToBasecase: () => void; onPromote: () => void;
  userLevel: UserLevel;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(scenario.name);
  const { removeChange } = useScenarioStore();

  useEffect(() => { setNameVal(scenario.name); setEditingName(false); }, [scenario.id]);

  const hasResults = useResultsStore.getState().getResults(scenario.id) != null;
  const statusLabel = scenario.status === 'calculated' ? 'Current' : (hasResults ? 'Stale' : 'Not Run');

  // Status badge
  let statusBadge: React.ReactNode;
  if (isActive) {
    statusBadge = <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[10px]">● Active — Editing</Badge>;
  } else if (scenario.status === 'calculated') {
    statusBadge = <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px]">✓ Current</Badge>;
  } else if (hasResults) {
    statusBadge = <Badge variant="outline" className="border-amber-400 text-amber-600 text-[10px]">⚠ Stale</Badge>;
  } else {
    statusBadge = <Badge variant="secondary" className="text-[10px]">○ Not Run</Badge>;
  }

  const screenBadgeColor = (dt: string) => {
    if (dt === 'Labor') return 'bg-blue-100 text-blue-700';
    if (dt === 'Equipment') return 'bg-purple-100 text-purple-700';
    if (dt === 'Product') return 'bg-green-100 text-green-700';
    if (dt === 'General') return 'bg-amber-100 text-amber-700';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0 space-y-3">
        <div className="flex items-center gap-3">
          {editingName ? (
            <Input value={nameVal} onChange={e => setNameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { onRename(scenario.id, nameVal); setEditingName(false); } if (e.key === 'Escape') setEditingName(false); }}
              onBlur={() => { onRename(scenario.id, nameVal); setEditingName(false); }}
              className="h-9 text-lg font-semibold max-w-sm" autoFocus />
          ) : (
            <h2 className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5"
              onClick={() => { setNameVal(scenario.name); setEditingName(true); }}>
              {scenario.name}
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </h2>
          )}
          {statusBadge}
          <div className="flex-1" />
          {!isActive && (
            <>
              <Button size="sm" onClick={onActivate}>
                <Play className="h-3.5 w-3.5 mr-1" /> Activate for Editing
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </>
          )}
        </div>

        {/* Active scenario actions */}
        {isActive && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-start gap-2 rounded-md px-3 py-2 text-xs bg-amber-500/10 text-amber-800 flex-1 min-w-0">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span>What-if mode active. Changes on Input screens are recorded here.</span>
            </div>
            <Button size="sm" variant="secondary" className="h-8 text-xs shrink-0" onClick={() => onRunScenario(scenario)}>
              <Save className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs shrink-0" onClick={() => onSaveAs(scenario)}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Save As
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={onReturnToBasecase}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Return to Basecase
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs border-amber-400 text-amber-700 hover:bg-amber-50 shrink-0" onClick={onPromote}>
              <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Promote
            </Button>
          </div>
        )}
      </div>

      {/* Body — tabs showing parameter values with amber tint on changed values */}
      <Tabs defaultValue="changes" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 shrink-0 w-fit">
          <TabsTrigger value="changes">Changes ({scenario.changes.length})</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="labor">Labor</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="ibom">IBOM</TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <TabsContent value="changes">
            <ChangesTab scenario={scenario} isActive={isActive} onRemoveChange={(cId) => removeChange(scenario.id, cId)} />
          </TabsContent>
          <TabsContent value="general"><GeneralTab model={model} /></TabsContent>
          <TabsContent value="labor"><LaborTab model={model} /></TabsContent>
          <TabsContent value="equipment"><EquipmentTab model={model} /></TabsContent>
          <TabsContent value="products"><ProductsTab model={model} /></TabsContent>
          <TabsContent value="operations"><OperationsTab model={model} /></TabsContent>
          <TabsContent value="ibom"><IBOMTab model={model} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ── Changes Tab ──
function ChangesTab({ scenario, isActive, onRemoveChange }: {
  scenario: Scenario; isActive: boolean; onRemoveChange: (id: string) => void;
}) {
  if (scenario.changes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {isActive ? 'No changes yet. Go to an Input screen and make changes.' : 'No changes recorded.'}
      </div>
    );
  }

  const screenBadgeColor = (dt: string) => {
    if (dt === 'Labor') return 'bg-blue-100 text-blue-700';
    if (dt === 'Equipment') return 'bg-purple-100 text-purple-700';
    if (dt === 'Product') return 'bg-green-100 text-green-700';
    if (dt === 'General') return 'bg-amber-100 text-amber-700';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            <th className="text-left p-2 font-medium w-8">#</th>
            <th className="text-left p-2 font-medium">Parameter</th>
            <th className="text-left p-2 font-medium">Screen</th>
            <th className="text-right p-2 font-medium">Basecase</th>
            <th className="text-right p-2 font-medium">What-if</th>
            <th className="text-right p-2 font-medium">Δ</th>
            {isActive && <th className="p-2 w-8"></th>}
          </tr>
        </thead>
        <tbody>
          {scenario.changes.map((c, idx) => {
            const base = Number(c.basecaseValue);
            const wi = Number(c.whatIfValue);
            const delta = (!isNaN(base) && !isNaN(wi)) ? wi - base : null;
            return (
              <tr key={c.id} className="border-t border-border hover:bg-amber-500/5">
                <td className="p-2 text-muted-foreground">{idx + 1}</td>
                <td className="p-2">
                  <span className="font-medium">{c.entityName}</span>
                  <span className="text-muted-foreground"> · {c.fieldLabel}</span>
                </td>
                <td className="p-2">
                  <span className={`inline-block text-[10px] font-medium rounded px-1.5 py-0.5 ${screenBadgeColor(c.dataType)}`}>{c.dataType}</span>
                </td>
                <td className="p-2 text-right font-mono text-muted-foreground">{c.basecaseValue}</td>
                <td className="p-2 text-right font-mono font-semibold text-primary">{c.whatIfValue}</td>
                <td className="p-2 text-right font-mono">
                  {delta !== null ? (
                    <span className={delta >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {delta >= 0 ? '+' : ''}{delta % 1 === 0 ? delta : delta.toFixed(2)}
                    </span>
                  ) : '—'}
                </td>
                {isActive && (
                  <td className="p-2">
                    <button onClick={() => onRemoveChange(c.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Delete Confirmation Modal
// ═══════════════════════════════════════════════════════════════════════
function DeleteConfirmModal({ scenario, onConfirm, onCancel }: {
  scenario: Scenario; onConfirm: () => void; onCancel: () => void;
}) {
  const [typedName, setTypedName] = useState('');
  const needsTyping = scenario.changes.length > 5;
  const canDelete = needsTyping ? typedName === scenario.name : true;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete "{scenario.name}"?</DialogTitle>
          <DialogDescription>
            This will permanently remove this scenario and all its {scenario.changes.length} change{scenario.changes.length !== 1 ? 's' : ''}. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {needsTyping && (
          <div className="space-y-2">
            <Label className="text-xs">Type the What-if name to confirm:</Label>
            <Input value={typedName} onChange={e => setTypedName(e.target.value)} placeholder={scenario.name} className="h-8 font-mono" autoFocus />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!canDelete}>Delete Permanently</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Promote to Basecase Modal
// ═══════════════════════════════════════════════════════════════════════
function PromoteModal({ scenario, onConfirm, onCancel }: {
  scenario: Scenario; onConfirm: () => void; onCancel: () => void;
}) {
  const [typedName, setTypedName] = useState('');
  const canPromote = typedName === scenario.name;

  const screenBadgeColor = (dt: string) => {
    if (dt === 'Labor') return 'bg-blue-100 text-blue-700';
    if (dt === 'Equipment') return 'bg-purple-100 text-purple-700';
    if (dt === 'Product') return 'bg-green-100 text-green-700';
    if (dt === 'General') return 'bg-amber-100 text-amber-700';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="h-16 w-16 rounded-full flex items-center justify-center bg-amber-500/15">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold">Promote "{scenario.name}" to Basecase?</h2>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">The following changes will become permanent:</h3>
          {scenario.changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes recorded.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-xs sticky top-0">
                    <th className="text-left p-2 font-medium w-8">#</th>
                    <th className="text-left p-2 font-medium">Parameter</th>
                    <th className="text-left p-2 font-medium">Screen</th>
                    <th className="text-right p-2 font-medium">Basecase</th>
                    <th className="text-right p-2 font-medium">What-if</th>
                  </tr>
                </thead>
                <tbody>
                  {scenario.changes.map((c, idx) => (
                    <tr key={c.id} className="border-t border-border text-xs">
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      <td className="p-2"><span className="font-medium">{c.entityName}</span> · {c.fieldLabel}</td>
                      <td className="p-2">
                        <span className={`inline-block text-[10px] font-medium rounded px-1.5 py-0.5 ${screenBadgeColor(c.dataType)}`}>{c.dataType}</span>
                      </td>
                      <td className="p-2 text-right font-mono text-muted-foreground">{c.basecaseValue}</td>
                      <td className="p-2 text-right font-mono font-semibold text-primary">{c.whatIfValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-sm font-bold text-red-600">
          This is permanent. Your Basecase data will be overwritten. This cannot be undone.
        </p>

        <div>
          <Label className="text-xs">Type the What-if name to confirm:</Label>
          <Input value={typedName} onChange={e => setTypedName(e.target.value)} placeholder={scenario.name} className="h-8 mt-1 font-mono max-w-sm" autoFocus />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} disabled={!canPromote} className="bg-amber-600 hover:bg-amber-700 text-white">
            <ArrowUpCircle className="h-4 w-4 mr-2" /> Promote to Basecase
          </Button>
        </div>
      </div>
    </div>
  );
}
