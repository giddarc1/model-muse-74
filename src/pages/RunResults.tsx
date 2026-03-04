import { useState } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, CheckCircle, AlertTriangle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// Mock result data for the demo model
const mockEquipUtil = [
  { name: 'BENCH',    setup: 8,  run: 22, repair: 0, waitLabor: 3,  idle: 67 },
  { name: 'VT_LATHE', setup: 15, run: 45, repair: 8, waitLabor: 7,  idle: 25 },
  { name: 'DEBURR',   setup: 5,  run: 18, repair: 0, waitLabor: 2,  idle: 75 },
  { name: 'INSPECT',  setup: 4,  run: 28, repair: 0, waitLabor: 5,  idle: 63 },
  { name: 'REWORK',   setup: 3,  run: 12, repair: 0, waitLabor: 1,  idle: 84 },
  { name: 'MILL',     setup: 12, run: 38, repair: 5, waitLabor: 8,  idle: 37 },
  { name: 'DRILL',    setup: 6,  run: 20, repair: 0, waitLabor: 4,  idle: 70 },
];

const mockLaborUtil = [
  { name: 'PREP',     setup: 10, run: 25, unavail: 5, idle: 60 },
  { name: 'MACHINST', setup: 18, run: 42, unavail: 5, idle: 35 },
  { name: 'INSPECTR', setup: 6,  run: 30, unavail: 5, idle: 59 },
  { name: 'REPAIR',   setup: 5,  run: 15, unavail: 10, idle: 70 },
];

const mockProductMCT = [
  { name: 'HUB1',    lotWait: 2.1, queue: 4.5, waitLabor: 1.2, setup: 0.8, run: 1.5 },
  { name: 'HUB2',    lotWait: 2.0, queue: 4.2, waitLabor: 1.1, setup: 0.7, run: 1.4 },
  { name: 'HUB3',    lotWait: 1.8, queue: 3.8, waitLabor: 1.0, setup: 0.6, run: 1.2 },
  { name: 'HUB4',    lotWait: 1.8, queue: 3.9, waitLabor: 1.0, setup: 0.6, run: 1.3 },
  { name: 'SLEEVE',  lotWait: 0.5, queue: 1.2, waitLabor: 0.3, setup: 0.2, run: 0.4 },
  { name: 'MOUNT',   lotWait: 0.8, queue: 1.8, waitLabor: 0.4, setup: 0.3, run: 0.6 },
  { name: 'BRACKET', lotWait: 0.3, queue: 0.8, waitLabor: 0.1, setup: 0.1, run: 0.2 },
  { name: 'BOLT',    lotWait: 0.2, queue: 0.5, waitLabor: 0.1, setup: 0.1, run: 0.1 },
];

const mockSummary = [
  { product: 'HUB1', goodMade: 2100, goodShipped: 2100, started: 2210, scrap: 110, wip: 85, mct: 10.1 },
  { product: 'HUB2', goodMade: 1680, goodShipped: 1680, started: 1764, scrap: 84,  wip: 68, mct: 9.4 },
  { product: 'HUB3', goodMade: 1260, goodShipped: 1260, started: 1323, scrap: 63,  wip: 52, mct: 8.4 },
  { product: 'HUB4', goodMade: 1260, goodShipped: 1260, started: 1323, scrap: 63,  wip: 53, mct: 8.6 },
  { product: 'SLEEVE', goodMade: 6300, goodShipped: 0, started: 6300, scrap: 0, wip: 25, mct: 2.6 },
  { product: 'MOUNT', goodMade: 25200, goodShipped: 0, started: 25200, scrap: 0, wip: 98, mct: 3.9 },
  { product: 'BRACKET', goodMade: 50400, goodShipped: 0, started: 50400, scrap: 0, wip: 35, mct: 1.5 },
  { product: 'BOLT', goodMade: 50400, goodShipped: 0, started: 50400, scrap: 0, wip: 22, mct: 1.0 },
];

type RunMode = 'full' | 'verify' | 'util_only';

export default function RunResults() {
  const model = useModelStore((s) => s.getActiveModel());
  const [runMode, setRunMode] = useState<RunMode>('full');
  const [hasRun, setHasRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  if (!model) return null;

  const handleRun = () => {
    setIsRunning(true);
    // Simulate calculation delay
    setTimeout(() => {
      setIsRunning(false);
      setHasRun(true);
      toast.success(
        runMode === 'full' ? 'Full calculation complete — all production targets achievable' :
        runMode === 'verify' ? 'Data verification complete — no errors found' :
        'Utilization calculation complete'
      );
    }, 1200);
  };

  const chartColors = {
    setup: 'hsl(217, 91%, 60%)',
    run: 'hsl(142, 71%, 45%)',
    repair: 'hsl(0, 72%, 51%)',
    waitLabor: 'hsl(38, 92%, 50%)',
    unavail: 'hsl(220, 9%, 46%)',
    lotWait: 'hsl(270, 50%, 60%)',
    queue: 'hsl(0, 72%, 51%)',
  };

  return (
    <div className="p-6 animate-fade-in">
      <h1 className="text-xl font-bold mb-1">Run & Results</h1>
      <p className="text-sm text-muted-foreground mb-6">Execute calculations and view model outputs.</p>

      {/* Run Control Panel */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Run Mode</Label>
              <div className="flex gap-2">
                <Button
                  variant={runMode === 'full' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRunMode('full')}
                  className="text-xs"
                >
                  <Play className="h-3.5 w-3.5 mr-1" /> Full Calculate
                </Button>
                <Button
                  variant={runMode === 'verify' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRunMode('verify')}
                  className="text-xs"
                >
                  <Shield className="h-3.5 w-3.5 mr-1" /> Verify Data
                </Button>
                <Button
                  variant={runMode === 'util_only' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRunMode('util_only')}
                  className="text-xs"
                >
                  Utilization Only
                </Button>
              </div>
            </div>
            <Button
              size="lg"
              onClick={handleRun}
              disabled={isRunning}
              className="gap-2 px-8"
            >
              {isRunning ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
                  Calculating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  {runMode === 'full' ? 'Run Full Calculate' : runMode === 'verify' ? 'Verify Data' : 'Calculate Utilization'}
                </>
              )}
            </Button>
          </div>
          {hasRun && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-md">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm text-success font-medium">All production targets can be achieved. Results are current.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Area */}
      {hasRun && (
        <Tabs defaultValue="equipment">
          <TabsList>
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
            <TabsTrigger value="labor">Labor</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          {/* Equipment Tab */}
          <TabsContent value="equipment" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Equipment Utilization</CardTitle>
                <CardDescription>Stacked utilization breakdown by equipment group</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={mockEquipUtil} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: '% Utilization', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={model.general.util_limit} stroke="hsl(0, 72%, 51%)" strokeDasharray="5 5" label={{ value: `Limit ${model.general.util_limit}%`, position: 'right', style: { fontSize: 10, fill: 'hsl(0, 72%, 51%)' } }} />
                    <Bar dataKey="setup" stackId="a" fill={chartColors.setup} name="Setup" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="run" stackId="a" fill={chartColors.run} name="Run" />
                    <Bar dataKey="repair" stackId="a" fill={chartColors.repair} name="Repair" />
                    <Bar dataKey="waitLabor" stackId="a" fill={chartColors.waitLabor} name="Wait for Labor" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Equipment Results Table</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-xs">Equipment</TableHead>
                      <TableHead className="font-mono text-xs text-right">Count</TableHead>
                      <TableHead className="font-mono text-xs text-right">Setup %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Run %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Repair %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Wait Labor %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Total %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Idle %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockEquipUtil.map((eq) => {
                      const total = eq.setup + eq.run + eq.repair + eq.waitLabor;
                      const eqData = model.equipment.find((e) => e.name === eq.name);
                      return (
                        <TableRow key={eq.name}>
                          <TableCell className="font-mono font-medium">{eq.name}</TableCell>
                          <TableCell className="font-mono text-right">{eqData?.count ?? '—'}</TableCell>
                          <TableCell className="font-mono text-right">{eq.setup}</TableCell>
                          <TableCell className="font-mono text-right">{eq.run}</TableCell>
                          <TableCell className="font-mono text-right">{eq.repair}</TableCell>
                          <TableCell className="font-mono text-right">{eq.waitLabor}</TableCell>
                          <TableCell className={`font-mono text-right font-medium ${total > model.general.util_limit ? 'text-destructive' : ''}`}>{total}</TableCell>
                          <TableCell className="font-mono text-right text-muted-foreground">{eq.idle}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Labor Tab */}
          <TabsContent value="labor" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Labor Utilization</CardTitle>
                <CardDescription>Utilization breakdown by labor group</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mockLaborUtil} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={model.general.util_limit} stroke="hsl(0, 72%, 51%)" strokeDasharray="5 5" />
                    <Bar dataKey="setup" stackId="a" fill={chartColors.setup} name="Setup" />
                    <Bar dataKey="run" stackId="a" fill={chartColors.run} name="Run" />
                    <Bar dataKey="unavail" stackId="a" fill={chartColors.unavail} name="Unavailable" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Labor Results Table</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-xs">Labor Group</TableHead>
                      <TableHead className="font-mono text-xs text-right">Count</TableHead>
                      <TableHead className="font-mono text-xs text-right">Setup %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Run %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Unavail %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Total %</TableHead>
                      <TableHead className="font-mono text-xs text-right">Idle %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockLaborUtil.map((l) => {
                      const total = l.setup + l.run + l.unavail;
                      const lData = model.labor.find((lb) => lb.name === l.name);
                      return (
                        <TableRow key={l.name}>
                          <TableCell className="font-mono font-medium">{l.name}</TableCell>
                          <TableCell className="font-mono text-right">{lData?.count ?? '—'}</TableCell>
                          <TableCell className="font-mono text-right">{l.setup}</TableCell>
                          <TableCell className="font-mono text-right">{l.run}</TableCell>
                          <TableCell className="font-mono text-right">{l.unavail}</TableCell>
                          <TableCell className="font-mono text-right font-medium">{total}</TableCell>
                          <TableCell className="font-mono text-right text-muted-foreground">{l.idle}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product MCT (Manufacturing Cycle Time)</CardTitle>
                <CardDescription>MCT breakdown by product in {model.general.mct_time_unit}s</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={mockProductMCT} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: `MCT (${model.general.mct_time_unit})`, angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="lotWait" stackId="a" fill={chartColors.lotWait} name="Lot Waiting" />
                    <Bar dataKey="queue" stackId="a" fill={chartColors.queue} name="Queue" />
                    <Bar dataKey="waitLabor" stackId="a" fill={chartColors.waitLabor} name="Wait for Labor" />
                    <Bar dataKey="setup" stackId="a" fill={chartColors.setup} name="Setup" />
                    <Bar dataKey="run" stackId="a" fill={chartColors.run} name="Run" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Output Summary</CardTitle>
                <CardDescription>Consolidated production metrics for all products (Basecase)</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-xs">Product</TableHead>
                      <TableHead className="font-mono text-xs text-right">Good Made</TableHead>
                      <TableHead className="font-mono text-xs text-right">Good Shipped</TableHead>
                      <TableHead className="font-mono text-xs text-right">Started</TableHead>
                      <TableHead className="font-mono text-xs text-right">Scrap</TableHead>
                      <TableHead className="font-mono text-xs text-right">WIP</TableHead>
                      <TableHead className="font-mono text-xs text-right">MCT ({model.general.mct_time_unit})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockSummary.map((row) => (
                      <TableRow key={row.product}>
                        <TableCell className="font-mono font-medium">{row.product}</TableCell>
                        <TableCell className="font-mono text-right">{row.goodMade.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-right">{row.goodShipped.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-right">{row.started.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-right">{row.scrap > 0 ? row.scrap.toLocaleString() : '—'}</TableCell>
                        <TableCell className="font-mono text-right">{row.wip}</TableCell>
                        <TableCell className="font-mono text-right font-medium">{row.mct.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 font-medium">
                      <TableCell className="font-mono">TOTAL</TableCell>
                      <TableCell className="font-mono text-right">{mockSummary.reduce((s, r) => s + r.goodMade, 0).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-right">{mockSummary.reduce((s, r) => s + r.goodShipped, 0).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-right">{mockSummary.reduce((s, r) => s + r.started, 0).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-right">{mockSummary.reduce((s, r) => s + r.scrap, 0).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-right">{mockSummary.reduce((s, r) => s + r.wip, 0)}</TableCell>
                      <TableCell className="font-mono text-right">—</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!hasRun && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Play className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No results yet</p>
            <p className="text-sm mt-1">Click "Run Full Calculate" above to compute MCT, WIP, and utilization metrics.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-sm font-medium ${className || ''}`}>{children}</label>;
}
