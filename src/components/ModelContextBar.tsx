import { useState } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useResultsStore } from '@/stores/resultsStore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Save, Download, CircleDot, FlaskConical, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calculate, verifyData } from '@/lib/calculationEngine';

export function ModelContextBar() {
  const model = useModelStore((s) => s.getActiveModel());
  const setRunStatus = useModelStore((s) => s.setRunStatus);
  const activeScenario = useScenarioStore((s) => s.getActiveScenario());
  const markCalculated = useScenarioStore((s) => s.markCalculated);
  const { setResults } = useResultsStore();
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);

  if (!model) return null;

  const statusConfig = {
    never_run: { label: 'Never Run', className: 'bg-muted text-muted-foreground' },
    current: { label: 'Results Current', className: 'bg-success text-success-foreground' },
    needs_recalc: { label: 'Recalc Needed', className: 'bg-warning text-warning-foreground' },
  };

  const status = statusConfig[model.run_status];
  const isResultsCurrent = model.run_status === 'current';
  const resultKey = activeScenario ? activeScenario.id : 'basecase';

  // ── Run Full Calculate ──────────────────────────────────────────
  const handleRun = async () => {
    const validationErrors: string[] = [];
    if (model.general.conv1 <= 0) validationErrors.push('Time Conversion 1 must be > 0');
    if (model.general.conv2 <= 0) validationErrors.push('Time Conversion 2 must be > 0');
    model.products.forEach(p => {
      if (p.lot_size < 1) validationErrors.push(`Product "${p.name}": Lot Size must be ≥ 1`);
      if (p.demand < 0) validationErrors.push(`Product "${p.name}": Demand cannot be negative`);
    });
    model.equipment.forEach(e => {
      if (e.equip_type === 'standard' && e.count < 1) validationErrors.push(`Equipment "${e.name}": Count must be ≥ 1`);
    });
    model.labor.forEach(l => {
      if (l.count < 1) validationErrors.push(`Labor "${l.name}": Count must be ≥ 1`);
    });
    if (validationErrors.length > 0) {
      toast.error(`${validationErrors.length} validation error(s) — fix before calculating`, {
        description: validationErrors.slice(0, 3).join('; ') + (validationErrors.length > 3 ? '…' : ''),
      });
      return;
    }

    setIsRunning(true);
    setTimeout(async () => {
      const calcResults = calculate(model, activeScenario || undefined);
      setResults(resultKey, calcResults);
      setRunStatus(model.id, 'current');
      if (activeScenario) markCalculated(activeScenario.id);
      setIsRunning(false);

      // Persist results
      const { scenarioDb } = await import('@/lib/scenarioDb');
      if (activeScenario) {
        scenarioDb.saveResults(activeScenario.id, calcResults);
      } else {
        scenarioDb.saveBasecaseResults(model.id, calcResults);
      }
      const { db } = await import('@/lib/supabaseData');
      db.updateModel(model.id, { run_status: 'current', last_run_at: new Date().toISOString() });

      if (calcResults.errors.length > 0) {
        toast.error(calcResults.errors[0]);
      } else if (calcResults.overLimitResources.length > 0) {
        toast.warning(`${calcResults.overLimitResources.length} resource(s) exceed utilization limit`);
      } else {
        toast.success('Full calculation complete — all production targets achievable');
      }
    }, 100);
  };

  // ── Save Checkpoint ─────────────────────────────────────────────
  const handleSaveCheckpoint = async () => {
    try {
      const { data: pn } = await supabase.from('model_param_names').select('*').eq('model_id', model.id).single();
      const snapshot = {
        general: model.general, labor: model.labor, equipment: model.equipment,
        products: model.products, operations: model.operations, routing: model.routing,
        ibom: model.ibom, param_names: pn || null,
      };
      const now = new Date();
      const label = `Checkpoint — ${now.toLocaleString()}`;
      const { error } = await supabase.from('model_versions').insert({
        model_id: model.id, label, snapshot: snapshot as any,
      });
      if (error) throw error;
      toast.success(`Checkpoint saved at ${now.toLocaleTimeString()}`);
    } catch (err) {
      console.error('Checkpoint error:', err);
      toast.error('Failed to save checkpoint');
    }
  };

  // ── Export Model as JSON ────────────────────────────────────────
  const handleExport = async () => {
    const { data: pn } = await supabase.from('model_param_names').select('*').eq('model_id', model.id).single();
    const exportData = {
      name: model.name,
      description: model.description,
      tags: model.tags,
      general: model.general,
      labor: model.labor,
      equipment: model.equipment,
      products: model.products,
      operations: model.operations,
      routing: model.routing,
      ibom: model.ibom,
      param_names: pn || null,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `${model.name.replace(/\s+/g, '-')}-export-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Model exported as JSON');
  };

  // ── Tooltip text ────────────────────────────────────────────────
  const runTooltip = activeScenario
    ? `Run Full Calculate on: ${activeScenario.name}`
    : 'Run Full Calculate on the current scenario';
  const checkpointTooltip = 'Save a version checkpoint you can restore later';
  const exportTooltip = 'Download this model as a JSON file';

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-11 bg-context-bar text-context-bar-foreground flex items-center px-4 gap-3 border-b border-sidebar-border shrink-0">
        <button
          onClick={() => navigate('/library')}
          className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-medium truncate max-w-[200px]">{model.name}</span>
        </button>

        <div className="h-4 w-px bg-sidebar-border" />

        {activeScenario ? (
          <Badge variant="outline" className="border-warning/40 text-warning text-xs font-mono">
            <FlaskConical className="h-2.5 w-2.5 mr-1" />
            Editing: {activeScenario.name}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-primary/40 text-primary text-xs font-mono">
            <CircleDot className="h-2.5 w-2.5 mr-1" />
            Editing: Basecase
          </Badge>
        )}

        <Badge className={`text-xs ${status.className}`}>
          {status.label}
        </Badge>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-context-bar-foreground hover:text-primary hover:bg-sidebar-accent" onClick={handleSaveCheckpoint}>
                <Save className="h-3.5 w-3.5 mr-1" /> Checkpoint
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{checkpointTooltip}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-context-bar-foreground hover:text-primary hover:bg-sidebar-accent" onClick={handleExport}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{exportTooltip}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" className="h-7 text-xs relative" onClick={handleRun} disabled={isRunning}>
                {isRunning ? (
                  <><span className="animate-spin h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full mr-1" /> Running…</>
                ) : (
                  <>
                    {isResultsCurrent ? (
                      <CheckCircle className="h-3.5 w-3.5 mr-1 text-success" />
                    ) : (
                      <Play className="h-3.5 w-3.5 mr-1" />
                    )}
                    Run
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isResultsCurrent ? 'Results are current — click to re-run' : runTooltip}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
