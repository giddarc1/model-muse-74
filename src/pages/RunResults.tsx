import { useState, useMemo } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useResultsStore } from '@/stores/resultsStore';
import { calculate, verifyData, type CalcResults, type ProductResult, type EquipmentResult } from '@/lib/calculationEngine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, CheckCircle, AlertTriangle, Shield, XCircle, RotateCcw, Network } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

type RunMode = 'full' | 'verify' | 'util_only';

export default function RunResults() {
  const model = useModelStore(s => s.getActiveModel());
  const setRunStatus = useModelStore(s => s.setRunStatus);
  const allScenarios = useScenarioStore(s => s.scenarios);
  const activeScenarioId = useScenarioStore(s => s.activeScenarioId);
  const displayIds = useScenarioStore(s => s.displayScenarioIds);
  const markCalculated = useScenarioStore(s => s.markCalculated);
  const { setResults, getResults } = useResultsStore();

  const [runMode, setRunMode] = useState<RunMode>('full');
  const [isRunning, setIsRunning] = useState(false);
  const [verifyMessages, setVerifyMessages] = useState<{ errors: string[]; warnings: string[] } | null>(null);
  const [transposed, setTransposed] = useState(false);
  const [ibomProduct, setIbomProduct] = useState('');

  if (!model) return null;

  const activeScenario = allScenarios.find(s => s.id === activeScenarioId) || null;
  const modelScenarios = allScenarios.filter(s => s.modelId === model.id);
  const resultKey = activeScenario ? activeScenario.id : 'basecase';
  const results = getResults(resultKey);
  const basecaseResults = getResults('basecase');
  const hasRun = !!results;

  // Scenario results for display
  const displayScenarioResults = displayIds
    .map(id => ({ id, scenario: modelScenarios.find(s => s.id === id), results: getResults(id) }))
    .filter(d => d.scenario && d.results) as { id: string; scenario: typeof modelScenarios[0]; results: CalcResults }[];

  const handleRun = () => {
    if (runMode === 'verify') {
      const msgs = verifyData(model);
      setVerifyMessages(msgs);
      if (msgs.errors.length === 0 && msgs.warnings.length === 0) {
        toast.success('Data verification complete — no issues found');
      } else {
        toast.warning(`Found ${msgs.errors.length} error(s) and ${msgs.warnings.length} warning(s)`);
      }
      return;
    }

    setIsRunning(true);
    setTimeout(() => {
      const calcResults = calculate(model, activeScenario);
      setResults(resultKey, calcResults);
      setRunStatus(model.id, 'current');
      if (activeScenario) markCalculated(activeScenario.id);
      setIsRunning(false);
      setVerifyMessages(null);

      if (calcResults.errors.length > 0) {
        toast.error(calcResults.errors[0]);
      } else if (calcResults.overLimitResources.length > 0) {
        toast.warning(`${calcResults.overLimitResources.length} resource(s) exceed utilization limit`);
      } else {
        toast.success(runMode === 'full' ? 'Full calculation complete — all production targets achievable' : 'Utilization calculation complete');
      }
    }, 100);
  };

  const chartColors = {
    setup: 'hsl(217, 91%, 60%)', run: 'hsl(142, 71%, 45%)',
    repair: 'hsl(0, 72%, 51%)', waitLabor: 'hsl(38, 92%, 50%)',
    unavail: 'hsl(220, 9%, 46%)', lotWait: 'hsl(270, 50%, 60%)', queue: 'hsl(0, 72%, 51%)',
  };

  const equipChartData = results?.equipment.map(e => ({
    name: e.name, setup: e.setupUtil, run: e.runUtil, repair: e.repairUtil, waitLabor: e.waitLaborUtil,
  })) || [];

  const laborChartData = results?.labor.map(l => ({
    name: l.name, setup: l.setupUtil, run: l.runUtil, unavail: l.unavailPct,
  })) || [];

  const productChartData = results?.products.map(p => ({
    name: p.name, lotWait: p.mctLotWait, queue: p.mctQueue, waitLabor: p.mctWaitLabor, setup: p.mctSetup, run: p.mctRun,
  })) || [];

  // IBOM Tree data
  const ibomSelectedProduct = ibomProduct || (model.products.find(p => p.demand > 0)?.id || '');

  return (
    <div className="p-6 animate-fade-in">
      <h1 className="text-xl font-bold mb-1">Run & Results</h1>
      <p className="text-sm text-muted-foreground mb-1">
        Execute calculations and view model outputs.
        {activeScenario && (
          <Badge className="ml-2 bg-warning/20 text-warning text-[10px] border-0">Scenario: {activeScenario.name}</Badge>
        )}
      </p>
      {model.run_status === 'needs_recalc' && hasRun && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-md">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="text-sm text-warning font-medium">Model data has changed since last run. Recalculation needed.</span>
        </div>
      )}

      {/* Run Control Panel */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1.5 block">Run Mode</label>
              <div className="flex gap-2">
                <Button variant={runMode === 'full' ? 'default' : 'outline'} size="sm" onClick={() => setRunMode('full')} className="text-xs">
                  <Play className="h-3.5 w-3.5 mr-1" /> Full Calculate
                </Button>
                <Button variant={runMode === 'verify' ? 'default' : 'outline'} size="sm" onClick={() => setRunMode('verify')} className="text-xs">
                  <Shield className="h-3.5 w-3.5 mr-1" /> Verify Data
                </Button>
                <Button variant={runMode === 'util_only' ? 'default' : 'outline'} size="sm" onClick={() => setRunMode('util_only')} className="text-xs">
                  Utilization Only
                </Button>
              </div>
            </div>
            <Button size="lg" onClick={handleRun} disabled={isRunning} className="gap-2 px-8">
              {isRunning ? (
                <><span className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" /> Calculating...</>
              ) : (
                <><Play className="h-4 w-4" /> {runMode === 'full' ? 'Run Full Calculate' : runMode === 'verify' ? 'Verify Data' : 'Calculate Utilization'}</>
              )}
            </Button>
          </div>

          {results && results.overLimitResources.length > 0 && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive font-semibold">Resources exceed utilization limit ({model.general.util_limit}%)</span>
              </div>
              <ul className="text-xs text-destructive/80 space-y-0.5 ml-6 list-disc">
                {results.overLimitResources.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {results && results.errors.length > 0 && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
              <div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" /><span className="text-sm text-destructive font-semibold">Errors</span></div>
              <ul className="text-xs text-destructive/80 space-y-0.5 ml-6 list-disc mt-1">
                {results.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {results && results.overLimitResources.length === 0 && results.errors.length === 0 && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-md">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm text-success font-medium">All production targets can be achieved. Results are current.</span>
            </div>
          )}

          {verifyMessages && (
            <div className="mt-4 space-y-2">
              {verifyMessages.errors.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" /> {e}</div>
              ))}
              {verifyMessages.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5" /> {w}</div>
              ))}
              {verifyMessages.errors.length === 0 && verifyMessages.warnings.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-success"><CheckCircle className="h-3.5 w-3.5" /> No issues found.</div>
              )}
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
            <TabsTrigger value="ibom">IBOM</TabsTrigger>
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
                  <BarChart data={equipChartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" label={{ value: '% Utilization', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={model.general.util_limit} stroke="hsl(0, 72%, 51%)" strokeDasharray="5 5" label={{ value: `Limit ${model.general.util_limit}%`, position: 'right', style: { fontSize: 10, fill: 'hsl(0, 72%, 51%)' } }} />
                    <Bar dataKey="setup" stackId="a" fill={chartColors.setup} name="Setup" />
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
                      <TableHead className="font-mono text-xs">Labor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results!.equipment.map(eq => (
                      <TableRow key={eq.id}>
                        <TableCell className="font-mono font-medium">{eq.name}</TableCell>
                        <TableCell className="font-mono text-right">{eq.count}</TableCell>
                        <TableCell className="font-mono text-right">{eq.setupUtil}</TableCell>
                        <TableCell className="font-mono text-right">{eq.runUtil}</TableCell>
                        <TableCell className="font-mono text-right">{eq.repairUtil}</TableCell>
                        <TableCell className="font-mono text-right">{eq.waitLaborUtil}</TableCell>
                        <TableCell className={`font-mono text-right font-medium ${eq.totalUtil > model.general.util_limit ? 'text-destructive' : ''}`}>{eq.totalUtil}</TableCell>
                        <TableCell className="font-mono text-right text-muted-foreground">{eq.idle}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{eq.laborGroup}</TableCell>
                      </TableRow>
                    ))}
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
                  <BarChart data={laborChartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
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
                    {results!.labor.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono font-medium">{l.name}</TableCell>
                        <TableCell className="font-mono text-right">{l.count}</TableCell>
                        <TableCell className="font-mono text-right">{l.setupUtil}</TableCell>
                        <TableCell className="font-mono text-right">{l.runUtil}</TableCell>
                        <TableCell className="font-mono text-right">{l.unavailPct}</TableCell>
                        <TableCell className={`font-mono text-right font-medium ${l.totalUtil > model.general.util_limit ? 'text-destructive' : ''}`}>{l.totalUtil}</TableCell>
                        <TableCell className="font-mono text-right text-muted-foreground">{l.idle}</TableCell>
                      </TableRow>
                    ))}
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
                  <BarChart data={productChartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
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

          {/* Enhanced Summary Tab */}
          <TabsContent value="summary" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Output Summary</CardTitle>
                    <CardDescription>
                      Consolidated production metrics
                      {displayScenarioResults.length > 0 && ` — comparing ${displayScenarioResults.length} scenario(s)`}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setTransposed(!transposed)}>
                    <RotateCcw className="h-3.5 w-3.5" /> {transposed ? 'Normal View' : 'Transpose'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {transposed ? (
                  <TransposedSummary results={results!} model={model} scenarioResults={displayScenarioResults} />
                ) : (
                  <NormalSummary results={results!} model={model} scenarioResults={displayScenarioResults} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* IBOM Tab */}
          <TabsContent value="ibom" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Network className="h-4 w-4 text-primary" /> IBOM Analysis
                    </CardTitle>
                    <CardDescription>Bill of Materials MCT contribution tree</CardDescription>
                  </div>
                  <Select value={ibomSelectedProduct} onValueChange={setIbomProduct}>
                    <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {model.products.filter(p => p.demand > 0).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="tree">
                  <TabsList className="mb-4">
                    <TabsTrigger value="tree" className="text-xs">Tree</TabsTrigger>
                    <TabsTrigger value="poles" className="text-xs">Poles</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tree">
                    <IBOMTreeView model={model} results={results!} selectedProductId={ibomSelectedProduct} />
                  </TabsContent>
                  <TabsContent value="poles">
                    <IBOMPolesView model={model} results={results!} selectedProductId={ibomSelectedProduct} />
                  </TabsContent>
                </Tabs>
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

/* ─── Summary sub-components ─── */

function NormalSummary({ results, model, scenarioResults }: {
  results: CalcResults; model: any;
  scenarioResults: { id: string; scenario: any; results: CalcResults }[];
}) {
  const hasScenarios = scenarioResults.length > 0;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-mono text-xs">Product</TableHead>
          <TableHead className="font-mono text-xs text-right">Demand</TableHead>
          <TableHead className="font-mono text-xs text-right">Lot Size</TableHead>
          <TableHead className="font-mono text-xs text-right">Good Made</TableHead>
          <TableHead className="font-mono text-xs text-right">Started</TableHead>
          <TableHead className="font-mono text-xs text-right">Scrap</TableHead>
          <TableHead className="font-mono text-xs text-right">WIP</TableHead>
          <TableHead className="font-mono text-xs text-right">MCT ({model.general.mct_time_unit})</TableHead>
          {hasScenarios && scenarioResults.map(sr => (
            <TableHead key={sr.id} className="font-mono text-xs text-right text-primary">
              MCT {sr.scenario.name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.products.map(row => (
          <TableRow key={row.id}>
            <TableCell className="font-mono font-medium">{row.name}</TableCell>
            <TableCell className="font-mono text-right">{row.demand.toLocaleString()}</TableCell>
            <TableCell className="font-mono text-right">{row.lotSize}</TableCell>
            <TableCell className="font-mono text-right">{row.goodMade.toLocaleString()}</TableCell>
            <TableCell className="font-mono text-right">{row.started.toLocaleString()}</TableCell>
            <TableCell className="font-mono text-right">{row.scrap > 0 ? row.scrap.toLocaleString() : '—'}</TableCell>
            <TableCell className="font-mono text-right">{row.wip}</TableCell>
            <TableCell className="font-mono text-right font-medium">{row.mct.toFixed(4)}</TableCell>
            {hasScenarios && scenarioResults.map(sr => {
              const sp = sr.results.products.find(p => p.id === row.id);
              const diff = sp ? sp.mct - row.mct : 0;
              return (
                <TableCell key={sr.id} className={`font-mono text-right text-xs ${diff < 0 ? 'text-success' : diff > 0 ? 'text-destructive' : ''}`}>
                  {sp?.mct.toFixed(4) || '—'}
                  {diff !== 0 && <span className="ml-1 text-[10px]">({diff > 0 ? '+' : ''}{diff.toFixed(4)})</span>}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
        <TableRow className="border-t-2 font-medium">
          <TableCell className="font-mono">TOTAL</TableCell>
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.demand, 0).toLocaleString()}</TableCell>
          <TableCell />
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.goodMade, 0).toLocaleString()}</TableCell>
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.started, 0).toLocaleString()}</TableCell>
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.scrap, 0).toLocaleString()}</TableCell>
          <TableCell className="font-mono text-right">{results.products.reduce((s, r) => s + r.wip, 0).toFixed(1)}</TableCell>
          <TableCell className="font-mono text-right">—</TableCell>
          {hasScenarios && scenarioResults.map(sr => <TableCell key={sr.id} className="font-mono text-right">—</TableCell>)}
        </TableRow>
      </TableBody>
    </Table>
  );
}

function TransposedSummary({ results, model, scenarioResults }: {
  results: CalcResults; model: any;
  scenarioResults: { id: string; scenario: any; results: CalcResults }[];
}) {
  const fields = [
    { key: 'demand', label: 'Demand', fmt: (v: number) => v.toLocaleString() },
    { key: 'lotSize', label: 'Lot Size', fmt: (v: number) => v.toString() },
    { key: 'goodMade', label: 'Good Made', fmt: (v: number) => v.toLocaleString() },
    { key: 'started', label: 'Started', fmt: (v: number) => v.toLocaleString() },
    { key: 'scrap', label: 'Scrap', fmt: (v: number) => v > 0 ? v.toLocaleString() : '—' },
    { key: 'wip', label: 'WIP', fmt: (v: number) => v.toString() },
    { key: 'mct', label: `MCT (${model.general.mct_time_unit})`, fmt: (v: number) => v.toFixed(4) },
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-mono text-xs">Metric</TableHead>
          {results.products.map(p => (
            <TableHead key={p.id} className="font-mono text-xs text-right">{p.name}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map(f => (
          <TableRow key={f.key}>
            <TableCell className="font-mono font-medium text-xs">{f.label}</TableCell>
            {results.products.map(p => (
              <TableCell key={p.id} className="font-mono text-right text-xs">
                {f.fmt((p as any)[f.key])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ─── IBOM sub-components ─── */

interface IBOMNode {
  productId: string;
  productName: string;
  mct: number;
  unitsPerAssy: number;
  children: IBOMNode[];
}

function buildIBOMTree(model: any, results: CalcResults, rootId: string): IBOMNode {
  const product = model.products.find((p: any) => p.id === rootId);
  const pr = results.products.find(p => p.id === rootId);
  const children = model.ibom
    .filter((e: any) => e.parent_product_id === rootId)
    .map((e: any) => ({
      ...buildIBOMTree(model, results, e.component_product_id),
      unitsPerAssy: e.units_per_assy,
    }));

  return {
    productId: rootId,
    productName: product?.name || '?',
    mct: pr?.mct || 0,
    unitsPerAssy: 1,
    children,
  };
}

function IBOMTreeView({ model, results, selectedProductId }: { model: any; results: CalcResults; selectedProductId: string }) {
  const tree = useMemo(() => buildIBOMTree(model, results, selectedProductId), [model, results, selectedProductId]);

  const renderNode = (node: IBOMNode, depth: number, isLongest: boolean) => (
    <div key={node.productId} className="ml-4" style={{ marginLeft: depth * 24 }}>
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono mb-1 ${
        isLongest ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border bg-card'
      }`}>
        <span>{node.productName}</span>
        {node.unitsPerAssy > 1 && <Badge variant="secondary" className="text-[9px] h-4">×{node.unitsPerAssy}</Badge>}
        <span className="text-muted-foreground">{node.mct.toFixed(4)} {model.general.mct_time_unit}</span>
      </div>
      {node.children.length > 0 && (
        <div className="border-l border-border ml-4 pl-1">
          {node.children.map(child => {
            const longestChild = node.children.reduce((a, b) => a.mct > b.mct ? a : b);
            return renderNode(child, 0, child.productId === longestChild.productId);
          })}
        </div>
      )}
    </div>
  );

  if (model.ibom.filter((e: any) => e.parent_product_id === selectedProductId).length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No IBOM entries for this product. Add components in the IBOM screen.
      </div>
    );
  }

  return <div className="py-2">{renderNode(tree, 0, true)}</div>;
}

function IBOMPolesView({ model, results, selectedProductId }: { model: any; results: CalcResults; selectedProductId: string }) {
  // Build all paths from root to leaf
  const paths = useMemo(() => {
    const allPaths: { path: string[]; totalMCT: number }[] = [];

    function traverse(nodeId: string, currentPath: string[], currentMCT: number) {
      const pr = results.products.find(p => p.id === nodeId);
      const mct = pr?.mct || 0;
      const product = model.products.find((p: any) => p.id === nodeId);
      const name = product?.name || '?';
      const newPath = [...currentPath, name];
      const newMCT = currentMCT + mct;

      const children = model.ibom.filter((e: any) => e.parent_product_id === nodeId);
      if (children.length === 0) {
        allPaths.push({ path: newPath, totalMCT: newMCT });
      } else {
        children.forEach((c: any) => traverse(c.component_product_id, newPath, newMCT));
      }
    }

    traverse(selectedProductId, [], 0);
    return allPaths.sort((a, b) => b.totalMCT - a.totalMCT);
  }, [model, results, selectedProductId]);

  if (paths.length <= 1 && paths[0]?.path.length <= 1) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No IBOM paths to display. Add components in the IBOM screen.
      </div>
    );
  }

  const maxMCT = paths[0]?.totalMCT || 1;

  return (
    <div className="space-y-2 py-2">
      {paths.map((p, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-40 text-xs font-mono text-right truncate text-muted-foreground">
            {p.path.join(' → ')}
          </div>
          <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
            <div
              className={`h-full rounded transition-all ${i === 0 ? 'bg-primary' : 'bg-primary/40'}`}
              style={{ width: `${(p.totalMCT / maxMCT) * 100}%` }}
            />
            <span className="absolute right-2 top-0.5 text-[10px] font-mono">
              {p.totalMCT.toFixed(4)} {model.general.mct_time_unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
