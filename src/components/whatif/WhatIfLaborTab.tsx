import { useState } from 'react';
import type { Model, LaborGroup } from '@/stores/modelStore';
import { useModelStore } from '@/stores/modelStore';
import type { Scenario } from '@/stores/scenarioStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useUserLevelStore, isVisible } from '@/hooks/useUserLevel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Info, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { DeptCodeSelect } from '@/components/DeptCodeSelect';

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[280px] text-xs">{text}</TooltipContent></Tooltip></TooltipProvider>
  );
}

const FIELD_LABELS: Record<string, string> = {
  count: 'Count', overtime_pct: 'Overtime %', unavail_pct: 'Unavail %',
  dept_code: 'Dept/Area', setup_factor: 'Setup Factor', run_factor: 'Run Factor',
  var_factor: 'Var Factor', prioritize_use: 'Prioritize Use',
  lab1: 'Lab1', lab2: 'Lab2', lab3: 'Lab3', lab4: 'Lab4', comments: 'Comments',
};

function cc(scenario: Scenario, entityId: string, field: string): string {
  return scenario.changes.some(c => c.dataType === 'Labor' && c.entityId === entityId && c.field === field)
    ? 'ring-2 ring-amber-400 bg-amber-500/5' : '';
}

export function WhatIfLaborTab({ model, scenario }: { model: Model; scenario: Scenario }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const updateLabor = useModelStore(s => s.updateLabor);
  const applyScenarioChange = useScenarioStore(s => s.applyScenarioChange);
  const { userLevel } = useUserLevelStore();

  if (!model.labor.length) {
    return <div className="py-12 text-center"><Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" /><p className="text-sm text-muted-foreground">No labor groups defined</p></div>;
  }

  const handleChange = (id: string, field: keyof LaborGroup, value: any) => {
    const labor = model.labor.find(l => l.id === id);
    const entityName = labor?.name || id;
    const fieldLabel = FIELD_LABELS[field] || field;
    applyScenarioChange(scenario.id, 'Labor', id, entityName, field, fieldLabel, value as string | number);
    updateLabor(model.id, id, { [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{model.labor.length} groups defined</p>
        <Button variant="outline" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="gap-1 text-xs">
          {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
        </Button>
      </div>
      <Card className="border-l-[3px] border-l-amber-400">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-xs">Name</TableHead>
                <TableHead className="font-mono text-xs">Count</TableHead>
                <TableHead className="font-mono text-xs">Overtime %</TableHead>
                <TableHead className="font-mono text-xs">Unavail %</TableHead>
                {showAdvanced && <>
                  <TableHead className="font-mono text-xs">Dept/Area</TableHead>
                  <TableHead className="font-mono text-xs">Setup Fac</TableHead>
                  <TableHead className="font-mono text-xs">Run Fac</TableHead>
                  <TableHead className="font-mono text-xs">Var Fac</TableHead>
                  <TableHead className="font-mono text-xs">
                    <div className="flex items-center gap-1">Prioritize <InfoTip text="When enabled, MPX shifts labor time toward more heavily utilised equipment groups served by this labor group." /></div>
                  </TableHead>
                  <TableHead className="font-mono text-xs">{model.param_names.lab1_name}</TableHead>
                  <TableHead className="font-mono text-xs">{model.param_names.lab2_name}</TableHead>
                  <TableHead className="font-mono text-xs">{model.param_names.lab3_name}</TableHead>
                  <TableHead className="font-mono text-xs">{model.param_names.lab4_name}</TableHead>
                </>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.labor.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono font-medium">{l.name}</TableCell>
                  <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, l.id, 'count')}`} value={l.count} onChange={(e) => handleChange(l.id, 'count', +e.target.value)} /></TableCell>
                  <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, l.id, 'overtime_pct')}`} value={l.overtime_pct} onChange={(e) => handleChange(l.id, 'overtime_pct', +e.target.value)} /></TableCell>
                  <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, l.id, 'unavail_pct')}`} value={l.unavail_pct} onChange={(e) => handleChange(l.id, 'unavail_pct', +e.target.value)} /></TableCell>
                  {showAdvanced && <>
                    <TableCell>
                      <DeptCodeSelect modelId={model.id} value={l.dept_code} onChange={(v) => handleChange(l.id, 'dept_code', v)} section="labor" className={`h-8 w-28 ${cc(scenario, l.id, 'dept_code')}`} />
                    </TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, l.id, 'setup_factor')}`} value={l.setup_factor} step="0.1" onChange={(e) => handleChange(l.id, 'setup_factor', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, l.id, 'run_factor')}`} value={l.run_factor} step="0.1" onChange={(e) => handleChange(l.id, 'run_factor', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, l.id, 'var_factor')}`} value={l.var_factor} step="0.1" onChange={(e) => handleChange(l.id, 'var_factor', +e.target.value)} /></TableCell>
                    <TableCell><Switch checked={l.prioritize_use} onCheckedChange={(v) => handleChange(l.id, 'prioritize_use', v)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, l.id, 'lab1')}`} value={l.lab1} onChange={(e) => handleChange(l.id, 'lab1', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, l.id, 'lab2')}`} value={l.lab2} onChange={(e) => handleChange(l.id, 'lab2', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, l.id, 'lab3')}`} value={l.lab3} onChange={(e) => handleChange(l.id, 'lab3', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, l.id, 'lab4')}`} value={l.lab4} onChange={(e) => handleChange(l.id, 'lab4', +e.target.value)} /></TableCell>
                  </>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
