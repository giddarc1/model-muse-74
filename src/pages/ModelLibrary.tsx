import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModelStore, type Model } from '@/stores/modelStore';
import { useAuth } from '@/contexts/AuthContext';
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
  Plus, Search, Star, MoreVertical, Copy, Trash2, Archive,
  LayoutGrid, List, Package, Cpu, Users, FlaskConical, Pencil, RotateCcw, LogOut,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function ModelLibrary() {
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
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Model | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [renameTarget, setRenameTarget] = useState<Model | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    if (!modelsLoaded || !modelsLoading) {
      loadModels();
    }
  }, []);

  const filtered = models.filter((m) => {
    if (!showArchived && m.is_archived) return false;
    if (showArchived && !m.is_archived) return false;
    const q = search.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = createModel(newName.trim(), newDesc.trim());
    setShowCreate(false);
    setNewName('');
    setNewDesc('');
    navigate(`/models/${id}/general`);
  };

  const handleDelete = () => {
    if (!deleteTarget || deleteConfirmName !== deleteTarget.name) return;
    deleteModel(deleteTarget.id);
    setDeleteTarget(null);
    setDeleteConfirmName('');
    toast.success(`Model "${deleteTarget.name}" permanently deleted`);
  };

  const handleRename = () => {
    if (!renameTarget || !renameValue.trim()) return;
    renameModel(renameTarget.id, renameValue.trim());
    setRenameTarget(null);
    setRenameValue('');
    toast.success('Model renamed');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const openModel = (id: string) => navigate(`/models/${id}/overview`);

  const statusBadge = (status: Model['run_status']) => {
    const map = {
      never_run: { label: 'Never Run', className: 'bg-muted text-muted-foreground' },
      current: { label: 'Current', className: 'bg-success/15 text-success border-success/30' },
      needs_recalc: { label: 'Recalc Needed', className: 'bg-warning/15 text-warning border-warning/30' },
    };
    const c = map[status];
    return <Badge variant="outline" className={`text-xs ${c.className}`}>{c.label}</Badge>;
  };

  const timeAgo = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const modelActions = (model: Model) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className="p-1 rounded hover:bg-muted">
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameTarget(model); setRenameValue(model.name); }}>
          <Pencil className="h-4 w-4 mr-2" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateModel(model.id); toast.success('Model duplicated'); }}>
          <Copy className="h-4 w-4 mr-2" /> Duplicate
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading models…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">RapidMCT</h1>
              <p className="text-sm text-muted-foreground mt-1">Manufacturing Cycle Time Analysis Platform</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="h-4 w-4" /> New Model
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1 text-muted-foreground">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{user?.email}</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search models..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant={showArchived ? 'secondary' : 'ghost'} size="sm" onClick={() => setShowArchived(!showArchived)}>
              <Archive className="h-4 w-4 mr-1" />
              {showArchived ? 'Archived' : 'Active'}
            </Button>
            <div className="flex border rounded-md overflow-hidden">
              <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('grid')}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('list')}>
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No models found</p>
            <p className="text-sm mt-1">{search ? 'Try a different search term' : 'Create a new model to get started'}</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((model, i) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group bg-card border rounded-lg hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                onClick={() => openModel(model.id)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{model.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{model.description || 'No description'}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button onClick={(e) => { e.stopPropagation(); toggleStar(model.id); }} className="p-1 rounded hover:bg-muted">
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
                  <div className="text-xs text-muted-foreground mt-3">Updated {timeAgo(model.updated_at)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-card border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Products</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Equipment</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Updated</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((model) => (
                  <tr key={model.id} className="border-b last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => openModel(model.id)}>
                    <td className="px-4 py-3 font-medium">{model.name}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{model.products.length}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{model.equipment.length}</td>
                    <td className="px-4 py-3">{statusBadge(model.run_status)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{timeAgo(model.updated_at)}</td>
                    <td className="px-2">{modelActions(model)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Model</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Model Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Q4 Production Cell" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description (optional)</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Brief description of this model" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Create Model</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmName(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Model</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>"{deleteTarget?.name}"</strong> and all its data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium mb-1.5 block">Type the model name to confirm:</label>
            <Input value={deleteConfirmName} onChange={(e) => setDeleteConfirmName(e.target.value)} placeholder={deleteTarget?.name} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteTarget(null); setDeleteConfirmName(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteConfirmName !== deleteTarget?.name}>Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Model</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm font-medium mb-1 block">New Name</label>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleRename()} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
