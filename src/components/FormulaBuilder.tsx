import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Model, Operation } from '@/stores/modelStore';

interface FormulaBuilderProps {
  open: boolean;
  onClose: () => void;
  model: Model;
  operation: Operation;
  field: string;
  fieldLabel: string;
  currentValue: number;
  onApply: (value: number, formula: string) => void;
}

/** Evaluate a formula expression referencing model variables */
function evaluateFormula(
  expr: string,
  model: Model,
  operation: Operation,
): { result: number | null; error: string | null } {
  try {
    // Build variable context
    const vars: Record<string, number> = {};
    const g = model.general;
    const pn = model.param_names;

    // General params
    vars['Gen1'] = g.gen1; vars['Gen2'] = g.gen2; vars['Gen3'] = g.gen3; vars['Gen4'] = g.gen4;
    vars[pn.gen1_name] = g.gen1; vars[pn.gen2_name] = g.gen2;
    vars[pn.gen3_name] = g.gen3; vars[pn.gen4_name] = g.gen4;

    // Equipment params
    const eq = model.equipment.find(e => e.id === operation.equip_id);
    if (eq) {
      vars['Eq1'] = eq.eq1; vars['Eq2'] = eq.eq2; vars['Eq3'] = eq.eq3; vars['Eq4'] = eq.eq4;
      vars[pn.eq1_name] = eq.eq1; vars[pn.eq2_name] = eq.eq2;
      vars[pn.eq3_name] = eq.eq3; vars[pn.eq4_name] = eq.eq4;
    }

    // Product params
    const prod = model.products.find(p => p.id === operation.product_id);
    if (prod) {
      vars['Prod1'] = prod.prod1; vars['Prod2'] = prod.prod2; vars['Prod3'] = prod.prod3; vars['Prod4'] = prod.prod4;
      vars[pn.prod1_name] = prod.prod1; vars[pn.prod2_name] = prod.prod2;
      vars[pn.prod3_name] = prod.prod3; vars[pn.prod4_name] = prod.prod4;
      vars['LotSize'] = prod.lot_size;
      vars['Demand'] = prod.demand;
    }

    // Operation params
    vars['Oper1'] = operation.oper1 || 0; vars['Oper2'] = operation.oper2 || 0;
    vars['Oper3'] = operation.oper3 || 0; vars['Oper4'] = operation.oper4 || 0;
    vars[pn.oper1_name] = operation.oper1 || 0; vars[pn.oper2_name] = operation.oper2 || 0;
    vars[pn.oper3_name] = operation.oper3 || 0; vars[pn.oper4_name] = operation.oper4 || 0;

    // Replace variable names with values (longest first to avoid partial matches)
    let evalExpr = expr;
    const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      evalExpr = evalExpr.replace(regex, String(vars[key]));
    }

    // Only allow safe math characters
    if (/[^0-9+\-*/().%\s]/.test(evalExpr)) {
      return { result: null, error: 'Invalid characters in expression' };
    }

    // eslint-disable-next-line no-eval
    const result = Function(`"use strict"; return (${evalExpr})`)();
    if (typeof result !== 'number' || !isFinite(result)) {
      return { result: null, error: 'Expression did not evaluate to a valid number' };
    }
    return { result: Math.round(result * 10000) / 10000, error: null };
  } catch {
    return { result: null, error: 'Invalid formula syntax' };
  }
}

const VARIABLE_GROUPS = [
  { label: 'General', vars: ['Gen1', 'Gen2', 'Gen3', 'Gen4'] },
  { label: 'Equipment', vars: ['Eq1', 'Eq2', 'Eq3', 'Eq4'] },
  { label: 'Product', vars: ['Prod1', 'Prod2', 'Prod3', 'Prod4', 'LotSize', 'Demand'] },
  { label: 'Operation', vars: ['Oper1', 'Oper2', 'Oper3', 'Oper4'] },
];

export function FormulaBuilder({ open, onClose, model, operation, field, fieldLabel, currentValue, onApply }: FormulaBuilderProps) {
  const [formula, setFormula] = useState('');
  const pn = model.param_names;

  const nameMap: Record<string, string> = useMemo(() => ({
    Gen1: pn.gen1_name, Gen2: pn.gen2_name, Gen3: pn.gen3_name, Gen4: pn.gen4_name,
    Eq1: pn.eq1_name, Eq2: pn.eq2_name, Eq3: pn.eq3_name, Eq4: pn.eq4_name,
    Prod1: pn.prod1_name, Prod2: pn.prod2_name, Prod3: pn.prod3_name, Prod4: pn.prod4_name,
    Oper1: pn.oper1_name, Oper2: pn.oper2_name, Oper3: pn.oper3_name, Oper4: pn.oper4_name,
    LotSize: 'LotSize', Demand: 'Demand',
  }), [pn]);

  const evaluation = useMemo(() => {
    if (!formula.trim()) return { result: null, error: null };
    return evaluateFormula(formula, model, operation);
  }, [formula, model, operation]);

  const insertVar = (varName: string) => {
    setFormula(prev => prev + (prev && !prev.endsWith(' ') && !prev.endsWith('(') ? ' ' : '') + nameMap[varName]);
  };

  const handleApply = () => {
    if (evaluation.result !== null) {
      onApply(evaluation.result, formula);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Formula Builder
            <Badge variant="outline" className="font-mono text-xs">{fieldLabel}</Badge>
          </DialogTitle>
          <DialogDescription>
            Build a formula using model variables. Click a variable to insert it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Current value: <span className="font-mono font-semibold">{currentValue}</span></Label>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Formula Expression</Label>
            <Input
              value={formula}
              onChange={e => setFormula(e.target.value)}
              placeholder="e.g. Gen1 * Oper1 + 0.5"
              className="font-mono text-sm"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleApply(); }}
            />
          </div>

          {/* Variable Palette */}
          <Tabs defaultValue="General">
            <TabsList className="h-7">
              {VARIABLE_GROUPS.map(g => (
                <TabsTrigger key={g.label} value={g.label} className="text-xs h-6 px-2">{g.label}</TabsTrigger>
              ))}
            </TabsList>
            {VARIABLE_GROUPS.map(g => (
              <TabsContent key={g.label} value={g.label} className="mt-2">
                <div className="flex flex-wrap gap-1.5">
                  {g.vars.map(v => {
                    const displayName = nameMap[v] || v;
                    return (
                      <button
                        key={v}
                        onClick={() => insertVar(v)}
                        className="px-2 py-1 text-xs font-mono bg-muted hover:bg-primary/10 hover:text-primary rounded border border-border transition-colors"
                      >
                        {displayName}
                      </button>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Operators */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Operators</Label>
            <div className="flex gap-1">
              {['+', '-', '*', '/', '(', ')'].map(op => (
                <button key={op} onClick={() => setFormula(f => f + ` ${op} `)}
                  className="w-8 h-8 text-sm font-mono bg-muted hover:bg-accent rounded border border-border transition-colors">
                  {op}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className={`p-3 rounded-md border ${evaluation.error ? 'border-destructive/30 bg-destructive/5' : evaluation.result !== null ? 'border-success/30 bg-success/5' : 'border-border bg-muted/30'}`}>
            <Label className="text-xs text-muted-foreground">Result Preview</Label>
            {evaluation.error ? (
              <p className="text-sm text-destructive font-medium mt-1">{evaluation.error}</p>
            ) : evaluation.result !== null ? (
              <p className="text-lg font-mono font-bold text-success mt-1">{evaluation.result}</p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Enter a formula above</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={evaluation.result === null}>
            Apply ({evaluation.result ?? '—'})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
