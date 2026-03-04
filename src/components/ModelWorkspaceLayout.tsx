import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { ModelContextBar } from './ModelContextBar';
import { ModelSidebar } from './ModelSidebar';

export function ModelWorkspaceLayout() {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const setActiveModel = useModelStore((s) => s.setActiveModel);
  const models = useModelStore((s) => s.models);

  useEffect(() => {
    const exists = models.some((m) => m.id === modelId);
    if (!exists) {
      navigate('/library', { replace: true });
      return;
    }
    setActiveModel(modelId!);
    return () => setActiveModel(null);
  }, [modelId, models, navigate, setActiveModel]);

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
