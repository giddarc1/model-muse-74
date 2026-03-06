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
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus, MoreVertical, Play, Save, ArrowUpCircle, RefreshCw,
  FlaskConical, Shield, Pencil, Trash2, Copy, Eye, EyeOff, Lock, ChevronRight, ChevronDown,
  Users, Wrench, Package, AlertTriangle, Layers, Circle, CircleAlert, CircleCheck,
} from 'lucide-react';
import { getScenarioColor } from '@/lib/scenarioColors';
import { toast } from 'sonner';
import { scenarioDb } from '@/lib/scenarioDb';

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
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
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
    setNewName('');
    setShowNewModal(false);
    toast.success(`Scenario "${newName.trim()}" created`);
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
    if (!activeScenarioId) return;
    promoteToBasecase(activeScenarioId);
    setShowPromoteModal(false);
    toast.success('Scenario promoted to Basecase');
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
        <div className="w-[260px] shrink-0 border-r border-border flex flex-col overflow-y-auto">
          <div className="p-3 border-b border-border">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Scenario List</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {/* Basecase */}
            <button
              onClick={() => { setActiveScenario(null); setShowFamilyRecords(false); }}
              className={`w-full text-left rounded-md p-2.5 transition-colors ${
                activeScenarioId === null ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-semibold">Basecase</span>
                <Badge className="ml-auto bg-primary/20 text-primary text-[10px] border-0">BASE</Badge>
              </div>
            </button>

            <div className="mt-2 space-y-1">
              {familyGroups.ungrouped.map(sc => renderScenarioItem(sc))}

              {[...familyGroups.groups.entries()].map(([familyId, members]) => {
                const isCollapsed = collapsedFamilies.has(familyId);
                const familyName = members[0]?.name || 'Family';
                return (
                  <div key={familyId} className="border border-border/50 rounded-md overflow-hidden">
                    <button
                      onClick={() => toggleFamilyCollapse(familyId)}
                      className="w-full text-left p-2 flex items-center gap-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold truncate flex-1">{familyName}</span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{members.length}</Badge>
                    </button>
                    {!isCollapsed && (
                      <div className="border-l-2 border-primary/20 ml-2 space-y-0.5 py-0.5">
                        {members.map(sc => renderScenarioItem(sc, true))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button size="sm" className="w-full mt-3 h-8 text-xs" onClick={() => setShowNewModal(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New Scenario
            </Button>
          </div>
        </div>

        {/* Centre Panel — Active Scenario (flex fill) */}
        <div className="flex-1 border-r border-border flex flex-col overflow-y-auto">
          <div className="p-3 border-b border-border">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Scenario</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {showFamilyRecords && activeFamilyId ? (
              <FamilyRecordsView
                familyMembers={activeFamilyMembers}
                activeScenarioId={activeScenarioId}
                model={model}
                onClose={() => setShowFamilyRecords(false)}
                userLevel={userLevel}
              />
            ) : activeScenarioId === null ? (
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
                onSaveAs={handleSaveAs}
                userLevel={userLevel}
              />
            ) : (
              <div className="p-8 text-center text-muted-foreground">Select a scenario</div>
            )}
          </div>
        </div>

        {/* Right Panel — Families (300px, Advanced only) */}
        {isVisible('whatif_families', userLevel) && (
          <div className="w-[300px] shrink-0 flex flex-col overflow-y-auto">
            <div className="p-3 border-b border-border">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Families</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-sm text-muted-foreground text-center mt-8">Family management placeholder</p>
            </div>
          </div>
        )}
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

// 2C: Scenario Editor with Direct Edits
function ScenarioEditorPanel({
  scenario, model, onUpdateDescription, onRename, onRemoveChange, onPromote, onRunScenario, onSaveAs, userLevel,
}: {
  scenario: Scenario;
  model: any;
  onUpdateDescription: (id: string, desc: string) => void;
  onRename: (id: string, name: string) => void;
  onRemoveChange: (scenarioId: string, changeId: string) => void;
  onPromote: () => void;
  onRunScenario: (scenario: Scenario) => void;
  onSaveAs: (scenario: Scenario) => void;
  userLevel: UserLevel;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(scenario.name);
  const [directEdits, setDirectEdits] = useState(false);
  const { updateChange, markNeedsRecalc } = useScenarioStore();
  const { updateLabor, updateEquipment, updateProduct, updateRouting } = useModelStore();

  const handleWhatIfEdit = (changeId: string, value: string) => {
    const numVal = Number(value);
    if (!isNaN(numVal)) {
      updateChange(scenario.id, changeId, numVal);
      markNeedsRecalc(scenario.id);
    }
  };

  const handleBasecaseEdit = (change: ScenarioChange, value: string) => {
    const numVal = Number(value);
    if (isNaN(numVal)) return;
    // Update basecase model directly
    if (change.dataType === 'Labor') updateLabor(model.id, change.entityId, { [change.field]: numVal });
    else if (change.dataType === 'Equipment') updateEquipment(model.id, change.entityId, { [change.field]: numVal });
    else if (change.dataType === 'Product') updateProduct(model.id, change.entityId, { [change.field]: numVal });
    else if (change.dataType === 'Routing') updateRouting(model.id, change.entityId, { [change.field]: numVal });
    markNeedsRecalc(scenario.id);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input value={nameVal} onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { onRename(scenario.id, nameVal); setEditingName(false); } if (e.key === 'Escape') setEditingName(false); }}
                className="h-8 text-lg font-semibold" autoFocus />
              <Button size="sm" className="h-8" onClick={() => { onRename(scenario.id, nameVal); setEditingName(false); }}>Save</Button>
            </div>
          ) : (
            <h1 className="text-xl font-bold cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
              onClick={() => { setNameVal(scenario.name); setEditingName(true); }}>
              <FlaskConical className="h-5 w-5 text-primary" />
              {scenario.name}
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </h1>
          )}
          <Textarea value={scenario.description} onChange={e => onUpdateDescription(scenario.id, e.target.value)}
            placeholder="Add a description…" className="mt-2 text-sm min-h-[48px] resize-none" />
        </div>
        <Badge className={`ml-4 shrink-0 text-xs border-0 ${scenario.status === 'calculated' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
          {scenario.status === 'calculated' ? 'Calculated' : 'Needs Recalc'}
        </Badge>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-8 text-xs" onClick={() => onRunScenario(scenario)}>
          <Play className="h-3.5 w-3.5 mr-1" /> Run This Scenario
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onSaveAs(scenario)}>
          <Save className="h-3.5 w-3.5 mr-1" /> Save As
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onPromote}>
          <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Replace Basecase
        </Button>
      </div>

      {/* Changes List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Changes from Basecase ({scenario.changes.length})</h3>
          {/* 2C: Direct Edits Toggle - Advanced only */}
          {isVisible('allow_edit_whatif', userLevel) && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Direct Edits</Label>
              <Switch checked={directEdits} onCheckedChange={setDirectEdits} className="scale-75" />
            </div>
          )}
        </div>
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
                    <td className="p-2.5 text-right font-mono text-xs text-muted-foreground">
                      {directEdits ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <input
                                type="number"
                                defaultValue={c.basecaseValue}
                                onBlur={e => handleBasecaseEdit(c, e.target.value)}
                                className="w-20 text-right bg-warning/5 border border-warning/30 rounded px-1 py-0.5 text-xs font-mono focus:border-warning focus:outline-none"
                              />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs max-w-xs">
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-warning" />
                                Editing this permanently changes the Basecase model data.
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        c.basecaseValue
                      )}
                    </td>
                    <td className="p-2.5 text-right font-mono text-xs font-semibold text-primary">
                      {directEdits ? (
                        <input
                          type="number"
                          defaultValue={c.whatIfValue}
                          onBlur={e => handleWhatIfEdit(c.id, e.target.value)}
                          className="w-20 text-right bg-primary/5 border border-primary/30 rounded px-1 py-0.5 text-xs font-mono font-semibold text-primary focus:border-primary focus:outline-none"
                        />
                      ) : (
                        c.whatIfValue
                      )}
                    </td>
                    <td className="p-2.5">
                      <button onClick={() => onRemoveChange(scenario.id, c.id)} className="text-muted-foreground hover:text-destructive transition-colors">
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

// 2D: Family Records View
function FamilyRecordsView({ familyMembers, activeScenarioId, model, onClose, userLevel }: {
  familyMembers: Scenario[];
  activeScenarioId: string | null;
  model: any;
  onClose: () => void;
  userLevel: UserLevel;
}) {
  const [directEdits, setDirectEdits] = useState(false);
  const { updateChange, markNeedsRecalc } = useScenarioStore();

  // Collect all unique parameter keys across all family members
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
    // Copy the active scenario's value to all other members for this param
    const activeScenario = familyMembers.find(s => s.id === activeScenarioId);
    if (!activeScenario) return;
    const activeChange = activeScenario.changes.find(c => `${c.dataType}|${c.entityId}|${c.field}` === paramKey);
    if (!activeChange) return;
    familyMembers.forEach(sc => {
      if (sc.id === activeScenarioId) return;
      const change = sc.changes.find(c => `${c.dataType}|${c.entityId}|${c.field}` === paramKey);
      if (change) {
        updateChange(sc.id, change.id, activeChange.whatIfValue);
        markNeedsRecalc(sc.id);
      }
    });
    toast.success('Value copied to all family members');
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
              <Label className="text-xs text-muted-foreground">Direct Edits</Label>
              <Switch checked={directEdits} onCheckedChange={setDirectEdits} className="scale-75" />
            </div>
          )}
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>Close</Button>
        </div>
      </div>

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
                  <th key={sc.id} className={`text-right p-2 font-medium min-w-[100px] ${sc.id === activeScenarioId ? 'bg-primary/10 text-primary' : ''}`}>
                    {sc.name}
                  </th>
                ))}
                <th className="p-2 w-8"></th>
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
                      <td key={sc.id} className={`p-2 text-right font-mono ${sc.id === activeScenarioId ? 'bg-primary/5' : ''}`}>
                        {directEdits && change ? (
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
                  <td className="p-2">
                    <button onClick={() => handleCopyRow(key)} className="text-muted-foreground hover:text-primary transition-colors" title="Copy active value to all">
                      <Copy className="h-3 w-3" />
                    </button>
                  </td>
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
