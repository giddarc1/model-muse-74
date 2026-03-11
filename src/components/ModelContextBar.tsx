import { useState, useEffect, useCallback } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useResultsStore } from '@/stores/resultsStore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Download, CircleDot, FlaskConical, CheckCircle, ChevronDown, RotateCcw, Clock, History, RefreshCw } from 'lucide-react';
import { UserLevelChip } from '@/components/UserLevelChip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useRunCalculation } from '@/hooks/useRunCalculation';

interface RecentVersion {
  id: string;
  label: string;
  created_at: string;
}

export function ModelContextBar() {
  const model = useModelStore((s) => s.getActiveModel());
  const activeScenario = useScenarioStore((s) => s.getActiveScenario());
  const navigate = useNavigate();
  const { isRunning, handleRun: sharedRun } = useRunCalculation();
  const [showCheckpointDialog, setShowCheckpointDialog] = useState(false);
  const [checkpointName, setCheckpointName] = useState('');
  const [isSavingCheckpoint, setIsSavingCheckpoint] = useState(false);
  const [recentVersions, setRecentVersions] = useState<RecentVersion[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [restoreVersionId, setRestoreVersionId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const loadRecentVersions = useCallback(async () => {
    if (!model) return;
    const { data } = await supabase
      .from('model_versions')
      .select('id, label, created_at')
      .eq('model_id', model.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentVersions((data as RecentVersion[]) || []);
  }, [model?.id]);

  useEffect(() => {
    loadRecentVersions();
  }, [loadRecentVersions]);

  if (!model) return null;

  const statusConfig = {
    never_run: { label: 'Never Run', className: 'bg-muted text-muted-foreground' },
    current: { label: 'Results Current', className: 'bg-success text-success-foreground' },
    needs_recalc: { label: 'Recalc Needed', className: 'bg-warning text-warning-foreground' },
  };

  const status = statusConfig[model.run_status];
  const isResultsCurrent = model.run_status === 'current';

  const handleRun = () => sharedRun('full');

  // ── Open checkpoint dialog ──────────────────────────────────────
  const handleOpenCheckpointDialog = () => {
    const now = new Date();
    const defaultName = `Checkpoint ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    setCheckpointName(defaultName);
    setShowCheckpointDialog(true);
  };

  // ── Save Checkpoint ─────────────────────────────────────────────
  const handleSaveCheckpoint = async () => {
    if (!checkpointName.trim()) return;
    setIsSavingCheckpoint(true);
    try {
      const { data: pn } = await supabase.from('model_param_names').select('*').eq('model_id', model.id).single();
      const snapshot = {
        general: model.general, labor: model.labor, equipment: model.equipment,
        products: model.products, operations: model.operations, routing: model.routing,
        ibom: model.ibom, param_names: pn || null,
      };
      const { error } = await supabase.from('model_versions').insert({
        model_id: model.id, label: checkpointName.trim(), snapshot: snapshot as any,
      });
      if (error) throw error;
      toast.success(`Checkpoint saved: ${checkpointName.trim()}`);
      setShowCheckpointDialog(false);
      loadRecentVersions();
    } catch (err) {
      console.error('Checkpoint error:', err);
      toast.error('Failed to save checkpoint');
    } finally {
      setIsSavingCheckpoint(false);
    }
  };

  // ── Export Model as JSON ────────────────────────────────────────
  const handleExport = async () => {
    const { data: pn } = await supabase.from('model_param_names').select('*').eq('model_id', model.id).single();
    const exportData = {
      name: model.name, description: model.description, tags: model.tags,
      general: model.general, labor: model.labor, equipment: model.equipment,
      products: model.products, operations: model.operations, routing: model.routing,
      ibom: model.ibom, param_names: pn || null,
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

  // ── Restore from dropdown ───────────────────────────────────────
  const handleRestore = async (versionId: string) => {
    setIsRestoring(true);
    try {
      const { data } = await supabase
        .from('model_versions')
        .select('snapshot, created_at')
        .eq('id', versionId)
        .single();

      if (!data?.snapshot) {
        toast.error('Failed to load version snapshot');
        return;
      }

      const snap = data.snapshot as any;
      const modelId = model.id;

      await Promise.all([
        supabase.from('model_operations').delete().eq('model_id', modelId),
        supabase.from('model_routing').delete().eq('model_id', modelId),
        supabase.from('model_ibom').delete().eq('model_id', modelId),
      ]);
      await Promise.all([
        supabase.from('model_labor').delete().eq('model_id', modelId),
        supabase.from('model_equipment').delete().eq('model_id', modelId),
        supabase.from('model_products').delete().eq('model_id', modelId),
      ]);

      if (snap.general) {
        await supabase.from('model_general').upsert({
          model_id: modelId, model_title: snap.general.model_title || '',
          ops_time_unit: snap.general.ops_time_unit || 'MIN', mct_time_unit: snap.general.mct_time_unit || 'DAY',
          prod_period_unit: snap.general.prod_period_unit || 'YEAR',
          conv1: snap.general.conv1 ?? 480, conv2: snap.general.conv2 ?? 210,
          util_limit: snap.general.util_limit ?? 95, var_equip: snap.general.var_equip ?? 30,
          var_labor: snap.general.var_labor ?? 30, var_prod: snap.general.var_prod ?? 30,
          author: snap.general.author || '', comments: snap.general.comments || '',
        }, { onConflict: 'model_id' });
      }
      if (snap.labor?.length) {
        await supabase.from('model_labor').insert(snap.labor.map((l: any) => ({
          id: l.id, model_id: modelId, name: l.name, count: l.count,
          overtime_pct: l.overtime_pct, unavail_pct: l.unavail_pct,
          dept_code: l.dept_code || '', setup_factor: l.setup_factor ?? 1,
          run_factor: l.run_factor ?? 1, var_factor: l.var_factor ?? 1, comments: l.comments || '',
        })));
      }
      if (snap.equipment?.length) {
        await supabase.from('model_equipment').insert(snap.equipment.map((e: any) => ({
          id: e.id, model_id: modelId, name: e.name, equip_type: e.equip_type || 'standard',
          count: e.count, mttf: e.mttf ?? 0, mttr: e.mttr ?? 0,
          overtime_pct: e.overtime_pct ?? 0, labor_group_id: e.labor_group_id || null,
          dept_code: e.dept_code || '', setup_factor: e.setup_factor ?? 1,
          run_factor: e.run_factor ?? 1, var_factor: e.var_factor ?? 1, comments: e.comments || '',
        })));
      }
      if (snap.products?.length) {
        await supabase.from('model_products').insert(snap.products.map((p: any) => ({
          id: p.id, model_id: modelId, name: p.name, demand: p.demand ?? 0,
          lot_size: p.lot_size ?? 1, tbatch_size: p.tbatch_size ?? -1,
          demand_factor: p.demand_factor ?? 1, lot_factor: p.lot_factor ?? 1,
          var_factor: p.var_factor ?? 1, make_to_stock: p.make_to_stock ?? false,
          gather_tbatches: p.gather_tbatches ?? true, comments: p.comments || '',
        })));
      }
      if (snap.operations?.length) {
        await supabase.from('model_operations').insert(snap.operations.map((o: any) => ({
          id: o.id, model_id: modelId, product_id: o.product_id,
          op_name: o.op_name, op_number: o.op_number ?? 10,
          equip_id: o.equip_id || null, pct_assigned: o.pct_assigned ?? 100,
          equip_setup_lot: o.equip_setup_lot ?? 0, equip_run_piece: o.equip_run_piece ?? 0,
          labor_setup_lot: o.labor_setup_lot ?? 0, labor_run_piece: o.labor_run_piece ?? 0,
        })));
      }
      if (snap.routing?.length) {
        const opNameToId: Record<string, string> = {};
        (snap.operations || []).forEach((o: any) => { opNameToId[o.product_id + ':' + o.op_name] = o.id; });
        await supabase.from('model_routing').insert(snap.routing.map((r: any) => ({
          id: r.id, model_id: modelId, product_id: r.product_id,
          from_op_id: opNameToId[r.product_id + ':' + r.from_op_name] || r.from_op_id || '',
          to_op_name: r.to_op_name, pct_routed: r.pct_routed,
        })));
      }
      if (snap.ibom?.length) {
        await supabase.from('model_ibom').insert(snap.ibom.map((b: any) => ({
          id: b.id, model_id: modelId, parent_product_id: b.parent_product_id,
          component_product_id: b.component_product_id, units_per_assy: b.units_per_assy ?? 1,
        })));
      }
      if (snap.param_names) {
        const { model_id, ...pnData } = snap.param_names;
        await supabase.from('model_param_names').upsert({ model_id: modelId, ...pnData }, { onConflict: 'model_id' });
      }

      const { db } = await import('@/lib/supabaseData');
      await db.updateModel(modelId, { run_status: 'needs_recalc', updated_at: new Date().toISOString() });
      useResultsStore.getState().clearAllForModel();
      await useModelStore.getState().loadModels(true);
      useModelStore.getState().setActiveModel(modelId);

      const v = recentVersions.find(v => v.id === versionId);
      toast.success(`Restored to: ${v?.label || 'checkpoint'}`);
      setDropdownOpen(false);
    } catch (err) {
      console.error('Restore error:', err);
      toast.error('Failed to restore checkpoint');
    } finally {
      setIsRestoring(false);
      setRestoreVersionId(null);
    }
  };

  // ── Tooltip text ────────────────────────────────────────────────
  const scenarioLabel = activeScenario ? activeScenario.name : 'Basecase';
  const runTooltip = `Quick recalculate — runs Full Calculate on ${scenarioLabel}`;
  const statusTooltip = model.run_status === 'current'
    ? `Last calculated: ${model.last_run_at ? new Date(model.last_run_at).toLocaleString() : 'unknown'}`
    : model.run_status === 'needs_recalc'
      ? `Results are stale — data changed${model.last_run_at ? ` since last run on ${new Date(model.last_run_at).toLocaleString()}` : ''}`
      : 'Model has never been run';
  const checkpointTooltip = 'Save a version checkpoint you can restore later';
  const exportTooltip = 'Download this model as a JSON file';

  const restoreVersion = restoreVersionId ? recentVersions.find(v => v.id === restoreVersionId) : null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-11 bg-context-bar text-context-bar-foreground flex items-center px-2 md:px-4 gap-1.5 md:gap-3 border-b border-sidebar-border shrink-0 overflow-x-auto">
        {/* Spacer for mobile hamburger */}
        <div className="w-8 shrink-0 md:hidden" />
        <button
          onClick={() => navigate('/library')}
          className="text-sm font-bold text-primary hover:text-primary/80 transition-colors shrink-0"
        >
          Trooba Flow
        </button>
        <span className="text-muted-foreground text-sm shrink-0">›</span>
        <span className="text-sm font-medium truncate max-w-[120px] md:max-w-[200px]">{model.name}</span>

        <div className="h-4 w-px bg-sidebar-border" />

        {activeScenario ? (
          <button onClick={() => navigate(`/models/${model.id}/whatif`)} className="shrink-0 hidden sm:flex">
            <Badge variant="outline" className="border-amber-400/60 bg-amber-500/10 text-amber-600 text-xs font-medium cursor-pointer hover:bg-amber-500/20 transition-colors">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
              What-if: {activeScenario.name}
            </Badge>
          </button>
        ) : (
          <Badge variant="outline" className="border-primary/40 text-primary text-xs font-mono shrink-0 hidden sm:flex">
            <CircleDot className="h-2.5 w-2.5 mr-1" />
            Basecase
          </Badge>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={`text-xs cursor-default ${status.className}`}>
              {status.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">{statusTooltip}</TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        <UserLevelChip />

        <div className="flex items-center gap-1.5">
          {/* Checkpoint button + dropdown */}
          <div className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-context-bar-foreground hover:text-primary hover:bg-sidebar-accent rounded-r-none" onClick={handleOpenCheckpointDialog}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Checkpoint
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{checkpointTooltip}</TooltipContent>
            </Tooltip>
            <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-6 px-0 text-context-bar-foreground hover:text-primary hover:bg-sidebar-accent rounded-l-none border-l border-sidebar-border">
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end" sideOffset={6}>
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground">Recent Checkpoints</p>
                </div>
                {recentVersions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No checkpoints yet</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {recentVersions.map(v => (
                      <div key={v.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent/50 transition-colors group">
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="text-sm font-medium truncate">{v.label || 'Unnamed Checkpoint'}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(v.created_at).toLocaleString()}</p>
                        </div>
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 text-[10px] px-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => { setRestoreVersionId(v.id); }}
                        >
                          <RotateCcw className="h-2.5 w-2.5 mr-0.5" /> Restore
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-border px-3 py-2">
                  <button
                    onClick={() => { setDropdownOpen(false); navigate(`/models/${model.id}/settings`); }}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <History className="h-3 w-3" /> View all checkpoints
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

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
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    )}
                    <span className="hidden lg:inline">Recalculate</span>
                    <span className="lg:hidden">Run</span>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{runTooltip}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Checkpoint Name Dialog */}
      <Dialog open={showCheckpointDialog} onOpenChange={setShowCheckpointDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Checkpoint</DialogTitle>
            <DialogDescription>
              Save a snapshot of the current model state that you can restore later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="checkpoint-name">Checkpoint Name</Label>
              <Input
                id="checkpoint-name"
                value={checkpointName}
                onChange={e => setCheckpointName(e.target.value)}
                placeholder="e.g. Before lot size changes"
                className="mt-1"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && checkpointName.trim() && handleSaveCheckpoint()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              <Clock className="h-3 w-3 inline mr-1" />
              {new Date().toLocaleString()}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckpointDialog(false)} disabled={isSavingCheckpoint}>Cancel</Button>
            <Button onClick={handleSaveCheckpoint} disabled={!checkpointName.trim() || isSavingCheckpoint}>
              {isSavingCheckpoint ? 'Saving…' : 'Save Checkpoint'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation from dropdown */}
      <AlertDialog open={!!restoreVersionId} onOpenChange={(open) => !open && setRestoreVersionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Checkpoint</AlertDialogTitle>
            <AlertDialogDescription>
              Restore to checkpoint: <strong>"{restoreVersion?.label || 'Unnamed'}"</strong> — saved on{' '}
              <strong>{restoreVersion ? new Date(restoreVersion.created_at).toLocaleString() : '...'}</strong>?
              <br /><br />
              This will replace all current model data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRestoring}
              onClick={() => restoreVersionId && handleRestore(restoreVersionId)}
            >
              {isRestoring ? 'Restoring…' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
