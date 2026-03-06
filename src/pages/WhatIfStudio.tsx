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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus, MoreVertical, Play, Save, ArrowUpCircle, RefreshCw, ArrowLeft, ChevronUp,
  FlaskConical, Shield, Pencil, Trash2, Copy, Eye, EyeOff, Lock, ChevronRight, ChevronDown,
  Users, Wrench, Package, AlertTriangle, Layers, Circle, CircleAlert, CircleCheck, Calendar,
} from 'lucide-react';
import { getScenarioColor } from '@/lib/scenarioColors';
import { toast } from 'sonner';
import { scenarioDb } from '@/lib/scenarioDb';
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
    applyScenarioChange, removeChange, promoteToBasecase, markCalculated,
    updateChange,
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
  const [showNewForm, setShowNewForm] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [familyParentId, setFamilyParentId] = useState('');
  const [familyCount, setFamilyCount] = useState(11);
  const [familyTemplate, setFamilyTemplate] = useState('{N}');
  const [familyStartYear, setFamilyStartYear] = useState(2025);
  const [familyStartMonth, setFamilyStartMonth] = useState(0);
  const [showFamilyRecords, setShowFamilyRecords] = useState(false);
  const [collapsedFamilies, setCollapsedFamilies] = useState<Set<string>>(new Set());

  // Family helpers
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const needsStartValue = familyTemplate.includes('{YYYY}') || familyTemplate.includes('{MMM}');

  const familyPreview = useMemo(() => {
    const names: string[] = [];
    for (let i = 0; i < Math.min(3, familyCount); i++) {
      let name = familyTemplate;
      name = name.replace(/{N}/g, String(i + 1));
      const monthIdx = (familyStartMonth + i) % 12;
      const yearOffset = Math.floor((familyStartMonth + i) / 12);
      name = name.replace(/{MMM}/g, months[monthIdx]);
      name = name.replace(/{YYYY}/g, String(familyStartYear + yearOffset));
      names.push(name);
    }
    if (familyCount > 3) names.push('...');
    return names;
  }, [familyTemplate, familyCount, familyStartYear, familyStartMonth]);

  // Group scenarios by family
  const familyGroups = useMemo(() => {
    const groups = new Map<string, Scenario[]>();
    const ungrouped: Scenario[] = [];
    scenarios.forEach(sc => {
      if (sc.familyId) {
        if (!groups.has(sc.familyId)) groups.set(sc.familyId, []);
        groups.get(sc.familyId)!.push(sc);
      } else {
        ungrouped.push(sc);
      }
    });
    return { groups, ungrouped };
  }, [scenarios]);

  // Auto-expand family that contains the active scenario
  useEffect(() => {
    if (activeScenarioId) {
      const activeSc = scenarios.find(s => s.id === activeScenarioId);
      if (activeSc?.familyId && collapsedFamilies.has(activeSc.familyId)) {
        setCollapsedFamilies(prev => {
          const next = new Set(prev);
          next.delete(activeSc.familyId!);
          return next;
        });
      }
    }
  }, [activeScenarioId]);

  if (!model || !modelId) return null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await createScenario(modelId, newName.trim());
    setActiveScenario(id);
    const nm = newName.trim();
    setNewName('');
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

  const handleRecalcAll = () => {
    const bcResults = calculate(model, null);
    setResults('basecase', bcResults);
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
    if (!activeScenarioId || !activeScenario) return;
    const nm = activeScenario.name;
    promoteToBasecase(activeScenarioId);
    setShowPromoteModal(false);
    toast.success(`Basecase updated from "${nm}". Run Full Calculate to see updated results.`);
  };

  const handleReturnToBasecase = () => {
    // Check if active scenario has unsaved changes (changes.length > 0 means edits exist)
    if (activeScenario && activeScenario.changes.length > 0) {
      setShowReturnModal(true);
    } else {
      setActiveScenario(null);
    }
  };

  const handleDeleteWithConfirmation = (scenarioId: string) => {
    setShowDeleteModal(scenarioId);
  };

  const handleSaveAs = async (scenario: Scenario) => {
    const newId = await duplicateScenario(scenario.id);
    setActiveScenario(newId);
    toast.success(`Saved as copy of "${scenario.name}"`);
  };

  const handleRename = (id: string) => {
    if (!renameValue.trim()) return;
    renameScenario(id, renameValue.trim());
    setRenamingId(null);
    toast.success('Scenario renamed');
  };

  const handleCreateFamily = async () => {
    if (!familyParentId) return;
    const parentSc = scenarios.find(s => s.id === familyParentId);
    if (!parentSc) return;
    const fId = crypto.randomUUID();
    useScenarioStore.getState().setScenarios(
      allScenarios.map(s => s.id === familyParentId ? { ...s, familyId: fId } : s)
    );
    for (let i = 0; i < familyCount; i++) {
      let nm = familyTemplate;
      nm = nm.replace(/{N}/g, String(i + 1));
      const mIdx = (familyStartMonth + i) % 12;
      const yOff = Math.floor((familyStartMonth + i) / 12);
      nm = nm.replace(/{MMM}/g, months[mIdx]);
      nm = nm.replace(/{YYYY}/g, String(familyStartYear + yOff));
      const newId = await createScenario(modelId, nm);
      parentSc.changes.forEach(c => {
        applyScenarioChange(newId, c.dataType, c.entityId, c.entityName, c.field, c.fieldLabel, c.whatIfValue);
      });
      useScenarioStore.getState().setScenarios(
        useScenarioStore.getState().scenarios.map(s => s.id === newId ? { ...s, familyId: fId } : s)
      );
    }
    useScenarioStore.getState().setScenarios(
      useScenarioStore.getState().scenarios.map(s => s.id === familyParentId ? { ...s, familyId: fId } : s)
    );
    setShowFamilyModal(false);
    toast.success(`Created family with ${familyCount} scenarios`);
  };

  const toggleFamilyCollapse = (familyId: string) => {
    setCollapsedFamilies(prev => {
      const next = new Set(prev);
      if (next.has(familyId)) next.delete(familyId); else next.add(familyId);
      return next;
    });
  };


  // Get active scenario's family
  const activeFamilyId = activeScenario?.familyId || null;
  const activeFamilyMembers = activeFamilyId
    ? scenarios.filter(s => s.familyId === activeFamilyId)
    : [];

  const renderScenarioItem = (sc: Scenario, indent = false) => (
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
          className={`w-full text-left rounded-md p-2.5 transition-colors group ${indent ? 'ml-4 w-[calc(100%-16px)]' : ''} ${
            activeScenarioId === sc.id
              ? 'bg-primary/10 border border-primary/30'
              : 'hover:bg-muted border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2">
            <FlaskConical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate flex-1">{sc.name}</span>
            <Badge className={`text-[10px] border-0 shrink-0 ${
              sc.status === 'calculated' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
            }`}>
              {sc.status === 'calculated' ? 'Calc' : 'Recalc'}
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
                {isVisible('whatif_families', userLevel) && !sc.familyId && (
                  <DropdownMenuItem onClick={() => { setFamilyParentId(sc.id); setShowFamilyModal(true); }}>
                    <Layers className="h-3.5 w-3.5 mr-2" /> Create Family
                  </DropdownMenuItem>
                )}
                {isVisible('whatif_families', userLevel) && sc.familyId && (
                  <DropdownMenuItem onClick={() => { setActiveScenario(sc.id); setShowFamilyRecords(true); }}>
                    <Layers className="h-3.5 w-3.5 mr-2" /> View Family Records
                  </DropdownMenuItem>
                )}
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
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold">What-if Studio</h1>
      </div>

      {/* Three-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — Scenario List (260px) */}
        <div className="w-[260px] shrink-0 border-r border-border flex flex-col">
          {/* Subheader */}
          <div className="h-9 flex items-center justify-between px-3 border-b border-border bg-muted/30 shrink-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Scenarios</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Shown</span>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto">
            {/* ── Basecase row (pinned first) ── */}
            <button
              onClick={() => { setActiveScenario(null); setShowFamilyRecords(false); }}
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

            {/* ── What-if rows ── */}
            {scenarios.map((sc, _i) => {
              // Determine stable colour index: position in the full scenario list for this model
              const colorIndex = scenarios.indexOf(sc);
              const dotColor = getScenarioColor(colorIndex);
              const isActive = activeScenarioId === sc.id;
              const isDisplayed = displayIds.includes(sc.id);

              // Status logic
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
                  {/* Colour dot */}
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: dotColor }}
                  />
                  {/* Name + optional family pill */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{sc.name}</span>
                    {isVisible('whatif_families', userLevel) && sc.familyId && (
                      <FamilyPillPopover
                        scenario={sc}
                        families={useScenarioStore.getState().families.filter(f => f.modelId === modelId)}
                      />
                    )}
                  </div>
                  {/* Status badge */}
                  {statusBadge}
                  {/* Eye toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleDisplayScenario(sc.id); }}
                    className="shrink-0 ml-1 text-muted-foreground hover:text-foreground transition-colors"
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
                      onClick={() => setShowNewForm(true)}
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

        {/* Centre Panel — Active Scenario (flex fill) */}
        {showFamilyRecords && activeScenario?.familyId ? (
          <div className="flex-1 border-r border-border flex flex-col overflow-y-auto">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowFamilyRecords(false)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Scenario
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <FamilyRecordsView
                familyMembers={scenarios.filter(s => s.familyId === activeScenario.familyId)}
                activeScenarioId={activeScenarioId}
                model={model}
                onClose={() => setShowFamilyRecords(false)}
                userLevel={userLevel}
              />
            </div>
          </div>
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
            onRemoveChange={removeChange}
            onPromote={() => setShowPromoteModal(true)}
            onRunScenario={handleRunScenario}
            onSaveAs={handleSaveAs}
            onDelete={handleDeleteWithConfirmation}
            onReturnToBasecase={handleReturnToBasecase}
            showCreateForm={showNewForm}
            newName={newName}
            setNewName={setNewName}
            onCreateSubmit={handleCreate}
            onCancelCreate={() => { setShowNewForm(false); setNewName(''); }}
            onShowNewForm={() => setShowNewForm(true)}
            userLevel={userLevel}
          />
        )}

        {/* Right Panel — Families (300px, Advanced only) */}
        {isVisible('whatif_families', userLevel) && (
          <FamiliesPanel
            modelId={modelId}
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            onShowFamilyRecords={(familyId) => {
              setShowFamilyRecords(true);
              // Store the familyId for the records view — find any member to select
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
        const needsTyping = scToDelete.changes.length > 5;
        const familyName = scToDelete.familyId ? 'a family' : null;
        return (
          <DeleteConfirmModal
            scenario={scToDelete}
            needsTyping={needsTyping}
            familyName={familyName}
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
              // Discard: just deactivate without saving
              setActiveScenario(null);
              setShowReturnModal(false);
            }}>Discard Changes and Return</Button>
            <Button onClick={() => {
              // Save first, then deactivate
              if (activeScenario) {
                handleRunScenario(activeScenario);
              }
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

      <Dialog open={showFamilyModal} onOpenChange={setShowFamilyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create What-If Family</DialogTitle>
            <DialogDescription>
              Group related scenarios for bulk editing and side-by-side comparison.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Number of additional scenarios</Label>
              <Input type="number" min={1} max={24} value={familyCount} onChange={e => setFamilyCount(Math.min(24, Math.max(1, +e.target.value)))} className="h-8 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Naming template</Label>
              <Input value={familyTemplate} onChange={e => setFamilyTemplate(e.target.value)} className="h-8 mt-1" placeholder="e.g. Month-{MMM}-{YYYY}" />
              <p className="text-[10px] text-muted-foreground mt-1">Use {'{N}'} for number, {'{YYYY}'} for year, {'{MMM}'} for month.</p>
            </div>
            {needsStartValue && (
              <div className="grid grid-cols-2 gap-2">
                {familyTemplate.includes('{YYYY}') && (
                  <div>
                    <Label className="text-xs">Start Year</Label>
                    <Input type="number" value={familyStartYear} onChange={e => setFamilyStartYear(+e.target.value)} className="h-8 mt-1" />
                  </div>
                )}
                {familyTemplate.includes('{MMM}') && (
                  <div>
                    <Label className="text-xs">Start Month</Label>
                    <select className="w-full h-8 border rounded px-2 text-xs bg-background mt-1" value={familyStartMonth} onChange={e => setFamilyStartMonth(+e.target.value)}>
                      {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
            <div className="bg-muted/30 rounded-md p-2">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Preview</p>
              <p className="text-xs font-mono">{familyPreview.join(', ')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFamilyModal(false)}>Cancel</Button>
            <Button onClick={handleCreateFamily}>Create Family</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Family Pill Popover ─────────────────────────────────────────────
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

// ─── Centre Panel ────────────────────────────────────────────────────
function CentrePanel({
  model, modelId, scenarios, activeScenarioId, activeScenario,
  setActiveScenario, onRename, onUpdateDescription, onRemoveChange,
  onPromote, onRunScenario, onSaveAs, onDelete, onReturnToBasecase,
  showCreateForm, newName, setNewName, onCreateSubmit, onCancelCreate, onShowNewForm,
  userLevel,
}: {
  model: any;
  modelId: string;
  scenarios: Scenario[];
  activeScenarioId: string | null;
  activeScenario: Scenario | null;
  setActiveScenario: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onUpdateDescription: (id: string, desc: string) => void;
  onRemoveChange: (scenarioId: string, changeId: string) => void;
  onPromote: () => void;
  onRunScenario: (scenario: Scenario) => void;
  onSaveAs: (scenario: Scenario) => void;
  onDelete: (id: string) => void;
  onReturnToBasecase: () => void;
  showCreateForm: boolean;
  newName: string;
  setNewName: (v: string) => void;
  onCreateSubmit: () => void;
  onCancelCreate: () => void;
  onShowNewForm: () => void;
  userLevel: UserLevel;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(activeScenario?.name || '');
  const [showChanges, setShowChanges] = useState(false);
  const [directEdits, setDirectEdits] = useState(false);
  const { updateChange, markNeedsRecalc } = useScenarioStore();
  const { updateLabor, updateEquipment, updateProduct, updateRouting } = useModelStore();

  // Sync nameVal when scenario changes
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
                <Textarea placeholder="Describe what you want to explore…" className="mt-1 text-sm min-h-[40px] resize-none" />
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
    if (!isNaN(numVal)) { updateChange(activeScenario.id, changeId, numVal); markNeedsRecalc(activeScenario.id); }
  };
  const handleBasecaseEdit = (change: ScenarioChange, value: string) => {
    const numVal = Number(value);
    if (isNaN(numVal)) return;
    if (change.dataType === 'Labor') updateLabor(model.id, change.entityId, { [change.field]: numVal });
    else if (change.dataType === 'Equipment') updateEquipment(model.id, change.entityId, { [change.field]: numVal });
    else if (change.dataType === 'Product') updateProduct(model.id, change.entityId, { [change.field]: numVal });
    else if (change.dataType === 'Routing') updateRouting(model.id, change.entityId, { [change.field]: numVal });
    markNeedsRecalc(activeScenario.id);
  };
  const getChangeDelta = (c: ScenarioChange) => {
    const base = Number(c.basecaseValue); const wi = Number(c.whatIfValue);
    if (isNaN(base) || isNaN(wi)) return null;
    return wi - base;
  };
  const screenBadgeColor = (dt: string) => {
    if (dt === 'Labor') return 'bg-blue-100 text-blue-700';
    if (dt === 'Equipment') return 'bg-purple-100 text-purple-700';
    if (dt === 'Product') return 'bg-green-100 text-green-700';
    return 'bg-muted text-muted-foreground';
  };

  const hasResults = useResultsStore.getState().getResults(activeScenario.id) != null;
  const lastCalcLabel = activeScenario.status === 'calculated' && activeScenario.updatedAt
    ? new Date(activeScenario.updatedAt).toLocaleString() : 'Never run';

  // ── Shared changes table ──
  const changesTable = (
    <div className="mt-3">
      {directEdits && (
        <div className="flex items-center gap-2 rounded-md px-3 py-2 mb-3 text-xs font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Editing Basecase Value here is permanent and cannot be undone.
        </div>
      )}
      {activeScenario.changes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No changes yet. Go to an Input screen and modify data to start building this What-if.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs">
                <th className="text-left p-2 font-medium w-8">#</th>
                <th className="text-left p-2 font-medium">Parameter</th>
                <th className="text-left p-2 font-medium">Screen</th>
                <th className={`text-right p-2 font-medium ${directEdits ? 'bg-red-50' : ''}`}>Basecase Value</th>
                <th className="text-right p-2 font-medium">What-if Value</th>
                <th className="text-right p-2 font-medium">Change</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {activeScenario.changes.map((c, idx) => {
                const delta = getChangeDelta(c);
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30 text-xs">
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
                    <td className={`p-2 text-right font-mono ${directEdits ? 'bg-red-50' : ''}`}>
                      {directEdits ? (
                        <input type="number" defaultValue={c.basecaseValue} onBlur={e => handleBasecaseEdit(c, e.target.value)}
                          className="w-20 text-right border border-red-300 bg-red-50 rounded px-1 py-0.5 text-xs font-mono focus:border-red-500 focus:outline-none" />
                      ) : (
                        <span className="text-muted-foreground">{c.basecaseValue}</span>
                      )}
                    </td>
                    <td className="p-2 text-right font-mono font-semibold text-primary">
                      {directEdits ? (
                        <input type="number" defaultValue={c.whatIfValue} onBlur={e => handleWhatIfEdit(c.id, e.target.value)}
                          className="w-20 text-right bg-primary/5 border border-primary/30 rounded px-1 py-0.5 text-xs font-mono font-semibold text-primary focus:border-primary focus:outline-none" />
                      ) : (
                        c.whatIfValue
                      )}
                    </td>
                    <td className="p-2 text-right font-mono text-xs">
                      {delta !== null ? (
                        <span className={delta >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                          {delta >= 0 ? '+' : ''}{delta % 1 === 0 ? delta : delta.toFixed(2)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-2">
                      <button onClick={() => onRemoveChange(activeScenario.id, c.id)} className="text-muted-foreground hover:text-destructive transition-colors">
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
        <ChevronUp className="h-3.5 w-3.5 mr-1" /> Collapse Changes
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

            <Textarea value={activeScenario.description} onChange={e => onUpdateDescription(activeScenario.id, e.target.value)}
              placeholder="Add a comment…" className="text-sm min-h-[48px] resize-none" />

            <div className="flex items-start gap-3 rounded-md px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(245,158,11,0.08)', color: '#92400E' }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
              <span>You are now editing this What-if. Go to any Input screen and make your changes. All edits will be recorded here automatically.</span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Changes ({activeScenario.changes.length})</h3>
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

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Lifecycle Actions</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => onRunScenario(activeScenario)}>
                <Save className="h-3.5 w-3.5 mr-1" /> Save What-if
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onSaveAs(activeScenario)}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Save As New What-if…
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

// 2D: Family Records View
function FamilyRecordsView({ familyMembers, activeScenarioId, model, onClose, userLevel }: {
  familyMembers: Scenario[];
  activeScenarioId: string | null;
  model: any;
  onClose: () => void;
  userLevel: UserLevel;
}) {
  const [editingEnabled, setEditingEnabled] = useState(false);
  const { updateChange, markNeedsRecalc } = useScenarioStore();
  const [clipboard, setClipboard] = useState<{ paramKey: string; values: Map<string, string | number> } | null>(null);

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

  const handleCopyRow = (paramKey: string) => {
    const values = new Map<string, string | number>();
    familyMembers.forEach(sc => {
      const change = sc.changes.find(c => `${c.dataType}|${c.entityId}|${c.field}` === paramKey);
      if (change) values.set(sc.id, change.whatIfValue);
    });
    setClipboard({ paramKey, values });
    toast.success('Row copied to clipboard');
  };

  const handlePasteRow = (paramKey: string) => {
    if (!clipboard) return;
    clipboard.values.forEach((value, scenarioId) => {
      const sc = familyMembers.find(s => s.id === scenarioId);
      if (!sc) return;
      const change = sc.changes.find(c => `${c.dataType}|${c.entityId}|${c.field}` === paramKey);
      if (change) {
        updateChange(sc.id, change.id, value);
        markNeedsRecalc(sc.id);
      }
    });
    toast.success('Values pasted');
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Family Records
          </h2>
          <p className="text-sm text-muted-foreground">{familyMembers.length} scenarios in this family</p>
        </div>
        <div className="flex items-center gap-3">
          {isVisible('allow_edit_whatif', userLevel) && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Enable Editing</Label>
              <Switch checked={editingEnabled} onCheckedChange={setEditingEnabled} className="scale-75" />
            </div>
          )}
        </div>
      </div>

      {editingEnabled && (
        <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium bg-destructive/10 text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Editing values here is permanent and cannot be undone.
        </div>
      )}

      {allParams.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No changes have been recorded in this family yet. Make changes to any scenario to see them here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="text-left p-2 font-medium sticky left-0 bg-muted/50 z-10">Parameter</th>
                {familyMembers.map(sc => (
                  <th
                    key={sc.id}
                    className={`text-right p-2 font-medium min-w-[100px] ${
                      sc.id === activeScenarioId ? 'bg-amber-500/15 text-amber-700' : ''
                    }`}
                  >
                    {sc.name}
                  </th>
                ))}
                {editingEnabled && <th className="p-2 w-16 text-center font-medium">Actions</th>}
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
                  {editingEnabled && (
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleCopyRow(key)} className="text-muted-foreground hover:text-primary transition-colors" title="Copy row">
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handlePasteRow(key)}
                          className={`transition-colors ${clipboard ? 'text-muted-foreground hover:text-primary' : 'text-muted-foreground/30 cursor-not-allowed'}`}
                          title="Paste row"
                          disabled={!clipboard}
                        >
                          <ClipboardPaste className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
    dataType: ScenarioChange['dataType'], entityId: string, entityName: string,
    field: string, fieldLabel: string, value: number | string,
  ) => {
    if (activeScenarioId) {
      applyScenarioChange(activeScenarioId, dataType, entityId, entityName, field, fieldLabel, value);
    } else {
      if (dataType === 'Labor') updateLabor(modelId, entityId, { [field]: value });
      else if (dataType === 'Equipment') updateEquipment(modelId, entityId, { [field]: value });
      else if (dataType === 'Product') updateProduct(modelId, entityId, { [field]: value });
      else if (dataType === 'Routing') updateRouting(modelId, entityId, { [field]: value });
    }
  };

  const getScrapRate = (productId: string) => {
    return model.routing.filter(r => r.product_id === productId && r.to_op_name === 'SCRAP').reduce((sum, r) => sum + r.pct_routed, 0);
  };

  const handleScrapRateEdit = (productId: string, productName: string, newRate: number) => {
    const scrapRoutes = model.routing.filter(r => r.product_id === productId && r.to_op_name === 'SCRAP');
    if (scrapRoutes.length === 0) { toast.error(`No SCRAP routing exists for ${productName}.`); return; }
    const currentTotal = scrapRoutes.reduce((s, r) => s + r.pct_routed, 0);
    const scale = currentTotal > 0 ? newRate / currentTotal : 1;
    scrapRoutes.forEach(r => {
      const newPct = Math.round(r.pct_routed * scale * 10) / 10;
      handleEdit('Routing', r.id, `${productName}: ${r.from_op_name}→SCRAP`, 'pct_routed', 'Routing %', newPct);
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
              { key: 'setup_factor', label: 'Setup F.', value: l.setup_factor },
              { key: 'run_factor', label: 'Run F.', value: l.run_factor },
              { key: 'var_factor', label: 'Var F.', value: l.var_factor },
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
              { key: 'run_factor', label: 'Run F.', value: e.run_factor },
              { key: 'var_factor', label: 'Var F.', value: e.var_factor },
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
        <div className="mt-3 pt-3 border-t border-border">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase mb-2">Scrap Rate</h4>
          <div className="rounded border border-border overflow-hidden text-xs">
            <table className="w-full">
              <thead><tr className="bg-muted/50 text-muted-foreground"><th className="text-left p-1.5 font-medium">Product</th><th className="text-right p-1.5 font-medium">Scrap %</th></tr></thead>
              <tbody>
                {model.products.filter(p => model.routing.some(r => r.product_id === p.id && r.to_op_name === 'SCRAP')).map(p => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-1.5 font-mono font-medium truncate max-w-[80px]">{p.name}</td>
                    <td className="p-1 text-right">
                      <input type="number" value={getScrapRate(p.id)} onChange={e => handleScrapRateEdit(p.id, p.name, Number(e.target.value))}
                        className="w-full text-right bg-transparent border rounded px-1 py-0.5 text-xs font-mono border-transparent hover:border-border focus:border-primary focus:outline-none" step="0.1" />
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
          <select className="w-full text-xs border rounded px-2 py-1 bg-background" value={routingProductId} onChange={e => setSelectedRoutingProduct(e.target.value)}>
            {model.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {routingEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2 text-center">No routing defined for {routingProduct?.name}</p>
        ) : (
          <div className="rounded border border-border overflow-hidden text-xs">
            <table className="w-full">
              <thead><tr className="bg-muted/50 text-muted-foreground"><th className="text-left p-1.5 font-medium">From→To</th><th className="text-right p-1.5 font-medium">%</th></tr></thead>
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
                        <input type="number" value={displayVal} onChange={e => handleEdit('Routing', r.id, entityName, 'pct_routed', 'Routing %', Number(e.target.value))}
                          className={`w-full text-right bg-transparent border rounded px-1 py-0.5 text-xs font-mono ${changed ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-transparent hover:border-border'} focus:border-primary focus:outline-none`} />
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

function QuickTable({ rows, dataType, onEdit, activeScenarioId }: {
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

  if (rows.length === 0) return <p className="text-xs text-muted-foreground p-2">No data</p>;

  const allFields = rows[0].fields;

  return (
    <div className="rounded border border-border overflow-hidden text-xs">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            <th className="text-left p-1.5 font-medium">Name</th>
            {allFields.map(f => <th key={f.key} className="text-right p-1.5 font-medium">{f.label}</th>)}
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
                    <input type="number" value={displayVal} onChange={e => onEdit(dataType, row.id, row.name, f.key, f.label, Number(e.target.value))}
                      className={`w-full text-right bg-transparent border rounded px-1 py-0.5 text-xs font-mono ${changed ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-transparent hover:border-border'} focus:border-primary focus:outline-none`} />
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

// ─── Delete Confirmation Modal ───────────────────────────────────────
function DeleteConfirmModal({ scenario, needsTyping, familyName, onConfirm, onCancel }: {
  scenario: Scenario;
  needsTyping: boolean;
  familyName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typedName, setTypedName] = useState('');
  const canDelete = needsTyping ? typedName === scenario.name : true;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete "{scenario.name}"?</DialogTitle>
          <DialogDescription>
            This will permanently remove this scenario and all its changes. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {familyName && (
            <div className="flex items-start gap-2 rounded-md px-3 py-2 text-xs" style={{ backgroundColor: 'rgba(245,158,11,0.08)', color: '#92400E' }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
              <span>This What-if is a member of {familyName}. Deleting it will remove it from the family.</span>
            </div>
          )}
          {needsTyping && (
            <div>
              <Label className="text-xs">Type the What-if name to confirm:</Label>
              <Input
                value={typedName}
                onChange={e => setTypedName(e.target.value)}
                placeholder={scenario.name}
                className="h-8 mt-1 font-mono"
                autoFocus
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!canDelete}>Delete Permanently</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Promote to Basecase Full-Screen Modal ───────────────────────────
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
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}>
            <AlertTriangle className="h-8 w-8" style={{ color: '#F59E0B' }} />
          </div>
          <h2 className="text-xl font-bold">Promote "{scenario.name}" to Basecase?</h2>
        </div>

        {/* Section 1: Changes */}
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

        {/* Section 2: Warning */}
        <p className="text-sm font-bold text-red-600">
          This action is permanent. Your current Basecase data will be overwritten. You cannot undo this.
        </p>

        {/* Section 3: Confirm by typing */}
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

        {/* Buttons */}
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
