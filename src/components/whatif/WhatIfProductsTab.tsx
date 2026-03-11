import { useState } from 'react';
import type { Model, Product } from '@/stores/modelStore';
import { useModelStore } from '@/stores/modelStore';
import type { Scenario } from '@/stores/scenarioStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useUserLevelStore, isVisible, type UserLevel } from '@/hooks/useUserLevel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { DeptCodeSelect } from '@/components/DeptCodeSelect';

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[280px] text-xs">{text}</TooltipContent></Tooltip></TooltipProvider>
  );
}

const FIELD_LABELS: Record<string, string> = {
  demand: 'End Demand', lot_size: 'Lot Size', tbatch_size: 'TBatch Size',
  demand_factor: 'Demand Factor', lot_factor: 'Lot Factor', var_factor: 'Var Factor',
  setup_factor: 'Setup Factor', make_to_stock: 'Make to Stock', gather_tbatches: 'Gather TBatches',
  dept_code: 'Dept/Area', prod1: 'Prod1', prod2: 'Prod2', prod3: 'Prod3', prod4: 'Prod4', comments: 'Comments',
};

function cc(scenario: Scenario, entityId: string, field: string): string {
  return scenario.changes.some(c => c.dataType === 'Product' && c.entityId === entityId && c.field === field)
    ? 'ring-2 ring-amber-400 bg-amber-500/5' : '';
}

export function WhatIfProductsTab({ model, scenario, userLevel }: { model: Model; scenario: Scenario; userLevel: UserLevel }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [search, setSearch] = useState('');
  const updateProduct = useModelStore(s => s.updateProduct);
  const { applyScenarioChange, removeChange } = useScenarioStore();
  const showInclude = true;

  if (!model.products.length) {
    return <div className="py-12 text-center text-sm text-muted-foreground">No products defined</div>;
  }

  const handleChange = (id: string, field: keyof Product, value: any) => {
    const prod = model.products.find(p => p.id === id);
    const entityName = prod?.name || id;
    const fieldLabel = FIELD_LABELS[field] || field;
    applyScenarioChange(scenario.id, 'Product', id, entityName, field, fieldLabel, value as string | number);
    updateProduct(model.id, id, { [field]: value });
  };

  const isExcluded = (productId: string) => {
    return scenario.changes.some(c => c.dataType === 'Product' && c.entityId === productId && c.field === 'included' && String(c.whatIfValue) === 'false');
  };

  const toggleInclude = (productId: string, productName: string) => {
    if (isExcluded(productId)) {
      const change = scenario.changes.find(c => c.dataType === 'Product' && c.entityId === productId && c.field === 'included');
      if (change) removeChange(scenario.id, change.id);
    } else {
      applyScenarioChange(scenario.id, 'Product', productId, productName, 'included', 'Included', 'false');
    }
  };

  const filteredProducts = model.products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const includedCount = model.products.filter(p => !isExcluded(p.id)).length;
  const totalCount = model.products.length;

  const allChecked = model.products.every(p => !isExcluded(p.id));
  const noneChecked = model.products.every(p => isExcluded(p.id));

  const toggleAll = () => {
    if (allChecked) {
      // Uncheck all
      model.products.forEach(p => {
        if (!isExcluded(p.id)) {
          applyScenarioChange(scenario.id, 'Product', p.id, p.name, 'included', 'Included', 'false');
        }
      });
    } else {
      // Check all
      model.products.forEach(p => {
        if (isExcluded(p.id)) {
          const change = scenario.changes.find(c => c.dataType === 'Product' && c.entityId === p.id && c.field === 'included');
          if (change) removeChange(scenario.id, change.id);
        }
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-48 text-xs"
        />
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{includedCount} of {totalCount} included</span>
          <Button variant="outline" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="gap-1 text-xs">
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
          </Button>
        </div>
      </div>
      <Card className="border-l-[3px] border-l-amber-400">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                {showInclude && (
                  <TableHead className="font-mono text-xs w-10">
                    <Checkbox
                      checked={allChecked ? true : noneChecked ? false : 'indeterminate'}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                )}
                <TableHead className="font-mono text-xs">Name</TableHead>
                <TableHead className="font-mono text-xs">
                  <TooltipProvider delayDuration={400}><Tooltip><TooltipTrigger asChild><span className="cursor-help">End Demand</span></TooltipTrigger><TooltipContent className="max-w-[260px] text-xs">Quantity shipped directly to customers.</TooltipContent></Tooltip></TooltipProvider>
                </TableHead>
                <TableHead className="font-mono text-xs">Lot Size</TableHead>
                {showAdvanced && <>
                  <TableHead className="font-mono text-xs">TBatch</TableHead>
                  <TableHead className="font-mono text-xs">Dept/Area</TableHead>
                  <TableHead className="font-mono text-xs">Demand Fac</TableHead>
                  <TableHead className="font-mono text-xs">Lot Fac</TableHead>
                  <TableHead className="font-mono text-xs">Var Fac</TableHead>
                  <TableHead className="font-mono text-xs">MTS</TableHead>
                  <TableHead className="font-mono text-xs">Gather</TableHead>
                  <TableHead className="font-mono text-xs">{model.param_names.prod1_name}</TableHead>
                  <TableHead className="font-mono text-xs">{model.param_names.prod2_name}</TableHead>
                  <TableHead className="font-mono text-xs">{model.param_names.prod3_name}</TableHead>
                  <TableHead className="font-mono text-xs">{model.param_names.prod4_name}</TableHead>
                </>}
                <TableHead className="font-mono text-xs">Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((p) => {
                const excluded = isExcluded(p.id);
                return (
                  <TableRow key={p.id} className={excluded ? 'opacity-50' : ''}>
                    {showInclude && (
                      <TableCell>
                        <Checkbox checked={!excluded} onCheckedChange={() => toggleInclude(p.id, p.name)} />
                      </TableCell>
                    )}
                    <TableCell className="font-mono font-medium">{p.name}</TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, p.id, 'demand')}`} value={p.demand} onChange={(e) => handleChange(p.id, 'demand', +e.target.value)} /></TableCell>
                    <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, p.id, 'lot_size')}`} value={p.lot_size} onChange={(e) => handleChange(p.id, 'lot_size', +e.target.value)} /></TableCell>
                    {showAdvanced && <>
                      <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, p.id, 'tbatch_size')}`} value={p.tbatch_size} onChange={(e) => handleChange(p.id, 'tbatch_size', +e.target.value)} /></TableCell>
                      <TableCell>
                        <DeptCodeSelect modelId={model.id} value={p.dept_code} onChange={(v) => handleChange(p.id, 'dept_code', v)} section="product" className={`h-8 w-28 ${cc(scenario, p.id, 'dept_code')}`} />
                      </TableCell>
                      <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, p.id, 'demand_factor')}`} value={p.demand_factor} step="0.1" onChange={(e) => handleChange(p.id, 'demand_factor', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, p.id, 'lot_factor')}`} value={p.lot_factor} step="0.1" onChange={(e) => handleChange(p.id, 'lot_factor', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, p.id, 'var_factor')}`} value={p.var_factor} step="0.1" onChange={(e) => handleChange(p.id, 'var_factor', +e.target.value)} /></TableCell>
                      <TableCell><Switch checked={p.make_to_stock} onCheckedChange={(v) => handleChange(p.id, 'make_to_stock', v)} /></TableCell>
                      <TableCell><Switch checked={p.gather_tbatches} onCheckedChange={(v) => handleChange(p.id, 'gather_tbatches', v)} /></TableCell>
                      <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, p.id, 'prod1')}`} value={p.prod1} onChange={(e) => handleChange(p.id, 'prod1', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, p.id, 'prod2')}`} value={p.prod2} onChange={(e) => handleChange(p.id, 'prod2', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, p.id, 'prod3')}`} value={p.prod3} onChange={(e) => handleChange(p.id, 'prod3', +e.target.value)} /></TableCell>
                      <TableCell><Input type="number" className={`h-8 w-20 font-mono ${cc(scenario, p.id, 'prod4')}`} value={p.prod4} onChange={(e) => handleChange(p.id, 'prod4', +e.target.value)} /></TableCell>
                    </>}
                    <TableCell><Input className={`h-8 w-32 ${cc(scenario, p.id, 'comments')}`} value={p.comments} onChange={(e) => handleChange(p.id, 'comments', e.target.value)} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
