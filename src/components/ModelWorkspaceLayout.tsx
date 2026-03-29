import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUserLevelStore, isVisible, type FeatureKey } from '@/hooks/useUserLevel';
import { ModelContextBar } from './ModelContextBar';
import { ModelSidebar } from './ModelSidebar';
import troobaMarkDark from '@/assets/trooba-mark-dark.svg';

import { toast } from 'sonner';

const SCREEN_NAMES: Record<string, string> = {
  overview: 'Overview', general: 'General Data', labor: 'Labor', equipment: 'Equipment',
  products: 'Products', operations: 'Operations', 'all-operations': 'All Operations',
  ibom: 'IBOM', run: 'Run & Results', whatif: 'What-If Studio', reports: 'Reports', settings: 'Model Settings',
};

// Map route segments to their gating feature (null = always visible)
const ROUTE_GATING: Record<string, FeatureKey | null> = {
  'all-operations': 'all_operations',
  'param-names': 'parameter_names',
};

export function ModelWorkspaceLayout() {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const setActiveModel = useModelStore((s) => s.setActiveModel);
  const models = useModelStore((s) => s.models);
  const modelsLoaded = useModelStore((s) => s.modelsLoaded);
  const loadModels = useModelStore((s) => s.loadModels);
  const loadScenariosFromDb = useScenarioStore((s) => s.loadScenariosFromDb);
  const userLevel = useUserLevelStore((s) => s.userLevel);

  const model = models.find(m => m.id === modelId);
  const screenSegment = location.pathname.split('/').pop() || 'overview';
  const screenName = SCREEN_NAMES[screenSegment] || screenSegment;
  usePageTitle(model ? `${model.name} — ${screenName}` : 'Loading...');

  useEffect(() => {
    if (!modelsLoaded) {
      loadModels();
      return;
    }
    const exists = models.some((m) => m.id === modelId);
    if (!exists) {
      toast.error('Model not found or does not belong to your organization');
      navigate('/library', { replace: true });
      return;
    }
    setActiveModel(modelId!);
    loadScenariosFromDb(modelId!);
    return () => setActiveModel(null);
  }, [modelId, models, modelsLoaded, navigate, setActiveModel, loadModels, loadScenariosFromDb]);

  // Redirect away from gated screens when user level changes
  useEffect(() => {
    const feature = ROUTE_GATING[screenSegment];
    if (feature && !isVisible(feature, userLevel)) {
      navigate(`/models/${modelId}/overview`, { replace: true });
    }
  }, [userLevel, screenSegment, modelId, navigate]);

  if (!modelsLoaded) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-sidebar">
        <img src={troobaMarkDark} alt="" className="h-12 w-12 mb-3 animate-pulse-brand" />
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-sidebar-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      
      <ModelContextBar />
      <div className="flex flex-1 overflow-hidden">
        <ModelSidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
