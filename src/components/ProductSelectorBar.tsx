import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import type { Product, Operation } from '@/stores/modelStore';

interface ProductSelectorBarProps {
  products: Product[];
  operations: Operation[];
  selectedProductId: string;
  onSelect: (id: string) => void;
  statusPill?: React.ReactNode;
}

export function ProductSelectorBar({ products, operations, selectedProductId, onSelect, statusPill }: ProductSelectorBarProps) {
  const [open, setOpen] = useState(false);
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedIdx = products.findIndex(p => p.id === selectedProductId);

  const opCount = (pid: string) => operations.filter(o => o.product_id === pid && o.op_name !== 'DOCK' && o.op_name !== 'STOCK' && o.op_name !== 'SCRAP').length;

  const goPrev = () => {
    if (products.length === 0) return;
    const idx = selectedIdx <= 0 ? products.length - 1 : selectedIdx - 1;
    onSelect(products[idx].id);
  };

  const goNext = () => {
    if (products.length === 0) return;
    const idx = selectedIdx >= products.length - 1 ? 0 : selectedIdx + 1;
    onSelect(products[idx].id);
  };

  return (
    <div className="flex items-center gap-3 h-12 px-4 border-b border-border bg-card/50">
      <span className="text-[13px] text-muted-foreground shrink-0">Product:</span>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-60 justify-between h-8 font-mono text-xs"
          >
            {selectedProduct ? (
              <span className="flex items-center gap-2 truncate">
                {selectedProduct.name}
                <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
                  {opCount(selectedProduct.id)} ops
                </Badge>
              </span>
            ) : (
              'Select product…'
            )}
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search products…" className="h-9" />
            <CommandList>
              <CommandEmpty>No products found.</CommandEmpty>
              {products.map(p => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => { onSelect(p.id); setOpen(false); }}
                  className="font-mono text-xs flex items-center justify-between"
                >
                  <span>{p.name}</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-2">
                    {opCount(p.id)} ops
                  </Badge>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={goPrev} disabled={products.length <= 1}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={goNext} disabled={products.length <= 1}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {statusPill && <div className="ml-auto">{statusPill}</div>}
    </div>
  );
}
