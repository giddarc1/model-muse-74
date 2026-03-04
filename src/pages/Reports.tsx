import { useState, useRef, useCallback } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useResultsStore } from '@/stores/resultsStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Printer, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const REPORT_SECTIONS = [
  { key: 'equip_util_chart', label: 'Equipment Utilization Chart' },
  { key: 'equip_results_table', label: 'Equipment Results Table' },
  { key: 'labor_util_chart', label: 'Labor Utilization Chart' },
  { key: 'labor_results_table', label: 'Labor Results Table' },
  { key: 'equip_wip', label: 'Equipment WIP' },
  { key: 'product_wip', label: 'Product WIP' },
  { key: 'product_mct_chart', label: 'Product MCT Chart' },
  { key: 'output_summary', label: 'Output Summary' },
  { key: 'ibom_tree', label: 'IBOM Tree' },
  { key: 'ibom_poles', label: 'IBOM Poles' },
] as const;

type SectionKey = typeof REPORT_SECTIONS[number]['key'];

export default function Reports() {
  const model = useModelStore(s => s.getActiveModel());
  const basecaseResults = useResultsStore(s => s.getResults('basecase'));
  const scenarios = useScenarioStore(s => s.scenarios);

  const [selected, setSelected] = useState<Set<SectionKey>>(
    new Set(REPORT_SECTIONS.map(s => s.key))
  );
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeScenarioNames, setIncludeScenarioNames] = useState(true);

  const toggle = (key: SectionKey) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(REPORT_SECTIONS.map(s => s.key)));
  const selectNone = () => setSelected(new Set());

  if (!model) return null;

  const hasResults = !!basecaseResults;

  const handlePDF = () => {
    window.print();
    toast.success('Print dialog opened');
  };

  const handleExcel = () => {
    if (!basecaseResults) {
      toast.error('No results to export. Run a calculation first.');
      return;
    }

    const wb = XLSX.utils.book_new();

    if (selected.has('equip_results_table') || selected.has('equip_util_chart')) {
      const data = basecaseResults.equipment.map(e => ({
        Equipment: e.name, Count: e.count,
        'Setup %': e.setupUtil, 'Run %': e.runUtil, 'Repair %': e.repairUtil,
        'Wait Labor %': e.waitLaborUtil, 'Total %': e.totalUtil, 'Idle %': e.idle,
        Labor: e.laborGroup,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Equipment');
    }

    if (selected.has('labor_results_table') || selected.has('labor_util_chart')) {
      const data = basecaseResults.labor.map(l => ({
        'Labor Group': l.name, Count: l.count,
        'Setup %': l.setupUtil, 'Run %': l.runUtil,
        'Unavail %': l.unavailPct, 'Total %': l.totalUtil, 'Idle %': l.idle,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Labor');
    }

    if (selected.has('output_summary') || selected.has('product_mct_chart') || selected.has('product_wip')) {
      const data = basecaseResults.products.map(p => ({
        Product: p.name, Demand: p.demand, 'Lot Size': p.lotSize,
        'Good Made': p.goodMade, 'Good Shipped': p.goodShipped,
        Started: p.started, Scrap: p.scrap, WIP: p.wip,
        [`MCT (${model.general.mct_time_unit})`]: p.mct,
        'MCT Run': p.mctRun, 'MCT Setup': p.mctSetup,
        'MCT Queue': p.mctQueue, 'MCT Lot Wait': p.mctLotWait,
        'MCT Wait Labor': p.mctWaitLabor,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Products');
    }

    if (includeHeader) {
      const info = [
        { Field: 'Model', Value: model.name },
        { Field: 'Date', Value: new Date().toLocaleDateString() },
        { Field: 'Author', Value: model.general.author },
        { Field: 'Time Units', Value: `${model.general.ops_time_unit} → ${model.general.mct_time_unit} → ${model.general.prod_period_unit}` },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), 'Model Info');
    }

    XLSX.writeFile(wb, `${model.name.replace(/\s+/g, '_')}_Report.xlsx`);
    toast.success('Excel report downloaded');
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Reports
          </h1>
          <p className="text-sm text-muted-foreground">Configure and export model reports</p>
        </div>
      </div>

      {!hasResults && (
        <Card className="mb-6">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-warning mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">No calculation results available. Run a Full Calculate first to generate reports.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Report Contents</CardTitle>
            <CardDescription>Select outputs to include</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={selectAll}>All</Button>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={selectNone}>None</Button>
            </div>

            <div className="space-y-2.5">
              {REPORT_SECTIONS.map(sec => (
                <label key={sec.key} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={selected.has(sec.key)}
                    onCheckedChange={() => toggle(sec.key)}
                  />
                  {sec.label}
                </label>
              ))}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Include model name & date</Label>
                <Switch checked={includeHeader} onCheckedChange={setIncludeHeader} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Include scenario names on charts</Label>
                <Switch checked={includeScenarioNames} onCheckedChange={setIncludeScenarioNames} />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Button className="w-full gap-2" onClick={handlePDF} disabled={!hasResults}>
                <Printer className="h-4 w-4" /> Export PDF (Print)
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={handleExcel} disabled={!hasResults}>
                <Download className="h-4 w-4" /> Export Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="lg:col-span-2 print:shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Report Preview</CardTitle>
            <CardDescription>
              {selected.size} of {REPORT_SECTIONS.length} sections selected
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasResults ? (
              <p className="text-sm text-muted-foreground text-center py-8">Run a calculation to see report preview.</p>
            ) : (
              <div className="space-y-6 print:space-y-4" id="report-content">
                {includeHeader && (
                  <div className="border-b border-border pb-4">
                    <h2 className="text-lg font-bold">{model.name}</h2>
                    <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString()} · Author: {model.general.author}</p>
                  </div>
                )}

                {selected.has('equip_results_table') && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Equipment Results</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Equipment</TableHead>
                          <TableHead className="text-xs text-right">Count</TableHead>
                          <TableHead className="text-xs text-right">Total %</TableHead>
                          <TableHead className="text-xs text-right">Idle %</TableHead>
                          <TableHead className="text-xs">Labor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {basecaseResults.equipment.map(e => (
                          <TableRow key={e.id}>
                            <TableCell className="font-mono text-xs">{e.name}</TableCell>
                            <TableCell className="font-mono text-xs text-right">{e.count}</TableCell>
                            <TableCell className="font-mono text-xs text-right">{e.totalUtil}</TableCell>
                            <TableCell className="font-mono text-xs text-right">{e.idle}</TableCell>
                            <TableCell className="font-mono text-xs">{e.laborGroup}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {selected.has('labor_results_table') && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Labor Results</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Group</TableHead>
                          <TableHead className="text-xs text-right">Count</TableHead>
                          <TableHead className="text-xs text-right">Total %</TableHead>
                          <TableHead className="text-xs text-right">Idle %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {basecaseResults.labor.map(l => (
                          <TableRow key={l.id}>
                            <TableCell className="font-mono text-xs">{l.name}</TableCell>
                            <TableCell className="font-mono text-xs text-right">{l.count}</TableCell>
                            <TableCell className="font-mono text-xs text-right">{l.totalUtil}</TableCell>
                            <TableCell className="font-mono text-xs text-right">{l.idle}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {selected.has('output_summary') && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Output Summary</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Product</TableHead>
                          <TableHead className="text-xs text-right">Demand</TableHead>
                          <TableHead className="text-xs text-right">WIP</TableHead>
                          <TableHead className="text-xs text-right">MCT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {basecaseResults.products.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">{p.name}</TableCell>
                            <TableCell className="font-mono text-xs text-right">{p.demand}</TableCell>
                            <TableCell className="font-mono text-xs text-right">{p.wip}</TableCell>
                            <TableCell className="font-mono text-xs text-right">{p.mct.toFixed(4)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
