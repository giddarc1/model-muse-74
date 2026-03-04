import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { ModelContextBar } from './ModelContextBar';
import { ModelSidebar } from './ModelSidebar';
import { toast } from 'sonner';

export function ModelWorkspaceLayout() {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const setActiveModel = useModelStore((s) => s.setActiveModel);
  const models = useModelStore((s) => s.models);
  const modelsLoaded = useModelStore((s) => s.modelsLoaded);
  const loadModels = useModelStore((s) => s.loadModels);

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
    return () => setActiveModel(null);
  }, [modelId, models, modelsLoaded, navigate, setActiveModel, loadModels]);

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
