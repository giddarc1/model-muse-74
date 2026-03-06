import { Lock } from 'lucide-react';
import { getScenarioColor } from '@/lib/scenarioColors';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useResultsStore } from '@/stores/resultsStore';
import { useModelStore } from '@/stores/modelStore';

/**
 * Small label placed in the top-left corner of every chart area
 * showing which scenario's results are being displayed.
 */
export default function ChartScenarioLabel() {
  const model = useModelStore(s => s.getActiveModel());
  const selectedRunScenarioId = useResultsStore(s => s.selectedRunScenarioId);
  const allScenarios = useScenarioStore(s => s.scenarios);
  const modelScenarios = model ? allScenarios.filter(s => s.modelId === model.id) : [];

  const isBasecase = !selectedRunScenarioId || selectedRunScenarioId === 'basecase';
  const scenario = !isBasecase ? modelScenarios.find(s => s.id === selectedRunScenarioId) : null;
  const scenarioIndex = scenario ? modelScenarios.indexOf(scenario) : -1;
  const dotColor = scenario ? getScenarioColor(scenarioIndex) : undefined;

  return (
    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded border border-border/50">
      {isBasecase ? (
        <>
          <Lock className="h-2.5 w-2.5" />
          <span>Basecase results</span>
        </>
      ) : (
        <>
          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
          <span>{scenario?.name} results</span>
        </>
      )}
    </div>
  );
}