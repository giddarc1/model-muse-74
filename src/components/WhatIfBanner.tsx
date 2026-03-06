import { useScenarioStore } from '@/stores/scenarioStore';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye } from 'lucide-react';

export function WhatIfBanner() {
  const activeScenario = useScenarioStore((s) => s.getActiveScenario());
  const setActiveScenario = useScenarioStore((s) => s.setActiveScenario);
  const navigate = useNavigate();
  const location = useLocation();
  const { modelId } = useParams<{ modelId: string }>();

  if (!activeScenario) return null;

  const handleViewChanges = () => {
    if (modelId && !location.pathname.endsWith('/whatif')) {
      navigate(`/models/${modelId}/whatif`);
    }
  };

  const handleReturnToBasecase = () => {
    setActiveScenario(null);
  };

  return (
    <div
      className="w-full shrink-0 flex items-center justify-between px-4"
      style={{
        height: 36,
        fontSize: 13,
        backgroundColor: '#F59E0B',
        color: '#000',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-black/70" />
        <span>
          Editing What-if: <strong>{activeScenario.name}</strong>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-black/80 hover:text-black hover:bg-black/10"
          onClick={handleViewChanges}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          View Changes
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs border-black/30 text-black hover:bg-black/10 bg-transparent"
          onClick={handleReturnToBasecase}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Return to Basecase
        </Button>
      </div>
    </div>
  );
}
