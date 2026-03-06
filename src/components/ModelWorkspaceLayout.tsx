import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUserLevelStore, isVisible, type FeatureKey } from '@/hooks/useUserLevel';
import { ModelContextBar } from './ModelContextBar';
import { ModelSidebar } from './ModelSidebar';
import { toast } from 'sonner';

const SCREEN_NAMES: Record<string, string> = {
  overview: 'Overview', general: 'General Data', labor: 'Labor', equipment: 'Equipment',
  products: 'Products', operations: 'Operations', 'all-operations': 'All Operations',
  ibom: 'IBOM', run: 'Run & Results', whatif: 'What-If Studio', reports: 'Reports', settings: 'Model Settings',
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

  if (!modelsLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
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
