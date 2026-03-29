import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModelStore, type Model, defaultParamNames } from '@/stores/modelStore';
import { useAuth } from '@/contexts/AuthContext';
import { useUserLevelStore } from '@/hooks/useUserLevel';
import { UserProfileDropdown } from '@/components/UserProfileDropdown';
import { usePageTitle } from '@/hooks/usePageTitle';
import { saveFullModelToDB } from '@/lib/supabaseData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Search, Star, MoreVertical, Copy, Trash2, Archive,
  LayoutGrid, List, Package, Cpu, Users, Pencil, RotateCcw,
  Download, Upload, Settings,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import troobaLogoDark from '@/assets/trooba-logo-dark.svg';
import troobaMarkDark from '@/assets/trooba-mark-dark.svg';

type StatusFilter = 'all' | 'never_run' | 'current' | 'needs_recalc';

export default function ModelLibrary() {
  usePageTitle('Model Library');
  const models = useModelStore((s) => s.models);
  const modelsLoaded = useModelStore((s) => s.modelsLoaded);
  const modelsLoading = useModelStore((s) => s.modelsLoading);
  const loadModels = useModelStore((s) => s.loadModels);
  const createModel = useModelStore((s) => s.createModel);
  const duplicateModel = useModelStore((s) => s.duplicateModel);
  const deleteModel = useModelStore((s) => s.deleteModel);
  const renameModel = useModelStore((s) => s.renameModel);
  const toggleStar = useModelStore((s) => s.toggleStar);
  const archiveModel = useModelStore((s) => s.archiveModel);
  const { signOut, user } = useAuth();
  const fetchUserLevel = useUserLevelStore(s => s.fetchUserLevel);
  const navigate = useNavigate();
  const importRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<Model | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [renameTarget, setRenameTarget] = useState<Model | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!modelsLoaded && !modelsLoading) loadModels();
    fetchUserLevel();
  }, [modelsLoaded, modelsLoading, loadModels, fetchUserLevel]);

  const filtered = models.filter((m) => {
    if (!showArchived && m.is_archived) return false;
    if (showArchived && !m.is_archived) return false;
    if (statusFilter !== 'all' && m.run_status !== statusFilter) return false;
    const q = search.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = createModel(newName.trim(), newDesc.trim());
    setShowCreate(false); setNewName(''); setNewDesc('');
    navigate(`/models/${id}/general`);
  };

  const handleDelete = () => {
    if (!deleteTarget || deleteConfirmName !== deleteTarget.name) return;
    deleteModel(deleteTarget.id);
    setDeleteTarget(null); setDeleteConfirmName('');
    toast.success(`Model "${deleteTarget.name}" permanently deleted`);
  };

  const handleRename = () => {
    if (!renameTarget || !renameValue.trim()) return;
    renameModel(renameTarget.id, renameValue.trim());
    setRenameTarget(null); setRenameValue('');
    toast.success('Model renamed');
  };

  const openModel = (id: string) => navigate(`/models/${id}/overview`);

  const handleExportModel = (model: Model) => {
    const exportData = {
      name: model.name, description: model.description, tags: model.tags,
      general: model.general, labor: model.labor, equipment: model.equipment,
      products: model.products, operations: model.operations, routing: model.routing, ibom: model.ibom,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `${model.name.replace(/\s+/g, '-')}-export-${date}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Model exported');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const snap = JSON.parse(text);
      if (!snap.general || !snap.labor || !snap.equipment || !snap.products) {
        toast.error('Invalid model file — missing required data sections');
        setImporting(false); return;
      }
      const { createDemoModel } = await import('@/stores/modelStore');
      const uid = () => crypto.randomUUID();
      const idMap: Record<string, string> = {};
      const newUid = (old: string) => { const n = uid(); idMap[old] = n; return n; };

      const modelId = uid();
      const labor = (snap.labor || []).map((l: any) => ({ ...l, id: newUid(l.id) }));
      const equipment = (snap.equipment || []).map((e: any) => ({
        ...e, id: newUid(e.id),
        labor_group_id: e.labor_group_id ? (idMap[e.labor_group_id] || e.labor_group_id) : '',
      }));
      const products = (snap.products || []).map((p: any) => ({ ...p, id: newUid(p.id) }));
      const operations = (snap.operations || []).map((o: any) => ({
        ...o, id: newUid(o.id),
        product_id: idMap[o.product_id] || o.product_id,
        equip_id: o.equip_id ? (idMap[o.equip_id] || o.equip_id) : '',
      }));
      const routing = (snap.routing || []).map((r: any) => ({
        ...r, id: uid(),
        product_id: idMap[r.product_id] || r.product_id,
      }));
      const ibom = (snap.ibom || []).map((i: any) => ({
        ...i, id: uid(),
        parent_product_id: idMap[i.parent_product_id] || i.parent_product_id,
        component_product_id: idMap[i.component_product_id] || i.component_product_id,
      }));

      const importedModel: Model = {
        id: modelId,
        name: `${snap.name || 'Imported Model'} (Imported)`,
        description: snap.description || '',
        tags: snap.tags || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_run_at: null, run_status: 'never_run',
        is_archived: false, is_demo: false, is_starred: false,
        general: snap.general, param_names: snap.param_names || { ...defaultParamNames }, labor, equipment, products, operations, routing, ibom,
      };

      await saveFullModelToDB(importedModel);
      useModelStore.setState(s => ({ models: [importedModel, ...s.models] }));
      toast.success(`Model "${importedModel.name}" imported successfully`);
      navigate(`/models/${modelId}/overview`);
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Failed to import model — invalid file format');
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  const statusBadge = (status: Model['run_status']) => {
    const map = {
      never_run: { label: 'Never Run', className: 'bg-muted/20 text-muted-foreground' },
      current: { label: 'Current', className: 'bg-success/15 text-success border-success/30' },
      needs_recalc: { label: 'Recalc Needed', className: 'bg-warning/15 text-warning border-warning/30' },
    };
    const c = map[status];
    return <Badge variant="outline" className={`text-xs ${c.className}`}>{c.label}</Badge>;
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const modelActions = (model: Model) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className="p-1 rounded hover:bg-[#F3F4F6]"><MoreVertical className="h-4 w-4 text-[#9CA3AF]" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameTarget(model); setRenameValue(model.name); }}>
          <Pencil className="h-4 w-4 mr-2" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateModel(model.id); toast.success('Model duplicated'); }}>
          <Copy className="h-4 w-4 mr-2" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleExportModel(model); }}>
          <Download className="h-4 w-4 mr-2" /> Export JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); archiveModel(model.id); toast.success(model.is_archived ? 'Model restored' : 'Model archived'); }}>
          {model.is_archived ? <RotateCcw className="h-4 w-4 mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
          {model.is_archived ? 'Restore' : 'Archive'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteTarget(model); setDeleteConfirmName(''); }} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (modelsLoading && !modelsLoaded) {
    return (
      <div className="min-h-screen bg-sidebar flex items-center justify-center">
        <div className="text-center">
          <img src={troobaMarkDark} alt="" className="h-12 w-12 mx-auto mb-3 animate-pulse-brand" />
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-sidebar-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      {/* Dark navy header */}
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-sidebar">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <img src={troobaLogoDark} alt="Trooba Flow" className="h-7" />
              <p className="subbrand-line mt-1.5">Flow Intelligence</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="h-4 w-4" /> New Model
              </Button>
              <Button variant="ghost" size="icon" className="text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => navigate('/settings')} title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
              <UserProfileDropdown />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-muted" />
              <Input placeholder="Search models..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.12)] text-sidebar-foreground placeholder:text-sidebar-muted focus-visible:border-primary" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-40 h-9 text-xs bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.12)] text-sidebar-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="never_run">Never Run</SelectItem>
                <SelectItem value="current">Results Current</SelectItem>
                <SelectItem value="needs_recalc">Recalc Needed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className={`text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent ${showArchived ? 'bg-sidebar-accent text-sidebar-foreground' : ''}`} onClick={() => setShowArchived(!showArchived)}>
              <Archive className="h-4 w-4 mr-1" /> {showArchived ? 'Archived' : 'Active'}
            </Button>
            <div className="flex border border-[rgba(255,255,255,0.12)] rounded-md overflow-hidden">
              <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-none ${viewMode === 'grid' ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent'}`} onClick={() => setViewMode('grid')}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-none ${viewMode === 'list' ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent'}`} onClick={() => setViewMode('list')}>
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Light content area */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <img src={troobaMarkDark} alt="" className="h-9 w-9 mx-auto mb-3 opacity-20" />
            <p className="text-[14px] font-medium text-foreground">No models found</p>
            <p className="text-[13px] text-muted-foreground mt-1">{search ? 'Try a different search term' : 'Create a new model or import one to get started'}</p>
            <div className="flex gap-2 justify-center mt-4">
              <Button onClick={() => setShowCreate(true)} className="gap-1"><Plus className="h-4 w-4" /> Create Model</Button>
              <Button variant="outline" onClick={() => importRef.current?.click()} className="gap-1"><Upload className="h-4 w-4" /> Import JSON</Button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((model, i) => (
              <motion.div key={model.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="group bg-card border border-border rounded-md shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                onClick={() => openModel(model.id)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">{model.name}</h3>
                      <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">{model.description || 'No description'}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button onClick={(e) => { e.stopPropagation(); toggleStar(model.id); }} className="p-1 rounded hover:bg-[#F3F4F6]">
                        <Star className={`h-4 w-4 ${model.is_starred ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`} />
                      </button>
                      {modelActions(model)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {model.tags.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                    {statusBadge(model.run_status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span className="flex items-center gap-1"><Package className="h-3 w-3" />{model.products.length}</span>
                    <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />{model.equipment.length}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{model.labor.length}</span>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground mt-3">Updated {timeAgo(model.updated_at)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[#F4F6F8]">
                  <th className="text-left px-4 py-2.5 font-mono font-normal text-[10px] uppercase tracking-[0.1em] text-[#6B7280]">Name</th>
                  <th className="text-left px-4 py-2.5 font-mono font-normal text-[10px] uppercase tracking-[0.1em] text-[#6B7280]">Products</th>
                  <th className="text-left px-4 py-2.5 font-mono font-normal text-[10px] uppercase tracking-[0.1em] text-[#6B7280]">Equipment</th>
                  <th className="text-left px-4 py-2.5 font-mono font-normal text-[10px] uppercase tracking-[0.1em] text-[#6B7280]">Status</th>
                  <th className="text-left px-4 py-2.5 font-mono font-normal text-[10px] uppercase tracking-[0.1em] text-[#6B7280]">Updated</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((model) => (
                  <tr key={model.id} className="border-b border-[#F0F2F5] last:border-0 hover:bg-[#F9FAFB] cursor-pointer" onClick={() => openModel(model.id)}>
                    <td className="px-4 py-3 font-medium text-foreground">{model.name}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{model.products.length}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{model.equipment.length}</td>
                    <td className="px-4 py-3">{statusBadge(model.run_status)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{timeAgo(model.updated_at)}</td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>{modelActions(model)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create New Model</DialogTitle><DialogDescription>Start a new capacity model</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Name</label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Q4 Capacity Plan" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreate()} /></div>
            <div><label className="text-sm font-medium">Description</label><Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional description" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete Model</DialogTitle><DialogDescription>Type the model name to confirm permanent deletion.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">Model: <span className="font-semibold">{deleteTarget?.name}</span></p>
            <Input value={deleteConfirmName} onChange={(e) => setDeleteConfirmName(e.target.value)} placeholder="Type model name to confirm" />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" onClick={handleDelete} disabled={deleteConfirmName !== deleteTarget?.name}>Delete Permanently</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={() => setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Rename Model</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="New name" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleRename()} />
          <DialogFooter><Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button><Button onClick={handleRename} disabled={!renameValue.trim()}>Rename</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
