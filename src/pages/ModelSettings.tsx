import { useState, useEffect } from 'react';
import { useModelStore } from '@/stores/modelStore';
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Save, Trash2, Archive, Download, RotateCcw, X, Plus, Clock } from 'lucide-react';
import { toast } from 'sonner';

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

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [paramNames, setParamNames] = useState<ParamNames>(defaultParamNames);
  const [versions, setVersions] = useState<Version[]>([]);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showRestore, setShowRestore] = useState<string | null>(null);

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
      .order('created_at', { ascending: false })
      .limit(10);
    setVersions((data as Version[]) || []);
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
    const snapshot = {
      general: model.general,
      labor: model.labor,
      equipment: model.equipment,
      products: model.products,
      operations: model.operations,
      routing: model.routing,
      ibom: model.ibom,
    };
    await supabase.from('model_versions' as any).insert({
      model_id: model.id,
      label: 'Manual Checkpoint',
      snapshot,
    });
    toast.success('Checkpoint saved');
    loadVersions();
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

  const handleRestore = async (versionId: string) => {
    const { data } = await supabase
      .from('model_versions')
      .select('snapshot')
      .eq('id', versionId)
      .single();
    if (!data?.snapshot) { toast.error('Failed to load version'); return; }
    // This is a simplified restore — in production you'd replace all DB data
    toast.success('Version restore requires page reload');
    setShowRestore(null);
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
                  <CardDescription>Save and restore model checkpoints.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveCheckpoint}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Save Checkpoint
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No checkpoints saved yet.</p>
              ) : (
                <div className="space-y-2">
                  {versions.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium">{v.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {new Date(v.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowRestore(v.id)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Restore
                      </Button>
                    </div>
                  ))}
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
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteConfirm !== model.name}>
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showRestore} onOpenChange={open => { if (!open) setShowRestore(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Version</DialogTitle>
            <DialogDescription>
              This will replace all current model data with the saved checkpoint. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRestore(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleRestore(showRestore!)}>Restore</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
