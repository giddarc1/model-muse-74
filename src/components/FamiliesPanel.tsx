import { useState, useMemo } from 'react';
import { useScenarioStore, type Scenario, type ScenarioFamily } from '@/stores/scenarioStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus, ChevronDown, ChevronRight, Layers, X, ArrowLeft, ArrowRight,
  Circle, CircleCheck, CircleAlert,
} from 'lucide-react';
import { getScenarioColor } from '@/lib/scenarioColors';
import { toast } from 'sonner';

interface FamiliesTabContentProps {
  modelId: string;
  scenarios: Scenario[];
  activeScenarioId: string | null;
  onSelectScenario: (id: string) => void;
  onShowFamilyRecords: (familyId: string) => void;
}

export default function FamiliesTabContent({
  modelId, scenarios, activeScenarioId, onSelectScenario, onShowFamilyRecords,
}: FamiliesTabContentProps) {
  const families = useScenarioStore(s => s.families).filter(f => f.modelId === modelId);
  const { createFamily, createScenario, applyScenarioChange, addToFamily, removeFromFamily } = useScenarioStore();

  const [view, setView] = useState<'list' | 'create'>('list');
  const [step, setStep] = useState(1);
  const [familyName, setFamilyName] = useState('');
  const [familyDesc, setFamilyDesc] = useState('');
  const [memberCount, setMemberCount] = useState(3);
  const [namingMode, setNamingMode] = useState<'custom' | 'template'>('template');
  const [customNames, setCustomNames] = useState<string[]>([]);
  const [template, setTemplate] = useState('Scenario {N}');
  const [templateStart, setTemplateStart] = useState(1);

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const generatedNames = useMemo(() => {
    if (namingMode === 'custom') return customNames.slice(0, memberCount);
    const names: string[] = [];
    for (let i = 0; i < memberCount; i++) {
      let name = template;
      name = name.replace(/{N}/g, String(templateStart + i));
      name = name.replace(/{MMM}/g, months[i % 12]);
      names.push(name);
    }
    return names;
  }, [namingMode, customNames, memberCount, template, templateStart]);

  const familyMembers = useMemo(() => {
    const map = new Map<string, Scenario[]>();
    families.forEach(f => {
      map.set(f.id, scenarios.filter(s => s.familyId === f.id));
    });
    return map;
  }, [families, scenarios]);

  const ungrouped = scenarios.filter(s => !s.familyId);
  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || null;

  const resetCreate = () => {
    setStep(1); setFamilyName(''); setFamilyDesc(''); setMemberCount(3);
    setNamingMode('template'); setCustomNames([]); setTemplate('Scenario {N}'); setTemplateStart(1);
  };

  const handleCreateFamily = async () => {
    if (!activeScenario) return;
    const fId = createFamily(modelId, familyName.trim());
    addToFamily(activeScenario.id, fId);
    const allNames = generatedNames;
    for (const name of allNames) {
      const newId = await createScenario(modelId, name);
      activeScenario.changes.forEach(c => {
        applyScenarioChange(newId, c.dataType, c.entityId, c.entityName, c.field, c.fieldLabel, c.whatIfValue);
      });
      addToFamily(newId, fId);
    }
    resetCreate();
    setView('list');
    toast.success(`Created family "${familyName.trim()}" with ${allNames.length} members`);
  };

  // ─── Create Flow ───
  if (view === 'create') {
    return (
      <>
        <div className="flex-1 overflow-y-auto p-3">
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-3">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">Step {step} of 3</p>

          {step === 1 && (
            <div className="space-y-3">
              <div>
                <Label className="text-[11px]">Family name *</Label>
                <Input
                  value={familyName}
                  onChange={e => setFamilyName(e.target.value)}
                  placeholder="e.g. Monthly variations"
                  className="h-7 text-xs mt-1"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-[11px]">Description (optional)</Label>
                <Textarea
                  value={familyDesc}
                  onChange={e => setFamilyDesc(e.target.value)}
                  placeholder="Purpose of this family…"
                  className="mt-1 text-xs min-h-[50px] resize-none"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <Label className="text-[11px]">Number of members (1–50)</Label>
                <Input
                  type="number" min={1} max={50} value={memberCount}
                  onChange={e => {
                    const v = Math.min(50, Math.max(1, +e.target.value));
                    setMemberCount(v);
                    if (namingMode === 'custom') {
                      setCustomNames(prev => {
                        const arr = [...prev];
                        while (arr.length < v) arr.push('');
                        return arr.slice(0, v);
                      });
                    }
                  }}
                  className="h-7 mt-1 w-20 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Naming</Label>
                <div className="space-y-1">
                  <button
                    onClick={() => setNamingMode('custom')}
                    className={`w-full rounded border p-2 text-left text-[11px] transition-colors ${namingMode === 'custom' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                  >
                    <span className="font-medium">Custom names</span>
                  </button>
                  <button
                    onClick={() => setNamingMode('template')}
                    className={`w-full rounded border p-2 text-left text-[11px] transition-colors ${namingMode === 'template' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                  >
                    <span className="font-medium">Auto-generate</span>
                  </button>
                </div>
              </div>
              {namingMode === 'custom' && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {Array.from({ length: memberCount }).map((_, i) => (
                    <Input key={i} value={customNames[i] || ''}
                      onChange={e => { const arr = [...customNames]; arr[i] = e.target.value; setCustomNames(arr); }}
                      placeholder={`Member ${i + 1}`} className="h-6 text-[11px]" />
                  ))}
                </div>
              )}
              {namingMode === 'template' && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-[11px]">Template</Label>
                    <Input value={template} onChange={e => setTemplate(e.target.value)} placeholder="e.g. Scenario {N}" className="h-7 mt-1 text-xs" />
                    <p className="text-[9px] text-muted-foreground mt-0.5">{'{N}'} = number, {'{MMM}'} = month</p>
                  </div>
                  <div>
                    <Label className="text-[11px]">Starting value</Label>
                    <Input type="number" value={templateStart} onChange={e => setTemplateStart(+e.target.value)} className="h-7 mt-1 w-16 text-xs" />
                  </div>
                  <div className="bg-muted/40 rounded p-2">
                    <p className="text-[9px] text-muted-foreground uppercase font-semibold mb-1">Preview</p>
                    {generatedNames.slice(0, 3).map((n, i) => <p key={i} className="text-[11px] font-mono">{n}</p>)}
                    {memberCount > 3 && <p className="text-[10px] text-muted-foreground">… +{memberCount - 3} more</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="rounded border border-border p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Family</span>
                  <span className="font-medium">{familyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Members</span>
                  <span className="font-medium">{generatedNames.length} + active</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Names:</span>
                  <div className="mt-1 space-y-0.5">
                    {generatedNames.slice(0, 6).map((n, i) => (
                      <p key={i} className="text-[11px] font-mono bg-muted/30 rounded px-1.5 py-0.5">{n}</p>
                    ))}
                    {generatedNames.length > 6 && <p className="text-[10px] text-muted-foreground">… +{generatedNames.length - 6} more</p>}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Records from the active What-if will be copied to all members.</p>
            </div>
          )}
        </div>

        {/* Step navigation footer */}
        <div className="p-3 border-t border-border shrink-0 flex items-center justify-between">
          <div>
            {step > 1 ? (
              <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft className="h-3 w-3 mr-0.5" /> Back
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={() => { resetCreate(); setView('list'); }}>
                Cancel
              </Button>
            )}
          </div>
          <div>
            {step < 3 ? (
              <Button size="sm" className="h-7 text-[11px] px-3" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !familyName.trim()}>
                Next <ArrowRight className="h-3 w-3 ml-0.5" />
              </Button>
            ) : (
              <Button size="sm" className="h-7 text-[11px] px-3" onClick={handleCreateFamily} disabled={!activeScenarioId}>
                Create Family
              </Button>
            )}
          </div>
        </div>
      </>
    );
  }

  // ─── List View ───
  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {families.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <Layers className="h-7 w-7 text-muted-foreground/40 mb-2" />
            <p className="text-[13px] font-medium text-foreground">No families yet.</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">Group related What-ifs to manage them together.</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {families.map(family => {
              const members = familyMembers.get(family.id) || [];
              return (
                <FamilyCard
                  key={family.id}
                  family={family}
                  members={members}
                  allScenarios={scenarios}
                  activeScenarioId={activeScenarioId}
                  onSelectScenario={onSelectScenario}
                />
              );
            })}
          </div>
        )}

        {/* Ungrouped section */}
        {ungrouped.length > 0 && (
          <div className="px-2 pb-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 py-1.5">Ungrouped</p>
            {ungrouped.map((sc) => {
              const idx = scenarios.indexOf(sc);
              const dotColor = getScenarioColor(idx);
              const isActive = activeScenarioId === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => onSelectScenario(sc.id)}
                  className="w-full text-left px-2 py-1.5 flex items-center gap-1.5 text-xs rounded hover:bg-muted/50 transition-colors"
                >
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                  <span className="flex-1 truncate">{sc.name}</span>
                  {isActive && <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[9px] shrink-0">Active</Badge>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer — Create Family button */}
      <div className="p-3 border-t border-border shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => { resetCreate(); setView('create'); }}
                  disabled={!activeScenarioId}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Create Family
                </Button>
              </div>
            </TooltipTrigger>
            {!activeScenarioId && (
              <TooltipContent side="top">
                <p className="text-xs">Activate a What-if first.</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </>
  );
}

// ─── Family Card ──────────────────────────────────────────────────────
function FamilyCard({
  family, members, allScenarios, activeScenarioId, onSelectScenario,
}: {
  family: ScenarioFamily;
  members: Scenario[];
  allScenarios: Scenario[];
  activeScenarioId: string | null;
  onSelectScenario: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(family.name);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const { renameFamily, removeFromFamily, addToFamily } = useScenarioStore();

  const standaloneScenarios = allScenarios.filter(s => !s.familyId);

  const handleRename = () => {
    if (renameName.trim()) renameFamily(family.id, renameName.trim());
    setIsRenaming(false);
  };

  const handleAddSelected = () => {
    checkedIds.forEach(id => addToFamily(id, family.id));
    toast.success(`Added ${checkedIds.size} member(s)`);
    setCheckedIds(new Set());
    setShowAddMembers(false);
  };

  const getStatusBadge = (sc: Scenario) => {
    if (activeScenarioId === sc.id) return <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[8px] shrink-0 px-1">Active</Badge>;
    if (sc.status === 'calculated') return <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[8px] shrink-0 px-1">Calc</Badge>;
    return null;
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border border-border overflow-hidden bg-card">
        {/* Header — 36px */}
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-1.5 px-2 hover:bg-muted/30 transition-colors" style={{ height: 36 }}>
            {open ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            {isRenaming ? (
              <Input
                value={renameName}
                onChange={e => setRenameName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false); }}
                className="h-5 text-xs font-medium flex-1"
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="text-xs font-medium flex-1 truncate text-left"
                onDoubleClick={(e) => { e.stopPropagation(); setIsRenaming(true); setRenameName(family.name); }}
                title="Double-click to rename"
              >
                {family.name}
              </span>
            )}
            <Badge variant="secondary" className="text-[9px] shrink-0 px-1.5">
              {members.length}
            </Badge>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border">
            {members.length === 0 ? (
              <p className="text-[11px] text-muted-foreground px-2 py-2">
                No members yet. Add What-ifs below.
              </p>
            ) : (
              members.map((sc) => {
                const dotColor = getScenarioColor(allScenarios.indexOf(sc));
                return (
                  <div
                    key={sc.id}
                    className={`flex items-center gap-1.5 px-2 text-[11px] border-b border-border/30 last:border-0 cursor-pointer ${
                      activeScenarioId === sc.id ? 'bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                    style={{ height: 32 }}
                    onClick={() => onSelectScenario(sc.id)}
                  >
                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                    <span className="flex-1 truncate">{sc.name}</span>
                    {getStatusBadge(sc)}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromFamily(sc.id); toast.success(`Removed "${sc.name}"`); }}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove from family"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}

            {/* Add existing What-ifs */}
            {!showAddMembers ? (
              <button
                onClick={() => { setShowAddMembers(true); setCheckedIds(new Set()); }}
                className="w-full px-2 py-1.5 text-[10px] text-primary hover:bg-primary/5 transition-colors text-left font-medium border-t border-border/30"
              >
                <Plus className="h-3 w-3 inline mr-0.5" /> Add What-ifs
              </button>
            ) : (
              <div className="px-2 py-1.5 border-t border-border/30 space-y-1.5">
                {standaloneScenarios.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">All What-ifs are in a family.</p>
                ) : (
                  <div className="space-y-0.5 max-h-24 overflow-y-auto">
                    {standaloneScenarios.map(sc => (
                      <label key={sc.id} className="flex items-center gap-1.5 text-[11px] cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                        <Checkbox
                          checked={checkedIds.has(sc.id)}
                          onCheckedChange={(checked) => {
                            setCheckedIds(prev => { const n = new Set(prev); if (checked) n.add(sc.id); else n.delete(sc.id); return n; });
                          }}
                          className="h-3 w-3"
                        />
                        {sc.name}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-1">
                  <Button size="sm" className="h-5 text-[10px] px-2" onClick={handleAddSelected} disabled={checkedIds.size === 0}>
                    Add
                  </Button>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={() => setShowAddMembers(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
