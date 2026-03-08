import { create } from 'zustand';
import { useModelStore } from './modelStore';
import { scenarioDb } from '@/lib/scenarioDb';

export interface ScenarioChange {
  id: string;
  // Extended data types for routing and product inclusion
  dataType: 'Labor' | 'Equipment' | 'Product' | 'General' | 'Routing' | 'Product Inclusion';
  entityId: string;
  entityName: string;
  field: string;
  fieldLabel: string;
  basecaseValue: string | number;
  whatIfValue: string | number;
}

export interface Scenario {
  id: string;
  modelId: string;
  name: string;
  description: string;
  familyId: string | null;
  status: 'calculated' | 'needs_recalc';
  changes: ScenarioChange[];
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioFamily {
  id: string;
  modelId: string;
  name: string;
}

interface ScenarioStore {
  scenarios: Scenario[];
  families: ScenarioFamily[];
  activeScenarioId: string | null;
  displayScenarioIds: string[];
  loadedModelId: string | null;

  setActiveScenario: (id: string | null) => void;
  getActiveScenario: () => Scenario | undefined;
  getScenariosForModel: (modelId: string) => Scenario[];
  loadScenariosFromDb: (modelId: string) => Promise<void>;
  setScenarios: (scenarios: Scenario[]) => void;

  createScenario: (modelId: string, name: string, description?: string) => Promise<string>;
  duplicateScenario: (id: string) => Promise<string>;
  renameScenario: (id: string, name: string) => void;
  updateScenarioDescription: (id: string, description: string) => void;
  deleteScenario: (id: string) => void;

  addChange: (scenarioId: string, change: Omit<ScenarioChange, 'id'>) => void;
  updateChange: (scenarioId: string, changeId: string, whatIfValue: string | number) => void;
  removeChange: (scenarioId: string, changeId: string) => void;

  applyScenarioChange: (scenarioId: string, dataType: ScenarioChange['dataType'], entityId: string, entityName: string, field: string, fieldLabel: string, whatIfValue: string | number) => void;

  toggleDisplayScenario: (id: string) => void;
  markNeedsRecalc: (scenarioId: string) => void;
  markCalculated: (scenarioId: string) => void;

  promoteToBasecase: (scenarioId: string) => void;

  // Family management
  createFamily: (modelId: string, name: string) => string;
  deleteFamily: (familyId: string) => void;
  addToFamily: (scenarioId: string, familyId: string) => void;
  removeFromFamily: (scenarioId: string) => void;
  renameFamily: (familyId: string, name: string) => void;
}

const uid = () => crypto.randomUUID();

export const useScenarioStore = create<ScenarioStore>((set, get) => ({
  scenarios: [],
  families: [],
  activeScenarioId: null,
  displayScenarioIds: [],
  loadedModelId: null,

  setActiveScenario: (id) => set({ activeScenarioId: id }),

  getActiveScenario: () => {
    const { scenarios, activeScenarioId } = get();
    return scenarios.find(s => s.id === activeScenarioId);
  },

  getScenariosForModel: (modelId) => {
    return get().scenarios.filter(s => s.modelId === modelId);
  },

  loadScenariosFromDb: async (modelId) => {
    if (get().loadedModelId === modelId) return;
    const { loadScenariosForModel } = await import('@/lib/scenarioDb');
    const { scenarios, results } = await loadScenariosForModel(modelId);
    set({ scenarios, loadedModelId: modelId, activeScenarioId: null, displayScenarioIds: [] });

    // Populate resultsStore with loaded results
    const { useResultsStore } = await import('./resultsStore');
    Object.entries(results).forEach(([scenarioId, calcResults]) => {
      useResultsStore.getState().setResults(scenarioId, calcResults);
    });

    // Load basecase results
    const { loadBasecaseResults } = await import('@/lib/scenarioDb');
    const bcResults = await loadBasecaseResults(modelId);
    if (bcResults) {
      useResultsStore.getState().setResults('basecase', bcResults);
    }
  },

  setScenarios: (scenarios) => set({ scenarios }),

  createScenario: async (modelId, name, description = '') => {
    const dbId = await scenarioDb.create(modelId, name, description);
    const id = dbId || uid();
    const scenario: Scenario = {
      id, modelId, name, description,
      familyId: null,
      status: 'needs_recalc',
      changes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set(s => ({ scenarios: [...s.scenarios, scenario] }));
    return id;
  },

  duplicateScenario: async (id) => {
    const source = get().scenarios.find(s => s.id === id);
    if (!source) return '';
    const newName = `${source.name} (Copy)`;
    const dbId = await scenarioDb.create(source.modelId, newName, source.description);
    const newId = dbId || uid();
    const dup: Scenario = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      name: newName,
      status: 'needs_recalc',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Re-id changes and save to DB
    dup.changes = dup.changes.map((c: ScenarioChange) => {
      const newChange = { ...c, id: uid() };
      scenarioDb.upsertChange(newId, newChange);
      return newChange;
    });
    set(s => ({ scenarios: [...s.scenarios, dup] }));
    return newId;
  },

  renameScenario: (id, name) => {
    set(s => ({
      scenarios: s.scenarios.map(sc => sc.id === id ? { ...sc, name, updatedAt: new Date().toISOString() } : sc),
    }));
    scenarioDb.update(id, { name });
  },

  updateScenarioDescription: (id, description) => {
    set(s => ({
      scenarios: s.scenarios.map(sc => sc.id === id ? { ...sc, description, updatedAt: new Date().toISOString() } : sc),
    }));
    scenarioDb.update(id, { description });
  },

  deleteScenario: (id) => {
    set(s => ({
      scenarios: s.scenarios.filter(sc => sc.id !== id),
      activeScenarioId: s.activeScenarioId === id ? null : s.activeScenarioId,
      displayScenarioIds: s.displayScenarioIds.filter(sid => sid !== id),
    }));
    scenarioDb.delete(id);
  },

  addChange: (scenarioId, change) => {
    const newChange: ScenarioChange = { ...change, id: uid() };
    set(s => ({
      scenarios: s.scenarios.map(sc => sc.id === scenarioId ? {
        ...sc,
        changes: [...sc.changes, newChange],
        status: 'needs_recalc' as const,
        updatedAt: new Date().toISOString(),
      } : sc),
    }));
    scenarioDb.upsertChange(scenarioId, newChange);
    scenarioDb.update(scenarioId, { status: 'needs_recalc' });
  },

  updateChange: (scenarioId, changeId, whatIfValue) => {
    let updatedChange: ScenarioChange | null = null;
    set(s => ({
      scenarios: s.scenarios.map(sc => {
        if (sc.id !== scenarioId) return sc;
        return {
          ...sc,
          changes: sc.changes.map(c => {
            if (c.id !== changeId) return c;
            updatedChange = { ...c, whatIfValue };
            return updatedChange;
          }),
          status: 'needs_recalc' as const,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
    if (updatedChange) {
      scenarioDb.upsertChange(scenarioId, updatedChange);
      scenarioDb.update(scenarioId, { status: 'needs_recalc' });
    }
  },

  removeChange: (scenarioId, changeId) => {
    set(s => ({
      scenarios: s.scenarios.map(sc => sc.id === scenarioId ? {
        ...sc,
        changes: sc.changes.filter(c => c.id !== changeId),
        updatedAt: new Date().toISOString(),
      } : sc),
    }));
    scenarioDb.removeChange(changeId);
  },

  applyScenarioChange: (scenarioId, dataType, entityId, entityName, field, fieldLabel, whatIfValue) => {
    const scenario = get().scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;

    const existing = scenario.changes.find(c => c.entityId === entityId && c.field === field && c.dataType === dataType);
    if (existing) {
      if (String(existing.basecaseValue) === String(whatIfValue)) {
        get().removeChange(scenarioId, existing.id);
      } else {
        get().updateChange(scenarioId, existing.id, whatIfValue);
      }
    } else {
      const model = useModelStore.getState().getActiveModel();
      if (!model) return;
      let basecaseValue: string | number = '';
      if (dataType === 'Labor') {
        const entity = model.labor.find(l => l.id === entityId);
        if (entity) basecaseValue = (entity as any)[field];
      } else if (dataType === 'Equipment') {
        const entity = model.equipment.find(e => e.id === entityId);
        if (entity) basecaseValue = (entity as any)[field];
      } else if (dataType === 'Product') {
        const entity = model.products.find(p => p.id === entityId);
        if (field === 'included') {
          basecaseValue = 'true'; // all products included by default
        } else if (entity) {
          basecaseValue = (entity as any)[field];
        }
      } else if (dataType === 'General') {
        basecaseValue = (model.general as any)[field];
      } else if (dataType === 'Routing') {
        const entry = model.routing.find(r => r.id === entityId);
        if (entry) basecaseValue = (entry as any)[field];
      } else if (dataType === 'Product Inclusion') {
        basecaseValue = 'Yes'; // default: all products included
      }
      if (String(basecaseValue) === String(whatIfValue)) return;
      get().addChange(scenarioId, { dataType, entityId, entityName, field, fieldLabel, basecaseValue, whatIfValue });
    }
  },

  toggleDisplayScenario: (id) => set(s => ({
    displayScenarioIds: s.displayScenarioIds.includes(id)
      ? s.displayScenarioIds.filter(sid => sid !== id)
      : [...s.displayScenarioIds, id],
  })),

  markNeedsRecalc: (scenarioId) => {
    set(s => ({
      scenarios: s.scenarios.map(sc => sc.id === scenarioId ? { ...sc, status: 'needs_recalc' as const } : sc),
    }));
    scenarioDb.update(scenarioId, { status: 'needs_recalc' });
  },

  markCalculated: (scenarioId) => {
    set(s => ({
      scenarios: s.scenarios.map(sc => sc.id === scenarioId ? { ...sc, status: 'calculated' as const } : sc),
    }));
    scenarioDb.update(scenarioId, { status: 'calculated' });
  },

  promoteToBasecase: (scenarioId) => {
    const scenario = get().scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;
    const modelStore = useModelStore.getState();
    const model = modelStore.models.find(m => m.id === scenario.modelId);
    if (!model) return;

    scenario.changes.forEach(change => {
      if (change.dataType === 'Labor') {
        modelStore.updateLabor(scenario.modelId, change.entityId, { [change.field]: change.whatIfValue });
      } else if (change.dataType === 'Equipment') {
        modelStore.updateEquipment(scenario.modelId, change.entityId, { [change.field]: change.whatIfValue });
      } else if (change.dataType === 'Product') {
        modelStore.updateProduct(scenario.modelId, change.entityId, { [change.field]: change.whatIfValue });
      } else if (change.dataType === 'Routing') {
        modelStore.updateRouting(scenario.modelId, change.entityId, { [change.field]: change.whatIfValue });
      }
    });

    set(s => ({
      scenarios: s.scenarios
        .filter(sc => sc.id !== scenarioId)
        .map(sc => sc.modelId === scenario.modelId ? { ...sc, status: 'needs_recalc' as const } : sc),
      activeScenarioId: null,
      displayScenarioIds: s.displayScenarioIds.filter(id => id !== scenarioId),
    }));
    scenarioDb.delete(scenarioId);
  },

  // ── Family management ──
  createFamily: (modelId, name) => {
    const id = uid();
    const family: ScenarioFamily = { id, modelId, name };
    set(s => ({ families: [...s.families, family] }));
    return id;
  },

  deleteFamily: (familyId) => {
    set(s => ({
      families: s.families.filter(f => f.id !== familyId),
      scenarios: s.scenarios.map(sc => sc.familyId === familyId ? { ...sc, familyId: null } : sc),
    }));
  },

  addToFamily: (scenarioId, familyId) => {
    set(s => ({
      scenarios: s.scenarios.map(sc => sc.id === scenarioId ? { ...sc, familyId } : sc),
    }));
  },

  removeFromFamily: (scenarioId) => {
    set(s => ({
      scenarios: s.scenarios.map(sc => sc.id === scenarioId ? { ...sc, familyId: null } : sc),
    }));
  },

  renameFamily: (familyId, name) => {
    set(s => ({
      families: s.families.map(f => f.id === familyId ? { ...f, name } : f),
    }));
  },
}));
