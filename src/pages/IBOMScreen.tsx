import { useState, useMemo, useCallback } from 'react';
import { useModelStore, type IBOMEntry } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronRight, ChevronDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRightIcon, Network, Info, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';

interface TreeNode {
  productId: string;
  productName: string;
  unitsPerAssy: number;
  children: TreeNode[];
  depth: number;
}

export default function IBOMScreen() {
  const model = useModelStore((s) => s.getActiveModel());
  const addIBOM = useModelStore((s) => s.addIBOM);
  const updateIBOM = useModelStore((s) => s.updateIBOM);
  const deleteIBOM = useModelStore((s) => s.deleteIBOM);
  const activeScenarioId = useScenarioStore(s => s.activeScenarioId);
  const activeScenario = useScenarioStore(s => s.scenarios.find(sc => sc.id === s.activeScenarioId));

  const [viewAssemblyId, setViewAssemblyId] = useState('');
  const [editParentId, setEditParentId] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [checkedAllowable, setCheckedAllowable] = useState<Set<string>>(new Set());
  const [selectedComponent, setSelectedComponent] = useState('');

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

  const getDescendants = useCallback((productId: string, visited: Set<string> = new Set()): Set<string> => {
    if (!model || visited.has(productId)) return visited;
    visited.add(productId);
    const children = model.ibom.filter((e) => e.parent_product_id === productId);
    children.forEach((c) => getDescendants(c.component_product_id, visited));
    return visited;
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

  // 2E: Compute Units / Final Assembly for each component
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

  if (!model) return null;

  const prodName = (id: string) => model.products.find((p) => p.id === id)?.name || '???';

  const toggleExpand = (key: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
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

  const handleRemoveOne = () => {
    if (!selectedComponent) return;
    const entry = currentComponents.find((c) => c.component_product_id === selectedComponent);
    if (entry) {
      deleteIBOM(model.id, entry.id);
      setSelectedComponent('');
      toast.success('Component removed');
    }
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
    setSelectedComponent('');
    toast.success('All components removed');
  };

  const renderTreeNode = (node: TreeNode, parentKey: string, index: number) => {
    const key = `${parentKey}-${node.productId}-${index}`;
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(key);
    const ufa = unitsPerFinalAssy.get(node.productId);

    return (
      <div key={key}>
        <div
          className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded cursor-pointer text-sm"
          style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
          onClick={() => hasChildren && toggleExpand(key)}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className="font-mono font-medium">{node.productName}</span>
          <Badge variant="secondary" className="text-xs font-mono h-5 px-1.5">
            ×{node.unitsPerAssy}
          </Badge>
          {ufa !== undefined && (
            <span className="text-[10px] text-muted-foreground italic ml-auto font-mono" title="Units / Final Assembly">
              {ufa} / final
            </span>
          )}
        </div>
        {hasChildren && isExpanded && node.children.map((child, i) => renderTreeNode(child, key, i))}
      </div>
    );
  };

  const allProducts = model.products;

  return (
    <div className="p-6 animate-fade-in">
      {activeScenarioId && activeScenario && (
        <div className="mb-4 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md">
          <FlaskConical className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-700 font-medium">
            Changes are being recorded to <span className="font-semibold">{activeScenario.name}</span>
          </span>
        </div>
      )}
      <h1 className="text-xl font-bold mb-1">Indented Bill of Materials</h1>
      <p className="text-sm text-muted-foreground mb-6">Define parent-child relationships between products and their component parts.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: View IBOM Structure */}
        <Card className={`h-fit ${activeScenarioId ? 'border-l-[3px] border-l-amber-400' : ''}`}>
          <CardHeader>
            <CardTitle className="text-base">View Assembly Structure</CardTitle>
            <CardDescription>Select an assembly to view its component hierarchy.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label className="text-xs">Choose Assembly</Label>
              <Select value={viewAssemblyId} onValueChange={(v) => { setViewAssemblyId(v); setExpandedNodes(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="Select an assembly..." /></SelectTrigger>
                <SelectContent>
                  {allProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {model.ibom.some((e) => e.parent_product_id === p.id) && (
                        <span className="text-muted-foreground ml-1">
                          ({model.ibom.filter((e) => e.parent_product_id === p.id).length} components)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {viewAssemblyId && (
              <div className="border rounded-md p-2 min-h-[200px] bg-muted/20">
                <div className="flex items-center gap-2 py-1.5 px-2 font-medium text-sm">
                  <Network className="h-4 w-4 text-primary" />
                  <span className="font-mono">{prodName(viewAssemblyId)}</span>
                  <Badge className="text-xs h-5">Assembly</Badge>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground ml-auto cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs text-xs">
                        <p>"Units / Final Assy" shows total units of each component needed per 1 good final assembly across all IBOM levels. Scrap is excluded.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {tree.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2 py-4">No components defined for this product.</p>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" className="text-xs mb-1" onClick={() => {
                      const allKeys = new Set<string>();
                      const collectKeys = (nodes: TreeNode[], parentKey: string) => {
                        nodes.forEach((n, i) => {
                          const key = `${parentKey}-${n.productId}-${i}`;
                          if (n.children.length > 0) { allKeys.add(key); collectKeys(n.children, key); }
                        });
                      };
                      collectKeys(tree, 'root');
                      setExpandedNodes(allKeys);
                    }}>Expand All</Button>
                    {tree.map((node, i) => renderTreeNode(node, 'root', i))}
                  </>
                )}
              </div>
            )}

            {/* Units / Final Assembly Table */}
            {viewAssemblyId && unitsPerFinalAssy.size > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  Units / Final Assembly
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Read-only. Units of this component needed per 1 good final assembly, accounting for all IBOM levels. Scrap is excluded.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-xs">Component</TableHead>
                      <TableHead className="font-mono text-xs text-right">Units/Assy</TableHead>
                      <TableHead className="font-mono text-xs text-right">
                        Units / Final Assy
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...unitsPerFinalAssy.entries()].map(([prodId, qty]) => {
                      const ibomEntry = model.ibom.find(e => e.component_product_id === prodId);
                      return (
                        <TableRow key={prodId}>
                          <TableCell className="font-mono text-xs">{prodName(prodId)}</TableCell>
                          <TableCell className="font-mono text-xs text-right">{ibomEntry?.units_per_assy ?? '—'}</TableCell>
                          <TableCell className="font-mono text-xs text-right italic text-muted-foreground bg-muted/30">{qty}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Panel: Build IBOM Structure */}
        <Card className={`h-fit ${activeScenarioId ? 'border-l-[3px] border-l-amber-400' : ''}`}>
          <CardHeader>
            <CardTitle className="text-base">Build IBOM Structure</CardTitle>
            <CardDescription>Select a parent product and manage its components.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Choose Parent Product</Label>
              <Select value={editParentId} onValueChange={(v) => { setEditParentId(v); setSelectedAllowable(''); setSelectedComponent(''); }}>
                <SelectTrigger><SelectValue placeholder="Select a parent product..." /></SelectTrigger>
                <SelectContent>
                  {allProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {editParentId && (
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                <div>
                  <Label className="text-xs mb-1.5 block">Current Components</Label>
                  <div className="border rounded-md min-h-[200px] max-h-[320px] overflow-y-auto">
                    {currentComponents.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3">No components</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs font-mono h-8">Component</TableHead>
                            <TableHead className="text-xs font-mono h-8 w-20">Units</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentComponents.map((c) => (
                            <TableRow
                              key={c.id}
                              className={`cursor-pointer ${selectedComponent === c.component_product_id ? 'bg-primary/10' : ''}`}
                              onClick={() => setSelectedComponent(c.component_product_id)}
                            >
                              <TableCell className="font-mono text-xs py-1.5">{prodName(c.component_product_id)}</TableCell>
                              <TableCell className="py-1.5">
                                <Input
                                  type="number"
                                  className="h-7 w-16 font-mono text-xs"
                                  value={c.units_per_assy}
                                  min={1}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => updateIBOM(model.id, c.id, { units_per_assy: Math.max(1, +e.target.value) })}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 pt-8">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleAddOne} disabled={!selectedAllowable} title="Add one">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRemoveOne} disabled={!selectedComponent} title="Remove one">
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleAddAll} disabled={allowableProducts.length === 0} title="Add all">
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRemoveAll} disabled={currentComponents.length === 0} title="Remove all">
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>

                <div>
                  <Label className="text-xs mb-1.5 block">Allowable Components</Label>
                  <div className="border rounded-md min-h-[200px] max-h-[320px] overflow-y-auto">
                    {allowableProducts.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3">No available components</p>
                    ) : (
                      <div className="p-1">
                        {allowableProducts.map((p) => (
                          <div
                            key={p.id}
                            className={`px-2.5 py-1.5 rounded cursor-pointer text-xs font-mono ${selectedAllowable === p.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
                            onClick={() => setSelectedAllowable(p.id)}
                          >
                            {p.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
