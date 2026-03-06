import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useModelStore } from '@/stores/modelStore';
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
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Plus, Play, Save, ArrowUpCircle, ArrowLeft, ChevronUp,
  FlaskConical, Pencil, Trash2, Copy, Eye, EyeOff, Lock,
  Users, Wrench, Package, AlertTriangle, Layers, Circle, CircleAlert, CircleCheck, Calendar,
} from 'lucide-react';
import { getScenarioColor } from '@/lib/scenarioColors';
import { toast } from 'sonner';
import FamiliesPanel from '@/components/FamiliesPanel';

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
  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || null;

  const [newName, setNewName] = useState('');
  const [newComment, setNewComment] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showFamilyRecords, setShowFamilyRecords] = useState(false);

  if (!model || !modelId) return null;

  // ── Handlers ──
  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await createScenario(modelId, newName.trim(), newComment.trim());
    setActiveScenario(id);
    const nm = newName.trim();
    setNewName('');
    setNewComment('');
    setShowNewForm(false);
    toast.success(`What-if "${nm}" is now active. Go to any Input screen to make changes.`);
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
    toast.success(`Basecase updated from "${nm}". Run Full Calculate to see updated results.`);
  };

  const handleReturnToBasecase = () => {
    if (activeScenario && activeScenario.changes.length > 0) {
      setShowReturnModal(true);
    } else {
      setActiveScenario(null);
    }
  };

  const handleSaveAs = async (scenario: Scenario) => {
    const newId = await duplicateScenario(scenario.id);
    setActiveScenario(newId);
    toast.success(`Saved as copy of "${scenario.name}"`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold">What-if Studio</h1>
      </div>

      {/* Three-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ═══ Left Panel — Scenario List (260px) ═══ */}
        <LeftPanel
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          displayIds={displayIds}
          setActiveScenario={setActiveScenario}
          toggleDisplayScenario={toggleDisplayScenario}
          onShowNewForm={() => setShowNewForm(true)}
          userLevel={userLevel}
          modelId={modelId}
        />

        {/* ═══ Centre Panel ═══ */}
        {showFamilyRecords && activeScenario?.familyId ? (
          <FamilyRecordsView
            familyMembers={scenarios.filter(s => s.familyId === activeScenario.familyId)}
            activeScenarioId={activeScenarioId}
            model={model}
            onClose={() => setShowFamilyRecords(false)}
            userLevel={userLevel}
          />
        ) : (
          <CentrePanel
            model={model}
            modelId={modelId}
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            activeScenario={activeScenario}
            setActiveScenario={setActiveScenario}
            onRename={renameScenario}
            onUpdateDescription={updateScenarioDescription}
            onPromote={() => setShowPromoteModal(true)}
            onRunScenario={handleRunScenario}
            onSaveAs={handleSaveAs}
            onDelete={(id) => setShowDeleteModal(id)}
            onReturnToBasecase={handleReturnToBasecase}
            showCreateForm={showNewForm}
            newName={newName}
            newComment={newComment}
            setNewName={setNewName}
            setNewComment={setNewComment}
            onCreateSubmit={handleCreate}
            onCancelCreate={() => { setShowNewForm(false); setNewName(''); setNewComment(''); }}
            onShowNewForm={() => setShowNewForm(true)}
            userLevel={userLevel}
          />
        )}

        {/* ═══ Right Panel — Families (Advanced only) ═══ */}
        {isVisible('whatif_families', userLevel) && (
          <FamiliesPanel
            modelId={modelId}
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            onShowFamilyRecords={(familyId) => {
              setShowFamilyRecords(true);
              const member = scenarios.find(s => s.familyId === familyId);
              if (member) setActiveScenario(member.id);
            }}
          />
        )}
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && (() => {
        const scToDelete = scenarios.find(s => s.id === showDeleteModal);
        if (!scToDelete) return null;
        return (
          <DeleteConfirmModal
            scenario={scToDelete}
            onConfirm={() => { deleteScenario(showDeleteModal); setShowDeleteModal(null); toast.success(`"${scToDelete.name}" deleted`); }}
            onCancel={() => setShowDeleteModal(null)}
          />
        );
      })()}

      {/* ── Return to Basecase Modal ── */}
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
            }}>Discard Changes and Return</Button>
            <Button onClick={() => {
              if (activeScenario) handleRunScenario(activeScenario);
              setActiveScenario(null);
              setShowReturnModal(false);
            }}>Save and Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Promote to Basecase Full-Screen Modal ── */}
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
// Left Panel — Scenario List
// ═══════════════════════════════════════════════════════════════════════
function LeftPanel({
  scenarios, activeScenarioId, displayIds, setActiveScenario, toggleDisplayScenario,
  onShowNewForm, userLevel, modelId,
}: {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  displayIds: string[];
  setActiveScenario: (id: string | null) => void;
  toggleDisplayScenario: (id: string) => void;
  onShowNewForm: () => void;
  userLevel: UserLevel;
  modelId: string;
}) {
  return (
    <div className="w-[260px] shrink-0 border-r border-border flex flex-col">
      <div className="h-9 flex items-center justify-between px-3 border-b border-border bg-muted/30 shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Scenarios</span>
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Shown</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Basecase row (pinned) */}
        <button
          onClick={() => setActiveScenario(null)}
          className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-b border-border/50 ${
            activeScenarioId === null ? 'bg-primary/5' : 'hover:bg-muted/50'
          }`}
        >
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium flex-1 truncate">Basecase</span>
          {activeScenarioId === null ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 text-[10px] border-0 shrink-0">Active</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] shrink-0">Background</Badge>
          )}
          <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
        </button>

        {/* What-if rows */}
        {scenarios.map((sc) => {
          const colorIndex = scenarios.indexOf(sc);
          const dotColor = getScenarioColor(colorIndex);
          const isActive = activeScenarioId === sc.id;
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
              onClick={() => setActiveScenario(sc.id)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors group border-b border-border/30 ${
                isActive ? 'bg-primary/5' : 'hover:bg-muted/50'
              }`}
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block">{sc.name}</span>
                {isVisible('whatif_families', userLevel) && sc.familyId && (
                  <FamilyPillPopover
                    scenario={sc}
                    families={useScenarioStore.getState().families.filter(f => f.modelId === modelId)}
                  />
                )}
              </div>
              {statusBadge}
              {/* Eye toggle — controls chart display */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleDisplayScenario(sc.id); }}
                className="shrink-0 ml-1 text-muted-foreground hover:text-foreground transition-colors"
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

      {/* Bottom button */}
      <div className="p-3 border-t border-border shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={onShowNewForm}
                  disabled={activeScenarioId !== null}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> New What-if
                </Button>
              </div>
            </TooltipTrigger>
            {activeScenarioId !== null && (
              <TooltipContent side="top">
                <p className="text-xs">Return to Basecase before creating a new What-if</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Family Pill Popover
// ═══════════════════════════════════════════════════════════════════════
function FamilyPillPopover({ scenario, families }: {
  scenario: Scenario;
  families: { id: string; modelId: string; name: string }[];
}) {
  const { addToFamily, removeFromFamily } = useScenarioStore();
  const currentFamily = families.find(f => f.id === scenario.familyId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={e => e.stopPropagation()}
          className="inline-block mt-0.5 text-[9px] font-medium bg-accent text-accent-foreground rounded px-1.5 py-0.5 leading-none hover:bg-accent/80 transition-colors cursor-pointer"
        >
          {currentFamily?.name || 'Family'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-2" onClick={e => e.stopPropagation()}>
        <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 px-1">Assign to family</p>
        {families.map(f => (
          <button
            key={f.id}
            onClick={() => addToFamily(scenario.id, f.id)}
            className={`w-full text-left text-xs rounded px-2 py-1.5 hover:bg-muted transition-colors flex items-center gap-2 ${
              scenario.familyId === f.id ? 'bg-primary/10 text-primary font-medium' : ''
            }`}
          >
            <Layers className="h-3 w-3 shrink-0" />
            {f.name}
          </button>
        ))}
        {scenario.familyId && (
          <>
            <div className="border-t border-border my-1" />
            <button
              onClick={() => removeFromFamily(scenario.id)}
              className="w-full text-left text-xs rounded px-2 py-1.5 hover:bg-destructive/10 text-destructive transition-colors"
            >
              Remove from family
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Centre Panel
// ═══════════════════════════════════════════════════════════════════════
function CentrePanel({
  model, modelId, scenarios, activeScenarioId, activeScenario,
  setActiveScenario, onRename, onUpdateDescription, onPromote,
  onRunScenario, onSaveAs, onDelete, onReturnToBasecase,
  showCreateForm, newName, newComment, setNewName, setNewComment,
  onCreateSubmit, onCancelCreate, onShowNewForm, userLevel,
}: {
  model: any;
  modelId: string;
  scenarios: Scenario[];
  activeScenarioId: string | null;
  activeScenario: Scenario | null;
  setActiveScenario: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onUpdateDescription: (id: string, desc: string) => void;
  onPromote: () => void;
  onRunScenario: (scenario: Scenario) => void;
  onSaveAs: (scenario: Scenario) => void;
  onDelete: (id: string) => void;
  onReturnToBasecase: () => void;
  showCreateForm: boolean;
  newName: string;
  newComment: string;
  setNewName: (v: string) => void;
  setNewComment: (v: string) => void;
  onCreateSubmit: () => void;
  onCancelCreate: () => void;
  onShowNewForm: () => void;
  userLevel: UserLevel;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(activeScenario?.name || '');
  const [showChanges, setShowChanges] = useState(false);
  const [directEdits, setDirectEdits] = useState(false);
  const { updateChange, markNeedsRecalc, removeChange } = useScenarioStore();
  const { updateLabor, updateEquipment, updateProduct, updateRouting } = useModelStore();

  useEffect(() => {
    if (activeScenario) setNameVal(activeScenario.name);
    setShowChanges(false);
    setDirectEdits(false);
  }, [activeScenario?.id]);

  const isActive = activeScenarioId !== null && activeScenario?.id === activeScenarioId;

  // ── STATE A: Basecase selected (or inline create form) ──
  if (activeScenarioId === null) {
    const lastModified = model.updated_at ? new Date(model.updated_at).toLocaleDateString() : '—';
    return (
      <div className="flex-1 border-r border-border flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Scenario</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-lg border border-border p-5 bg-card">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Basecase</h2>
              <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px] ml-auto">Read-only</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                <span>{model.products?.length || 0} Products</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wrench className="h-3.5 w-3.5" />
                <span>{model.equipment?.length || 0} Equipment</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{model.labor?.length || 0} Labor Groups</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Modified {lastModified}</span>
              </div>
            </div>
          </div>

          {showCreateForm ? (
            <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-3">
              <h3 className="text-sm font-semibold">New What-if</h3>
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) onCreateSubmit(); if (e.key === 'Escape') onCancelCreate(); }}
                  placeholder="e.g. Higher demand scenario"
                  className="h-8 mt-1"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-xs">Comment (optional)</Label>
                <Textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Describe what you want to explore…"
                  className="mt-1 text-sm min-h-[40px] resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={onCreateSubmit} disabled={!newName.trim()}>
                  <Play className="h-3.5 w-3.5 mr-1" /> Start Editing
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onCancelCreate}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-8">
              <h3 className="text-sm font-semibold mb-1">What-if Scenarios</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {scenarios.length} saved What-if{scenarios.length !== 1 ? 's' : ''}
              </p>
              <Button onClick={onShowNewForm} className="h-10 text-sm px-6">
                <Plus className="h-4 w-4 mr-2" /> New What-if
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!activeScenario) {
    return (
      <div className="flex-1 border-r border-border flex items-center justify-center text-muted-foreground">
        Select a scenario
      </div>
    );
  }

  // Helpers
  const handleWhatIfEdit = (changeId: string, value: string) => {
    const numVal = Number(value);
    if (!isNaN(numVal)) {
      updateChange(activeScenario.id, changeId, numVal);
      markNeedsRecalc(activeScenario.id);
    }
  };

  const handleBasecaseEdit = (change: ScenarioChange, value: string) => {
    const numVal = Number(value);
    if (isNaN(numVal)) return;
    // Permanently update basecase model data
    if (change.dataType === 'Labor') updateLabor(modelId, change.entityId, { [change.field]: numVal });
    else if (change.dataType === 'Equipment') updateEquipment(modelId, change.entityId, { [change.field]: numVal });
    else if (change.dataType === 'Product') updateProduct(modelId, change.entityId, { [change.field]: numVal });
    else if (change.dataType === 'Routing') updateRouting(modelId, change.entityId, { [change.field]: numVal });
  };

  const screenBadgeColor = (dt: string) => {
    if (dt === 'Labor') return 'bg-blue-100 text-blue-700';
    if (dt === 'Equipment') return 'bg-purple-100 text-purple-700';
    if (dt === 'Product') return 'bg-green-100 text-green-700';
    if (dt === 'General') return 'bg-amber-100 text-amber-700';
    return 'bg-muted text-muted-foreground';
  };

  const getChangeDelta = (c: ScenarioChange) => {
    const base = Number(c.basecaseValue);
    const wi = Number(c.whatIfValue);
    if (isNaN(base) || isNaN(wi)) return null;
    return wi - base;
  };

  const lastCalcLabel = activeScenario.status === 'calculated'
    ? `Calculated ${new Date(activeScenario.updatedAt).toLocaleString()}`
    : activeScenario.changes.length > 0 ? 'Needs recalculation' : 'Not yet run';

  // ── Records Table (shared between STATE B and STATE C) ──
  const changesTable = (
    <div className="mt-2 space-y-2">
      {directEdits && (
        <div className="flex items-start gap-2 rounded-md px-3 py-2 text-xs font-medium bg-destructive/10 text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Editing Basecase Value here permanently changes your model and cannot be undone.
        </div>
      )}
      {activeScenario.changes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No changes yet. Go to an Input screen and make changes to start building this What-if.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="text-left p-2 font-medium w-8">#</th>
                <th className="text-left p-2 font-medium">Parameter</th>
                <th className="text-left p-2 font-medium">Screen</th>
                <th className={`text-right p-2 font-medium ${directEdits ? 'bg-red-50' : ''}`}>Basecase</th>
                <th className="text-right p-2 font-medium">What-if</th>
                <th className="text-right p-2 font-medium">Change</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {activeScenario.changes.map((c, idx) => {
                const delta = getChangeDelta(c);
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-2 text-muted-foreground">{idx + 1}</td>
                    <td className="p-2">
                      <span className="font-medium">{c.entityName}</span>
                      <span className="text-muted-foreground"> · {c.fieldLabel}</span>
                    </td>
                    <td className="p-2">
                      <span className={`inline-block text-[10px] font-medium rounded px-1.5 py-0.5 ${screenBadgeColor(c.dataType)}`}>
                        {c.dataType}
                      </span>
                    </td>
                    <td className={`p-2 text-right font-mono ${directEdits ? 'bg-red-50/50' : ''}`}>
                      {directEdits ? (
                        <input
                          type="number"
                          defaultValue={c.basecaseValue}
                          onBlur={e => handleBasecaseEdit(c, e.target.value)}
                          className="w-full text-right bg-transparent border border-red-200 rounded px-1 py-0.5 font-mono text-xs focus:border-red-400 focus:outline-none"
                        />
                      ) : (
                        <span className="text-muted-foreground">{c.basecaseValue}</span>
                      )}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {directEdits ? (
                        <input
                          type="number"
                          defaultValue={c.whatIfValue}
                          onBlur={e => handleWhatIfEdit(c.id, e.target.value)}
                          className="w-full text-right bg-transparent border border-border rounded px-1 py-0.5 font-mono text-xs focus:border-primary focus:outline-none"
                        />
                      ) : (
                        <span className="font-semibold text-primary">{c.whatIfValue}</span>
                      )}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {delta !== null ? (
                        <span className={delta >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                          {delta >= 0 ? '+' : ''}{delta % 1 === 0 ? delta : delta.toFixed(2)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-2">
                      <button onClick={() => removeChange(activeScenario.id, c.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Button variant="ghost" size="sm" className="mt-2 text-xs text-muted-foreground" onClick={() => setShowChanges(false)}>
        <ChevronUp className="h-3.5 w-3.5 mr-1" /> Collapse
      </Button>
    </div>
  );

  // ── STATE C: Active scenario ──
  if (isActive) {
    return (
      <div className="flex-1 border-r border-border flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Scenario</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="border-l-4 border-amber-400 p-6 space-y-5">
            {/* Name (editable on click) */}
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input value={nameVal} onChange={e => setNameVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { onRename(activeScenario.id, nameVal); setEditingName(false); } if (e.key === 'Escape') setEditingName(false); }}
                  className="h-9 text-xl font-bold" autoFocus />
              </div>
            ) : (
              <h1 className="text-xl font-bold cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
                onClick={() => { setNameVal(activeScenario.name); setEditingName(true); }}>
                {activeScenario.name}
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </h1>
            )}

            {/* Comment (auto-saves on blur) */}
            <Textarea
              value={activeScenario.description}
              onBlur={e => onUpdateDescription(activeScenario.id, e.target.value)}
              onChange={e => onUpdateDescription(activeScenario.id, e.target.value)}
              placeholder="Add a comment…"
              className="text-sm min-h-[48px] resize-none"
            />

            {/* Amber info box */}
            <div className="flex items-start gap-3 rounded-md px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(245,158,11,0.08)', color: '#92400E' }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
              <span>What-if mode is active. Go to any Input screen — Labor, Equipment, Products, or General Data — and make your changes there. Every change you make will be automatically recorded here.</span>
            </div>

            {/* Live change count + View/Edit Changes */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{activeScenario.changes.length} change{activeScenario.changes.length !== 1 ? 's' : ''} recorded</h3>
                <div className="flex items-center gap-2">
                  {isVisible('allow_edit_whatif', userLevel) && showChanges && (
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Allow Direct Edits</Label>
                      <Switch checked={directEdits} onCheckedChange={setDirectEdits} className="scale-75" />
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowChanges(!showChanges)}>
                    {showChanges ? 'Hide' : 'View / Edit Changes'}
                  </Button>
                </div>
              </div>
              {showChanges && changesTable}
            </div>

            {/* Lifecycle Actions divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Lifecycle Actions</span>
              </div>
            </div>

            {/* Lifecycle action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => onRunScenario(activeScenario)}>
                <Save className="h-3.5 w-3.5 mr-1" /> Save What-if
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onSaveAs(activeScenario)}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Save As New…
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onReturnToBasecase}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Return to Basecase
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-amber-400 text-amber-700 hover:bg-amber-50" onClick={onPromote}>
                <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Promote to Basecase
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── STATE B: Selected but not active ──
  return (
    <div className="flex-1 border-r border-border flex flex-col overflow-y-auto">
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Scenario</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {editingName ? (
          <div className="flex items-center gap-2">
            <Input value={nameVal} onChange={e => setNameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { onRename(activeScenario.id, nameVal); setEditingName(false); } if (e.key === 'Escape') setEditingName(false); }}
              className="h-9 text-lg font-semibold" autoFocus />
          </div>
        ) : (
          <h1 className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
            onClick={() => { setNameVal(activeScenario.name); setEditingName(true); }}>
            {activeScenario.name}
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </h1>
        )}

        <Textarea value={activeScenario.description}
          onBlur={e => onUpdateDescription(activeScenario.id, e.target.value)}
          onChange={e => onUpdateDescription(activeScenario.id, e.target.value)}
          placeholder="Add a comment…" className="text-sm min-h-[48px] resize-none" />

        <div className="flex items-center gap-3">
          <Badge className={`text-[10px] border-0 ${activeScenario.status === 'calculated' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
            {activeScenario.status === 'calculated' ? 'Current' : 'Not Run'}
          </Badge>
          <span className="text-xs text-muted-foreground">{lastCalcLabel}</span>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Changes ({activeScenario.changes.length})</h3>
            {activeScenario.changes.length > 0 && (
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowChanges(!showChanges)}>
                {showChanges ? 'Hide Changes' : 'View All Changes'}
              </Button>
            )}
          </div>
          {showChanges && changesTable}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" className="h-8 text-xs" onClick={() => setActiveScenario(activeScenario.id)}>
            <Play className="h-3.5 w-3.5 mr-1" /> Activate for Editing
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive"
            onClick={() => onDelete(activeScenario.id)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Family Records View
// ═══════════════════════════════════════════════════════════════════════
function FamilyRecordsView({ familyMembers, activeScenarioId, model, onClose, userLevel }: {
  familyMembers: Scenario[];
  activeScenarioId: string | null;
  model: any;
  onClose: () => void;
  userLevel: UserLevel;
}) {
  const [editingEnabled, setEditingEnabled] = useState(false);
  const { updateChange, markNeedsRecalc } = useScenarioStore();

  const allParams = useMemo(() => {
    const paramMap = new Map<string, { dataType: string; entityId: string; entityName: string; field: string; fieldLabel: string }>();
    familyMembers.forEach(sc => {
      sc.changes.forEach(c => {
        const key = `${c.dataType}|${c.entityId}|${c.field}`;
        if (!paramMap.has(key)) {
          paramMap.set(key, { dataType: c.dataType, entityId: c.entityId, entityName: c.entityName, field: c.field, fieldLabel: c.fieldLabel });
        }
      });
    });
    return [...paramMap.entries()];
  }, [familyMembers]);

  const handleEdit = (scenarioId: string, changeId: string, value: string) => {
    const numVal = Number(value);
    if (!isNaN(numVal)) {
      updateChange(scenarioId, changeId, numVal);
      markNeedsRecalc(scenarioId);
    }
  };

  return (
    <div className="flex-1 border-r border-border flex flex-col overflow-y-auto">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Scenario
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> Family Records
            </h2>
            <p className="text-sm text-muted-foreground">{familyMembers.length} scenarios in this family</p>
          </div>
          {isVisible('allow_edit_whatif', userLevel) && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Enable Editing</Label>
              <Switch checked={editingEnabled} onCheckedChange={setEditingEnabled} className="scale-75" />
            </div>
          )}
        </div>

        {editingEnabled && (
          <div className="flex items-start gap-2 rounded-md px-3 py-2 text-xs font-medium bg-destructive/10 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Editing values here is permanent and cannot be undone.
          </div>
        )}

        {allParams.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No changes have been recorded in this family yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left p-2 font-medium sticky left-0 bg-muted/50 z-10">Parameter</th>
                  {familyMembers.map(sc => (
                    <th key={sc.id} className={`text-right p-2 font-medium min-w-[100px] ${sc.id === activeScenarioId ? 'bg-amber-500/15 text-amber-700' : ''}`}>
                      {sc.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allParams.map(([key, param]) => (
                  <tr key={key} className="border-t border-border hover:bg-muted/20">
                    <td className="p-2 font-mono sticky left-0 bg-background z-10">
                      <span className="text-muted-foreground">{param.entityName}</span>
                      <span className="mx-1">·</span>
                      <span>{param.fieldLabel}</span>
                    </td>
                    {familyMembers.map(sc => {
                      const change = sc.changes.find(c => `${c.dataType}|${c.entityId}|${c.field}` === key);
                      return (
                        <td key={sc.id} className={`p-2 text-right font-mono ${sc.id === activeScenarioId ? 'bg-amber-500/5' : ''}`}>
                          {editingEnabled && change ? (
                            <input
                              type="number"
                              defaultValue={change.whatIfValue}
                              onBlur={e => handleEdit(sc.id, change.id, e.target.value)}
                              className="w-full text-right bg-transparent border border-border rounded px-1 py-0.5 font-mono focus:border-primary focus:outline-none"
                            />
                          ) : (
                            <span className={change ? 'font-semibold text-primary' : 'text-muted-foreground'}>
                              {change ? change.whatIfValue : '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}
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

// ═══════════════════════════════════════════════════════════════════════
// Delete Confirmation Modal (Fix 7)
// ═══════════════════════════════════════════════════════════════════════
function DeleteConfirmModal({ scenario, onConfirm, onCancel }: {
  scenario: Scenario;
  onConfirm: () => void;
  onCancel: () => void;
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
            <Input
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder={scenario.name}
              className="h-8 font-mono"
              autoFocus
            />
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
// Promote to Basecase Full-Screen Modal (Fix 6)
// ═══════════════════════════════════════════════════════════════════════
function PromoteModal({ scenario, onConfirm, onCancel }: {
  scenario: Scenario;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typedName, setTypedName] = useState('');
  const canPromote = typedName === scenario.name;

  const getChangeDelta = (c: ScenarioChange) => {
    const base = Number(c.basecaseValue); const wi = Number(c.whatIfValue);
    if (isNaN(base) || isNaN(wi)) return null;
    return wi - base;
  };
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
          <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}>
            <AlertTriangle className="h-8 w-8" style={{ color: '#F59E0B' }} />
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
                    <th className="text-right p-2 font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {scenario.changes.map((c, idx) => {
                    const delta = getChangeDelta(c);
                    return (
                      <tr key={c.id} className="border-t border-border text-xs">
                        <td className="p-2 text-muted-foreground">{idx + 1}</td>
                        <td className="p-2">
                          <span className="font-medium">{c.entityName}</span>
                          <span className="text-muted-foreground"> · {c.fieldLabel}</span>
                        </td>
                        <td className="p-2">
                          <span className={`inline-block text-[10px] font-medium rounded px-1.5 py-0.5 ${screenBadgeColor(c.dataType)}`}>
                            {c.dataType}
                          </span>
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
                      </tr>
                    );
                  })}
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
          <Input
            value={typedName}
            onChange={e => setTypedName(e.target.value)}
            placeholder={scenario.name}
            className="h-8 mt-1 font-mono max-w-sm"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={!canPromote}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <ArrowUpCircle className="h-4 w-4 mr-2" /> Promote to Basecase
          </Button>
        </div>
      </div>
    </div>
  );
}
