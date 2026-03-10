import { useModelStore, type ParamNames } from '@/stores/modelStore';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tag, Info } from 'lucide-react';

const ROWS: { key: keyof ParamNames; variable: string; category: string }[] = [
  { key: 'gen1_name', variable: 'Gen1', category: 'General' },
  { key: 'gen2_name', variable: 'Gen2', category: 'General' },
  { key: 'gen3_name', variable: 'Gen3', category: 'General' },
  { key: 'gen4_name', variable: 'Gen4', category: 'General' },
  { key: 'lab1_name', variable: 'Lab1', category: 'Labor' },
  { key: 'lab2_name', variable: 'Lab2', category: 'Labor' },
  { key: 'lab3_name', variable: 'Lab3', category: 'Labor' },
  { key: 'lab4_name', variable: 'Lab4', category: 'Labor' },
  { key: 'eq1_name', variable: 'Eq1', category: 'Equipment' },
  { key: 'eq2_name', variable: 'Eq2', category: 'Equipment' },
  { key: 'eq3_name', variable: 'Eq3', category: 'Equipment' },
  { key: 'eq4_name', variable: 'Eq4', category: 'Equipment' },
  { key: 'prod1_name', variable: 'Prod1', category: 'Product' },
  { key: 'prod2_name', variable: 'Prod2', category: 'Product' },
  { key: 'prod3_name', variable: 'Prod3', category: 'Product' },
  { key: 'prod4_name', variable: 'Prod4', category: 'Product' },
  { key: 'oper1_name', variable: 'Oper1', category: 'Operation' },
  { key: 'oper2_name', variable: 'Oper2', category: 'Operation' },
  { key: 'oper3_name', variable: 'Oper3', category: 'Operation' },
  { key: 'oper4_name', variable: 'Oper4', category: 'Operation' },
];

export default function ParameterNames() {
  const model = useModelStore(s => s.getActiveModel());
  const updateParamNames = useModelStore(s => s.updateParamNames);

  if (!model) return (
    <div className="p-6 max-w-3xl space-y-4">
      <div className="h-7 w-48 bg-muted animate-pulse rounded" />
      <div className="h-64 bg-muted animate-pulse rounded-lg mt-6" />
    </div>
  );

  const pn = model.param_names;

  return (
    <div className="p-6 max-w-3xl animate-fade-in">
      <h1 className="text-xl font-bold flex items-center gap-2 mb-1">
        <Tag className="h-5 w-5 text-primary" /> Parameter Names
      </h1>
      <p className="text-sm text-muted-foreground mb-2">
        Renaming a parameter updates its label throughout the app. Names are saved per model.
      </p>

      <div className="mb-6 flex items-start gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground bg-muted/50 border border-border">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          Rename the custom variables (Gen1–Gen4, Lab1–Lab4, Eq1–Eq4, Prod1–Prod4, Oper1–Oper4) used in the Formula Builder in Operations/Routing. Once renamed, the new labels appear throughout the app.
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-xs w-24">Variable</TableHead>
                <TableHead className="font-mono text-xs w-28">Category</TableHead>
                <TableHead className="font-mono text-xs">Display Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map(row => (
                <TableRow key={row.key}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {row.variable}
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-gray-400 cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[280px] text-xs">Custom variable — rename using the Display Name field. The renamed label will appear throughout the app and can be used in the Formula Builder.</TooltipContent></Tooltip></TooltipProvider>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-mono">{row.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 w-48 font-mono text-xs"
                      maxLength={20}
                      value={pn[row.key]}
                      onChange={e => updateParamNames(model.id, { [row.key]: e.target.value })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
