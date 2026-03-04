import { create } from 'zustand';

export interface LaborGroup {
  id: string;
  name: string;
  count: number;
  overtime_pct: number;
  unavail_pct: number;
  dept_code: string;
  setup_factor: number;
  run_factor: number;
  var_factor: number;
  comments: string;
}

export interface EquipmentGroup {
  id: string;
  name: string;
  equip_type: 'standard' | 'delay';
  count: number;
  mttf: number;
  mttr: number;
  overtime_pct: number;
  labor_group_id: string;
  dept_code: string;
  setup_factor: number;
  run_factor: number;
  var_factor: number;
  comments: string;
}

export interface Product {
  id: string;
  name: string;
  demand: number;
  lot_size: number;
  tbatch_size: number;
  demand_factor: number;
  lot_factor: number;
  var_factor: number;
  make_to_stock: boolean;
  gather_tbatches: boolean;
  comments: string;
}

export interface Operation {
  id: string;
  product_id: string;
  op_name: string;
  op_number: number;
  equip_id: string;
  pct_assigned: number;
  equip_setup_lot: number;
  equip_run_piece: number;
  labor_setup_lot: number;
  labor_run_piece: number;
}

export interface RoutingEntry {
  id: string;
  product_id: string;
  from_op_name: string;
  to_op_name: string;
  pct_routed: number;
}

export interface IBOMEntry {
  id: string;
  parent_product_id: string;
  component_product_id: string;
  units_per_assy: number;
}

export interface GeneralData {
  model_title: string;
  ops_time_unit: 'MIN' | 'HR' | 'SEC';
  mct_time_unit: 'MIN' | 'HR' | 'DAY' | 'WEEK';
  prod_period_unit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  conv1: number;
  conv2: number;
  util_limit: number;
  var_equip: number;
  var_labor: number;
  var_prod: number;
  author: string;
  comments: string;
}

export interface Model {
  id: string;
  name: string;
  description: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  run_status: 'never_run' | 'current' | 'needs_recalc';
  is_archived: boolean;
  is_demo: boolean;
  is_starred: boolean;
  general: GeneralData;
  labor: LaborGroup[];
  equipment: EquipmentGroup[];
  products: Product[];
  operations: Operation[];
  routing: RoutingEntry[];
}

interface ModelStore {
  models: Model[];
  activeModelId: string | null;
  setActiveModel: (id: string | null) => void;
  getActiveModel: () => Model | undefined;
  createModel: (name: string, description?: string) => string;
  duplicateModel: (id: string) => string;
  deleteModel: (id: string) => void;
  toggleStar: (id: string) => void;
  archiveModel: (id: string) => void;
  updateGeneral: (modelId: string, data: Partial<GeneralData>) => void;
  addLabor: (modelId: string, labor: LaborGroup) => void;
  updateLabor: (modelId: string, laborId: string, data: Partial<LaborGroup>) => void;
  deleteLabor: (modelId: string, laborId: string) => void;
  addEquipment: (modelId: string, eq: EquipmentGroup) => void;
  updateEquipment: (modelId: string, eqId: string, data: Partial<EquipmentGroup>) => void;
  deleteEquipment: (modelId: string, eqId: string) => void;
  addProduct: (modelId: string, product: Product) => void;
  updateProduct: (modelId: string, productId: string, data: Partial<Product>) => void;
  deleteProduct: (modelId: string, productId: string) => void;
  addOperation: (modelId: string, op: Operation) => void;
  updateOperation: (modelId: string, opId: string, data: Partial<Operation>) => void;
  deleteOperation: (modelId: string, opId: string) => void;
  addRouting: (modelId: string, entry: RoutingEntry) => void;
  updateRouting: (modelId: string, entryId: string, data: Partial<RoutingEntry>) => void;
  deleteRouting: (modelId: string, entryId: string) => void;
  setRouting: (modelId: string, productId: string, entries: RoutingEntry[]) => void;
}

const uid = () => crypto.randomUUID();

function createDemoModel(): Model {
  const laborIds = { PREP: uid(), MACHINST: uid(), INSPECTR: uid(), REPAIR: uid() };
  const equipIds = { BENCH: uid(), VT_LATHE: uid(), DEBURR: uid(), INSPECT: uid(), REWORK: uid(), MILL: uid(), DRILL: uid() };

  return {
    id: uid(),
    name: 'Hub Manufacturing Cell — Demo',
    description: 'Classic MPX tutorial example. A hub manufacturing cell with 4 hub products, sleeves, mounts, brackets, and bolts.',
    tags: ['Demo', 'Tutorial'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_run_at: null,
    run_status: 'never_run',
    is_archived: false,
    is_demo: true,
    is_starred: true,
    general: {
      model_title: 'Hub Manufacturing Cell',
      ops_time_unit: 'MIN',
      mct_time_unit: 'DAY',
      prod_period_unit: 'YEAR',
      conv1: 480,
      conv2: 210,
      util_limit: 95,
      var_equip: 30,
      var_labor: 30,
      var_prod: 30,
      author: 'RapidMCT Demo',
      comments: 'Based on the Hub Manufacturing Cell example from the MPX manual.',
    },
    labor: [
      { id: laborIds.PREP, name: 'PREP', count: 3, overtime_pct: 0, unavail_pct: 5, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Preparation workers' },
      { id: laborIds.MACHINST, name: 'MACHINST', count: 5, overtime_pct: 0, unavail_pct: 5, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Machinists' },
      { id: laborIds.INSPECTR, name: 'INSPECTR', count: 3, overtime_pct: 0, unavail_pct: 5, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Inspectors' },
      { id: laborIds.REPAIR, name: 'REPAIR', count: 3, overtime_pct: 0, unavail_pct: 10, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Repair workers' },
    ],
    equipment: [
      { id: equipIds.BENCH, name: 'BENCH', equip_type: 'standard', count: 3, mttf: 0, mttr: 0, overtime_pct: 0, labor_group_id: laborIds.PREP, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Prep bench' },
      { id: equipIds.VT_LATHE, name: 'VT_LATHE', equip_type: 'standard', count: 4, mttf: 600, mttr: 60, overtime_pct: 0, labor_group_id: laborIds.MACHINST, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Vertical lathes' },
      { id: equipIds.DEBURR, name: 'DEBURR', equip_type: 'standard', count: 3, mttf: 0, mttr: 0, overtime_pct: 0, labor_group_id: laborIds.REPAIR, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Deburr stations' },
      { id: equipIds.INSPECT, name: 'INSPECT', equip_type: 'standard', count: 3, mttf: 0, mttr: 0, overtime_pct: 0, labor_group_id: laborIds.INSPECTR, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Inspection stations' },
      { id: equipIds.REWORK, name: 'REWORK', equip_type: 'standard', count: 2, mttf: 0, mttr: 0, overtime_pct: 0, labor_group_id: laborIds.REPAIR, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Rework area' },
      { id: equipIds.MILL, name: 'MILL', equip_type: 'standard', count: 2, mttf: 480, mttr: 30, overtime_pct: 0, labor_group_id: laborIds.MACHINST, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Milling machines' },
      { id: equipIds.DRILL, name: 'DRILL', equip_type: 'standard', count: 2, mttf: 0, mttr: 0, overtime_pct: 0, labor_group_id: laborIds.MACHINST, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Drill presses' },
    ],
    products: [
      { id: uid(), name: 'HUB1', demand: 50, lot_size: 40, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Hub variant 1' },
      { id: uid(), name: 'HUB2', demand: 40, lot_size: 40, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Hub variant 2' },
      { id: uid(), name: 'HUB3', demand: 30, lot_size: 40, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Hub variant 3' },
      { id: uid(), name: 'HUB4', demand: 30, lot_size: 40, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Hub variant 4' },
      { id: uid(), name: 'SLEEVE', demand: 0, lot_size: 40, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Sleeve component' },
      { id: uid(), name: 'MOUNT', demand: 0, lot_size: 80, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Mount assembly' },
      { id: uid(), name: 'BRACKET', demand: 0, lot_size: 1000, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Bracket component' },
      { id: uid(), name: 'BOLT', demand: 0, lot_size: 1000, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Bolt component' },
    ],
    operations: [],
    routing: [],
  };
}

const defaultGeneral: GeneralData = {
  model_title: '',
  ops_time_unit: 'MIN',
  mct_time_unit: 'DAY',
  prod_period_unit: 'YEAR',
  conv1: 480,
  conv2: 210,
  util_limit: 95,
  var_equip: 30,
  var_labor: 30,
  var_prod: 30,
  author: '',
  comments: '',
};

export const useModelStore = create<ModelStore>((set, get) => ({
  models: [createDemoModel()],
  activeModelId: null,

  setActiveModel: (id) => set({ activeModelId: id }),

  getActiveModel: () => {
    const { models, activeModelId } = get();
    return models.find((m) => m.id === activeModelId);
  },

  createModel: (name, description = '') => {
    const id = uid();
    const model: Model = {
      id, name, description, tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_run_at: null,
      run_status: 'never_run',
      is_archived: false, is_demo: false, is_starred: false,
      general: { ...defaultGeneral, model_title: name },
      labor: [], equipment: [], products: [], operations: [], routing: [],
    };
    set((s) => ({ models: [model, ...s.models] }));
    return id;
  },

  duplicateModel: (id) => {
    const source = get().models.find((m) => m.id === id);
    if (!source) return '';
    const newId = uid();
    const dup: Model = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      name: `${source.name} (Copy)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_demo: false, is_starred: false,
    };
    set((s) => ({ models: [dup, ...s.models] }));
    return newId;
  },

  deleteModel: (id) => set((s) => ({ models: s.models.filter((m) => m.id !== id) })),
  toggleStar: (id) => set((s) => ({ models: s.models.map((m) => m.id === id ? { ...m, is_starred: !m.is_starred } : m) })),
  archiveModel: (id) => set((s) => ({ models: s.models.map((m) => m.id === id ? { ...m, is_archived: !m.is_archived } : m) })),

  updateGeneral: (modelId, data) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, general: { ...m.general, ...data }, updated_at: new Date().toISOString() } : m),
  })),

  addLabor: (modelId, labor) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, labor: [...m.labor, labor], updated_at: new Date().toISOString() } : m),
  })),
  updateLabor: (modelId, laborId, data) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, labor: m.labor.map((l) => l.id === laborId ? { ...l, ...data } : l), updated_at: new Date().toISOString() } : m),
  })),
  deleteLabor: (modelId, laborId) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, labor: m.labor.filter((l) => l.id !== laborId), updated_at: new Date().toISOString() } : m),
  })),

  addEquipment: (modelId, eq) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, equipment: [...m.equipment, eq], updated_at: new Date().toISOString() } : m),
  })),
  updateEquipment: (modelId, eqId, data) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, equipment: m.equipment.map((e) => e.id === eqId ? { ...e, ...data } : e), updated_at: new Date().toISOString() } : m),
  })),
  deleteEquipment: (modelId, eqId) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, equipment: m.equipment.filter((e) => e.id !== eqId), updated_at: new Date().toISOString() } : m),
  })),

  addProduct: (modelId, product) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, products: [...m.products, product], updated_at: new Date().toISOString() } : m),
  })),
  updateProduct: (modelId, productId, data) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, products: m.products.map((p) => p.id === productId ? { ...p, ...data } : p), updated_at: new Date().toISOString() } : m),
  })),
  deleteProduct: (modelId, productId) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, products: m.products.filter((p) => p.id !== productId), updated_at: new Date().toISOString() } : m),
  })),

  addOperation: (modelId, op) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, operations: [...m.operations, op], updated_at: new Date().toISOString() } : m),
  })),
  updateOperation: (modelId, opId, data) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, operations: m.operations.map((o) => o.id === opId ? { ...o, ...data } : o), updated_at: new Date().toISOString() } : m),
  })),
  deleteOperation: (modelId, opId) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, operations: m.operations.filter((o) => o.id !== opId), updated_at: new Date().toISOString() } : m),
  })),

  addRouting: (modelId, entry) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, routing: [...m.routing, entry], updated_at: new Date().toISOString() } : m),
  })),
  updateRouting: (modelId, entryId, data) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, routing: m.routing.map((r) => r.id === entryId ? { ...r, ...data } : r), updated_at: new Date().toISOString() } : m),
  })),
  deleteRouting: (modelId, entryId) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? { ...m, routing: m.routing.filter((r) => r.id !== entryId), updated_at: new Date().toISOString() } : m),
  })),
  setRouting: (modelId, productId, entries) => set((s) => ({
    models: s.models.map((m) => m.id === modelId ? {
      ...m,
      routing: [...m.routing.filter((r) => r.product_id !== productId), ...entries],
      updated_at: new Date().toISOString(),
    } : m),
  })),
}));
