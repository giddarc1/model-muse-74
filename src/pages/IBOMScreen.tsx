import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useModelStore, type IBOMEntry } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronRight, ChevronDown, Network, FlaskConical, Trash2, X, Search, Package, PlusCircle, GitBranch } from 'lucide-react';
import { toast } from 'sonner';

interface TreeNode {
  productId: string;
  productName: string;
  unitsPerAssy: number;
  children: TreeNode[];
  depth: number;
}

export default function IBOMScreen() {
  const navigate = useNavigate();
  const { modelId } = useParams<{ modelId: string }>();
  const model = useModelStore((s) => s.getActiveModel());
  const addIBOM = useModelStore((s) => s.addIBOM);
  const updateIBOM = useModelStore((s) => s.updateIBOM);
  const deleteIBOM = useModelStore((s) => s.deleteIBOM);
  const activeScenarioId = useScenarioStore(s => s.activeScenarioId);
  const activeScenario = useScenarioStore(s => s.scenarios.find(sc => sc.id === s.activeScenarioId));

  const [viewAssemblyId, setViewAssemblyId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [checkedAllowable, setCheckedAllowable] = useState<Set<string>>(new Set());
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
  const [showRemoveAllDialog, setShowRemoveAllDialog] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [upaErrors, setUpaErrors] = useState<Set<string>>(new Set());
  const [showEmptyPicker, setShowEmptyPicker] = useState(false);

  // Track previous valid values for revert on blur
  const prevUpaValues = useRef<Map<string, number>>(new Map());

  const buildTree = useCallback((parentId: string, depth: number, visited: Set<string>): TreeNode[] => {
    if (!model || visited.has(parentId)) return [];
    const entries = model.ibom.filter((e) => e.parent_product_id === parentId);
    return entries.map((e) => {
      const product = model.products.find((p) => p.id === e.component_product_id);
      const nextVisited = new Set(visited);
      nextVisited.add(parentId);
      return {
        productId: e.component_product_id,
        productName: product?.name || '???',
        unitsPerAssy: e.units_per_assy,
        children: buildTree(e.component_product_id, depth + 1, nextVisited),
        depth,
      };
    });
  }, [model]);

  const getAncestors = useCallback((productId: string, visited: Set<string> = new Set()): Set<string> => {
    if (!model || visited.has(productId)) return visited;
    visited.add(productId);
    const parents = model.ibom.filter((e) => e.component_product_id === productId);
    parents.forEach((p) => getAncestors(p.parent_product_id, visited));
    return visited;
  }, [model]);

  const tree = useMemo(() => {
    if (!viewAssemblyId) return [];
    return buildTree(viewAssemblyId, 0, new Set());
  }, [viewAssemblyId, buildTree]);

  // Compute max depth of tree
  const maxDepth = useMemo(() => {
    function getDepth(nodes: TreeNode[]): number {
      if (nodes.length === 0) return 0;
      return 1 + Math.max(...nodes.map(n => getDepth(n.children)));
    }
    return getDepth(tree);
  }, [tree]);

  // Compute Units / Final Assembly for each component
  const unitsPerFinalAssy = useMemo(() => {
    if (!model || !viewAssemblyId) return new Map<string, number>();
    const result = new Map<string, number>();
    function traverse(parentId: string, multiplier: number, visited: Set<string>) {
      if (visited.has(parentId)) return;
      const nextVisited = new Set(visited);
      nextVisited.add(parentId);
      const entries = model!.ibom.filter(e => e.parent_product_id === parentId);
      entries.forEach(e => {
        const cumulative = multiplier * e.units_per_assy;
        const existing = result.get(e.component_product_id) || 0;
        result.set(e.component_product_id, existing + cumulative);
        traverse(e.component_product_id, cumulative, nextVisited);
      });
    }
    traverse(viewAssemblyId, 1, new Set());
    return result;
  }, [model, viewAssemblyId]);

  // Filter tree nodes
  const filterTree = useCallback((nodes: TreeNode[], query: string): TreeNode[] => {
    if (!query) return nodes;
    const lq = query.toLowerCase();
    return nodes.reduce<TreeNode[]>((acc, node) => {
      const filteredChildren = filterTree(node.children, query);
      if (node.productName.toLowerCase().includes(lq) || filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren });
      }
      return acc;
    }, []);
  }, []);

  const filteredTree = useMemo(() => filterTree(tree, filterText), [tree, filterText, filterTree]);

  // Bottom panel: components of selected product
  const editParentId = selectedProductId || '';
  const currentComponents = useMemo(() => {
    if (!model || !editParentId) return [];
    return model.ibom.filter((e) => e.parent_product_id === editParentId);
  }, [model, editParentId]);

  const allowableProducts = useMemo(() => {
    if (!model || !editParentId) return [];
    const currentCompIds = new Set(currentComponents.map((c) => c.component_product_id));
    const ancestors = getAncestors(editParentId);
    return model.products.filter((p) => {
      if (p.id === editParentId) return false;
      if (currentCompIds.has(p.id)) return false;
      if (ancestors.has(p.id)) return false;
      return true;
    });
  }, [model, editParentId, currentComponents, getAncestors]);

  // Check if selected product is a what-if edit target
  const isWhatIfTarget = useMemo(() => {
    if (!activeScenario || !editParentId) return false;
    return activeScenario.changes.some(c => c.entityId === editParentId);
  }, [activeScenario, editParentId]);

  // No products empty state
  if (!model) return null;

  if (model.products.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center animate-fade-in gap-4 px-6">
        <div className="rounded-full bg-muted p-6">
          <Package className="h-12 w-12 text-muted-foreground/50" />
        </div>
        <div className="text-center space-y-1.5">
          <h2 className="text-lg font-semibold">No products defined yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Add products in the Products tab before building your IBOM structure.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/models/${modelId}/products`)}
          className="gap-2"
        >
          Go to Products
        </Button>
      </div>
    );
  }

  const prodName = (id: string) => model.products.find((p) => p.id === id)?.name || '???';
  const allProducts = model.products;

  const toggleExpand = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSelectRow = (productId: string) => {
    setSelectedProductId(productId);
    setCheckedAllowable(new Set());
    setConfirmingRemoveId(null);
    setShowEmptyPicker(false);
  };

  const handleAddChecked = () => {
    if (!editParentId || checkedAllowable.size === 0) return;
    checkedAllowable.forEach(pId => {
      addIBOM(model.id, {
        id: crypto.randomUUID(),
        parent_product_id: editParentId,
        component_product_id: pId,
        units_per_assy: 1,
      });
    });
    toast.success(`Added ${checkedAllowable.size} component(s)`);
    setCheckedAllowable(new Set());
  };

  const handleAddAll = () => {
    allowableProducts.forEach((p) => {
      addIBOM(model.id, {
        id: crypto.randomUUID(),
        parent_product_id: editParentId,
        component_product_id: p.id,
        units_per_assy: 1,
      });
    });
    toast.success(`Added ${allowableProducts.length} components`);
  };

  const handleRemoveAll = () => {
    currentComponents.forEach((c) => deleteIBOM(model.id, c.id));
    toast.success('All components removed');
    setShowRemoveAllDialog(false);
  };

  const expandAll = () => {
    const allKeys = new Set<string>();
    const collectKeys = (nodes: TreeNode[], parentKey: string) => {
      nodes.forEach((n, i) => {
        const key = `${parentKey}-${n.productId}-${i}`;
        if (n.children.length > 0) { allKeys.add(key); collectKeys(n.children, key); }
      });
    };
    collectKeys(tree, 'root');
    setExpandedNodes(allKeys);
  };

  const handleUpaChange = (entryId: string, value: string, currentValid: number) => {
    const num = Number(value);
    if (!prevUpaValues.current.has(entryId)) {
      prevUpaValues.current.set(entryId, currentValid);
    }
    if (value === '' || num <= 0) {
      setUpaErrors(prev => new Set(prev).add(entryId));
      return;
    }
    setUpaErrors(prev => { const n = new Set(prev); n.delete(entryId); return n; });
    updateIBOM(model.id, entryId, { units_per_assy: num });
    prevUpaValues.current.set(entryId, num);
  };

  const handleUpaBlur = (entryId: string) => {
    if (upaErrors.has(entryId)) {
      const revert = prevUpaValues.current.get(entryId) || 1;
      updateIBOM(model.id, entryId, { units_per_assy: revert });
      setUpaErrors(prev => { const n = new Set(prev); n.delete(entryId); return n; });
    }
  };

  // Filter dropdown products too
  const filteredDropdownProducts = filterText
    ? allProducts.filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()))
    : allProducts;

  const renderTreeNode = (node: TreeNode, parentKey: string, index: number) => {
    const key = `${parentKey}-${node.productId}-${index}`;
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(key);
    const isSelected = selectedProductId === node.productId;
    const ufa = unitsPerFinalAssy.get(node.productId);

    return (
      <div key={key}>
        <div
          className={`flex items-center gap-2 h-8 px-2 cursor-pointer text-sm transition-colors ${
            isSelected
              ? 'bg-primary/5 border-l-2 border-l-primary'
              : 'hover:bg-muted/50 border-l-2 border-l-transparent'
          }`}
          style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
          onClick={() => handleSelectRow(node.productId)}
        >
          {hasChildren ? (
            <button
              className="shrink-0 p-0.5 rounded hover:bg-muted"
              onClick={(e) => toggleExpand(key, e)}
            >
              {isExpanded
                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              }
            </button>
          ) : (
            <span className="w-4.5 shrink-0 text-center text-muted-foreground/40">—</span>
          )}
          <span className={`font-mono text-xs ${hasChildren ? 'font-medium' : 'text-muted-foreground'}`}>
            {node.productName}
          </span>
          <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums w-16 text-right">
            {node.unitsPerAssy}
          </span>
          <span className="font-mono text-xs text-muted-foreground/60 italic tabular-nums w-20 text-right">
            {ufa !== undefined ? ufa : '—'}
          </span>
        </div>
        {hasChildren && isExpanded && node.children.map((child, i) => renderTreeNode(child, key, i))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in">
      {/* Page Header */}
      <div className="px-6 pt-4 pb-2 shrink-0">
        {activeScenarioId && activeScenario && (
          <div className="mb-2 flex items-center gap-2 p-2 bg-warning/10 border border-warning/30 rounded-md">
            <FlaskConical className="h-3.5 w-3.5 text-warning shrink-0" />
            <span className="text-xs text-warning font-medium">
              Changes recorded to <span className="font-semibold">{activeScenario.name}</span>
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Indented Bill of Materials</h1>
            <p className="text-sm text-muted-foreground">Define parent–child relationships between products and their component parts.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Go to:</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate(`/models/${modelId}/products`)}>
              Product Form
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate(`/models/${modelId}/operations`)}>
              Operations
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ TOP PANEL — IBOM Structure Tree ═══ */}
      <div className="shrink-0 px-6 pb-2" style={{ height: '45%', minHeight: 200 }}>
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">IBOM Structure</CardTitle>
                {viewAssemblyId && tree.length > 0 && maxDepth > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                    {maxDepth} level{maxDepth !== 1 ? 's' : ''} deep
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Network className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">View assembly:</span>
                <Select value={viewAssemblyId} onValueChange={(v) => { setViewAssemblyId(v); setExpandedNodes(new Set()); setSelectedProductId(''); setFilterText(''); }}>
                  <SelectTrigger className="h-7 w-48 text-xs">
                    <SelectValue placeholder="Select assembly…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProducts.map((p) => {
                      const compCount = model.ibom.filter(e => e.parent_product_id === p.id).length;
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {compCount > 0 && <span className="text-muted-foreground ml-1">({compCount})</span>}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {viewAssemblyId && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => { setViewAssemblyId(''); setSelectedProductId(''); setExpandedNodes(new Set()); setFilterText(''); }}>
                    <X className="h-3 w-3 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </div>
            {/* Filter input */}
            {viewAssemblyId && tree.length > 0 && (
              <div className="relative mt-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter products…"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="h-7 text-xs pl-7 pr-7"
                />
                {filterText && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setFilterText('')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {!viewAssemblyId ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Select an assembly above to view its structure.
              </div>
            ) : tree.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No components defined for this product. Select it below to add components.
              </div>
            ) : (
              <div className="text-xs">
                {/* Column headers */}
                <div className="flex items-center gap-2 h-7 px-2 border-b border-border bg-muted/30 text-muted-foreground font-medium sticky top-0 z-10">
                  <div className="flex-1 pl-2 flex items-center gap-2">
                    <span>Component</span>
                    <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 ml-2" onClick={expandAll}>
                      Expand All
                    </Button>
                  </div>
                  <span className="w-16 text-right">Units/Assy</span>
                  <span className="w-20 text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help underline decoration-dotted">Units/Final</TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs text-xs">
                          Total units of this component needed per 1 good final assembly across all IBOM levels. Scrap excluded.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                </div>
                {/* Root assembly row */}
                <div
                  className={`flex items-center gap-2 h-8 px-2 cursor-pointer transition-colors ${
                    selectedProductId === viewAssemblyId
                      ? 'bg-primary/5 border-l-2 border-l-primary'
                      : 'hover:bg-muted/50 border-l-2 border-l-transparent'
                  }`}
                  onClick={() => handleSelectRow(viewAssemblyId)}
                >
                  <Network className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-mono text-xs font-semibold">{prodName(viewAssemblyId)}</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1">Assembly</Badge>
                  <span className="ml-auto w-16 text-right font-mono text-xs text-muted-foreground">—</span>
                  <span className="w-20 text-right font-mono text-xs text-muted-foreground/60">—</span>
                </div>
                {/* Tree nodes */}
                {filteredTree.map((node, i) => renderTreeNode(node, 'root', i))}
                {filterText && filteredTree.length === 0 && (
                  <div className="flex items-center justify-center py-6 text-muted-foreground text-xs">
                    No matching products found.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ BOTTOM PANEL — Edit Components ═══ */}
      <div className="flex-1 min-h-0 px-6 pt-2 pb-4">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2 shrink-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">
                {editParentId
                  ? <>Components for: <span className="font-mono text-primary">{prodName(editParentId)}</span></>
                  : 'Edit Components'
                }
              </CardTitle>
              {editParentId && isWhatIfTarget && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-warning/40 text-warning bg-warning/10">
                  ● What-if active
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 pt-0">
            {!editParentId ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Click any product in the tree above to edit its components.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 h-full">
                {/* Left: Current Components */}
                <div className="flex flex-col min-h-0">
                  <Label className="text-xs font-medium mb-1.5 shrink-0">Current Components</Label>
                  <div className="border rounded-md flex-1 overflow-y-auto">
                    {currentComponents.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3">No components added yet. Add from the list on the right.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs h-7">Component</TableHead>
                            <TableHead className="text-xs h-7 w-24">Units/Assy</TableHead>
                            <TableHead className="text-xs h-7 w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentComponents.map((c) => {
                            const isConfirming = confirmingRemoveId === c.id;
                            const hasError = upaErrors.has(c.id);
                            return (
                              <TableRow key={c.id} className={isConfirming ? 'bg-destructive/10' : ''}>
                                {isConfirming ? (
                                  <TableCell colSpan={3} className="py-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-destructive font-medium">
                                        Remove {prodName(c.component_product_id)}?
                                      </span>
                                      <div className="flex gap-1.5">
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          className="h-6 text-xs px-2"
                                          onClick={() => {
                                            deleteIBOM(model.id, c.id);
                                            setConfirmingRemoveId(null);
                                            toast.success('Component removed');
                                          }}
                                        >
                                          Confirm
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 text-xs px-2"
                                          onClick={() => setConfirmingRemoveId(null)}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  </TableCell>
                                ) : (
                                  <>
                                    <TableCell className="font-mono text-xs py-1">{prodName(c.component_product_id)}</TableCell>
                                    <TableCell className="py-1">
                                      <div>
                                        <Input
                                          type="number"
                                          className={`h-6 w-16 font-mono text-xs ${hasError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                          defaultValue={c.units_per_assy}
                                          min={1}
                                          onChange={(e) => handleUpaChange(c.id, e.target.value, c.units_per_assy)}
                                          onBlur={() => handleUpaBlur(c.id)}
                                        />
                                        {hasError && (
                                          <p className="text-[10px] text-destructive mt-0.5">Must be greater than 0</p>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-1 text-right">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs text-destructive hover:text-destructive px-2"
                                        onClick={() => setConfirmingRemoveId(c.id)}
                                      >
                                        Remove
                                      </Button>
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                  {currentComponents.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs mt-1.5 self-start text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setShowRemoveAllDialog(true)}
                    >
                      Remove All Components
                    </Button>
                  )}
                </div>

                {/* Right: Add Components */}
                <div className="flex flex-col min-h-0">
                  <Label className="text-xs font-medium mb-1.5 shrink-0">Available to add:</Label>
                  <div className="border rounded-md flex-1 overflow-y-auto p-1">
                    {allProducts.length <= 1 ? (
                      <p className="text-xs text-muted-foreground p-2">No other products exist. Add products in the Products tab first.</p>
                    ) : allowableProducts.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">All valid components have already been added.</p>
                    ) : (
                      <div className="space-y-0.5">
                        {allowableProducts.map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs font-mono hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={checkedAllowable.has(p.id)}
                              onCheckedChange={(checked) => {
                                setCheckedAllowable(prev => {
                                  const next = new Set(prev);
                                  if (checked) next.add(p.id); else next.delete(p.id);
                                  return next;
                                });
                              }}
                            />
                            {p.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 mt-1.5 shrink-0">
                    <Button size="sm" className="text-xs" onClick={handleAddChecked} disabled={checkedAllowable.size === 0}>
                      {checkedAllowable.size > 0 ? `Add ${checkedAllowable.size} Selected` : 'Add Selected'}
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={handleAddAll} disabled={allowableProducts.length === 0}>
                      Add All ({allowableProducts.length})
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Remove All Confirmation Dialog */}
      <Dialog open={showRemoveAllDialog} onOpenChange={setShowRemoveAllDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove All Components</DialogTitle>
            <DialogDescription>
              Remove all {currentComponents.length} components from {editParentId ? prodName(editParentId) : ''}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRemoveAllDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveAll}>Remove All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
