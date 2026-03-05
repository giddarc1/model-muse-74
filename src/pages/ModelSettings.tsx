import { useState, useEffect } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useResultsStore } from '@/stores/resultsStore';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/supabaseData';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Save, Trash2, Archive, Download, RotateCcw, X, Plus, Clock, Pencil, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface ParamNames {
  gen1_name: string; gen2_name: string; gen3_name: string; gen4_name: string;
  lab1_name: string; lab2_name: string; lab3_name: string; lab4_name: string;
  eq1_name: string; eq2_name: string; eq3_name: string; eq4_name: string;
  prod1_name: string; prod2_name: string; prod3_name: string; prod4_name: string;
  oper1_name: string; oper2_name: string; oper3_name: string; oper4_name: string;
}

const defaultParamNames: ParamNames = {
  gen1_name: 'Gen1', gen2_name: 'Gen2', gen3_name: 'Gen3', gen4_name: 'Gen4',
  lab1_name: 'Lab1', lab2_name: 'Lab2', lab3_name: 'Lab3', lab4_name: 'Lab4',
  eq1_name: 'Eq1', eq2_name: 'Eq2', eq3_name: 'Eq3', eq4_name: 'Eq4',
  prod1_name: 'Prod1', prod2_name: 'Prod2', prod3_name: 'Prod3', prod4_name: 'Prod4',
  oper1_name: 'Oper1', oper2_name: 'Oper2', oper3_name: 'Oper3', oper4_name: 'Oper4',
};

interface Version {
  id: string;
  label: string;
  created_at: string;
}

export default function ModelSettings() {
  const model = useModelStore(s => s.getActiveModel());
  const renameModel = useModelStore(s => s.renameModel);
  const archiveModel = useModelStore(s => s.archiveModel);
  const deleteModel = useModelStore(s => s.deleteModel);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [paramNames, setParamNames] = useState<ParamNames>(defaultParamNames);
  const [versions, setVersions] = useState<Version[]>([]);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [restoreVersionId, setRestoreVersionId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingVersionName, setEditingVersionName] = useState('');
  const [deleteVersionId, setDeleteVersionId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    if (!model) return;
    setName(model.name);
    setTitle(model.general.model_title);
    setDescription(model.description);
    setTags(model.tags);
    // Load param names
    supabase.from('model_param_names').select('*').eq('model_id', model.id).single()
      .then(({ data }) => {
        if (data) {
          setParamNames(data as unknown as ParamNames);
        }
      });
    // Load versions
    loadVersions();
  }, [model?.id]);

  const loadVersions = async () => {
    if (!model) return;
    const { data } = await supabase
      .from('model_versions')
      .select('id, label, created_at')
      .eq('model_id', model.id)
      .order('created_at', { ascending: false });
    setVersions((data as Version[]) || []);
  };

  const handleRenameVersion = async (versionId: string) => {
    if (!editingVersionName.trim()) return;
    const { error } = await supabase.from('model_versions').update({ label: editingVersionName.trim() }).eq('id', versionId);
    if (error) { toast.error('Failed to rename checkpoint'); return; }
    toast.success('Checkpoint renamed');
    setEditingVersionId(null);
    loadVersions();
  };

  const handleDeleteVersion = async (versionId: string) => {
    const { error } = await supabase.from('model_versions').delete().eq('id', versionId);
    if (error) { toast.error('Failed to delete checkpoint'); return; }
    toast.success('Checkpoint deleted');
    setDeleteVersionId(null);
    loadVersions();
  };

  if (!model) return null;

  const handleSaveName = () => {
    if (!name.trim()) return;
    renameModel(model.id, name.trim());
    toast.success('Model name updated');
  };

  const handleSaveDescription = () => {
    db.updateModel(model.id, { description });
    useModelStore.setState(s => ({
      models: s.models.map(m => m.id === model.id ? { ...m, description } : m),
    }));
    toast.success('Description saved');
  };

  const handleSaveTitle = () => {
    useModelStore.getState().updateGeneral(model.id, { model_title: title });
    toast.success('Report title saved');
  };

  const handleAddTag = () => {
    if (!newTag.trim() || tags.includes(newTag.trim())) return;
    const updated = [...tags, newTag.trim()];
    setTags(updated);
    setNewTag('');
    db.updateModel(model.id, { tags: updated });
    useModelStore.setState(s => ({
      models: s.models.map(m => m.id === model.id ? { ...m, tags: updated } : m),
    }));
  };

  const handleRemoveTag = (tag: string) => {
    const updated = tags.filter(t => t !== tag);
    setTags(updated);
    db.updateModel(model.id, { tags: updated });
    useModelStore.setState(s => ({
      models: s.models.map(m => m.id === model.id ? { ...m, tags: updated } : m),
    }));
  };

  const handleSaveParamNames = async () => {
    const { error } = await supabase.from('model_param_names').upsert({
      model_id: model.id, ...paramNames,
    }, { onConflict: 'model_id' });
    if (error) console.error('saveParamNames:', error);
    else toast.success('Parameter names saved');
  };

  const handleSaveCheckpoint = async () => {
    // Load param_names for snapshot
    const { data: pn } = await supabase.from('model_param_names').select('*').eq('model_id', model.id).single();

    const snapshot = {
      general: model.general,
      labor: model.labor,
      equipment: model.equipment,
      products: model.products,
      operations: model.operations,
      routing: model.routing,
      ibom: model.ibom,
      param_names: pn || null,
    };
    const { error } = await supabase.from('model_versions').insert({
      model_id: model.id,
      label: 'Manual Checkpoint',
      snapshot: snapshot as any,
    });
    if (error) {
      console.error('Checkpoint save error:', error);
      toast.error('Failed to save checkpoint');
      return;
    }
    toast.success('Checkpoint saved');
    loadVersions();
  };

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
        setIsRestoring(false);
        setRestoreVersionId(null);
        return;
      }

      const snap = data.snapshot as any;
      const modelId = model.id;

      // Delete all existing child data
      await Promise.all([
        supabase.from('model_operations').delete().eq('model_id', modelId),
        supabase.from('model_routing').delete().eq('model_id', modelId),
        supabase.from('model_ibom').delete().eq('model_id', modelId),
      ]);

      // Delete remaining (after operations since routing refs operations)
      await Promise.all([
        supabase.from('model_labor').delete().eq('model_id', modelId),
        supabase.from('model_equipment').delete().eq('model_id', modelId),
        supabase.from('model_products').delete().eq('model_id', modelId),
      ]);

      // Update general data
      if (snap.general) {
        await supabase.from('model_general').upsert({
          model_id: modelId,
          model_title: snap.general.model_title || '',
          ops_time_unit: snap.general.ops_time_unit || 'MIN',
          mct_time_unit: snap.general.mct_time_unit || 'DAY',
          prod_period_unit: snap.general.prod_period_unit || 'YEAR',
          conv1: snap.general.conv1 ?? 480,
          conv2: snap.general.conv2 ?? 210,
          util_limit: snap.general.util_limit ?? 95,
          var_equip: snap.general.var_equip ?? 30,
          var_labor: snap.general.var_labor ?? 30,
          var_prod: snap.general.var_prod ?? 30,
          author: snap.general.author || '',
          comments: snap.general.comments || '',
        }, { onConflict: 'model_id' });
      }

      // Insert labor
      if (snap.labor?.length) {
        await supabase.from('model_labor').insert(
          snap.labor.map((l: any) => ({
            id: l.id, model_id: modelId, name: l.name, count: l.count,
            overtime_pct: l.overtime_pct, unavail_pct: l.unavail_pct,
            dept_code: l.dept_code || '', setup_factor: l.setup_factor ?? 1,
            run_factor: l.run_factor ?? 1, var_factor: l.var_factor ?? 1,
            comments: l.comments || '',
          }))
        );
      }

      // Insert equipment
      if (snap.equipment?.length) {
        await supabase.from('model_equipment').insert(
          snap.equipment.map((e: any) => ({
            id: e.id, model_id: modelId, name: e.name, equip_type: e.equip_type || 'standard',
            count: e.count, mttf: e.mttf ?? 0, mttr: e.mttr ?? 0,
            overtime_pct: e.overtime_pct ?? 0, labor_group_id: e.labor_group_id || null,
            dept_code: e.dept_code || '', setup_factor: e.setup_factor ?? 1,
            run_factor: e.run_factor ?? 1, var_factor: e.var_factor ?? 1,
            comments: e.comments || '',
          }))
        );
      }

      // Insert products
      if (snap.products?.length) {
        await supabase.from('model_products').insert(
          snap.products.map((p: any) => ({
            id: p.id, model_id: modelId, name: p.name, demand: p.demand ?? 0,
            lot_size: p.lot_size ?? 1, tbatch_size: p.tbatch_size ?? -1,
            demand_factor: p.demand_factor ?? 1, lot_factor: p.lot_factor ?? 1,
            var_factor: p.var_factor ?? 1, make_to_stock: p.make_to_stock ?? false,
            gather_tbatches: p.gather_tbatches ?? true, comments: p.comments || '',
          }))
        );
      }

      // Insert operations
      if (snap.operations?.length) {
        await supabase.from('model_operations').insert(
          snap.operations.map((o: any) => ({
            id: o.id, model_id: modelId, product_id: o.product_id,
            op_name: o.op_name, op_number: o.op_number ?? 10,
            equip_id: o.equip_id || null, pct_assigned: o.pct_assigned ?? 100,
            equip_setup_lot: o.equip_setup_lot ?? 0, equip_run_piece: o.equip_run_piece ?? 0,
            labor_setup_lot: o.labor_setup_lot ?? 0, labor_run_piece: o.labor_run_piece ?? 0,
          }))
        );
      }

      // Insert routing
      if (snap.routing?.length) {
        // Need to map from_op_name back to from_op_id
        const opNameToId: Record<string, string> = {};
        (snap.operations || []).forEach((o: any) => {
          // key by product_id + op_name
          opNameToId[o.product_id + ':' + o.op_name] = o.id;
        });

        await supabase.from('model_routing').insert(
          snap.routing.map((r: any) => ({
            id: r.id, model_id: modelId, product_id: r.product_id,
            from_op_id: opNameToId[r.product_id + ':' + r.from_op_name] || r.from_op_id || '',
            to_op_name: r.to_op_name, pct_routed: r.pct_routed,
          }))
        );
      }

      // Insert IBOM
      if (snap.ibom?.length) {
        await supabase.from('model_ibom').insert(
          snap.ibom.map((b: any) => ({
            id: b.id, model_id: modelId, parent_product_id: b.parent_product_id,
            component_product_id: b.component_product_id, units_per_assy: b.units_per_assy ?? 1,
          }))
        );
      }

      // Restore param names
      if (snap.param_names) {
        const { model_id, ...pnData } = snap.param_names;
        await supabase.from('model_param_names').upsert({
          model_id: modelId, ...pnData,
        }, { onConflict: 'model_id' });
      }

      // Update model status
      await db.updateModel(modelId, { run_status: 'needs_recalc', updated_at: new Date().toISOString() });

      // Clear stale results
      useResultsStore.getState().clearAllForModel();

      // Force reload model data from Supabase
      await useModelStore.getState().loadModels(true);
      useModelStore.getState().setActiveModel(modelId);

      toast.success(`Model restored to checkpoint from ${new Date(data.created_at).toLocaleString()}`);
      navigate(`/models/${modelId}/general`);
    } catch (err) {
      console.error('Restore error:', err);
      toast.error('Failed to restore checkpoint');
    } finally {
      setIsRestoring(false);
      setRestoreVersionId(null);
    }
  };

  const handleExport = () => {
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
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Model exported');
  };

  const handleDelete = () => {
    if (deleteConfirm !== model.name) return;
    deleteModel(model.id);
    setShowDelete(false);
    toast.success('Model deleted');
    window.location.href = '/library';
  };

  const paramField = (key: keyof ParamNames, label: string) => (
    <div key={key}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className="h-8 font-mono text-sm"
        value={paramNames[key]}
        onChange={e => setParamNames(p => ({ ...p, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl animate-fade-in">
      <h1 className="text-xl font-bold mb-1">Model Settings</h1>
      <p className="text-sm text-muted-foreground mb-6">Configure model metadata, parameter labels, and manage versions.</p>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="params">Parameter Names</TabsTrigger>
          <TabsTrigger value="versions">Version History</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Model Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Model Name (Library)</Label>
                <div className="flex gap-2">
                  <Input value={name} onChange={e => setName(e.target.value)} />
                  <Button size="sm" onClick={handleSaveName} disabled={!name.trim() || name === model.name}>
                    <Save className="h-3.5 w-3.5 mr-1" /> Save
                  </Button>
                </div>
              </div>
              <div>
                <Label>Report Title</Label>
                <div className="flex gap-2">
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title for printed reports" />
                  <Button size="sm" onClick={handleSaveTitle} disabled={title === model.general.model_title}>
                    <Save className="h-3.5 w-3.5 mr-1" /> Save
                  </Button>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <div className="flex gap-2">
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                </div>
                <Button size="sm" className="mt-2" onClick={handleSaveDescription} disabled={description === model.description}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Save Description
                </Button>
              </div>
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map(t => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <button onClick={() => handleRemoveTag(t)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    placeholder="Add tag..."
                    className="h-8"
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  />
                  <Button size="sm" variant="outline" onClick={handleAddTag} disabled={!newTag.trim()}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="params" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custom Parameter Names</CardTitle>
              <CardDescription>Rename Gen1–4, Lab1–4, Eq1–4, Prod1–4, Oper1–4 labels for this model.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">General Parameters</h4>
                <div className="grid grid-cols-4 gap-2">
                  {paramField('gen1_name', 'Gen1')}
                  {paramField('gen2_name', 'Gen2')}
                  {paramField('gen3_name', 'Gen3')}
                  {paramField('gen4_name', 'Gen4')}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Labor Parameters</h4>
                <div className="grid grid-cols-4 gap-2">
                  {paramField('lab1_name', 'Lab1')}
                  {paramField('lab2_name', 'Lab2')}
                  {paramField('lab3_name', 'Lab3')}
                  {paramField('lab4_name', 'Lab4')}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Equipment Parameters</h4>
                <div className="grid grid-cols-4 gap-2">
                  {paramField('eq1_name', 'Eq1')}
                  {paramField('eq2_name', 'Eq2')}
                  {paramField('eq3_name', 'Eq3')}
                  {paramField('eq4_name', 'Eq4')}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Product Parameters</h4>
                <div className="grid grid-cols-4 gap-2">
                  {paramField('prod1_name', 'Prod1')}
                  {paramField('prod2_name', 'Prod2')}
                  {paramField('prod3_name', 'Prod3')}
                  {paramField('prod4_name', 'Prod4')}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Operation Parameters</h4>
                <div className="grid grid-cols-4 gap-2">
                  {paramField('oper1_name', 'Oper1')}
                  {paramField('oper2_name', 'Oper2')}
                  {paramField('oper3_name', 'Oper3')}
                  {paramField('oper4_name', 'Oper4')}
                </div>
              </div>
              <Button onClick={handleSaveParamNames}>
                <Save className="h-3.5 w-3.5 mr-1" /> Save Parameter Names
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Version History</CardTitle>
                  <CardDescription>Save and restore model checkpoints. {versions.length > 0 && `${versions.length} checkpoint${versions.length !== 1 ? 's' : ''} saved.`}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No checkpoints saved yet. Use the Checkpoint button in the context bar to save one.</p>
              ) : (
                <div className="space-y-2">
                  {versions.slice(0, visibleCount).map(v => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-md border border-border group">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          {editingVersionId === v.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                className="h-7 text-sm w-48"
                                value={editingVersionName}
                                onChange={e => setEditingVersionName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleRenameVersion(v.id)}
                                autoFocus
                              />
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleRenameVersion(v.id)}>
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingVersionId(null)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className={`text-sm font-semibold ${!v.label ? 'italic text-muted-foreground' : ''}`}>
                                {v.label || 'Unnamed Checkpoint'}
                              </span>
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(v.created_at).toLocaleString()}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      {editingVersionId !== v.id && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => { setEditingVersionId(v.id); setEditingVersionName(v.label || ''); }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={() => setDeleteVersionId(v.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs ml-1" onClick={() => setRestoreVersionId(v.id)}>
                            <RotateCcw className="h-3 w-3 mr-1" /> Restore
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {versions.length > visibleCount && (
                    <Button variant="ghost" className="w-full text-xs" onClick={() => setVisibleCount(c => c + 10)}>
                      <ChevronDown className="h-3.5 w-3.5 mr-1" /> Load more ({versions.length - visibleCount} remaining)
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger" className="mt-4 space-y-4">
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-md border border-border">
                <div>
                  <p className="text-sm font-medium">Archive Model</p>
                  <p className="text-xs text-muted-foreground">Hide from main library. Can be restored.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { archiveModel(model.id); toast.success(model.is_archived ? 'Model restored' : 'Model archived'); }}>
                  <Archive className="h-3.5 w-3.5 mr-1" /> {model.is_archived ? 'Restore' : 'Archive'}
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border border-border">
                <div>
                  <p className="text-sm font-medium">Export Model</p>
                  <p className="text-xs text-muted-foreground">Download full model data as JSON.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Export
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border border-destructive/30 bg-destructive/5">
                <div>
                  <p className="text-sm font-medium text-destructive">Delete Model</p>
                  <p className="text-xs text-muted-foreground">Permanently delete this model and all data.</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Model</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>"{model.name}"</strong> and all its data. Type the model name to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            placeholder={model.name}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteConfirm !== model.name}>
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation dialog */}
      <AlertDialog open={!!restoreVersionId} onOpenChange={(open) => !open && setRestoreVersionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Checkpoint</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all current model data with the checkpoint from{' '}
              <strong>{restoreVersionId && versions.find(v => v.id === restoreVersionId)
                ? new Date(versions.find(v => v.id === restoreVersionId)!.created_at).toLocaleString()
                : '...'}</strong>.
              This cannot be undone. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRestoring}
              onClick={() => restoreVersionId && handleRestore(restoreVersionId)}
            >
              {isRestoring ? 'Restoring...' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
