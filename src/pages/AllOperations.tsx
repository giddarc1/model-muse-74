import { useState, useMemo, useCallback } from 'react';
import { useModelStore, type Operation } from '@/stores/modelStore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Grid3X3, ClipboardPaste, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function AllOperations() {
  const model = useModelStore(s => s.getActiveModel());
  const updateOperation = useModelStore(s => s.updateOperation);
  const [filter, setFilter] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const rows = useMemo(() => {
    if (!model) return [];
    return model.operations
      .map(op => {
        const product = model.products.find(p => p.id === op.product_id);
        const equip = model.equipment.find(e => e.id === op.equip_id);
        return { op, productName: product?.name || '—', equipName: equip?.name || '—' };
      })
      .filter(r =>
        !filter ||
        r.productName.toLowerCase().includes(filter.toLowerCase()) ||
        r.op.op_name.toLowerCase().includes(filter.toLowerCase())
      )
      .sort((a, b) => {
        const pCmp = a.productName.localeCompare(b.productName);
        return pCmp !== 0 ? pCmp : a.op.op_number - b.op.op_number;
      });
  }, [model, filter]);

  const handlePaste = useCallback(async () => {
    if (!model) return;
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.trim().split('\n').map(l => l.split('\t'));
      let updated = 0;
      lines.forEach(cols => {
        if (cols.length < 9) return;
        const [prodName, , opNumStr, , , setupStr, runStr, lSetupStr, lRunStr] = cols;
        const opNum = parseInt(opNumStr);
        const op = model.operations.find(o => {
          const p = model.products.find(pp => pp.id === o.product_id);
          return p?.name === prodName && o.op_number === opNum;
        });
        if (op) {
          const updates: Partial<Operation> = {};
          if (!isNaN(+setupStr)) updates.equip_setup_lot = +setupStr;
          if (!isNaN(+runStr)) updates.equip_run_piece = +runStr;
          if (!isNaN(+lSetupStr)) updates.labor_setup_lot = +lSetupStr;
          if (!isNaN(+lRunStr)) updates.labor_run_piece = +lRunStr;
          if (Object.keys(updates).length > 0) {
            updateOperation(model.id, op.id, updates);
            updated++;
          }
        }
      });
      toast.success(`Pasted — ${updated} operations updated`);
    } catch {
      toast.error('Could not read clipboard');
    }
  }, [model, updateOperation]);

  if (!model) return null;

  const pn = model.param_names;

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-primary" /> All Operations
          </h1>
          <p className="text-sm text-muted-foreground">
            Cross-product operations grid — {model.operations.length} operations across {model.products.length} products
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="gap-1 text-xs">
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAdvanced ? 'Hide Advanced Data' : 'Show Advanced Data'}
          </Button>
          <Input
            placeholder="Filter by product or op name…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="h-8 w-56 text-xs"
          />
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handlePaste}>
            <ClipboardPaste className="h-3.5 w-3.5" /> Paste
          </Button>
        </div>
      </div>

      {/* Info note */}
      <div className="mb-4 flex items-start gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground bg-muted/50 border border-border">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>This screen shows all operations across all products. It is best used for bulk data entry or copy-paste from external systems. To manage routing, use the Operations tab.</span>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-xs sticky left-0 bg-card z-10">Product</TableHead>
                <TableHead className="font-mono text-xs">Op Name</TableHead>
                <TableHead className="font-mono text-xs w-16">Op #</TableHead>
                <TableHead className="font-mono text-xs">Equipment</TableHead>
                <TableHead className="font-mono text-xs w-20">% Assign</TableHead>
                <TableHead className="font-mono text-xs">E.Setup/Lot</TableHead>
                <TableHead className="font-mono text-xs">E.Run/Pc</TableHead>
                <TableHead className="font-mono text-xs">L.Setup/Lot</TableHead>
                <TableHead className="font-mono text-xs">L.Run/Pc</TableHead>
                {showAdvanced && <>
                  <TableHead className="font-mono text-xs">E.Setup/TBatch</TableHead>
                  <TableHead className="font-mono text-xs">E.Setup/Pc</TableHead>
                  <TableHead className="font-mono text-xs">E.Run/Lot</TableHead>
                  <TableHead className="font-mono text-xs">E.Run/TBatch</TableHead>
                  <TableHead className="font-mono text-xs">L.Setup/TBatch</TableHead>
                  <TableHead className="font-mono text-xs">L.Setup/Pc</TableHead>
                  <TableHead className="font-mono text-xs">L.Run/Lot</TableHead>
                  <TableHead className="font-mono text-xs">L.Run/TBatch</TableHead>
                  <TableHead className="font-mono text-xs">{pn.oper1_name}</TableHead>
                  <TableHead className="font-mono text-xs">{pn.oper2_name}</TableHead>
                  <TableHead className="font-mono text-xs">{pn.oper3_name}</TableHead>
                  <TableHead className="font-mono text-xs">{pn.oper4_name}</TableHead>
                </>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const showProductHeader = i === 0 || rows[i - 1].productName !== r.productName;
                return (
                  <TableRow key={r.op.id} className={showProductHeader ? 'border-t-2 border-border' : ''}>
                    <TableCell className="font-mono font-medium sticky left-0 bg-card z-10">
                      {showProductHeader ? (
                        <Badge variant="outline" className="font-mono text-xs">{r.productName}</Badge>
                      ) : (
                        <span className="text-muted-foreground/30">↳</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">{r.op.op_name}</TableCell>
                    <TableCell>
                      <Input type="number" className="h-7 w-16 font-mono text-xs" value={r.op.op_number}
                        onChange={e => updateOperation(model.id, r.op.id, { op_number: +e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Select value={r.op.equip_id || 'none'}
                        onValueChange={v => updateOperation(model.id, r.op.id, { equip_id: v === 'none' ? '' : v })}>
                        <SelectTrigger className="h-7 w-28 font-mono text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {model.equipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input type="number" className="h-7 w-16 font-mono text-xs" value={r.op.pct_assigned}
                        onChange={e => updateOperation(model.id, r.op.id, { pct_assigned: +e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.1" className="h-7 w-20 font-mono text-xs" value={r.op.equip_setup_lot}
                        onChange={e => updateOperation(model.id, r.op.id, { equip_setup_lot: +e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" className="h-7 w-20 font-mono text-xs" value={r.op.equip_run_piece}
                        onChange={e => updateOperation(model.id, r.op.id, { equip_run_piece: +e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.1" className="h-7 w-20 font-mono text-xs" value={r.op.labor_setup_lot}
                        onChange={e => updateOperation(model.id, r.op.id, { labor_setup_lot: +e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" className="h-7 w-20 font-mono text-xs" value={r.op.labor_run_piece}
                        onChange={e => updateOperation(model.id, r.op.id, { labor_run_piece: +e.target.value })} />
                    </TableCell>
                    {showAdvanced && <>
                      <TableCell><Input type="number" step="0.1" className="h-7 w-20 font-mono text-xs" value={r.op.equip_setup_tbatch} onChange={e => updateOperation(model.id, r.op.id, { equip_setup_tbatch: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" className="h-7 w-20 font-mono text-xs" value={r.op.equip_setup_piece} onChange={e => updateOperation(model.id, r.op.id, { equip_setup_piece: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.1" className="h-7 w-20 font-mono text-xs" value={r.op.equip_run_lot} onChange={e => updateOperation(model.id, r.op.id, { equip_run_lot: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.1" className="h-7 w-20 font-mono text-xs" value={r.op.equip_run_tbatch} onChange={e => updateOperation(model.id, r.op.id, { equip_run_tbatch: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.1" className="h-7 w-20 font-mono text-xs" value={r.op.labor_setup_tbatch} onChange={e => updateOperation(model.id, r.op.id, { labor_setup_tbatch: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" className="h-7 w-20 font-mono text-xs" value={r.op.labor_setup_piece} onChange={e => updateOperation(model.id, r.op.id, { labor_setup_piece: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.1" className="h-7 w-20 font-mono text-xs" value={r.op.labor_run_lot} onChange={e => updateOperation(model.id, r.op.id, { labor_run_lot: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.1" className="h-7 w-20 font-mono text-xs" value={r.op.labor_run_tbatch} onChange={e => updateOperation(model.id, r.op.id, { labor_run_tbatch: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" className="h-7 w-20 font-mono text-xs" value={r.op.oper1} onChange={e => updateOperation(model.id, r.op.id, { oper1: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" className="h-7 w-20 font-mono text-xs" value={r.op.oper2} onChange={e => updateOperation(model.id, r.op.id, { oper2: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" className="h-7 w-20 font-mono text-xs" value={r.op.oper3} onChange={e => updateOperation(model.id, r.op.id, { oper3: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" className="h-7 w-20 font-mono text-xs" value={r.op.oper4} onChange={e => updateOperation(model.id, r.op.id, { oper4: +e.target.value })} /></TableCell>
                    </>}
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
