import { useState, useCallback, useSyncExternalStore } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useResultsStore } from '@/stores/resultsStore';
import { calculate, verifyData, type CalcResults } from '@/lib/calculationEngine';
import { toast } from 'sonner';

export type RunMode = 'full' | 'verify' | 'util_only';

export interface RunLogEntry {
  id: string;
  timestamp: string;
  mode: RunMode;
  scenarioName: string;
  durationMs: number;
  status: 'success' | 'warning' | 'error';
}

interface UseRunCalculationReturn {
  isRunning: boolean;
  runLog: RunLogEntry[];
  verifyMessages: { errors: string[]; warnings: string[] } | null;
  handleRun: (mode: RunMode) => Promise<void>;
  clearVerifyMessages: () => void;
}

// Module-level run log so it persists across hook instances
let _runLog: RunLogEntry[] = [];
let _runLogListeners: Set<() => void> = new Set();
function notifyRunLog() { _runLogListeners.forEach(fn => fn()); }
function subscribeRunLog(cb: () => void) { _runLogListeners.add(cb); return () => { _runLogListeners.delete(cb); }; }
function getRunLogSnapshot() { return _runLog; }

// Module-level isRunning so it's shared across hook instances
let _isRunning = false;
let _isRunningListeners: Set<() => void> = new Set();
function notifyIsRunning() { _isRunningListeners.forEach(fn => fn()); }
function subscribeIsRunning(cb: () => void) { _isRunningListeners.add(cb); return () => { _isRunningListeners.delete(cb); }; }
function getIsRunningSnapshot() { return _isRunning; }
function setGlobalIsRunning(v: boolean) { _isRunning = v; notifyIsRunning(); }

export function useRunCalculation(): UseRunCalculationReturn {
  const model = useModelStore(s => s.getActiveModel());
  const setRunStatus = useModelStore(s => s.setRunStatus);
  const activeScenario = useScenarioStore(s => s.getActiveScenario());
  const markCalculated = useScenarioStore(s => s.markCalculated);
  const { setResults } = useResultsStore();

  const [verifyMessages, setVerifyMessages] = useState<{ errors: string[]; warnings: string[] } | null>(null);

  // Subscribe to shared state
  const runLog = useSyncExternalStore(subscribeRunLog, getRunLogSnapshot);
  const isRunning = useSyncExternalStore(subscribeIsRunning, getIsRunningSnapshot);

  const handleRun = useCallback(async (mode: RunMode) => {
    if (!model) return;

    // Verify-only mode
    if (mode === 'verify') {
      const startTime = Date.now();
      const msgs = verifyData(model);
      setVerifyMessages(msgs);
      const entry: RunLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        mode: 'verify',
        scenarioName: activeScenario?.name || 'Basecase',
        durationMs: Date.now() - startTime,
        status: msgs.errors.length > 0 ? 'error' : msgs.warnings.length > 0 ? 'warning' : 'success',
      };
      _runLog = [entry, ..._runLog].slice(0, 5);
      notifyRunLog();
      if (msgs.errors.length === 0 && msgs.warnings.length === 0) {
        toast.success('Data verification complete — no issues found');
      } else {
        toast.warning(`Found ${msgs.errors.length} error(s) and ${msgs.warnings.length} warning(s)`);
      }
      return;
    }

    // Validation
    const validationErrors: string[] = [];
    if (model.general.conv1 <= 0) validationErrors.push('Time Conversion 1 must be greater than 0');
    if (model.general.conv2 <= 0) validationErrors.push('Time Conversion 2 must be greater than 0');
    model.products.forEach(p => {
      if (p.lot_size < 1) validationErrors.push(`Product "${p.name}": Lot Size must be ≥ 1`);
      if (p.demand < 0) validationErrors.push(`Product "${p.name}": Demand cannot be negative`);
    });
    model.equipment.forEach(e => {
      if (e.equip_type === 'standard' && e.count < 1) validationErrors.push(`Equipment "${e.name}": Count must be ≥ 1`);
    });
    model.labor.forEach(l => {
      if (l.count < 1) validationErrors.push(`Labor "${l.name}": Count must be ≥ 1`);
    });
    if (validationErrors.length > 0) {
      setVerifyMessages({ errors: validationErrors, warnings: [] });
      toast.error(`${validationErrors.length} validation error(s) — fix before calculating`, {
        description: validationErrors.slice(0, 3).join('; ') + (validationErrors.length > 3 ? '…' : ''),
      });
      return;
    }

    setIsRunning(true);
    const startTime = Date.now();
    const resultKey = activeScenario ? activeScenario.id : 'basecase';

    return new Promise<void>(resolve => {
      setTimeout(async () => {
        const calcResults = calculate(model, activeScenario || undefined);
        setResults(resultKey, calcResults);
        setRunStatus(model.id, 'current');
        if (activeScenario) markCalculated(activeScenario.id);
        setIsRunning(false);
        setVerifyMessages(null);

        const durationMs = Date.now() - startTime;
        const hasErrors = calcResults.errors.length > 0;
        const hasWarnings = calcResults.overLimitResources.length > 0;

        const entry: RunLogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          mode,
          scenarioName: activeScenario?.name || 'Basecase',
          durationMs,
          status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'success',
        };
        _runLog = [entry, ..._runLog].slice(0, 5);
        notifyRunLog();

        // Persist to Supabase
        const { scenarioDb } = await import('@/lib/scenarioDb');
        if (activeScenario) {
          scenarioDb.saveResults(activeScenario.id, calcResults);
        } else {
          scenarioDb.saveBasecaseResults(model.id, calcResults);
        }
        const { db } = await import('@/lib/supabaseData');
        db.updateModel(model.id, { run_status: 'current', last_run_at: new Date().toISOString() });

        if (hasErrors) {
          toast.error(calcResults.errors[0]);
        } else if (hasWarnings) {
          toast.warning(`${calcResults.overLimitResources.length} resource(s) exceed utilization limit`);
        } else {
          toast.success(mode === 'full' ? 'Full calculation complete — all production targets achievable' : 'Utilization calculation complete');
        }
        resolve();
      }, 100);
    });
  }, [model, activeScenario, setResults, setRunStatus, markCalculated]);

  return {
    isRunning,
    runLog,
    verifyMessages,
    handleRun,
    clearVerifyMessages: () => setVerifyMessages(null),
  };
}

export function getRunLog(): RunLogEntry[] {
  return _runLog;
}
