import { useRef, useState } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Info, FlaskConical, Save, Check } from 'lucide-react';
import { useUserLevelStore, isVisible } from '@/hooks/useUserLevel';
import { toast } from 'sonner';
import { UnsavedChangesGuard } from '@/components/UnsavedChangesGuard';

const FIELD_LABELS: Record<string, string> = {
  model_title: 'Model Title', ops_time_unit: 'Ops Time Unit', mct_time_unit: 'MCT Time Unit',
  prod_period_unit: 'Prod Period', conv1: 'MCT Conversion', conv2: 'Prod Conversion',
  util_limit: 'Util Limit', var_equip: 'Equipment Variability', var_labor: 'Labor Variability',
  var_prod: 'Product Variability', gen1: 'Gen1', gen2: 'Gen2', gen3: 'Gen3', gen4: 'Gen4',
  author: 'Author', comments: 'Comments',
};

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground inline-block ml-1 cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[280px] text-xs">{text}</TooltipContent></Tooltip></TooltipProvider>
  );
}

export default function GeneralData() {
  const model = useModelStore((s) => s.getActiveModel());
  const updateGeneral = useModelStore((s) => s.updateGeneral);
  const { userLevel } = useUserLevelStore();
  const showAdvancedParams = isVisible('advanced_parameters', userLevel);
  const activeScenarioId = useScenarioStore(s => s.activeScenarioId);
  const activeScenario = useScenarioStore(s => s.scenarios.find(sc => sc.id === s.activeScenarioId));
  const applyScenarioChange = useScenarioStore(s => s.applyScenarioChange);
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Capture saved unit values on mount — labels only update on remount, not live
  const savedUnitsRef = useRef<{ ops: string; mct: string; prod: string } | null>(null);
  if (model && !savedUnitsRef.current) {
    savedUnitsRef.current = {
      ops: model.general.ops_time_unit,
      mct: model.general.mct_time_unit,
      prod: model.general.prod_period_unit,
    };
  }

  if (!model) return (
    <div className="p-6 max-w-3xl space-y-4">
      <div className="h-7 w-48 bg-muted animate-pulse rounded" />
      <div className="h-4 w-72 bg-muted animate-pulse rounded" />
      <div className="h-48 bg-muted animate-pulse rounded-lg mt-6" />
    </div>
  );

  const g = model.general;
  const pn = model.param_names;
  const update = (data: Partial<typeof g>) => {
    if (activeScenarioId && activeScenario) {
      Object.entries(data).forEach(([field, value]) => {
        const fieldLabel = FIELD_LABELS[field] || field;
        applyScenarioChange(activeScenarioId, 'General', model.id, 'General', field, fieldLabel, value as string | number);
      });
    }
    updateGeneral(model.id, data);
    setIsDirty(true);
    setJustSaved(false);
  };

  const handleSave = () => {
    setIsDirty(false);
    setJustSaved(true);
    toast.success('Saved');
    setTimeout(() => setJustSaved(false), 2000);
  };

  const UNIT_LABELS: Record<string, string> = {
    SEC: 'seconds', MIN: 'minutes', HR: 'hours', DAY: 'days', WEEK: 'weeks', MONTH: 'months', YEAR: 'year',
  };
  const UNIT_SINGULAR: Record<string, string> = {
    SEC: 'second', MIN: 'minute', HR: 'hour', DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year',
  };

  const savedOps = savedUnitsRef.current?.ops ?? g.ops_time_unit;
  const savedMct = savedUnitsRef.current?.mct ?? g.mct_time_unit;
  const savedProd = savedUnitsRef.current?.prod ?? g.prod_period_unit;

  return (
    <>
    <UnsavedChangesGuard isDirty={isDirty} onSave={handleSave} />
    <div className="p-6 max-w-3xl animate-fade-in">
      {activeScenarioId && activeScenario && (
        <div className="mb-4 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md">
          <FlaskConical className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-700 font-medium">
            Changes are being recorded to <span className="font-semibold">{activeScenario.name}</span>
          </span>
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">General Data</h1>
        <Button
          size="sm"
          className="gap-1"
          variant={isDirty ? 'default' : 'outline'}
          disabled={!isDirty && !justSaved}
          onClick={handleSave}
        >
          {justSaved ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" /> Save</>}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Configure time settings, variability parameters, and model metadata.</p>

      <Tabs defaultValue="time">
        <TabsList>
          <TabsTrigger value="time">Time Settings</TabsTrigger>
          {showAdvancedParams && <TabsTrigger value="advanced">Advanced Parameters</TabsTrigger>}
          <TabsTrigger value="comments">Comments</TabsTrigger>
        </TabsList>

        <TabsContent value="time" className="mt-4 space-y-4">
          <Card className={activeScenarioId ? 'border-l-[3px] border-l-amber-400' : ''}>
            <CardHeader>
              <CardTitle className="text-base">Time Settings</CardTitle>
              <CardDescription>Define time units and conversion factors for this model.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Model Title</Label>
                <Input value={g.model_title} onChange={(e) => update({ model_title: e.target.value })} placeholder="Report display name" />
              </div>

              {/* Group 1 — Time Units */}
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Time Units</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Operations Time Unit</Label>
                    <Select value={g.ops_time_unit} onValueChange={(v) => update({ ops_time_unit: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SEC">Seconds</SelectItem>
                        <SelectItem value="MIN">Minutes</SelectItem>
                        <SelectItem value="HR">Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">MCT Time Unit</Label>
                    <Select value={g.mct_time_unit} onValueChange={(v) => update({ mct_time_unit: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MIN">Minutes</SelectItem>
                        <SelectItem value="HR">Hours</SelectItem>
                        <SelectItem value="DAY">Days</SelectItem>
                        <SelectItem value="WEEK">Weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Production Period</Label>
                    <Select value={g.prod_period_unit} onValueChange={(v) => update({ prod_period_unit: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAY">Day</SelectItem>
                        <SelectItem value="WEEK">Week</SelectItem>
                        <SelectItem value="MONTH">Month</SelectItem>
                        <SelectItem value="YEAR">Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Group 2 — Factory Calendar */}
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Factory Calendar</p>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[13px] font-medium">
                      MCT Conversion{' '}
                      <span className="text-muted-foreground font-normal">({savedOps} per {savedMct})</span>
                    </Label>
                    <Input
                      type="number"
                      value={g.conv1}
                      onChange={(e) => update({ conv1: +e.target.value })}
                      className={`w-[100px] text-right ${g.conv1 <= 0 ? 'border-destructive' : ''}`}
                    />
                    {g.conv1 <= 0 && <p className="text-xs text-destructive mt-1">Must be greater than 0</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Working {UNIT_LABELS[savedOps] ?? savedOps} per {UNIT_SINGULAR[savedMct] ?? savedMct}
                    </p>
                  </div>
                  <div>
                    <Label className="text-[13px] font-medium">
                      Prod. Period Conversion{' '}
                      <span className="text-muted-foreground font-normal">({savedMct} per {savedProd})</span>
                    </Label>
                    <Input
                      type="number"
                      value={g.conv2}
                      onChange={(e) => update({ conv2: +e.target.value })}
                      className={`w-[100px] text-right ${g.conv2 <= 0 ? 'border-destructive' : ''}`}
                    />
                    {g.conv2 <= 0 && <p className="text-xs text-destructive mt-1">Must be greater than 0</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Working {UNIT_LABELS[savedMct] ?? savedMct} per {UNIT_SINGULAR[savedProd] ?? savedProd}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="mt-4 space-y-4">
          <Card className={activeScenarioId ? 'border-l-[3px] border-l-amber-400' : ''}>
            <CardHeader>
              <CardTitle className="text-base">Variability & Limits</CardTitle>
              <CardDescription>Default coefficients of variation for queuing calculations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center">Utilization Limit (%)<InfoTip text="When any equipment or labor group exceeds this utilization, MPX stops calculating and reports that production cannot be achieved. Default 95 is recommended — the 5% buffer accounts for model approximation. Do not use this as an allowance for breakdowns; model those separately." /></Label>
                  <Input type="number" value={g.util_limit} onChange={(e) => {
                    const v = +e.target.value;
                    if (v >= 1 && v <= 99.9) update({ util_limit: v });
                    else update({ util_limit: v });
                  }} className={g.util_limit < 1 || g.util_limit > 99.9 ? 'border-destructive' : ''} />
                  {(g.util_limit < 1 || g.util_limit > 99.9) && <p className="text-xs text-destructive mt-1">Valid range: 1–99.9</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="flex items-center">Equipment Variability %<InfoTip text="Global coefficient of variation for equipment operation times, expressed as a percentage. 30% is typical for manufacturing. Individual equipment groups can multiply this using their Variability Factor." /></Label>
                  <Input type="number" value={g.var_equip} onChange={(e) => update({ var_equip: +e.target.value })} />
                </div>
                <div>
                  <Label className="flex items-center">Labor Variability %<InfoTip text="Global coefficient of variation for labor operation times, expressed as a percentage. 30% is typical for manufacturing. Individual labor groups can multiply this using their Variability Factor." /></Label>
                  <Input type="number" value={g.var_labor} onChange={(e) => update({ var_labor: +e.target.value })} />
                </div>
                <div>
                  <Label className="flex items-center">Product Variability %<InfoTip text="Models variability in production scheduling — how consistently lots are released at regular intervals. Higher values model more chaotic shop floor scheduling." /></Label>
                  <Input type="number" value={g.var_prod} onChange={(e) => update({ var_prod: +e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>

          {showAdvancedParams && (
            <Card className={activeScenarioId ? 'border-l-[3px] border-l-amber-400' : ''}>
              <CardHeader>
                <CardTitle className="text-base">Global Parameters</CardTitle>
                <CardDescription>Global variables that can be referenced in operation time formulas. Rename them in Parameter Names for clarity.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  {(['gen1', 'gen2', 'gen3', 'gen4'] as const).map(key => (
                    <div key={key}>
                      <Label className="text-xs flex items-center">{pn[`${key}_name` as keyof typeof pn]}<InfoTip text="Custom variable — rename using the Display Name field. The renamed label will appear throughout the app and can be used in the Formula Builder." /></Label>
                      <Input type="number" className="h-8 font-mono" value={g[key]} onChange={(e) => update({ [key]: +e.target.value })} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="comments" className="mt-4 space-y-4">
          <Card className={activeScenarioId ? 'border-l-[3px] border-l-amber-400' : ''}>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>Author</Label>
                <Input value={g.author} onChange={(e) => update({ author: e.target.value })} />
              </div>
              <div>
                <Label>Comments</Label>
                <Textarea rows={6} value={g.comments} onChange={(e) => update({ comments: e.target.value })} placeholder="Notes about this model..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
