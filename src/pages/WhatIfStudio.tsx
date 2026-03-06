import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

// ═══════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════
export default function WhatIfStudio() {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newComment, setNewComment] = useState('');

  if (!model || !modelId) return null;

  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || null;
  const selectedScenario = selectedId && selectedId !== 'basecase'
    ? scenarios.find(s => s.id === selectedId) || null
    : null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await createScenario(modelId, newName.trim(), newComment.trim());
    setActiveScenario(id);
    setSelectedId(id);
    const nm = newName.trim();
    setNewName(''); setNewComment(''); setShowNewForm(false);
    toast.success(`What-if "${nm}" created and active.`);
  };

  const handleRunScenario = (scenario: Scenario) => {
    const basecaseResults = useResultsStore.getState().getResults('basecase');
    if (!basecaseResults) setResults('basecase', calculate(model, null));
    const results = calculate(model, scenario);
    setResults(scenario.id, results);
    markCalculated(scenario.id);
    toast.success(`Scenario "${scenario.name}" calculated`);
  };

  const handlePromote = () => {
    if (!activeScenarioId || !activeScenario) return;
    promoteToBasecase(activeScenarioId);
    setShowPromoteModal(false);
    setSelectedId(null);
    toast.success('Basecase updated. Run Full Calculate to see updated results.');
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

  const handleRunAndView = (scenario: Scenario) => {
    handleRunScenario(scenario);
    // Ensure this scenario's eye icon is toggled on so results are visible in charts
    if (!displayIds.includes(scenario.id)) {
      toggleDisplayScenario(scenario.id);
    }
    if (modelId) navigate(`/models/${modelId}/run`);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ═══ LEFT PANEL — 240px ═══ */}
      <div className="w-[240px] shrink-0 border-r border-border flex flex-col bg-muted/20">
        <div className="h-10 flex items-center px-3 border-b border-border shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scenarios</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Basecase */}
          <button
            onClick={() => handleLeftClick('basecase')}
            className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors border-b border-border/50 ${selectedId === 'basecase' ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
          >
            <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium flex-1 truncate">Basecase</span>
            {!activeScenarioId && <Badge className="bg-emerald-500/15 text-emerald-600 text-[10px] border-0 shrink-0">Active</Badge>}
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
              statusBadge = <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[10px] shrink-0 gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" /> Active</Badge>;
            } else if (sc.status === 'needs_recalc' && hasResults) {
              statusBadge = <Badge variant="outline" className="border-amber-400 text-amber-600 text-[10px] shrink-0 gap-0.5"><CircleAlert className="h-2.5 w-2.5" /> Stale</Badge>;
            } else if (sc.status === 'calculated') {
              statusBadge = <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px] shrink-0 gap-0.5"><CircleCheck className="h-2.5 w-2.5" /> Current</Badge>;
            } else {
              statusBadge = <Badge variant="secondary" className="text-[10px] shrink-0 gap-0.5"><Circle className="h-2.5 w-2.5" /> Not Run</Badge>;
            }
            return (
              <button key={sc.id} onClick={() => handleLeftClick(sc.id)}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors border-b border-border/30 ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                <span className="text-sm font-medium flex-1 truncate">{sc.name}</span>
                {statusBadge}
                <button onClick={(e) => { e.stopPropagation(); toggleDisplayScenario(sc.id); }}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  title={isDisplayed ? 'Hide from charts' : 'Show in charts'}
                >
                  {isDisplayed ? <Eye className="h-3.5 w-3.5" style={{ color: dotColor }} /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t border-border shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button size="sm" className="w-full h-8 text-xs" onClick={() => { setShowNewForm(true); setSelectedId(null); }} disabled={activeScenarioId !== null}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> New What-if
                  </Button>
                </div>
              </TooltipTrigger>
              {activeScenarioId !== null && <TooltipContent side="top"><p className="text-xs">Save or return to Basecase first.</p></TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* ═══ CENTRE PANEL ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {showNewForm ? (
          <NewWhatIfForm newName={newName} newComment={newComment} setNewName={setNewName} setNewComment={setNewComment} onSubmit={handleCreate} onCancel={() => { setShowNewForm(false); setNewName(''); setNewComment(''); }} />
        ) : selectedId === 'basecase' ? (
          <BasecaseView model={model} />
        ) : selectedScenario ? (
          <ScenarioView
            model={model} modelId={modelId} scenario={selectedScenario}
            isActive={activeScenarioId === selectedScenario.id}
            onActivate={() => setActiveScenario(selectedScenario.id)}
            onDelete={() => setShowDeleteModal(selectedScenario.id)}
            onRename={renameScenario}
            onRunScenario={handleRunScenario}
            onSaveAs={handleSaveAs}
            onReturnToBasecase={handleReturnToBasecase}
            onPromote={() => setShowPromoteModal(true)}
            onRunAndView={handleRunAndView}
            userLevel={userLevel}
          />
        ) : (
          <EmptyState onNew={() => setShowNewForm(true)} disabled={activeScenarioId !== null} />
        )}
      </div>

      {/* ── Modals ── */}
      {showDeleteModal && (() => {
        const sc = scenarios.find(s => s.id === showDeleteModal);
        if (!sc) return null;
        return <DeleteConfirmModal scenario={sc} onConfirm={() => { deleteScenario(showDeleteModal); if (selectedId === showDeleteModal) setSelectedId(null); setShowDeleteModal(null); toast.success(`"${sc.name}" deleted`); }} onCancel={() => setShowDeleteModal(null)} />;
      })()}

      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Return to Basecase?</DialogTitle><DialogDescription>You have unsaved changes in "{activeScenario?.name}". What would you like to do?</DialogDescription></DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setShowReturnModal(false)}>Stay in What-if</Button>
            <Button variant="secondary" className="border border-amber-400 text-amber-700" onClick={() => { setActiveScenario(null); setShowReturnModal(false); setSelectedId('basecase'); }}>Discard Changes and Return</Button>
            <Button onClick={() => { if (activeScenario) handleRunScenario(activeScenario); setActiveScenario(null); setShowReturnModal(false); setSelectedId('basecase'); }}>Save and Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showPromoteModal && activeScenario && <PromoteModal scenario={activeScenario} onConfirm={handlePromote} onCancel={() => setShowPromoteModal(false)} />}
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
      <TooltipProvider><Tooltip>
        <TooltipTrigger asChild><div><Button size="lg" onClick={onNew} disabled={disabled}><Plus className="h-4 w-4 mr-2" /> New What-if</Button></div></TooltipTrigger>
        {disabled && <TooltipContent><p className="text-xs">Save or return to Basecase first.</p></TooltipContent>}
      </Tooltip></TooltipProvider>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// New What-if Form
// ═══════════════════════════════════════════════════════════════════════
function NewWhatIfForm({ newName, newComment, setNewName, setNewComment, onSubmit, onCancel }: {
  newName: string; newComment: string; setNewName: (v: string) => void; setNewComment: (v: string) => void; onSubmit: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md rounded-lg border border-primary/30 bg-primary/5 p-6 space-y-4">
        <h3 className="text-base font-semibold">New What-if</h3>
        <div>
          <Label className="text-xs">Name</Label>
          <Input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) onSubmit(); if (e.key === 'Escape') onCancel(); }} placeholder="e.g. Reduce Setup Times" className="h-9 mt-1" autoFocus />
        </div>
        <div>
          <Label className="text-xs">Comment (optional)</Label>
          <Textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Brief description" className="mt-1 text-sm min-h-[48px] resize-none" />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onSubmit} disabled={!newName.trim()}><Play className="h-3.5 w-3.5 mr-1" /> Start Editing</Button>
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
  const [activeTab, setActiveTab] = useState('general');
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-12 px-6 flex items-center gap-2 border-b border-border shrink-0">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Basecase</h2>
        <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px] ml-2">Read-only</Badge>
      </div>
      <div className="px-6 py-1.5 text-xs text-muted-foreground border-b border-border shrink-0">
        To edit Basecase data, use the Input screens in the main navigation.
      </div>
      <div className="border-b border-border shrink-0">
        <div className="flex px-6">
          {['general','labor','equipment','products','operations','ibom'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'general' && <ReadOnlyGeneralTab model={model} />}
        {activeTab === 'labor' && <ReadOnlyLaborTab model={model} />}
        {activeTab === 'equipment' && <ReadOnlyEquipmentTab model={model} />}
        {activeTab === 'products' && <ReadOnlyProductsTab model={model} />}
        {activeTab === 'operations' && <ReadOnlyOperationsTab model={model} />}
        {activeTab === 'ibom' && <ReadOnlyIBOMTab model={model} />}
      </div>
    </div>
  );
}

// ── Read-only helpers ──
function ReadOnlyTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead><tr className="bg-muted/50 text-muted-foreground">{headers.map(h => <th key={h} className="text-left p-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i} className="border-t border-border">{row.map((cell, j) => <td key={j} className={`p-2 ${j === 0 ? 'font-medium' : 'text-muted-foreground font-mono'}`}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function KVGrid({ items }: { items: { label: string; value: string | number }[] }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">{items.map(i => <div key={i.label}><span className="text-xs text-muted-foreground">{i.label}</span><p className="text-sm font-mono">{i.value}</p></div>)}</div>;
}

function ReadOnlyGeneralTab({ model }: { model: Model }) {
  const g = model.general;
  return <KVGrid items={[
    { label: 'Model Title', value: g.model_title || '—' }, { label: 'Author', value: g.author || '—' },
    { label: 'Ops Time Unit', value: g.ops_time_unit }, { label: 'MCT Time Unit', value: g.mct_time_unit },
    { label: 'Production Period', value: g.prod_period_unit }, { label: 'Conv1', value: g.conv1 },
    { label: 'Conv2', value: g.conv2 }, { label: 'Utilisation Limit', value: `${g.util_limit}%` },
    { label: 'Var Equip', value: `${g.var_equip}%` }, { label: 'Var Labor', value: `${g.var_labor}%` },
    { label: 'Var Prod', value: `${g.var_prod}%` },
  ]} />;
}

function ReadOnlyLaborTab({ model }: { model: Model }) {
  if (!model.labor.length) return <p className="text-sm text-muted-foreground">No labor groups.</p>;
  return <ReadOnlyTable headers={['Name', 'Count', 'OT%', 'Unavail%', 'Dept']} rows={model.labor.map(l => [l.name, l.count, l.overtime_pct, l.unavail_pct, l.dept_code || '—'])} />;
}

function ReadOnlyEquipmentTab({ model }: { model: Model }) {
  if (!model.equipment.length) return <p className="text-sm text-muted-foreground">No equipment.</p>;
  return <ReadOnlyTable headers={['Name', 'Type', 'Count', 'MTTF', 'MTTR', 'Unavail%']} rows={model.equipment.map(e => [e.name, e.equip_type, e.count, e.mttf, e.mttr, e.unavail_pct])} />;
}

function ReadOnlyProductsTab({ model }: { model: Model }) {
  if (!model.products.length) return <p className="text-sm text-muted-foreground">No products.</p>;
  return <ReadOnlyTable headers={['Name', 'Demand', 'Lot Size', 'TBatch', 'Dept']} rows={model.products.map(p => [p.name, p.demand, p.lot_size, p.tbatch_size, p.dept_code || '—'])} />;
}

function ReadOnlyOperationsTab({ model }: { model: Model }) {
  if (!model.operations.length) return <p className="text-sm text-muted-foreground">No operations.</p>;
  const pm = Object.fromEntries(model.products.map(p => [p.id, p.name]));
  const em = Object.fromEntries(model.equipment.map(e => [e.id, e.name]));
  return <ReadOnlyTable headers={['Product', 'Op#', 'Op Name', 'Equipment', 'Eq Setup/Lot', 'Eq Run/Pc']} rows={model.operations.map(o => [pm[o.product_id] || '—', o.op_number, o.op_name, em[o.equip_id] || '—', o.equip_setup_lot, o.equip_run_piece])} />;
}

function ReadOnlyIBOMTab({ model }: { model: Model }) {
  if (!model.ibom.length) return <p className="text-sm text-muted-foreground">No IBOM entries.</p>;
  const pm = Object.fromEntries(model.products.map(p => [p.id, p.name]));
  return <ReadOnlyTable headers={['Parent', 'Component', 'Units/Assy']} rows={model.ibom.map(b => [pm[b.parent_product_id] || '—', pm[b.component_product_id] || '—', b.units_per_assy])} />;
}

// ═══════════════════════════════════════════════════════════════════════
// Scenario View — the core of Prompt 2
// ═══════════════════════════════════════════════════════════════════════
function ScenarioView({
  model, modelId, scenario, isActive,
  onActivate, onDelete, onRename,
  onRunScenario, onSaveAs, onReturnToBasecase, onPromote, onRunAndView, userLevel,
}: {
  model: Model; modelId: string; scenario: Scenario; isActive: boolean;
  onActivate: () => void; onDelete: () => void;
  onRename: (id: string, name: string) => void;
  onRunScenario: (s: Scenario) => void; onSaveAs: (s: Scenario) => void;
  onReturnToBasecase: () => void; onPromote: () => void;
  onRunAndView: (s: Scenario) => void;
  userLevel: UserLevel;
  // Note: Delete button absent in active state, Promote moved to Changes tab
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(scenario.name);
  const [activeTab, setActiveTab] = useState('general');
  const { applyScenarioChange, removeChange } = useScenarioStore();

  useEffect(() => { setNameVal(scenario.name); setEditingName(false); }, [scenario.id]);

  const hasResults = useResultsStore.getState().getResults(scenario.id) != null;

  // Count changes per domain for dot indicators
  const changeCounts = useMemo(() => {
    const counts: Record<string, number> = { general: 0, labor: 0, equipment: 0, products: 0, operations: 0 };
    scenario.changes.forEach(c => {
      if (c.dataType === 'General') counts.general++;
      else if (c.dataType === 'Labor') counts.labor++;
      else if (c.dataType === 'Equipment') counts.equipment++;
      else if (c.dataType === 'Product') counts.products++;
      else counts.operations++;
    });
    return counts;
  }, [scenario.changes]);

  // Helper to get existing change value for a param
  const getWhatIfValue = useCallback((dataType: ScenarioChange['dataType'], entityId: string, field: string): string | number | null => {
    const change = scenario.changes.find(c => c.dataType === dataType && c.entityId === entityId && c.field === field);
    return change ? change.whatIfValue : null;
  }, [scenario.changes]);

  // Blur handler for What-if value cells
  const handleWhatIfBlur = useCallback((
    dataType: ScenarioChange['dataType'], entityId: string, entityName: string,
    field: string, fieldLabel: string, value: string, basecaseValue: number | string
  ) => {
    if (value === '' || value === String(basecaseValue)) {
      // Clear change if exists
      const existing = scenario.changes.find(c => c.dataType === dataType && c.entityId === entityId && c.field === field);
      if (existing) removeChange(scenario.id, existing.id);
      return;
    }
    const numVal = Number(value);
    if (!isNaN(numVal)) {
      applyScenarioChange(scenario.id, dataType, entityId, entityName, field, fieldLabel, numVal);
    }
  }, [scenario.id, scenario.changes, applyScenarioChange, removeChange]);

  // Status badge
  let statusBadge: React.ReactNode;
  if (isActive) {
    statusBadge = <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[10px]">● Active</Badge>;
  } else if (scenario.status === 'calculated') {
    statusBadge = <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px]">✓ Current</Badge>;
  } else if (hasResults) {
    statusBadge = <Badge variant="outline" className="border-amber-400 text-amber-600 text-[10px]">⚠ Stale</Badge>;
  } else {
    statusBadge = <Badge variant="secondary" className="text-[10px]">○ Not Run</Badge>;
  }

  const tabs = [
    { key: 'general', label: 'General' },
    { key: 'labor', label: 'Labor' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'products', label: 'Products' },
    { key: 'operations', label: 'Operations' },
    { key: 'changes', label: 'Changes' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── HEADER BAR — 48px ── */}
      <div className="h-12 px-6 flex items-center gap-3 border-b border-border shrink-0">
        {editingName ? (
          <Input value={nameVal} onChange={e => setNameVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { onRename(scenario.id, nameVal); setEditingName(false); } if (e.key === 'Escape') setEditingName(false); }}
            onBlur={() => { onRename(scenario.id, nameVal); setEditingName(false); }}
            className="h-8 text-base font-semibold max-w-xs" autoFocus />
        ) : (
          <h2 className="text-base font-semibold cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5"
            onClick={() => { setNameVal(scenario.name); setEditingName(true); }}>
            {scenario.name}
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </h2>
        )}
        {statusBadge}
        <div className="flex-1" />
        {isActive ? (
          <>
            <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => onRunScenario(scenario)}>
              <Save className="h-3.5 w-3.5 mr-1" /> Save What-if
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onSaveAs(scenario)}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Save As…
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onReturnToBasecase}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Return to Basecase
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => onRunAndView(scenario)}>
              <Play className="h-3.5 w-3.5 mr-1" /> Run & View Results
            </Button>
          </>
        ) : (
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

      {/* ── TAB BAR ── */}
      <div className="border-b border-border shrink-0">
        <div className="flex px-6">
          {tabs.map(tab => {
            const hasChanges = tab.key !== 'changes' && (changeCounts[tab.key] || 0) > 0;
            const isChangesTab = tab.key === 'changes';
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${activeTab === tab.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {tab.label}
                {isChangesTab && scenario.changes.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">({scenario.changes.length})</span>
                )}
                {hasChanges && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
                {activeTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isActive ? (
          <>
            {activeTab === 'general' && <EditableGeneralTab model={model} scenario={scenario} getWhatIfValue={getWhatIfValue} onBlur={handleWhatIfBlur} />}
            {activeTab === 'labor' && <EditableLaborTab model={model} scenario={scenario} getWhatIfValue={getWhatIfValue} onBlur={handleWhatIfBlur} />}
            {activeTab === 'equipment' && <EditableEquipmentTab model={model} scenario={scenario} getWhatIfValue={getWhatIfValue} onBlur={handleWhatIfBlur} />}
            {activeTab === 'products' && <EditableProductsTab model={model} scenario={scenario} getWhatIfValue={getWhatIfValue} onBlur={handleWhatIfBlur} />}
            {activeTab === 'operations' && <EditableOperationsTab model={model} scenario={scenario} getWhatIfValue={getWhatIfValue} onBlur={handleWhatIfBlur} />}
            {activeTab === 'changes' && <ChangesTab scenario={scenario} isActive={isActive} userLevel={userLevel} modelId={modelId} onPromote={onPromote} />}
          </>
        ) : (
          <>
            {activeTab === 'general' && <ReadOnlyGeneralTab model={model} />}
            {activeTab === 'labor' && <ReadOnlyLaborTab model={model} />}
            {activeTab === 'equipment' && <ReadOnlyEquipmentTab model={model} />}
            {activeTab === 'products' && <ReadOnlyProductsTab model={model} />}
            {activeTab === 'operations' && <ReadOnlyOperationsTab model={model} />}
            {activeTab === 'changes' && <ChangesTab scenario={scenario} isActive={isActive} userLevel={userLevel} modelId={modelId} onPromote={onPromote} />}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Editable What-if Cell
// ═══════════════════════════════════════════════════════════════════════
function WhatIfCell({ basecaseValue, whatIfValue, onBlur }: {
  basecaseValue: number | string;
  whatIfValue: string | number | null;
  onBlur: (value: string) => void;
}) {
  const [localVal, setLocalVal] = useState(whatIfValue != null ? String(whatIfValue) : '');
  useEffect(() => { setLocalVal(whatIfValue != null ? String(whatIfValue) : ''); }, [whatIfValue]);

  const hasChange = whatIfValue != null && String(whatIfValue) !== String(basecaseValue);

  return (
    <input
      type="number"
      value={localVal}
      onChange={e => setLocalVal(e.target.value)}
      onBlur={() => onBlur(localVal)}
      placeholder={String(basecaseValue)}
      className={`w-full text-right bg-transparent border rounded px-1.5 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 ${hasChange ? 'border-amber-400 bg-amber-500/5' : 'border-border'}`}
    />
  );
}

function DeltaCell({ basecaseValue, whatIfValue }: { basecaseValue: number | string; whatIfValue: string | number | null }) {
  if (whatIfValue == null) return <td className="p-2 text-right font-mono text-xs text-muted-foreground">—</td>;
  const base = Number(basecaseValue);
  const wi = Number(whatIfValue);
  if (isNaN(base) || isNaN(wi) || base === wi) return <td className="p-2 text-right font-mono text-xs text-muted-foreground">—</td>;
  const delta = wi - base;
  return (
    <td className="p-2 text-right font-mono text-xs">
      <span className={delta >= 0 ? 'text-emerald-600' : 'text-red-500'}>
        {delta >= 0 ? '+' : ''}{delta % 1 === 0 ? delta : delta.toFixed(2)}
      </span>
    </td>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Editable Param Table wrapper
// ═══════════════════════════════════════════════════════════════════════
interface ParamRow {
  dataType: ScenarioChange['dataType'];
  entityId: string;
  entityName: string;
  field: string;
  fieldLabel: string;
  basecaseValue: number;
}

function EditableParamTable({
  headers, rows, getWhatIfValue, onBlur,
}: {
  headers: string[];
  rows: ParamRow[];
  getWhatIfValue: (dt: ScenarioChange['dataType'], entityId: string, field: string) => string | number | null;
  onBlur: (dt: ScenarioChange['dataType'], entityId: string, entityName: string, field: string, fieldLabel: string, value: string, basecaseValue: number | string) => void;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            {headers.map(h => <th key={h} className="text-left p-2 font-medium">{h}</th>)}
            <th className="text-right p-2 font-medium">Basecase Value</th>
            <th className="text-right p-2 font-medium w-32">What-if Value</th>
            <th className="text-right p-2 font-medium w-20">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const wiVal = getWhatIfValue(r.dataType, r.entityId, r.field);
            return (
              <tr key={`${r.entityId}-${r.field}-${i}`} className={`border-t border-border ${wiVal != null ? 'bg-amber-500/5' : ''}`}>
                {/* Entity name + param cells — merged into the headers dynamically */}
                <td className="p-2 font-medium">{r.entityName}</td>
                {headers.length > 1 && <td className="p-2 text-muted-foreground">{r.fieldLabel}</td>}
                <td className="p-2 text-right font-mono text-muted-foreground">{r.basecaseValue}</td>
                <td className="p-2">
                  <WhatIfCell basecaseValue={r.basecaseValue} whatIfValue={wiVal}
                    onBlur={(val) => onBlur(r.dataType, r.entityId, r.entityName, r.field, r.fieldLabel, val, r.basecaseValue)} />
                </td>
                <DeltaCell basecaseValue={r.basecaseValue} whatIfValue={wiVal} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Editable Tab Implementations
// ═══════════════════════════════════════════════════════════════════════
type EditableTabProps = {
  model: Model; scenario: Scenario;
  getWhatIfValue: (dt: ScenarioChange['dataType'], entityId: string, field: string) => string | number | null;
  onBlur: (dt: ScenarioChange['dataType'], entityId: string, entityName: string, field: string, fieldLabel: string, value: string, basecaseValue: number | string) => void;
};

function EditableGeneralTab({ model, scenario, getWhatIfValue, onBlur }: EditableTabProps) {
  const g = model.general;
  const rows: ParamRow[] = [
    { dataType: 'General', entityId: 'general', entityName: 'General', field: 'conv1', fieldLabel: 'Conv1 (Shifts × Hours)', basecaseValue: g.conv1 },
    { dataType: 'General', entityId: 'general', entityName: 'General', field: 'conv2', fieldLabel: 'Conv2 (Days per Period)', basecaseValue: g.conv2 },
    { dataType: 'General', entityId: 'general', entityName: 'General', field: 'util_limit', fieldLabel: 'Utilisation Limit %', basecaseValue: g.util_limit },
    { dataType: 'General', entityId: 'general', entityName: 'General', field: 'var_equip', fieldLabel: 'Var Equip %', basecaseValue: g.var_equip },
    { dataType: 'General', entityId: 'general', entityName: 'General', field: 'var_labor', fieldLabel: 'Var Labor %', basecaseValue: g.var_labor },
    { dataType: 'General', entityId: 'general', entityName: 'General', field: 'var_prod', fieldLabel: 'Var Prod %', basecaseValue: g.var_prod },
  ];
  return <EditableParamTable headers={['Parameter', 'Detail']} rows={rows} getWhatIfValue={getWhatIfValue} onBlur={onBlur} />;
}

function EditableLaborTab({ model, scenario, getWhatIfValue, onBlur }: EditableTabProps) {
  if (!model.labor.length) return <p className="text-sm text-muted-foreground">No labor groups.</p>;
  const rows: ParamRow[] = model.labor.flatMap(l => [
    { dataType: 'Labor' as const, entityId: l.id, entityName: l.name, field: 'count', fieldLabel: 'No. in Group', basecaseValue: l.count },
    { dataType: 'Labor' as const, entityId: l.id, entityName: l.name, field: 'unavail_pct', fieldLabel: 'Unavailability %', basecaseValue: l.unavail_pct },
    { dataType: 'Labor' as const, entityId: l.id, entityName: l.name, field: 'overtime_pct', fieldLabel: 'Overtime %', basecaseValue: l.overtime_pct },
  ]);
  return <EditableParamTable headers={['Labor Group', 'Parameter']} rows={rows} getWhatIfValue={getWhatIfValue} onBlur={onBlur} />;
}

function EditableEquipmentTab({ model, scenario, getWhatIfValue, onBlur }: EditableTabProps) {
  if (!model.equipment.length) return <p className="text-sm text-muted-foreground">No equipment.</p>;
  const rows: ParamRow[] = model.equipment.flatMap(e => [
    { dataType: 'Equipment' as const, entityId: e.id, entityName: e.name, field: 'count', fieldLabel: 'No. in Group', basecaseValue: e.count },
    { dataType: 'Equipment' as const, entityId: e.id, entityName: e.name, field: 'unavail_pct', fieldLabel: 'Unavailability %', basecaseValue: e.unavail_pct },
    { dataType: 'Equipment' as const, entityId: e.id, entityName: e.name, field: 'setup_factor', fieldLabel: 'Setup Time Factor', basecaseValue: e.setup_factor },
    { dataType: 'Equipment' as const, entityId: e.id, entityName: e.name, field: 'run_factor', fieldLabel: 'Run Time Factor', basecaseValue: e.run_factor },
    { dataType: 'Equipment' as const, entityId: e.id, entityName: e.name, field: 'mttf', fieldLabel: 'MTTF', basecaseValue: e.mttf },
    { dataType: 'Equipment' as const, entityId: e.id, entityName: e.name, field: 'mttr', fieldLabel: 'MTTR', basecaseValue: e.mttr },
  ]);
  return <EditableParamTable headers={['Equipment Group', 'Parameter']} rows={rows} getWhatIfValue={getWhatIfValue} onBlur={onBlur} />;
}

function EditableProductsTab({ model, scenario, getWhatIfValue, onBlur }: EditableTabProps) {
  if (!model.products.length) return <p className="text-sm text-muted-foreground">No products.</p>;
  const rows: ParamRow[] = model.products.flatMap(p => [
    { dataType: 'Product' as const, entityId: p.id, entityName: p.name, field: 'demand', fieldLabel: 'Demand / Production Qty', basecaseValue: p.demand },
    { dataType: 'Product' as const, entityId: p.id, entityName: p.name, field: 'lot_size', fieldLabel: 'Lot Size', basecaseValue: p.lot_size },
    { dataType: 'Product' as const, entityId: p.id, entityName: p.name, field: 'tbatch_size', fieldLabel: 'Transfer Batch Size', basecaseValue: p.tbatch_size },
  ]);
  return <EditableParamTable headers={['Product', 'Parameter']} rows={rows} getWhatIfValue={getWhatIfValue} onBlur={onBlur} />;
}

function EditableOperationsTab({ model, scenario, getWhatIfValue, onBlur }: EditableTabProps) {
  if (!model.operations.length) return <p className="text-sm text-muted-foreground">No operations.</p>;
  const prodMap = Object.fromEntries(model.products.map(p => [p.id, p.name]));

  // Group by product
  const grouped = useMemo(() => {
    const map = new Map<string, typeof model.operations>();
    model.operations.forEach(o => {
      const list = map.get(o.product_id) || [];
      list.push(o);
      map.set(o.product_id, list);
    });
    return map;
  }, [model.operations]);

  const rows: ParamRow[] = [];
  grouped.forEach((ops, productId) => {
    ops.forEach(o => {
      const prefix = `${prodMap[productId] || '—'} · ${o.op_name}`;
      rows.push(
        { dataType: 'Equipment' as const, entityId: o.id, entityName: prefix, field: 'equip_setup_lot', fieldLabel: 'Equip Setup/Lot', basecaseValue: o.equip_setup_lot },
        { dataType: 'Equipment' as const, entityId: o.id, entityName: prefix, field: 'equip_run_piece', fieldLabel: 'Equip Run/Pc', basecaseValue: o.equip_run_piece },
        { dataType: 'Labor' as const, entityId: o.id, entityName: prefix, field: 'labor_setup_lot', fieldLabel: 'Labor Setup/Lot', basecaseValue: o.labor_setup_lot },
        { dataType: 'Labor' as const, entityId: o.id, entityName: prefix, field: 'labor_run_piece', fieldLabel: 'Labor Run/Pc', basecaseValue: o.labor_run_piece },
      );
    });
  });

  return <EditableParamTable headers={['Product · Operation', 'Parameter']} rows={rows} getWhatIfValue={getWhatIfValue} onBlur={onBlur} />;
}

// ═══════════════════════════════════════════════════════════════════════
// Changes Tab (audit trail)
// ═══════════════════════════════════════════════════════════════════════
function ChangesTab({ scenario, isActive, userLevel, modelId }: {
  scenario: Scenario; isActive: boolean; userLevel: UserLevel; modelId: string;
}) {
  const [directEdits, setDirectEdits] = useState(false);
  const { removeChange, updateChange, markNeedsRecalc } = useScenarioStore();
  const { updateLabor, updateEquipment, updateProduct, updateRouting } = useModelStore();

  const screenBadgeColor = (dt: string) => {
    if (dt === 'Labor') return 'bg-blue-100 text-blue-700';
    if (dt === 'Equipment') return 'bg-purple-100 text-purple-700';
    if (dt === 'Product') return 'bg-green-100 text-green-700';
    if (dt === 'General') return 'bg-amber-100 text-amber-700';
    return 'bg-muted text-muted-foreground';
  };

  const handleBasecaseEdit = (change: ScenarioChange, value: string) => {
    const numVal = Number(value);
    if (isNaN(numVal)) return;
    if (change.dataType === 'Labor') updateLabor(modelId, change.entityId, { [change.field]: numVal });
    else if (change.dataType === 'Equipment') updateEquipment(modelId, change.entityId, { [change.field]: numVal });
    else if (change.dataType === 'Product') updateProduct(modelId, change.entityId, { [change.field]: numVal });
    else if (change.dataType === 'Routing') updateRouting(modelId, change.entityId, { [change.field]: numVal });
  };

  const handleWhatIfEdit = (changeId: string, value: string) => {
    const numVal = Number(value);
    if (!isNaN(numVal)) {
      updateChange(scenario.id, changeId, numVal);
      markNeedsRecalc(scenario.id);
    }
  };

  if (scenario.changes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {isActive ? 'No changes yet. Edit values in the tabs above to build this What-if.' : 'No changes recorded.'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isActive && isVisible('allow_edit_whatif', userLevel) && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Allow Direct Edits</Label>
          <Switch checked={directEdits} onCheckedChange={setDirectEdits} className="scale-75" />
        </div>
      )}

      {directEdits && (
        <div className="flex items-start gap-2 rounded-md px-3 py-2 text-xs font-medium bg-destructive/10 text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Editing Basecase Value here permanently changes your model and cannot be undone.
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="text-left p-2 font-medium w-8">#</th>
              <th className="text-left p-2 font-medium">Domain</th>
              <th className="text-left p-2 font-medium">Resource</th>
              <th className="text-left p-2 font-medium">Parameter</th>
              <th className={`text-right p-2 font-medium ${directEdits ? 'bg-red-50' : ''}`}>Basecase Value</th>
              <th className="text-right p-2 font-medium">What-if Value</th>
              <th className="text-right p-2 font-medium">Change</th>
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
                    <span className={`inline-block text-[10px] font-medium rounded px-1.5 py-0.5 ${screenBadgeColor(c.dataType)}`}>{c.dataType}</span>
                  </td>
                  <td className="p-2 font-medium">{c.entityName}</td>
                  <td className="p-2 text-muted-foreground">{c.fieldLabel}</td>
                  <td className={`p-2 text-right font-mono ${directEdits ? 'bg-red-50/50' : ''}`}>
                    {directEdits ? (
                      <input type="number" defaultValue={c.basecaseValue}
                        onBlur={e => handleBasecaseEdit(c, e.target.value)}
                        className="w-full text-right bg-transparent border border-red-200 rounded px-1 py-0.5 font-mono text-xs focus:border-red-400 focus:outline-none" />
                    ) : (
                      <span className="text-muted-foreground">{c.basecaseValue}</span>
                    )}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {directEdits ? (
                      <input type="number" defaultValue={c.whatIfValue}
                        onBlur={e => handleWhatIfEdit(c.id, e.target.value)}
                        className="w-full text-right bg-transparent border border-border rounded px-1 py-0.5 font-mono text-xs focus:border-primary focus:outline-none" />
                    ) : (
                      <span className="font-semibold text-primary">{c.whatIfValue}</span>
                    )}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {delta !== null && delta !== 0 ? (
                      <span className={delta >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                        {delta >= 0 ? '+' : ''}{delta % 1 === 0 ? delta : delta.toFixed(2)}
                      </span>
                    ) : '—'}
                  </td>
                  {isActive && (
                    <td className="p-2">
                      <button onClick={() => removeChange(scenario.id, c.id)} className="text-muted-foreground hover:text-destructive transition-colors">
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
        <DialogHeader><DialogTitle>Delete "{scenario.name}"?</DialogTitle><DialogDescription>This will permanently remove this scenario and all its {scenario.changes.length} change{scenario.changes.length !== 1 ? 's' : ''}. This cannot be undone.</DialogDescription></DialogHeader>
        {needsTyping && <div className="space-y-2"><Label className="text-xs">Type the What-if name to confirm:</Label><Input value={typedName} onChange={e => setTypedName(e.target.value)} placeholder={scenario.name} className="h-8 font-mono" autoFocus /></div>}
        <DialogFooter><Button variant="outline" onClick={onCancel}>Cancel</Button><Button variant="destructive" onClick={onConfirm} disabled={!canDelete}>Delete Permanently</Button></DialogFooter>
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
          {scenario.changes.length === 0 ? <p className="text-sm text-muted-foreground">No changes recorded.</p> : (
            <div className="rounded-lg border border-border overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/50 text-muted-foreground text-xs sticky top-0">
                  <th className="text-left p-2 font-medium w-8">#</th><th className="text-left p-2 font-medium">Parameter</th>
                  <th className="text-left p-2 font-medium">Screen</th><th className="text-right p-2 font-medium">Basecase</th><th className="text-right p-2 font-medium">What-if</th>
                </tr></thead>
                <tbody>{scenario.changes.map((c, idx) => (
                  <tr key={c.id} className="border-t border-border text-xs">
                    <td className="p-2 text-muted-foreground">{idx + 1}</td>
                    <td className="p-2"><span className="font-medium">{c.entityName}</span> · {c.fieldLabel}</td>
                    <td className="p-2"><span className={`inline-block text-[10px] font-medium rounded px-1.5 py-0.5 ${screenBadgeColor(c.dataType)}`}>{c.dataType}</span></td>
                    <td className="p-2 text-right font-mono text-muted-foreground">{c.basecaseValue}</td>
                    <td className="p-2 text-right font-mono font-semibold text-primary">{c.whatIfValue}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
        <p className="text-sm font-bold text-red-600">This is permanent. Your Basecase data will be overwritten. This cannot be undone.</p>
        <div><Label className="text-xs">Type the What-if name to confirm:</Label><Input value={typedName} onChange={e => setTypedName(e.target.value)} placeholder={scenario.name} className="h-8 mt-1 font-mono max-w-sm" autoFocus /></div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} disabled={!canPromote} className="bg-amber-600 hover:bg-amber-700 text-white"><ArrowUpCircle className="h-4 w-4 mr-2" /> Promote to Basecase</Button>
        </div>
      </div>
    </div>
  );
}
