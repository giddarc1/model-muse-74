import { create } from 'zustand';
import { useModelStore } from './modelStore';

export interface ScenarioChange {
  id: string;
  dataType: 'Labor' | 'Equipment' | 'Product' | 'General';
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

  setActiveScenario: (id: string | null) => void;
  getActiveScenario: () => Scenario | undefined;
  getScenariosForModel: (modelId: string) => Scenario[];
  
  createScenario: (modelId: string, name: string, description?: string) => string;
  duplicateScenario: (id: string) => string;
  renameScenario: (id: string, name: string) => void;
  updateScenarioDescription: (id: string, description: string) => void;
  deleteScenario: (id: string) => void;
  
  addChange: (scenarioId: string, change: Omit<ScenarioChange, 'id'>) => void;
  updateChange: (scenarioId: string, changeId: string, whatIfValue: string | number) => void;
  removeChange: (scenarioId: string, changeId: string) => void;
  
  applyScenarioChange: (scenarioId: string, dataType: ScenarioChange['dataType'], entityId: string, entityName: string, field: string, fieldLabel: string, whatIfValue: string | number) => void;

  toggleDisplayScenario: (id: string) => void;
  markNeedsRecalc: (scenarioId: string) => void;
  
  promoteToBasecase: (scenarioId: string) => void;
}

const uid = () => crypto.randomUUID();

function createDemoScenarios(modelId: string): Scenario[] {
  const store = useModelStore.getState();
  const model = store.models.find(m => m.id === modelId);
  if (!model) return [];

  const machinst = model.labor.find(l => l.name === 'MACHINST');
  const repair = model.labor.find(l => l.name === 'REPAIR');
  const vtLathe = model.equipment.find(e => e.name === 'VT_LATHE');
  const mill = model.equipment.find(e => e.name === 'MILL');

  const moveLabor: Scenario = {
    id: uid(),
    modelId,
    name: 'Move Labor',
    description: 'Move one worker from REPAIR to MACHINST to reduce machining bottleneck.',
    familyId: null,
    status: 'needs_recalc',
    changes: [
      ...(machinst ? [{
        id: uid(),
        dataType: 'Labor' as const,
        entityId: machinst.id,
        entityName: 'MACHINST',
        field: 'count',
        fieldLabel: 'No. in Group',
        basecaseValue: 5,
        whatIfValue: 6,
      }] : []),
      ...(repair ? [{
        id: uid(),
        dataType: 'Labor' as const,
        entityId: repair.id,
        entityName: 'REPAIR',
        field: 'count',
        fieldLabel: 'No. in Group',
        basecaseValue: 3,
        whatIfValue: 2,
      }] : []),
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const improveChanges: ScenarioChange[] = [];
  
  model.products.forEach(p => {
    if (p.lot_size !== 20) {
      improveChanges.push({
        id: uid(),
        dataType: 'Product',
        entityId: p.id,
        entityName: p.name,
        field: 'lot_size',
        fieldLabel: 'Lot Size',
        basecaseValue: p.lot_size,
        whatIfValue: 20,
      });
    }
  });

  if (vtLathe) {
    improveChanges.push({
      id: uid(),
      dataType: 'Equipment',
      entityId: vtLathe.id,
      entityName: 'VT_LATHE',
      field: 'setup_factor',
      fieldLabel: 'Setup Factor',
      basecaseValue: 1,
      whatIfValue: 0.25,
    });
  }
  if (mill) {
    improveChanges.push({
      id: uid(),
      dataType: 'Equipment',
      entityId: mill.id,
      entityName: 'MILL',
      field: 'setup_factor',
      fieldLabel: 'Setup Factor',
      basecaseValue: 1,
      whatIfValue: 0.25,
    });
  }

  const improve: Scenario = {
    id: uid(),
    modelId,
    name: 'Improve',
    description: 'Reduce lot sizes to 20 and apply 75% setup reduction on VT_LATHE and MILL.',
    familyId: null,
    status: 'needs_recalc',
    changes: improveChanges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return [moveLabor, improve];
}

let demoInitialized = false;

export const useScenarioStore = create<ScenarioStore>((set, get) => ({
  scenarios: [],
  families: [],
  activeScenarioId: null,
  displayScenarioIds: [],

  setActiveScenario: (id) => set({ activeScenarioId: id }),

  getActiveScenario: () => {
    const { scenarios, activeScenarioId } = get();
    return scenarios.find(s => s.id === activeScenarioId);
  },

  getScenariosForModel: (modelId) => {
    const { scenarios } = get();
    // Lazy-init demo scenarios
    if (!demoInitialized) {
      const model = useModelStore.getState().models.find(m => m.id === modelId);
      if (model?.is_demo && scenarios.filter(s => s.modelId === modelId).length === 0) {
        demoInitialized = true;
        const demoScenarios = createDemoScenarios(modelId);
        if (demoScenarios.length > 0) {
          set(s => ({ scenarios: [...s.scenarios, ...demoScenarios] }));
          return demoScenarios;
        }
      }
    }
    return scenarios.filter(s => s.modelId === modelId);
  },

  createScenario: (modelId, name, description = '') => {
    const id = uid();
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

  duplicateScenario: (id) => {
    const source = get().scenarios.find(s => s.id === id);
    if (!source) return '';
    const newId = uid();
    const dup: Scenario = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      name: `${source.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set(s => ({ scenarios: [...s.scenarios, dup] }));
    return newId;
  },

  renameScenario: (id, name) => set(s => ({
    scenarios: s.scenarios.map(sc => sc.id === id ? { ...sc, name, updatedAt: new Date().toISOString() } : sc),
  })),

  updateScenarioDescription: (id, description) => set(s => ({
    scenarios: s.scenarios.map(sc => sc.id === id ? { ...sc, description, updatedAt: new Date().toISOString() } : sc),
  })),

  deleteScenario: (id) => set(s => ({
    scenarios: s.scenarios.filter(sc => sc.id !== id),
    activeScenarioId: s.activeScenarioId === id ? null : s.activeScenarioId,
  })),

  addChange: (scenarioId, change) => set(s => ({
    scenarios: s.scenarios.map(sc => sc.id === scenarioId ? {
      ...sc,
      changes: [...sc.changes, { ...change, id: uid() }],
      status: 'needs_recalc' as const,
      updatedAt: new Date().toISOString(),
    } : sc),
  })),

  updateChange: (scenarioId, changeId, whatIfValue) => set(s => ({
    scenarios: s.scenarios.map(sc => sc.id === scenarioId ? {
      ...sc,
      changes: sc.changes.map(c => c.id === changeId ? { ...c, whatIfValue } : c),
      status: 'needs_recalc' as const,
      updatedAt: new Date().toISOString(),
    } : sc),
  })),

  removeChange: (scenarioId, changeId) => set(s => ({
    scenarios: s.scenarios.map(sc => sc.id === scenarioId ? {
      ...sc,
      changes: sc.changes.filter(c => c.id !== changeId),
      updatedAt: new Date().toISOString(),
    } : sc),
  })),

  applyScenarioChange: (scenarioId, dataType, entityId, entityName, field, fieldLabel, whatIfValue) => {
    const scenario = get().scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;

    const existing = scenario.changes.find(c => c.entityId === entityId && c.field === field);
    if (existing) {
      if (existing.basecaseValue === whatIfValue) {
        // Revert — remove change
        get().removeChange(scenarioId, existing.id);
      } else {
        get().updateChange(scenarioId, existing.id, whatIfValue);
      }
    } else {
      // Look up basecase value
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
        if (entity) basecaseValue = (entity as any)[field];
      }
      if (basecaseValue === whatIfValue) return; // No actual change
      get().addChange(scenarioId, { dataType, entityId, entityName, field, fieldLabel, basecaseValue, whatIfValue });
    }
  },

  toggleDisplayScenario: (id) => set(s => ({
    displayScenarioIds: s.displayScenarioIds.includes(id)
      ? s.displayScenarioIds.filter(sid => sid !== id)
      : [...s.displayScenarioIds, id],
  })),

  markNeedsRecalc: (scenarioId) => set(s => ({
    scenarios: s.scenarios.map(sc => sc.id === scenarioId ? { ...sc, status: 'needs_recalc' as const } : sc),
  })),

  promoteToBasecase: (scenarioId) => {
    const scenario = get().scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;
    const modelStore = useModelStore.getState();
    const model = modelStore.models.find(m => m.id === scenario.modelId);
    if (!model) return;

    // Apply each change to the basecase model
    scenario.changes.forEach(change => {
      if (change.dataType === 'Labor') {
        modelStore.updateLabor(scenario.modelId, change.entityId, { [change.field]: change.whatIfValue });
      } else if (change.dataType === 'Equipment') {
        modelStore.updateEquipment(scenario.modelId, change.entityId, { [change.field]: change.whatIfValue });
      } else if (change.dataType === 'Product') {
        modelStore.updateProduct(scenario.modelId, change.entityId, { [change.field]: change.whatIfValue });
      }
    });

    // Clear changes from this scenario and update all other scenarios' basecase values
    set(s => ({
      scenarios: s.scenarios.map(sc => {
        if (sc.id === scenarioId) {
          return { ...sc, changes: [], status: 'needs_recalc' as const, updatedAt: new Date().toISOString() };
        }
        if (sc.modelId === scenario.modelId) {
          return { ...sc, status: 'needs_recalc' as const };
        }
        return sc;
      }),
      activeScenarioId: null,
    }));
  },
}));
