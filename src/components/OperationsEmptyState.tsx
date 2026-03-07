import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitMerge, ArrowRight, ArrowDown, Plus, MoveRight } from 'lucide-react';

interface OperationsEmptyStateProps {
  productName: string;
  onAddOperations: () => void;
  onDirectToStock: () => void;
}

export function OperationsEmptyState({ productName, onAddOperations, onDirectToStock }: OperationsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <GitMerge className="h-8 w-8 text-muted-foreground" />
      </div>

      <h2 className="text-lg font-semibold mb-2">
        No operations defined for <span className="font-mono text-primary">{productName}</span>
      </h2>

      <p className="text-sm text-muted-foreground max-w-md mb-1">
        Define the sequence of manufacturing operations this product goes through.
      </p>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Every routing must start at DOCK (entry point) and all paths must end at STOCK (completed) or SCRAP (defective losses).
      </p>

      {/* Visual flow hint */}
      <div className="flex items-center gap-1.5 mb-6 flex-wrap justify-center">
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 font-mono text-xs">DOCK</Badge>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <Badge variant="secondary" className="font-mono text-xs">+ operations</Badge>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="flex flex-col items-center gap-1">
          <Badge className="bg-blue-500/15 text-blue-700 border-blue-300 font-mono text-xs">STOCK</Badge>
          <div className="flex items-center gap-1">
            <ArrowDown className="h-3 w-3 text-muted-foreground" />
            <Badge className="bg-destructive/15 text-destructive border-destructive/30 font-mono text-xs">SCRAP</Badge>
          </div>
        </div>
      </div>

      {/* Two side-by-side options */}
      <div className="flex items-start gap-3">
        <Button className="gap-1.5" onClick={onAddOperations}>
          <Plus className="h-4 w-4" /> Add Operations
        </Button>
        <div className="flex flex-col items-center">
          <Button variant="outline" className="gap-1.5" onClick={onDirectToStock}>
            <MoveRight className="h-4 w-4" /> Direct to Stock
          </Button>
          <span className="text-xs text-muted-foreground mt-1.5">For products with no manufacturing steps</span>
        </div>
      </div>
    </div>
  );
}
