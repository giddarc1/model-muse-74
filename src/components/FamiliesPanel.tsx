import { useState, useMemo } from 'react';
import { useScenarioStore, type Scenario, type ScenarioChange, type ScenarioFamily } from '@/stores/scenarioStore';
import { useUserLevelStore, isVisible } from '@/hooks/useUserLevel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from '@/components/ui/drawer';
import {
  Plus, ChevronDown, ChevronRight, GripVertical, Layers, AlertTriangle,
  ArrowLeft, ArrowRight, Copy, ClipboardPaste,
} from 'lucide-react';
import { toast } from 'sonner';

interface FamiliesPanelProps {
  modelId: string;
  scenarios: Scenario[];
  activeScenarioId: string | null;
  onShowFamilyRecords: (familyId: string) => void;
}

export default function FamiliesPanel({
  modelId, scenarios, activeScenarioId, onShowFamilyRecords,
}: FamiliesPanelProps) {
  const families = useScenarioStore(s => s.families).filter(f => f.modelId === modelId);
  const { createFamily, createScenario, applyScenarioChange, addToFamily } = useScenarioStore();
  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || null;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [familyName, setFamilyName] = useState('');
  const [familyDesc, setFamilyDesc] = useState('');
  const [memberCount, setMemberCount] = useState(3);
  const [namingMode, setNamingMode] = useState<'custom' | 'template'>('template');
  const [customNames, setCustomNames] = useState<string[]>([]);
  const [template, setTemplate] = useState('Scenario {N}');
  const [templateStart, setTemplateStart] = useState(1);

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Generate preview names
  const generatedNames = useMemo(() => {
    if (namingMode === 'custom') return customNames.slice(0, memberCount);
    const names: string[] = [];
    for (let i = 0; i < memberCount; i++) {
      let name = template;
      name = name.replace(/{N}/g, String(templateStart + i));
      const mIdx = (i) % 12;
      name = name.replace(/{MMM}/g, months[mIdx]);
      names.push(name);
    }
    return names;
  }, [namingMode, customNames, memberCount, template, templateStart]);

  const previewNames = generatedNames.slice(0, 3);
  const allNames = generatedNames;

  // Group scenarios by family
  const familyMembers = useMemo(() => {
    const map = new Map<string, Scenario[]>();
    families.forEach(f => {
      map.set(f.id, scenarios.filter(s => s.familyId === f.id));
    });
    return map;
  }, [families, scenarios]);

  const resetDrawer = () => {
    setStep(1);
    setFamilyName('');
    setFamilyDesc('');
    setMemberCount(3);
    setNamingMode('template');
    setCustomNames([]);
    setTemplate('Scenario {N}');
    setTemplateStart(1);
  };

  const handleOpenDrawer = () => {
    resetDrawer();
    setDrawerOpen(true);
  };

  const handleCreateFamily = async () => {
    if (!activeScenario) return;
    const fId = createFamily(modelId, familyName);
    // Add the active scenario to this family
    addToFamily(activeScenario.id, fId);
    // Create member scenarios with copies of active scenario's changes
    for (const name of allNames) {
      const newId = await createScenario(modelId, name);
      activeScenario.changes.forEach(c => {
        applyScenarioChange(newId, c.dataType, c.entityId, c.entityName, c.field, c.fieldLabel, c.whatIfValue);
      });
      addToFamily(newId, fId);
    }
    setDrawerOpen(false);
    toast.success(`Created family "${familyName}" with ${allNames.length} members`);
  };

  return (
    <div className="w-[300px] shrink-0 border-l border-border flex flex-col">
      {/* Header */}
      <div className="h-9 flex items-center px-3 border-b border-border bg-muted/30 shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">What-if Families</span>
      </div>

      {/* Family cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {families.length === 0 && (
          <div className="text-center text-sm text-muted-foreground mt-8 px-3">
            <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            <p>No families yet.</p>
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
              activeScenarioId={activeScenarioId}
              onViewRecords={() => onShowFamilyRecords(family.id)}
            />
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
                  onClick={handleOpenDrawer}
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

      {/* 3-step Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className="fixed inset-y-0 right-0 w-[420px] rounded-none border-l border-border flex flex-col">
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="text-base">Create Family</DrawerTitle>
            <DrawerDescription className="text-xs">Step {step} of 3</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-5">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Name your family</h3>
                <div>
                  <Label className="text-xs">Family name *</Label>
                  <Input
                    value={familyName}
                    onChange={e => setFamilyName(e.target.value)}
                    placeholder="e.g. Monthly demand variations"
                    className="h-8 mt-1"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs">Description (optional)</Label>
                  <Textarea
                    value={familyDesc}
                    onChange={e => setFamilyDesc(e.target.value)}
                    placeholder="Describe the purpose of this family…"
                    className="mt-1 text-sm min-h-[60px] resize-none"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Set up members</h3>
                <div>
                  <Label className="text-xs">Number of additional members (1–50)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={memberCount}
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
                    className="h-8 mt-1 w-24"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Naming</Label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNamingMode('custom')}
                      className={`flex-1 rounded-md border p-3 text-left text-xs transition-colors ${namingMode === 'custom' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                    >
                      <span className="font-medium">Custom names</span>
                      <p className="text-muted-foreground mt-0.5">Enter each name manually</p>
                    </button>
                    <button
                      onClick={() => setNamingMode('template')}
                      className={`flex-1 rounded-md border p-3 text-left text-xs transition-colors ${namingMode === 'template' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                    >
                      <span className="font-medium">Auto-generate</span>
                      <p className="text-muted-foreground mt-0.5">From a naming template</p>
                    </button>
                  </div>
                </div>

                {namingMode === 'custom' && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {Array.from({ length: memberCount }).map((_, i) => (
                      <Input
                        key={i}
                        value={customNames[i] || ''}
                        onChange={e => {
                          const arr = [...customNames];
                          arr[i] = e.target.value;
                          setCustomNames(arr);
                        }}
                        placeholder={`Member ${i + 1}`}
                        className="h-7 text-xs"
                      />
                    ))}
                  </div>
                )}

                {namingMode === 'template' && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Template</Label>
                      <Input
                        value={template}
                        onChange={e => setTemplate(e.target.value)}
                        placeholder="e.g. Scenario {N}"
                        className="h-8 mt-1"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Use {'{N}'} for number, {'{MMM}'} for month name
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Starting value</Label>
                      <Input
                        type="number"
                        value={templateStart}
                        onChange={e => setTemplateStart(+e.target.value)}
                        className="h-8 mt-1 w-24"
                      />
                    </div>
                    <div className="bg-muted/40 rounded-md p-3">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Preview</p>
                      <div className="space-y-0.5">
                        {previewNames.map((n, i) => (
                          <p key={i} className="text-xs font-mono">{n}</p>
                        ))}
                        {memberCount > 3 && <p className="text-xs text-muted-foreground">… and {memberCount - 3} more</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Confirm</h3>
                <div className="rounded-lg border border-border p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Family name</span>
                    <span className="font-medium">{familyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Members</span>
                    <span className="font-medium">{allNames.length} + active What-if</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">First 5 names:</span>
                    <div className="mt-1 space-y-0.5">
                      {allNames.slice(0, 5).map((n, i) => (
                        <p key={i} className="text-xs font-mono bg-muted/30 rounded px-2 py-0.5">{n}</p>
                      ))}
                      {allNames.length > 5 && (
                        <p className="text-xs text-muted-foreground">… and {allNames.length - 5} more</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-md px-3 py-2 text-xs bg-amber-500/10 text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                  <span>All current changes in the active What-if will be copied to all members.</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="border-t border-border p-4 flex items-center justify-between">
            <div>
              {step > 1 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setStep(s => s - 1)}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDrawerOpen(false)}>
                Cancel
              </Button>
              {step < 3 ? (
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setStep(s => s + 1)}
                  disabled={step === 1 && !familyName.trim()}
                >
                  Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              ) : (
                <Button size="sm" className="h-8 text-xs" onClick={handleCreateFamily}>
                  <Layers className="h-3.5 w-3.5 mr-1" /> Create Family
                </Button>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// ─── Family Card ──────────────────────────────────────────────────────
function FamilyCard({
  family, members, activeScenarioId, onViewRecords,
}: {
  family: ScenarioFamily;
  members: Scenario[];
  activeScenarioId: string | null;
  onViewRecords: () => void;
}) {
  const [open, setOpen] = useState(true);
  const { setActiveScenario } = useScenarioStore();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
            {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-sm font-medium flex-1 truncate">{family.name}</span>
            <Badge variant="secondary" className="text-[10px] shrink-0">{members.length} member{members.length !== 1 ? 's' : ''}</Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border">
            {members.map(sc => (
              <button
                key={sc.id}
                onClick={() => setActiveScenario(sc.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0 ${
                  activeScenarioId === sc.id ? 'bg-primary/5' : ''
                }`}
              >
                <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0 cursor-grab" />
                <span className="flex-1 truncate">{sc.name}</span>
                {activeScenarioId === sc.id && (
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                )}
              </button>
            ))}
            <button
              onClick={onViewRecords}
              className="w-full px-3 py-1.5 text-[11px] text-primary hover:bg-primary/5 transition-colors text-left font-medium"
            >
              View Family Records →
            </button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
