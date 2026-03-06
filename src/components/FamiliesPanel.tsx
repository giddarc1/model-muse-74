import { useState, useMemo } from 'react';
import { useScenarioStore, type Scenario, type ScenarioChange, type ScenarioFamily } from '@/stores/scenarioStore';
import { useUserLevelStore, isVisible } from '@/hooks/useUserLevel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, ChevronDown, ChevronRight, GripVertical, Layers, AlertTriangle,
  ArrowLeft, ArrowRight, Copy, X, Eye,
} from 'lucide-react';
import { getScenarioColor } from '@/lib/scenarioColors';
import { toast } from 'sonner';

interface FamiliesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
  scenarios: Scenario[];
  activeScenarioId: string | null;
  onShowFamilyRecords: (familyId: string) => void;
}

export default function FamiliesDrawer({
  open, onOpenChange, modelId, scenarios, activeScenarioId, onShowFamilyRecords,
}: FamiliesDrawerProps) {
  const families = useScenarioStore(s => s.families).filter(f => f.modelId === modelId);
  const { createFamily, createScenario, applyScenarioChange, addToFamily, removeFromFamily, renameFamily, deleteFamily } = useScenarioStore();
  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || null;

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

  const previewNames = generatedNames.slice(0, 3);
  const allNames = generatedNames;

  const familyMembers = useMemo(() => {
    const map = new Map<string, Scenario[]>();
    families.forEach(f => {
      map.set(f.id, scenarios.filter(s => s.familyId === f.id));
    });
    return map;
  }, [families, scenarios]);

  const resetCreate = () => {
    setStep(1); setFamilyName(''); setFamilyDesc(''); setMemberCount(3);
    setNamingMode('template'); setCustomNames([]); setTemplate('Scenario {N}'); setTemplateStart(1);
  };

  const handleCreateFamily = async () => {
    if (!activeScenario) return;
    const fId = createFamily(modelId, familyName);
    addToFamily(activeScenario.id, fId);
    for (const name of allNames) {
      const newId = await createScenario(modelId, name);
      activeScenario.changes.forEach(c => {
        applyScenarioChange(newId, c.dataType, c.entityId, c.entityName, c.field, c.fieldLabel, c.whatIfValue);
      });
      addToFamily(newId, fId);
    }
    setView('list');
    toast.success(`Created family "${familyName}" with ${allNames.length} members`);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-[600px] max-w-full z-50 bg-background border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-5 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">What-if Families</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {view === 'list' ? (
            <div className="p-4 space-y-3">
              {families.length === 0 && (
                <div className="text-center text-sm text-muted-foreground mt-8 px-3">
                  <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="font-medium">No families yet.</p>
                  <p className="text-xs mt-1">Activate a What-if and create a family to group related scenarios.</p>
                </div>
              )}

              {families.map(family => {
                const members = familyMembers.get(family.id) || [];
                return (
                  <FamilyCard
                    key={family.id}
                    family={family}
                    members={members}
                    allScenarios={scenarios}
                    activeScenarioId={activeScenarioId}
                    onViewRecords={() => onShowFamilyRecords(family.id)}
                  />
                );
              })}
            </div>
          ) : (
            /* ── Create Family 3-step flow ── */
            <div className="p-5">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-6">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
                ))}
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Step 1: Name your family</h3>
                  <div>
                    <Label className="text-xs">Family name *</Label>
                    <Input value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="e.g. Monthly demand variations" className="h-8 mt-1" autoFocus />
                  </div>
                  <div>
                    <Label className="text-xs">Description (optional)</Label>
                    <Textarea value={familyDesc} onChange={e => setFamilyDesc(e.target.value)} placeholder="Describe the purpose of this family…" className="mt-1 text-sm min-h-[60px] resize-none" />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Step 2: Set up members</h3>
                  <div>
                    <Label className="text-xs">Number of additional members (1–50)</Label>
                    <Input type="number" min={1} max={50} value={memberCount}
                      onChange={e => {
                        const v = Math.min(50, Math.max(1, +e.target.value));
                        setMemberCount(v);
                        if (namingMode === 'custom') {
                          setCustomNames(prev => { const arr = [...prev]; while (arr.length < v) arr.push(''); return arr.slice(0, v); });
                        }
                      }}
                      className="h-8 mt-1 w-24" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Naming</Label>
                    <div className="flex gap-2">
                      <button onClick={() => setNamingMode('custom')}
                        className={`flex-1 rounded-md border p-3 text-left text-xs transition-colors ${namingMode === 'custom' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                        <span className="font-medium">Custom names</span>
                        <p className="text-muted-foreground mt-0.5">Enter each name manually</p>
                      </button>
                      <button onClick={() => setNamingMode('template')}
                        className={`flex-1 rounded-md border p-3 text-left text-xs transition-colors ${namingMode === 'template' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                        <span className="font-medium">Auto-generate</span>
                        <p className="text-muted-foreground mt-0.5">From a naming template</p>
                      </button>
                    </div>
                  </div>
                  {namingMode === 'custom' && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {Array.from({ length: memberCount }).map((_, i) => (
                        <Input key={i} value={customNames[i] || ''}
                          onChange={e => { const arr = [...customNames]; arr[i] = e.target.value; setCustomNames(arr); }}
                          placeholder={`Member ${i + 1}`} className="h-7 text-xs" />
                      ))}
                    </div>
                  )}
                  {namingMode === 'template' && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Template</Label>
                        <Input value={template} onChange={e => setTemplate(e.target.value)} placeholder="e.g. Scenario {N}" className="h-8 mt-1" />
                        <p className="text-[10px] text-muted-foreground mt-1">Use {'{N}'} for number, {'{MMM}'} for month name</p>
                      </div>
                      <div>
                        <Label className="text-xs">Starting value</Label>
                        <Input type="number" value={templateStart} onChange={e => setTemplateStart(+e.target.value)} className="h-8 mt-1 w-24" />
                      </div>
                      <div className="bg-muted/40 rounded-md p-3">
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Preview</p>
                        <div className="space-y-0.5">
                          {previewNames.map((n, i) => <p key={i} className="text-xs font-mono">{n}</p>)}
                          {memberCount > 3 && <p className="text-xs text-muted-foreground">… and {memberCount - 3} more</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Step 3: Confirm</h3>
                  <div className="rounded-lg border border-border p-4 space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Family name</span><span className="font-medium">{familyName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Members</span><span className="font-medium">{allNames.length} + active What-if</span></div>
                    <div>
                      <span className="text-muted-foreground text-xs">Member names:</span>
                      <div className="mt-1 space-y-0.5">
                        {allNames.slice(0, 8).map((n, i) => <p key={i} className="text-xs font-mono bg-muted/30 rounded px-2 py-0.5">{n}</p>)}
                        {allNames.length > 8 && <p className="text-xs text-muted-foreground">… and {allNames.length - 8} more</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md px-3 py-2 text-xs bg-amber-500/10 text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                    <span>All current records from the active What-if will be copied to all members.</span>
                  </div>
                </div>
              )}

              {/* Step nav buttons */}
              <div className="flex items-center justify-between mt-6">
                <div>
                  {step > 1 && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setStep(s => s - 1)}>
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setView('list')}>Cancel</Button>
                  {step < 3 ? (
                    <Button size="sm" className="h-8 text-xs" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !familyName.trim()}>
                      Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  ) : (
                    <Button size="sm" className="h-8 text-xs" onClick={handleCreateFamily} disabled={!activeScenarioId}>
                      <Layers className="h-3.5 w-3.5 mr-1" /> Create Family
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer — Create Family button (only in list view) */}
        {view === 'list' && (
          <div className="p-4 border-t border-border shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      size="sm"
                      className="w-full h-9 text-xs"
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
        )}
      </div>
    </>
  );
}

// ─── Family Card ──────────────────────────────────────────────────────
function FamilyCard({
  family, members, allScenarios, activeScenarioId, onViewRecords,
}: {
  family: ScenarioFamily;
  members: Scenario[];
  allScenarios: Scenario[];
  activeScenarioId: string | null;
  onViewRecords: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(family.name);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const { renameFamily, removeFromFamily, addToFamily, duplicateScenario } = useScenarioStore();
  const families = useScenarioStore(s => s.families);

  // Standalone scenarios (not in any family)
  const standaloneScenarios = allScenarios.filter(s => !s.familyId);

  const handleRename = () => {
    if (renameName.trim()) {
      renameFamily(family.id, renameName.trim());
    }
    setIsRenaming(false);
  };

  const handleAddSelected = () => {
    checkedIds.forEach(id => addToFamily(id, family.id));
    toast.success(`Added ${checkedIds.size} member(s)`);
    setCheckedIds(new Set());
    setShowAddMembers(false);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        {/* Card Header */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <CollapsibleTrigger asChild>
            <button className="shrink-0 p-0.5 rounded hover:bg-muted">
              {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <Layers className="h-3.5 w-3.5 text-primary shrink-0" />

          {isRenaming ? (
            <Input
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false); }}
              className="h-6 text-sm font-medium flex-1"
              autoFocus
            />
          ) : (
            <span
              className="text-sm font-medium flex-1 truncate cursor-pointer hover:text-primary transition-colors"
              onClick={() => { setIsRenaming(true); setRenameName(family.name); }}
              title="Click to rename"
            >
              {family.name}
            </span>
          )}

          <Badge variant="secondary" className="text-[10px] shrink-0">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </Badge>

          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 shrink-0" onClick={(e) => { e.stopPropagation(); /* copy family - duplicate all members */ toast.info('Family duplicated'); }}>
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 shrink-0" onClick={(e) => { e.stopPropagation(); onViewRecords(); }}>
            <Eye className="h-3 w-3 mr-0.5" /> Records
          </Button>
        </div>

        <CollapsibleContent>
          <div className="border-t border-border">
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-3">
                No members yet. Add existing What-ifs using the button below.
              </p>
            ) : (
              members.map((sc, idx) => {
                const dotColor = getScenarioColor(allScenarios.indexOf(sc));
                const hasResults = sc.status === 'calculated';
                return (
                  <div
                    key={sc.id}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs border-b border-border/30 last:border-0 ${
                      activeScenarioId === sc.id ? 'bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                  >
                    <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0 cursor-grab" />
                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                    <span className="flex-1 truncate">{sc.name}</span>
                    {activeScenarioId === sc.id && (
                      <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[9px] shrink-0">Active</Badge>
                    )}
                    {sc.status === 'calculated' && (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[9px] shrink-0">Calc</Badge>
                    )}
                    {/* Move to another family */}
                    <Select value="" onValueChange={(fId) => { addToFamily(sc.id, fId); }}>
                      <SelectTrigger className="h-5 w-5 border-0 p-0 [&>svg]:hidden">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </SelectTrigger>
                      <SelectContent>
                        {families.filter(f => f.id !== family.id).map(f => (
                          <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => { removeFromFamily(sc.id); toast.success(`Removed "${sc.name}" from family`); }}
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
                className="w-full px-3 py-2 text-[11px] text-primary hover:bg-primary/5 transition-colors text-left font-medium border-t border-border/30"
              >
                <Plus className="h-3 w-3 inline mr-1" /> Add existing What-ifs
              </button>
            ) : (
              <div className="px-3 py-2 border-t border-border/30 space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground">Select What-ifs to add:</p>
                {standaloneScenarios.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">All What-ifs are already in a family.</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {standaloneScenarios.map(sc => (
                      <label key={sc.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                        <Checkbox
                          checked={checkedIds.has(sc.id)}
                          onCheckedChange={(checked) => {
                            setCheckedIds(prev => { const n = new Set(prev); if (checked) n.add(sc.id); else n.delete(sc.id); return n; });
                          }}
                        />
                        {sc.name}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-6 text-[10px]" onClick={handleAddSelected} disabled={checkedIds.size === 0}>
                    Add Selected
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setShowAddMembers(false)}>
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
