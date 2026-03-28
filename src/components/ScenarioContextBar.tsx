import { Lock, AlertTriangle } from 'lucide-react';
import { getScenarioColor } from '@/lib/scenarioColors';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useResultsStore } from '@/stores/resultsStore';
import { useModelStore } from '@/stores/modelStore';

export default function ScenarioContextBar() {
  const model = useModelStore(s => s.getActiveModel());
  const selectedRunScenarioId = useResultsStore(s => s.selectedRunScenarioId);
  const allScenarios = useScenarioStore(s => s.scenarios);
  const modelScenarios = model ? allScenarios.filter(s => s.modelId === model.id) : [];

  const isBasecase = !selectedRunScenarioId || selectedRunScenarioId === 'basecase';
  const scenario = !isBasecase ? modelScenarios.find(s => s.id === selectedRunScenarioId) : null;
  const scenarioIndex = scenario ? modelScenarios.indexOf(scenario) : -1;
  const dotColor = scenario ? getScenarioColor(scenarioIndex) : undefined;

  const isStale = scenario?.status === 'needs_recalc';
  const lastRunAt = model?.last_run_at;

  return (
    <div className="h-7 flex items-center justify-between px-6 bg-background border-b border-border-subtle text-[11px] shrink-0 -mx-6">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Showing results for:</span>
        {isBasecase ? (
          <span className="font-medium text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Basecase
          </span>
        ) : (
          <span className="font-medium text-warning flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
            {scenario?.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {isStale ? (
          <span className="text-warning flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Results may be outdated — data has changed since last run. Run Full Calculate to update.
          </span>
        ) : lastRunAt ? (
          <span className="text-muted-foreground">
            Last calculated: {new Date(lastRunAt).toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground italic">Not yet calculated</span>
        )}
      </div>
    </div>
  );
}
