import { useState } from 'react';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useResultsStore } from '@/stores/resultsStore';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Eye } from 'lucide-react';
import { calculate } from '@/lib/calculationEngine';
import { useModelStore } from '@/stores/modelStore';

export function WhatIfBanner() {
  const activeScenario = useScenarioStore((s) => s.getActiveScenario());
  const setActiveScenario = useScenarioStore((s) => s.setActiveScenario);
  const markCalculated = useScenarioStore((s) => s.markCalculated);
  const navigate = useNavigate();
  const location = useLocation();
  const { modelId } = useParams<{ modelId: string }>();
  const [showReturnModal, setShowReturnModal] = useState(false);

  if (!activeScenario) return null;

  const handleViewChanges = () => {
    if (modelId) {
      navigate(`/models/${modelId}/whatif`);
    }
  };

  const handleReturnClick = () => {
    if (activeScenario.changes.length > 0) {
      setShowReturnModal(true);
    } else {
      setActiveScenario(null);
    }
  };

  const handleSaveAndReturn = () => {
    const model = useModelStore.getState().models.find(m => m.id === activeScenario.modelId);
    if (model) {
      const results = calculate(model, activeScenario);
      useResultsStore.getState().setResults(activeScenario.id, results);
      markCalculated(activeScenario.id);
    }
    setActiveScenario(null);
    setShowReturnModal(false);
  };

  return (
    <>
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
            onClick={handleReturnClick}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Return to Basecase
          </Button>
        </div>
      </div>

      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return to Basecase?</DialogTitle>
            <DialogDescription>
              You have unsaved changes in "{activeScenario.name}". What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setShowReturnModal(false)}>Stay in What-if</Button>
            <Button
              variant="secondary"
              className="border border-amber-400 text-amber-700"
              onClick={() => {
                setActiveScenario(null);
                setShowReturnModal(false);
              }}
            >
              Discard Changes and Return
            </Button>
            <Button onClick={handleSaveAndReturn}>Save and Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
