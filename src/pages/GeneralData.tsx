import { useModelStore } from '@/stores/modelStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function GeneralData() {
  const model = useModelStore((s) => s.getActiveModel());
  const updateGeneral = useModelStore((s) => s.updateGeneral);

  if (!model) return null;

  const g = model.general;
  const update = (data: Partial<typeof g>) => updateGeneral(model.id, data);

  return (
    <div className="p-6 max-w-3xl animate-fade-in">
      <h1 className="text-xl font-bold mb-1">General Data</h1>
      <p className="text-sm text-muted-foreground mb-6">Configure time settings, variability parameters, and model metadata.</p>

      <Tabs defaultValue="time">
        <TabsList>
          <TabsTrigger value="time">Time Settings</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Parameters</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
        </TabsList>

        <TabsContent value="time" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Time Settings</CardTitle>
              <CardDescription>Define time units and conversion factors for this model.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Model Title</Label>
                <Input value={g.model_title} onChange={(e) => update({ model_title: e.target.value })} placeholder="Report display name" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Operations Time Unit</Label>
                  <Select value={g.ops_time_unit} onValueChange={(v) => update({ ops_time_unit: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEC">Seconds</SelectItem>
                      <SelectItem value="MIN">Minutes</SelectItem>
                      <SelectItem value="HR">Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>MCT Time Unit</Label>
                  <Select value={g.mct_time_unit} onValueChange={(v) => update({ mct_time_unit: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MIN">Minutes</SelectItem>
                      <SelectItem value="HR">Hours</SelectItem>
                      <SelectItem value="DAY">Days</SelectItem>
                      <SelectItem value="WEEK">Weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Production Period</Label>
                  <Select value={g.prod_period_unit} onValueChange={(v) => update({ prod_period_unit: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAY">Day</SelectItem>
                      <SelectItem value="WEEK">Week</SelectItem>
                      <SelectItem value="MONTH">Month</SelectItem>
                      <SelectItem value="YEAR">Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Conversion 1 ({g.ops_time_unit} per {g.mct_time_unit})</Label>
                  <Input type="number" value={g.conv1} onChange={(e) => update({ conv1: +e.target.value })} className={g.conv1 <= 0 ? 'border-destructive' : ''} />
                  {g.conv1 <= 0 && <p className="text-xs text-destructive mt-1">Must be greater than 0</p>}
                </div>
                <div>
                  <Label>Conversion 2 ({g.mct_time_unit} per {g.prod_period_unit})</Label>
                  <Input type="number" value={g.conv2} onChange={(e) => update({ conv2: +e.target.value })} className={g.conv2 <= 0 ? 'border-destructive' : ''} />
                  {g.conv2 <= 0 && <p className="text-xs text-destructive mt-1">Must be greater than 0</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Variability & Limits</CardTitle>
              <CardDescription>Default coefficients of variation for queuing calculations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Utilization Limit (%)</Label>
                  <Input type="number" value={g.util_limit} onChange={(e) => update({ util_limit: +e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Equipment Variability %</Label>
                  <Input type="number" value={g.var_equip} onChange={(e) => update({ var_equip: +e.target.value })} />
                </div>
                <div>
                  <Label>Labor Variability %</Label>
                  <Input type="number" value={g.var_labor} onChange={(e) => update({ var_labor: +e.target.value })} />
                </div>
                <div>
                  <Label>Product Variability %</Label>
                  <Input type="number" value={g.var_prod} onChange={(e) => update({ var_prod: +e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>Author</Label>
                <Input value={g.author} onChange={(e) => update({ author: e.target.value })} />
              </div>
              <div>
                <Label>Comments</Label>
                <Textarea rows={6} value={g.comments} onChange={(e) => update({ comments: e.target.value })} placeholder="Notes about this model..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
