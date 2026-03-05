import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';

interface DataPoint {
  x: number;
  y: number;
}

interface InterpolateCalculatorProps {
  open: boolean;
  onClose: () => void;
  onApply?: (value: number) => void;
}

function linearInterpolate(points: DataPoint[], targetX: number): { value: number; method: string } {
  if (points.length === 0) return { value: 0, method: 'No data' };
  if (points.length === 1) return { value: points[0].y, method: 'Single point' };

  const sorted = [...points].sort((a, b) => a.x - b.x);

  // Exact match
  const exact = sorted.find(p => p.x === targetX);
  if (exact) return { value: exact.y, method: 'Exact match' };

  // Find surrounding points
  let lower: DataPoint | null = null;
  let upper: DataPoint | null = null;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].x <= targetX && sorted[i + 1].x >= targetX) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }

  if (lower && upper) {
    // Interpolation
    const t = (targetX - lower.x) / (upper.x - lower.x);
    const value = lower.y + t * (upper.y - lower.y);
    return { value: Math.round(value * 10000) / 10000, method: 'Linear interpolation' };
  }

  // Extrapolation
  if (targetX < sorted[0].x) {
    const p1 = sorted[0], p2 = sorted[1];
    const slope = (p2.y - p1.y) / (p2.x - p1.x);
    const value = p1.y + slope * (targetX - p1.x);
    return { value: Math.round(value * 10000) / 10000, method: 'Linear extrapolation (below range)' };
  }

  const p1 = sorted[sorted.length - 2], p2 = sorted[sorted.length - 1];
  const slope = (p2.y - p1.y) / (p2.x - p1.x);
  const value = p2.y + slope * (targetX - p2.x);
  return { value: Math.round(value * 10000) / 10000, method: 'Linear extrapolation (above range)' };
}

export function InterpolateCalculator({ open, onClose, onApply }: InterpolateCalculatorProps) {
  const [points, setPoints] = useState<DataPoint[]>([
    { x: 0, y: 0 },
    { x: 10, y: 5 },
  ]);
  const [targetX, setTargetX] = useState(5);

  const addPoint = () => setPoints(p => [...p, { x: 0, y: 0 }]);
  const removePoint = (i: number) => setPoints(p => p.filter((_, idx) => idx !== i));
  const updatePoint = (i: number, field: 'x' | 'y', value: number) => {
    setPoints(p => p.map((pt, idx) => idx === i ? { ...pt, [field]: value } : pt));
  };

  const result = useMemo(
    () => linearInterpolate(points.filter(p => !isNaN(p.x) && !isNaN(p.y)), targetX),
    [points, targetX],
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Interpolate / Extrapolate</DialogTitle>
          <DialogDescription>
            Enter known data points and a target X value. The calculator will linearly interpolate or extrapolate the Y value.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Data Points */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Data Points</Label>
              <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={addPoint}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {points.map((pt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input type="number" value={pt.x} onChange={e => updatePoint(i, 'x', +e.target.value)}
                      className="h-7 font-mono text-xs" placeholder="X" />
                  </div>
                  <span className="text-xs text-muted-foreground">→</span>
                  <div className="flex-1">
                    <Input type="number" value={pt.y} onChange={e => updatePoint(i, 'y', +e.target.value)}
                      className="h-7 font-mono text-xs" placeholder="Y" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removePoint(i)} disabled={points.length <= 2}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Target */}
          <div>
            <Label className="text-xs">Target X Value</Label>
            <Input type="number" value={targetX} onChange={e => setTargetX(+e.target.value)}
              className="h-8 font-mono mt-1" />
          </div>

          {/* Result */}
          <div className="p-3 rounded-md border border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Result (Y)</Label>
              <Badge variant="outline" className="text-[10px]">{result.method}</Badge>
            </div>
            <p className="text-xl font-mono font-bold text-primary mt-1">{result.value}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {onApply && (
            <Button onClick={() => { onApply(result.value); onClose(); }}>
              Apply Value
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
