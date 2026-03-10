import { useState } from 'react';
import type { Model, EquipmentGroup } from '@/stores/modelStore';
import { useModelStore } from '@/stores/modelStore';
import type { Scenario } from '@/stores/scenarioStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Info, ChevronDown, ChevronUp, Cpu } from 'lucide-react';
import { DeptCodeSelect } from '@/components/DeptCodeSelect';

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[280px] text-xs">{text}</TooltipContent></Tooltip></TooltipProvider>
  );
}

const FIELD_LABELS: Record<string, string> = {
  count: 'Count', equip_type: 'Type', mttf: 'MTTF', mttr: 'MTTR',
  overtime_pct: 'OT %', labor_group_id: 'Labor Group', dept_code: 'Dept/Area',
  unavail_pct: 'Unavail %', setup_factor: 'Setup Factor', run_factor: 'Run Factor',
  var_factor: 'Var Factor', eq1: 'Eq1', eq2: 'Eq2', eq3: 'Eq3', eq4: 'Eq4', comments: 'Comments',
};

function cc(scenario: Scenario, entityId: string, field: string): string {
  return scenario.changes.some(c => c.dataType === 'Equipment' && c.entityId === entityId && c.field === field)
    ? 'ring-2 ring-amber-400 bg-amber-500/5' : '';
}

export function WhatIfEquipmentTab({ model, scenario }: { model: Model; scenario: Scenario }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const updateEquipment = useModelStore(s => s.updateEquipment);
  const applyScenarioChange = useScenarioStore(s => s.applyScenarioChange);

  if (!model.equipment.length) {
    return <div className="py-12 text-center"><Cpu className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" /><p className="text-sm text-muted-foreground">No equipment groups defined</p></div>;
  }

  const opsTimeUnit = model.general.ops_time_unit || 'MIN';

  const handleChange = (id: string, field: keyof EquipmentGroup, value: any) => {
    const eq = model.equipment.find(e => e.id === id);
    const entityName = eq?.name || id;
    const fieldLabel = FIELD_LABELS[field] || field;
    applyScenarioChange(scenario.id, 'Equipment', id, entityName, field, fieldLabel, value as string | number);
    if (field === 'equip_type' && value === 'delay') {
      updateEquipment(model.id, id, { [field]: value, count: -1 });
    } else if (field === 'dept_code') {
      const isOutOfArea = typeof value === 'string' && value.toLowerCase() === 'out of area';
      updateEquipment(model.id, id, { [field]: value, out_of_area: isOutOfArea });
    } else {
      updateEquipment(model.id, id, { [field]: value });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{model.equipment.length} groups defined</p>
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
                <TableHead className="font-mono text-xs">
                  <div className="flex items-center gap-1">Type <InfoTip text="Standard: normal equipment. Delay: no capacity constraint." /></div>
                </TableHead>
                <TableHead className="font-mono text-xs">Count</TableHead>
                <TableHead className="font-mono text-xs">MTTF ({opsTimeUnit})</TableHead>
                <TableHead className="font-mono text-xs">MTTR ({opsTimeUnit})</TableHead>
                <TableHead className="font-mono text-xs">OT %</TableHead>
                <TableHead className="font-mono text-xs">Labor</TableHead>
                <TableHead className="font-mono text-xs">Comments</TableHead>
                {showAdvanced && <>
                  <TableHead className="font-mono text-xs">Dept/Area</TableHead>
                  <TableHead className="font-mono text-xs">Unavail %</TableHead>
                  <TableHead className="font-mono text-xs">Setup Fac</TableHead>
                  <TableHead className="font-mono text-xs">Run Fac</TableHead>
                  <TableHead className="font-mono text-xs">Var Fac</TableHead>
                  <TableHead className="font-mono text-xs">{model.param_names.eq1_name}</TableHead>
                  <TableHead className="font-mono text-xs">{model.param_names.eq2_name}</TableHead>
                  <TableHead className="font-mono text-xs">{model.param_names.eq3_name}</TableHead>
                  <TableHead className="font-mono text-xs">{model.param_names.eq4_name}</TableHead>
                </>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.equipment.map((eq) => (
                <TableRow key={eq.id}>
                  <TableCell className="font-mono font-medium">{eq.name}</TableCell>
                  <TableCell>
                    <Select value={eq.equip_type} onValueChange={(v) => handleChange(eq.id, 'equip_type', v)}>
                      <SelectTrigger className={`h-8 w-24 ${cc(scenario, eq.id, 'equip_type')}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="delay">Delay</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input type="number" className={`h-8 w-16 font-mono ${cc(scenario, eq.id, 'count')}`} value={eq.count} disabled={eq.equip_type === 'delay'} onChange={(e) => handleChange(eq.id, 'count', +e.target.value)} /></TableCell>
                  <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, eq.id, 'mttf')}`} value={eq.mttf} onChange={(e) => handleChange(eq.id, 'mttf', +e.target.value)} /></TableCell>
                  <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, eq.id, 'mttr')}`} value={eq.mttr} onChange={(e) => handleChange(eq.id, 'mttr', +e.target.value)} /></TableCell>
                  <TableCell><Input type="number" className={`h-8 w-16 font-mono ${cc(scenario, eq.id, 'overtime_pct')}`} value={eq.overtime_pct} onChange={(e) => handleChange(eq.id, 'overtime_pct', +e.target.value)} /></TableCell>
                  <TableCell>
                    <Select value={eq.labor_group_id || 'none'} onValueChange={(v) => handleChange(eq.id, 'labor_group_id', v === 'none' ? '' : v)}>
                      <SelectTrigger className={`h-8 w-28 ${cc(scenario, eq.id, 'labor_group_id')}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {model.labor.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input className={`h-8 w-32 ${cc(scenario, eq.id, 'comments')}`} value={eq.comments} onChange={(e) => handleChange(eq.id, 'comments', e.target.value)} placeholder="Notes…" /></TableCell>
                  {showAdvanced && <>
                    <TableCell>
                      <DeptCodeSelect modelId={model.id} value={eq.dept_code} onChange={(v) => handleChange(eq.id, 'dept_code', v)} section="equipment" className={`h-8 w-28 ${cc(scenario, eq.id, 'dept_code')}`} />
                    </TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, eq.id, 'unavail_pct')}`} value={eq.unavail_pct} onChange={(e) => handleChange(eq.id, 'unavail_pct', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, eq.id, 'setup_factor')}`} value={eq.setup_factor} step="0.1" onChange={(e) => handleChange(eq.id, 'setup_factor', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, eq.id, 'run_factor')}`} value={eq.run_factor} step="0.1" onChange={(e) => handleChange(eq.id, 'run_factor', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, eq.id, 'var_factor')}`} value={eq.var_factor} step="0.1" onChange={(e) => handleChange(eq.id, 'var_factor', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, eq.id, 'eq1')}`} value={eq.eq1} onChange={(e) => handleChange(eq.id, 'eq1', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, eq.id, 'eq2')}`} value={eq.eq2} onChange={(e) => handleChange(eq.id, 'eq2', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, eq.id, 'eq3')}`} value={eq.eq3} onChange={(e) => handleChange(eq.id, 'eq3', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, eq.id, 'eq4')}`} value={eq.eq4} onChange={(e) => handleChange(eq.id, 'eq4', +e.target.value)} /></TableCell>
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
