import { useState, useMemo } from 'react';
import { useScenarioStore, type Scenario, type ScenarioFamily } from '@/stores/scenarioStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus, ChevronDown, ChevronRight, Layers, X,
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
  const { createFamily, addToFamily, removeFromFamily } = useScenarioStore();

  const familyMembers = useMemo(() => {
    const map = new Map<string, Scenario[]>();
    families.forEach(f => {
      map.set(f.id, scenarios.filter(s => s.familyId === f.id));
    });
    return map;
  }, [families, scenarios]);

  const ungrouped = scenarios.filter(s => !s.familyId);

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {families.length === 0 && ungrouped.length === 0 && (
          <div className="text-center text-sm text-muted-foreground mt-8 px-3">
            <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="font-medium text-xs">No families yet.</p>
            <p className="text-[11px] mt-1">Group related What-ifs to manage them together.</p>
          </div>
        )}

        {families.length === 0 && ungrouped.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <p className="text-[11px] text-muted-foreground">No families yet. Group related What-ifs to manage them together.</p>
          </div>
        )}

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
                onViewRecords={() => onShowFamilyRecords(family.id)}
              />
            );
          })}
        </div>

        {/* Ungrouped section */}
        {ungrouped.length > 0 && (
          <div className="px-2 pb-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 py-1.5">Ungrouped</p>
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

      {/* Footer */}
      <div className="p-3 border-t border-border shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => {
                    if (!activeScenarioId) return;
                    const name = `Family ${families.length + 1}`;
                    const fId = createFamily(modelId, name);
                    addToFamily(activeScenarioId, fId);
                    toast.success(`Created family "${name}"`);
                  }}
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
  family, members, allScenarios, activeScenarioId, onSelectScenario, onViewRecords,
}: {
  family: ScenarioFamily;
  members: Scenario[];
  allScenarios: Scenario[];
  activeScenarioId: string | null;
  onSelectScenario: (id: string) => void;
  onViewRecords: () => void;
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

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border border-border overflow-hidden bg-card">
        {/* Header */}
        <div className="flex items-center gap-1.5 px-2 py-2">
          <CollapsibleTrigger asChild>
            <button className="shrink-0 p-0.5 rounded hover:bg-muted">
              {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>

          {isRenaming ? (
            <Input
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false); }}
              className="h-5 text-xs font-medium flex-1"
              autoFocus
            />
          ) : (
            <span
              className="text-xs font-medium flex-1 truncate cursor-pointer hover:text-primary transition-colors"
              onDoubleClick={() => { setIsRenaming(true); setRenameName(family.name); }}
              title="Double-click to rename"
            >
              {family.name}
            </span>
          )}

          <Badge variant="secondary" className="text-[9px] shrink-0 px-1.5">
            {members.length}
          </Badge>
        </div>

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
                    className={`flex items-center gap-1.5 px-2 py-1 text-[11px] border-b border-border/30 last:border-0 cursor-pointer ${
                      activeScenarioId === sc.id ? 'bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                    onClick={() => onSelectScenario(sc.id)}
                  >
                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                    <span className="flex-1 truncate">{sc.name}</span>
                    {activeScenarioId === sc.id && (
                      <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[8px] shrink-0 px-1">Active</Badge>
                    )}
                    {sc.status === 'calculated' && (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[8px] shrink-0 px-1">Calc</Badge>
                    )}
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
