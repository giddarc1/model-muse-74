import { useModelStore } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Cpu, Users, Play, Settings2, FlaskConical, ArrowRight } from 'lucide-react';

export default function ModelOverview() {
  const model = useModelStore((s) => s.getActiveModel());
  const scenarios = useScenarioStore((s) => s.scenarios);
  const navigate = useNavigate();

  if (!model) return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-64 bg-muted animate-pulse rounded" />
      <div className="h-4 w-48 bg-muted animate-pulse rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
      </div>
    </div>
  );

  const modelScenarios = scenarios.filter(s => s.modelId === model.id);

  const stats = [
    { label: 'Products', value: model.products.length, icon: Package, color: 'text-primary' },
    { label: 'Equipment Groups', value: model.equipment.length, icon: Cpu, color: 'text-info' },
    { label: 'Labor Groups', value: model.labor.length, icon: Users, color: 'text-warning' },
    { label: 'What-If Scenarios', value: modelScenarios.length, icon: FlaskConical, color: 'text-destructive' },
  ];

  const quickLinks = [
    { label: 'General Data', path: 'general', icon: Settings2 },
    { label: 'Labor', path: 'labor', icon: Users },
    { label: 'Equipment', path: 'equipment', icon: Cpu },
    { label: 'Products', path: 'products', icon: Package },
    { label: 'Run Model', path: 'run', icon: Play },
    { label: 'What-If Studio', path: 'whatif', icon: FlaskConical },
  ];

  return (
    <div className="p-6 max-w-5xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{model.general.model_title || model.name}</h1>
        <p className="text-muted-foreground mt-1">{model.description || 'No description'}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold font-mono">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Quick Access</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {quickLinks.map((l) => (
              <Button
                key={l.path}
                variant="ghost"
                className="w-full justify-between h-10"
                onClick={() => navigate(`/models/${model.id}/${l.path}`)}
              >
                <span className="flex items-center gap-2 text-sm">
                  <l.icon className="h-4 w-4 text-muted-foreground" /> {l.label}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Model Info</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time Units</span>
              <span className="font-mono">{model.general.ops_time_unit} → {model.general.mct_time_unit} → {model.general.prod_period_unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Utilization Limit</span>
              <span className="font-mono">{model.general.util_limit}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conv 1</span>
              <span className="font-mono">{model.general.conv1} {model.general.ops_time_unit}/{model.general.mct_time_unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conv 2</span>
              <span className="font-mono">{model.general.conv2} {model.general.mct_time_unit}/{model.general.prod_period_unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Author</span>
              <span>{model.general.author || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Tags</span>
              <div className="flex gap-1">{model.tags.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}