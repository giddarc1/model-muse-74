import { useState, useMemo } from 'react';
import { useScenarioStore, type Scenario } from '@/stores/scenarioStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, ChevronDown, ChevronRight, X } from 'lucide-react';
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

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [memberCount, setMemberCount] = useState(3);

  const familyMembers = useMemo(() => {
    const map = new Map<string, Scenario[]>();
    families.forEach(f => {
      map.set(f.id, scenarios.filter(s => s.familyId === f.id));
    });
    return map;
  }, [families, scenarios]);

  const ungrouped = scenarios.filter(s => !s.familyId);
  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || null;

  const handleCreate = async () => {
    const trimmed = familyName.trim();
    if (!trimmed) return;
    const fId = createFamily(modelId, trimmed);
    for (let i = 1; i <= memberCount; i++) {
      const name = `${trimmed} - ${i}`;
      const newId = await createScenario(modelId, name);
      if (activeScenario) {
        activeScenario.changes.forEach(c => {
          applyScenarioChange(newId, c.dataType, c.entityId, c.entityName, c.field, c.fieldLabel, c.whatIfValue);
        });
      }
      addToFamily(newId, fId);
    }
    toast.success(`Created family "${trimmed}" with ${memberCount} members`);
    setShowCreateForm(false);
    setFamilyName('');
    setMemberCount(3);
  };

  return (
    <div className="flex flex-col h-full bg-muted/30" style={{ minHeight: 200 }}>
      {/* ── Header — always visible ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-[13px] font-semibold text-foreground">What-if Families</span>
        <Button
          size="sm"
          className="h-7 text-[11px] px-2"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
        >
          <Plus className="h-3 w-3 mr-0.5" /> Create Family
        </Button>
      </div>

      {/* ── Inline create form ── */}
      {showCreateForm && (
        <div className="px-3 py-3 border-b border-border space-y-2 bg-background shrink-0">
          <div>
            <Label className="text-[11px]">Family name</Label>
            <Input
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              placeholder="e.g. Monthly variations"
              className="h-7 text-xs mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-[11px]">Number of members</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={memberCount}
              onChange={e => setMemberCount(Math.min(50, Math.max(1, +e.target.value)))}
              className="h-7 text-xs mt-1 w-20"
            />
          </div>
          <div className="flex gap-1.5 pt-1">
            <Button size="sm" className="h-7 text-[11px] px-3" onClick={handleCreate} disabled={!familyName.trim()}>
              Create
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={() => { setShowCreateForm(false); setFamilyName(''); setMemberCount(3); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-2">
        {families.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center py-8">
            <p className="text-[13px] text-muted-foreground">No families have been created yet.</p>
            <p className="text-[12px] text-muted-foreground mt-1">Click + Create Family above to group related What-ifs together.</p>
          </div>
        ) : (
          <div className="space-y-2">
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

        {/* Ungrouped */}
        {ungrouped.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 py-1.5">Ungrouped</p>
            {ungrouped.map(sc => {
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
    </div>
  );
}

// ─── Family Card ──────────────────────────────────────────────────────
function FamilyCard({
  family, members, allScenarios, activeScenarioId, onSelectScenario,
}: {
  family: { id: string; name: string; modelId: string };
  members: Scenario[];
  allScenarios: Scenario[];
  activeScenarioId: string | null;
  onSelectScenario: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const { removeFromFamily } = useScenarioStore();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border border-border overflow-hidden bg-card">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-1.5 px-2 hover:bg-muted/30 transition-colors" style={{ height: 36 }}>
            {open ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            <span className="text-[13px] font-medium flex-1 truncate text-left">{family.name}</span>
            <Badge variant="secondary" className="text-[9px] shrink-0 px-1.5">{members.length}</Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border">
            {members.length === 0 ? (
              <p className="text-[11px] text-muted-foreground px-2 py-2">No members yet.</p>
            ) : (
              members.map(sc => {
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
                    {activeScenarioId === sc.id && <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[8px] shrink-0 px-1">Active</Badge>}
                    <button
                      onClick={e => { e.stopPropagation(); removeFromFamily(sc.id); toast.success(`Removed "${sc.name}"`); }}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
