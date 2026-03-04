import { create } from 'zustand';
import { fetchAllModels, saveFullModelToDB, db } from '@/lib/supabaseData';

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
  ibom: IBOMEntry[];
}

interface ModelStore {
  models: Model[];
  activeModelId: string | null;
  modelsLoaded: boolean;
  modelsLoading: boolean;
  setActiveModel: (id: string | null) => void;
  getActiveModel: () => Model | undefined;
  loadModels: () => Promise<void>;
  createModel: (name: string, description?: string) => string;
  duplicateModel: (id: string) => string;
  renameModel: (id: string, name: string) => void;
  deleteModel: (id: string) => void;
  toggleStar: (id: string) => void;
  archiveModel: (id: string) => void;
  setRunStatus: (id: string, status: Model['run_status']) => void;
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
  addIBOM: (modelId: string, entry: IBOMEntry) => void;
  updateIBOM: (modelId: string, entryId: string, data: Partial<IBOMEntry>) => void;
  deleteIBOM: (modelId: string, entryId: string) => void;
  setIBOMForParent: (modelId: string, parentId: string, entries: IBOMEntry[]) => void;
}

const uid = () => crypto.randomUUID();

// ─── Hub routing helper ─────────────────────────────────────────────
function createHubRouting(productId: string): RoutingEntry[] {
  return [
    { id: uid(), product_id: productId, from_op_name: 'DOCK', to_op_name: 'BENCH', pct_routed: 100 },
    { id: uid(), product_id: productId, from_op_name: 'BENCH', to_op_name: 'RFTURN', pct_routed: 100 },
    { id: uid(), product_id: productId, from_op_name: 'RFTURN', to_op_name: 'DEBURR', pct_routed: 100 },
    { id: uid(), product_id: productId, from_op_name: 'DEBURR', to_op_name: 'FNTURN', pct_routed: 100 },
    { id: uid(), product_id: productId, from_op_name: 'FNTURN', to_op_name: 'INSPECT', pct_routed: 100 },
    { id: uid(), product_id: productId, from_op_name: 'INSPECT', to_op_name: 'SLOT', pct_routed: 85 },
    { id: uid(), product_id: productId, from_op_name: 'INSPECT', to_op_name: 'REWORK', pct_routed: 10 },
    { id: uid(), product_id: productId, from_op_name: 'INSPECT', to_op_name: 'SCRAP', pct_routed: 5 },
    { id: uid(), product_id: productId, from_op_name: 'REWORK', to_op_name: 'INSPECT', pct_routed: 80 },
    { id: uid(), product_id: productId, from_op_name: 'REWORK', to_op_name: 'SCRAP', pct_routed: 20 },
    { id: uid(), product_id: productId, from_op_name: 'SLOT', to_op_name: 'STOCK', pct_routed: 100 },
  ];
}

// ─── Demo model factory (exported for seeding) ─────────────────────
export function createDemoModel(): Model {
  const laborIds = { PREP: uid(), MACHINST: uid(), INSPECTR: uid(), REPAIR: uid() };
  const equipIds = { BENCH: uid(), VT_LATHE: uid(), DEBURR: uid(), INSPECT: uid(), REWORK: uid(), MILL: uid(), DRILL: uid() };
  const prodIds = { HUB1: uid(), HUB2: uid(), HUB3: uid(), HUB4: uid(), SLEEVE: uid(), MOUNT: uid(), BRACKET: uid(), BOLT: uid() };

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
      ops_time_unit: 'MIN', mct_time_unit: 'DAY', prod_period_unit: 'YEAR',
      conv1: 480, conv2: 210, util_limit: 95, var_equip: 30, var_labor: 30, var_prod: 30,
      author: 'RapidMCT Demo',
      comments: 'Based on the Hub Manufacturing Cell example from the MPX manual.',
    },
    labor: [
      { id: laborIds.PREP, name: 'PREP', count: 4, overtime_pct: 0, unavail_pct: 5, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Preparation workers' },
      { id: laborIds.MACHINST, name: 'MACHINST', count: 12, overtime_pct: 0, unavail_pct: 5, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Machinists' },
      { id: laborIds.INSPECTR, name: 'INSPECTR', count: 3, overtime_pct: 0, unavail_pct: 5, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Inspectors' },
      { id: laborIds.REPAIR, name: 'REPAIR', count: 3, overtime_pct: 0, unavail_pct: 10, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Repair workers' },
    ],
    equipment: [
      { id: equipIds.BENCH, name: 'BENCH', equip_type: 'standard', count: 4, mttf: 0, mttr: 0, overtime_pct: 0, labor_group_id: laborIds.PREP, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Prep bench' },
      { id: equipIds.VT_LATHE, name: 'VT_LATHE', equip_type: 'standard', count: 7, mttf: 600, mttr: 60, overtime_pct: 0, labor_group_id: laborIds.MACHINST, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Vertical lathes' },
      { id: equipIds.DEBURR, name: 'DEBURR', equip_type: 'standard', count: 3, mttf: 0, mttr: 0, overtime_pct: 0, labor_group_id: laborIds.REPAIR, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Deburr stations' },
      { id: equipIds.INSPECT, name: 'INSPECT', equip_type: 'standard', count: 3, mttf: 0, mttr: 0, overtime_pct: 0, labor_group_id: laborIds.INSPECTR, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Inspection stations' },
      { id: equipIds.REWORK, name: 'REWORK', equip_type: 'standard', count: 2, mttf: 0, mttr: 0, overtime_pct: 0, labor_group_id: laborIds.REPAIR, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Rework area' },
      { id: equipIds.MILL, name: 'MILL', equip_type: 'standard', count: 3, mttf: 480, mttr: 30, overtime_pct: 0, labor_group_id: laborIds.MACHINST, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Milling machines' },
      { id: equipIds.DRILL, name: 'DRILL', equip_type: 'standard', count: 8, mttf: 0, mttr: 0, overtime_pct: 0, labor_group_id: laborIds.MACHINST, dept_code: '', setup_factor: 1, run_factor: 1, var_factor: 1, comments: 'Drill presses' },
    ],
    products: [
      { id: prodIds.HUB1, name: 'HUB1', demand: 5000, lot_size: 40, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Hub variant 1' },
      { id: prodIds.HUB2, name: 'HUB2', demand: 4000, lot_size: 40, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Hub variant 2' },
      { id: prodIds.HUB3, name: 'HUB3', demand: 3000, lot_size: 40, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Hub variant 3' },
      { id: prodIds.HUB4, name: 'HUB4', demand: 2500, lot_size: 40, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Hub variant 4' },
      { id: prodIds.SLEEVE, name: 'SLEEVE', demand: 0, lot_size: 40, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Sleeve component' },
      { id: prodIds.MOUNT, name: 'MOUNT', demand: 0, lot_size: 80, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Mount assembly' },
      { id: prodIds.BRACKET, name: 'BRACKET', demand: 0, lot_size: 1000, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Bracket component' },
      { id: prodIds.BOLT, name: 'BOLT', demand: 0, lot_size: 1000, tbatch_size: -1, demand_factor: 1, lot_factor: 1, var_factor: 1, make_to_stock: false, gather_tbatches: true, comments: 'Bolt component' },
    ],
    operations: [
      // HUB1
      { id: uid(), product_id: prodIds.HUB1, op_name: 'DOCK', op_number: 10, equip_id: '', pct_assigned: 100, equip_setup_lot: 0, equip_run_piece: 0, labor_setup_lot: 0, labor_run_piece: 0 },
      { id: uid(), product_id: prodIds.HUB1, op_name: 'BENCH', op_number: 20, equip_id: equipIds.BENCH, pct_assigned: 100, equip_setup_lot: 30, equip_run_piece: 5, labor_setup_lot: 30, labor_run_piece: 5 },
      { id: uid(), product_id: prodIds.HUB1, op_name: 'RFTURN', op_number: 30, equip_id: equipIds.VT_LATHE, pct_assigned: 100, equip_setup_lot: 45, equip_run_piece: 8, labor_setup_lot: 45, labor_run_piece: 8 },
      { id: uid(), product_id: prodIds.HUB1, op_name: 'DEBURR', op_number: 40, equip_id: equipIds.DEBURR, pct_assigned: 100, equip_setup_lot: 10, equip_run_piece: 3, labor_setup_lot: 10, labor_run_piece: 3 },
      { id: uid(), product_id: prodIds.HUB1, op_name: 'FNTURN', op_number: 50, equip_id: equipIds.VT_LATHE, pct_assigned: 100, equip_setup_lot: 45, equip_run_piece: 12, labor_setup_lot: 45, labor_run_piece: 12 },
      { id: uid(), product_id: prodIds.HUB1, op_name: 'INSPECT', op_number: 60, equip_id: equipIds.INSPECT, pct_assigned: 100, equip_setup_lot: 15, equip_run_piece: 4, labor_setup_lot: 15, labor_run_piece: 4 },
      { id: uid(), product_id: prodIds.HUB1, op_name: 'REWORK', op_number: 70, equip_id: equipIds.REWORK, pct_assigned: 100, equip_setup_lot: 20, equip_run_piece: 6, labor_setup_lot: 20, labor_run_piece: 6 },
      { id: uid(), product_id: prodIds.HUB1, op_name: 'SLOT', op_number: 80, equip_id: equipIds.MILL, pct_assigned: 100, equip_setup_lot: 30, equip_run_piece: 7, labor_setup_lot: 30, labor_run_piece: 7 },
      // HUB2
      { id: uid(), product_id: prodIds.HUB2, op_name: 'DOCK', op_number: 10, equip_id: '', pct_assigned: 100, equip_setup_lot: 0, equip_run_piece: 0, labor_setup_lot: 0, labor_run_piece: 0 },
      { id: uid(), product_id: prodIds.HUB2, op_name: 'BENCH', op_number: 20, equip_id: equipIds.BENCH, pct_assigned: 100, equip_setup_lot: 30, equip_run_piece: 5, labor_setup_lot: 30, labor_run_piece: 5 },
      { id: uid(), product_id: prodIds.HUB2, op_name: 'RFTURN', op_number: 30, equip_id: equipIds.VT_LATHE, pct_assigned: 100, equip_setup_lot: 45, equip_run_piece: 8, labor_setup_lot: 45, labor_run_piece: 8 },
      { id: uid(), product_id: prodIds.HUB2, op_name: 'DEBURR', op_number: 40, equip_id: equipIds.DEBURR, pct_assigned: 100, equip_setup_lot: 10, equip_run_piece: 3, labor_setup_lot: 10, labor_run_piece: 3 },
      { id: uid(), product_id: prodIds.HUB2, op_name: 'FNTURN', op_number: 50, equip_id: equipIds.VT_LATHE, pct_assigned: 100, equip_setup_lot: 45, equip_run_piece: 12, labor_setup_lot: 45, labor_run_piece: 12 },
      { id: uid(), product_id: prodIds.HUB2, op_name: 'INSPECT', op_number: 60, equip_id: equipIds.INSPECT, pct_assigned: 100, equip_setup_lot: 15, equip_run_piece: 4, labor_setup_lot: 15, labor_run_piece: 4 },
      { id: uid(), product_id: prodIds.HUB2, op_name: 'REWORK', op_number: 70, equip_id: equipIds.REWORK, pct_assigned: 100, equip_setup_lot: 20, equip_run_piece: 6, labor_setup_lot: 20, labor_run_piece: 6 },
      { id: uid(), product_id: prodIds.HUB2, op_name: 'SLOT', op_number: 80, equip_id: equipIds.MILL, pct_assigned: 100, equip_setup_lot: 30, equip_run_piece: 7, labor_setup_lot: 30, labor_run_piece: 7 },
      // HUB3
      { id: uid(), product_id: prodIds.HUB3, op_name: 'DOCK', op_number: 10, equip_id: '', pct_assigned: 100, equip_setup_lot: 0, equip_run_piece: 0, labor_setup_lot: 0, labor_run_piece: 0 },
      { id: uid(), product_id: prodIds.HUB3, op_name: 'BENCH', op_number: 20, equip_id: equipIds.BENCH, pct_assigned: 100, equip_setup_lot: 30, equip_run_piece: 5, labor_setup_lot: 30, labor_run_piece: 5 },
      { id: uid(), product_id: prodIds.HUB3, op_name: 'RFTURN', op_number: 30, equip_id: equipIds.VT_LATHE, pct_assigned: 100, equip_setup_lot: 45, equip_run_piece: 8, labor_setup_lot: 45, labor_run_piece: 8 },
      { id: uid(), product_id: prodIds.HUB3, op_name: 'DEBURR', op_number: 40, equip_id: equipIds.DEBURR, pct_assigned: 100, equip_setup_lot: 10, equip_run_piece: 3, labor_setup_lot: 10, labor_run_piece: 3 },
      { id: uid(), product_id: prodIds.HUB3, op_name: 'FNTURN', op_number: 50, equip_id: equipIds.VT_LATHE, pct_assigned: 100, equip_setup_lot: 45, equip_run_piece: 12, labor_setup_lot: 45, labor_run_piece: 12 },
      { id: uid(), product_id: prodIds.HUB3, op_name: 'INSPECT', op_number: 60, equip_id: equipIds.INSPECT, pct_assigned: 100, equip_setup_lot: 15, equip_run_piece: 4, labor_setup_lot: 15, labor_run_piece: 4 },
      { id: uid(), product_id: prodIds.HUB3, op_name: 'REWORK', op_number: 70, equip_id: equipIds.REWORK, pct_assigned: 100, equip_setup_lot: 20, equip_run_piece: 6, labor_setup_lot: 20, labor_run_piece: 6 },
      { id: uid(), product_id: prodIds.HUB3, op_name: 'SLOT', op_number: 80, equip_id: equipIds.MILL, pct_assigned: 100, equip_setup_lot: 30, equip_run_piece: 7, labor_setup_lot: 30, labor_run_piece: 7 },
      // HUB4
      { id: uid(), product_id: prodIds.HUB4, op_name: 'DOCK', op_number: 10, equip_id: '', pct_assigned: 100, equip_setup_lot: 0, equip_run_piece: 0, labor_setup_lot: 0, labor_run_piece: 0 },
      { id: uid(), product_id: prodIds.HUB4, op_name: 'BENCH', op_number: 20, equip_id: equipIds.BENCH, pct_assigned: 100, equip_setup_lot: 30, equip_run_piece: 5, labor_setup_lot: 30, labor_run_piece: 5 },
      { id: uid(), product_id: prodIds.HUB4, op_name: 'RFTURN', op_number: 30, equip_id: equipIds.VT_LATHE, pct_assigned: 100, equip_setup_lot: 45, equip_run_piece: 8, labor_setup_lot: 45, labor_run_piece: 8 },
      { id: uid(), product_id: prodIds.HUB4, op_name: 'DEBURR', op_number: 40, equip_id: equipIds.DEBURR, pct_assigned: 100, equip_setup_lot: 10, equip_run_piece: 3, labor_setup_lot: 10, labor_run_piece: 3 },
      { id: uid(), product_id: prodIds.HUB4, op_name: 'FNTURN', op_number: 50, equip_id: equipIds.VT_LATHE, pct_assigned: 100, equip_setup_lot: 45, equip_run_piece: 12, labor_setup_lot: 45, labor_run_piece: 12 },
      { id: uid(), product_id: prodIds.HUB4, op_name: 'INSPECT', op_number: 60, equip_id: equipIds.INSPECT, pct_assigned: 100, equip_setup_lot: 15, equip_run_piece: 4, labor_setup_lot: 15, labor_run_piece: 4 },
      { id: uid(), product_id: prodIds.HUB4, op_name: 'REWORK', op_number: 70, equip_id: equipIds.REWORK, pct_assigned: 100, equip_setup_lot: 20, equip_run_piece: 6, labor_setup_lot: 20, labor_run_piece: 6 },
      { id: uid(), product_id: prodIds.HUB4, op_name: 'SLOT', op_number: 80, equip_id: equipIds.MILL, pct_assigned: 100, equip_setup_lot: 30, equip_run_piece: 7, labor_setup_lot: 30, labor_run_piece: 7 },
      // SLEEVE
      { id: uid(), product_id: prodIds.SLEEVE, op_name: 'DOCK', op_number: 10, equip_id: '', pct_assigned: 100, equip_setup_lot: 0, equip_run_piece: 0, labor_setup_lot: 0, labor_run_piece: 0 },
      { id: uid(), product_id: prodIds.SLEEVE, op_name: 'TURN', op_number: 20, equip_id: equipIds.DRILL, pct_assigned: 100, equip_setup_lot: 20, equip_run_piece: 2, labor_setup_lot: 20, labor_run_piece: 2 },
      // MOUNT
      { id: uid(), product_id: prodIds.MOUNT, op_name: 'DOCK', op_number: 10, equip_id: '', pct_assigned: 100, equip_setup_lot: 0, equip_run_piece: 0, labor_setup_lot: 0, labor_run_piece: 0 },
      { id: uid(), product_id: prodIds.MOUNT, op_name: 'ASSEMBLE', op_number: 20, equip_id: equipIds.BENCH, pct_assigned: 100, equip_setup_lot: 20, equip_run_piece: 2, labor_setup_lot: 20, labor_run_piece: 2 },
      // BRACKET
      { id: uid(), product_id: prodIds.BRACKET, op_name: 'DOCK', op_number: 10, equip_id: '', pct_assigned: 100, equip_setup_lot: 0, equip_run_piece: 0, labor_setup_lot: 0, labor_run_piece: 0 },
      { id: uid(), product_id: prodIds.BRACKET, op_name: 'STAMP', op_number: 20, equip_id: equipIds.DRILL, pct_assigned: 100, equip_setup_lot: 20, equip_run_piece: 2, labor_setup_lot: 20, labor_run_piece: 2 },
      // BOLT
      { id: uid(), product_id: prodIds.BOLT, op_name: 'DOCK', op_number: 10, equip_id: '', pct_assigned: 100, equip_setup_lot: 0, equip_run_piece: 0, labor_setup_lot: 0, labor_run_piece: 0 },
      { id: uid(), product_id: prodIds.BOLT, op_name: 'FORM', op_number: 20, equip_id: equipIds.DRILL, pct_assigned: 100, equip_setup_lot: 20, equip_run_piece: 2, labor_setup_lot: 20, labor_run_piece: 2 },
    ],
    routing: [
      ...createHubRouting(prodIds.HUB1),
      ...createHubRouting(prodIds.HUB2),
      ...createHubRouting(prodIds.HUB3),
      ...createHubRouting(prodIds.HUB4),
      { id: uid(), product_id: prodIds.SLEEVE, from_op_name: 'DOCK', to_op_name: 'TURN', pct_routed: 100 },
      { id: uid(), product_id: prodIds.SLEEVE, from_op_name: 'TURN', to_op_name: 'STOCK', pct_routed: 100 },
      { id: uid(), product_id: prodIds.MOUNT, from_op_name: 'DOCK', to_op_name: 'ASSEMBLE', pct_routed: 100 },
      { id: uid(), product_id: prodIds.MOUNT, from_op_name: 'ASSEMBLE', to_op_name: 'STOCK', pct_routed: 100 },
      { id: uid(), product_id: prodIds.BRACKET, from_op_name: 'DOCK', to_op_name: 'STAMP', pct_routed: 100 },
      { id: uid(), product_id: prodIds.BRACKET, from_op_name: 'STAMP', to_op_name: 'STOCK', pct_routed: 100 },
      { id: uid(), product_id: prodIds.BOLT, from_op_name: 'DOCK', to_op_name: 'FORM', pct_routed: 100 },
      { id: uid(), product_id: prodIds.BOLT, from_op_name: 'FORM', to_op_name: 'STOCK', pct_routed: 100 },
    ],
    ibom: [
      { id: uid(), parent_product_id: prodIds.HUB1, component_product_id: prodIds.MOUNT, units_per_assy: 4 },
      { id: uid(), parent_product_id: prodIds.HUB1, component_product_id: prodIds.SLEEVE, units_per_assy: 1 },
      { id: uid(), parent_product_id: prodIds.HUB2, component_product_id: prodIds.MOUNT, units_per_assy: 4 },
      { id: uid(), parent_product_id: prodIds.HUB2, component_product_id: prodIds.SLEEVE, units_per_assy: 1 },
      { id: uid(), parent_product_id: prodIds.HUB3, component_product_id: prodIds.MOUNT, units_per_assy: 4 },
      { id: uid(), parent_product_id: prodIds.HUB3, component_product_id: prodIds.SLEEVE, units_per_assy: 1 },
      { id: uid(), parent_product_id: prodIds.HUB4, component_product_id: prodIds.MOUNT, units_per_assy: 4 },
      { id: uid(), parent_product_id: prodIds.HUB4, component_product_id: prodIds.SLEEVE, units_per_assy: 1 },
      { id: uid(), parent_product_id: prodIds.MOUNT, component_product_id: prodIds.BRACKET, units_per_assy: 2 },
      { id: uid(), parent_product_id: prodIds.MOUNT, component_product_id: prodIds.BOLT, units_per_assy: 2 },
    ],
  };
}

const defaultGeneral: GeneralData = {
  model_title: '', ops_time_unit: 'MIN', mct_time_unit: 'DAY', prod_period_unit: 'YEAR',
  conv1: 480, conv2: 210, util_limit: 95, var_equip: 30, var_labor: 30, var_prod: 30,
  author: '', comments: '',
};

export const useModelStore = create<ModelStore>((set, get) => ({
  models: [],
  activeModelId: null,
  modelsLoaded: false,
  modelsLoading: false,

  loadModels: async () => {
    if (get().modelsLoading) return;
    set({ modelsLoading: true });
    try {
      const models = await fetchAllModels();
      set({ models, modelsLoaded: true, modelsLoading: false });
    } catch (err) {
      console.error('loadModels error:', err);
      set({ modelsLoading: false });
    }
  },

  setActiveModel: (id) => set({ activeModelId: id }),

  getActiveModel: () => {
    const { models, activeModelId } = get();
    return models.find((m) => m.id === activeModelId);
  },

  createModel: (name, description = '') => {
    const id = uid();
    const model: Model = {
      id, name, description, tags: [],
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      last_run_at: null, run_status: 'never_run',
      is_archived: false, is_demo: false, is_starred: false,
      general: { ...defaultGeneral, model_title: name },
      labor: [], equipment: [], products: [], operations: [], routing: [], ibom: [],
    };
    set((s) => ({ models: [model, ...s.models] }));
    // Write to Supabase
    saveFullModelToDB(model).catch(err => console.error('createModel DB error:', err));
    return id;
  },

  duplicateModel: (id) => {
    const source = get().models.find((m) => m.id === id);
    if (!source) return '';
    const newId = uid();
    // Deep clone and assign new IDs to all entities
    const dup: Model = JSON.parse(JSON.stringify(source));
    dup.id = newId;
    dup.name = `${source.name} (Copy)`;
    dup.created_at = new Date().toISOString();
    dup.updated_at = new Date().toISOString();
    dup.is_demo = false;
    dup.is_starred = false;
    // Generate new IDs for all sub-entities and update references
    const idMap: Record<string, string> = {};
    const newUid = (oldId: string) => { const n = uid(); idMap[oldId] = n; return n; };
    dup.labor.forEach(l => { l.id = newUid(l.id); });
    dup.equipment.forEach(e => { e.id = newUid(e.id); if (e.labor_group_id) e.labor_group_id = idMap[e.labor_group_id] || e.labor_group_id; });
    dup.products.forEach(p => { p.id = newUid(p.id); });
    dup.operations.forEach(o => {
      o.id = newUid(o.id);
      o.product_id = idMap[o.product_id] || o.product_id;
      if (o.equip_id) o.equip_id = idMap[o.equip_id] || o.equip_id;
    });
    dup.routing.forEach(r => {
      r.id = uid();
      r.product_id = idMap[r.product_id] || r.product_id;
    });
    dup.ibom.forEach(i => {
      i.id = uid();
      i.parent_product_id = idMap[i.parent_product_id] || i.parent_product_id;
      i.component_product_id = idMap[i.component_product_id] || i.component_product_id;
    });
    set((s) => ({ models: [dup, ...s.models] }));
    saveFullModelToDB(dup).catch(err => console.error('duplicateModel DB error:', err));
    return newId;
  },

  deleteModel: (id) => {
    set((s) => ({ models: s.models.filter((m) => m.id !== id) }));
    db.deleteModel(id);
  },

  renameModel: (id, name) => {
    set((s) => ({
      models: s.models.map((m) => m.id === id ? { ...m, name, general: { ...m.general, model_title: name }, updated_at: new Date().toISOString() } : m),
    }));
    db.updateModel(id, { name });
  },

  toggleStar: (id) => set((s) => ({ models: s.models.map((m) => m.id === id ? { ...m, is_starred: !m.is_starred } : m) })),

  archiveModel: (id) => {
    const model = get().models.find(m => m.id === id);
    const newVal = !model?.is_archived;
    set((s) => ({ models: s.models.map((m) => m.id === id ? { ...m, is_archived: newVal } : m) }));
    db.updateModel(id, { is_archived: newVal });
  },

  setRunStatus: (id, status) => {
    set((s) => ({ models: s.models.map((m) => m.id === id ? { ...m, run_status: status } : m) }));
    db.updateModel(id, { run_status: status });
  },

  updateGeneral: (modelId, data) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, general: { ...m.general, ...data }, updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.updateGeneral(modelId, data);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },

  addLabor: (modelId, labor) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, labor: [...m.labor, labor], updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.insertLabor(modelId, labor);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  updateLabor: (modelId, laborId, data) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, labor: m.labor.map((l) => l.id === laborId ? { ...l, ...data } : l), updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.updateLabor(laborId, data);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  deleteLabor: (modelId, laborId) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? {
        ...m,
        labor: m.labor.filter((l) => l.id !== laborId),
        equipment: m.equipment.map((e) => e.labor_group_id === laborId ? { ...e, labor_group_id: '' } : e),
        updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const,
      } : m),
    }));
    db.deleteLabor(laborId);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },

  addEquipment: (modelId, eq) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, equipment: [...m.equipment, eq], updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.insertEquipment(modelId, eq);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  updateEquipment: (modelId, eqId, data) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, equipment: m.equipment.map((e) => e.id === eqId ? { ...e, ...data } : e), updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.updateEquipment(eqId, data);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  deleteEquipment: (modelId, eqId) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? {
        ...m,
        equipment: m.equipment.filter((e) => e.id !== eqId),
        operations: m.operations.map((o) => o.equip_id === eqId ? { ...o, equip_id: '' } : o),
        updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const,
      } : m),
    }));
    db.deleteEquipment(eqId);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },

  addProduct: (modelId, product) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, products: [...m.products, product], updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.insertProduct(modelId, product);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  updateProduct: (modelId, productId, data) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, products: m.products.map((p) => p.id === productId ? { ...p, ...data } : p), updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.updateProduct(productId, data);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  deleteProduct: (modelId, productId) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? {
        ...m,
        products: m.products.filter((p) => p.id !== productId),
        operations: m.operations.filter((o) => o.product_id !== productId),
        routing: m.routing.filter((r) => r.product_id !== productId),
        ibom: m.ibom.filter((e) => e.parent_product_id !== productId && e.component_product_id !== productId),
        updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const,
      } : m),
    }));
    db.deleteProduct(modelId, productId);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },

  addOperation: (modelId, op) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, operations: [...m.operations, op], updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.insertOperation(modelId, op);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  updateOperation: (modelId, opId, data) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, operations: m.operations.map((o) => o.id === opId ? { ...o, ...data } : o), updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.updateOperation(opId, data);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  deleteOperation: (modelId, opId) => {
    const model = get().models.find(m => m.id === modelId);
    const op = model?.operations.find(o => o.id === opId);
    set((s) => ({
      models: s.models.map((m) => {
        if (m.id !== modelId) return m;
        const opObj = m.operations.find((o) => o.id === opId);
        const opName = opObj?.op_name || '';
        const productId = opObj?.product_id || '';
        return {
          ...m,
          operations: m.operations.filter((o) => o.id !== opId),
          routing: m.routing.filter((r) => !(r.product_id === productId && (r.from_op_name === opName || r.to_op_name === opName))),
          updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const,
        };
      }),
    }));
    if (op) db.deleteOperation(modelId, opId, op.op_name, op.product_id);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },

  addRouting: (modelId, entry) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, routing: [...m.routing, entry], updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    const model = get().models.find(m => m.id === modelId);
    if (model) db.insertRouting(modelId, entry, model.operations);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  updateRouting: (modelId, entryId, data) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, routing: m.routing.map((r) => r.id === entryId ? { ...r, ...data } : r), updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.updateRouting(entryId, data);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  deleteRouting: (modelId, entryId) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, routing: m.routing.filter((r) => r.id !== entryId), updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.deleteRouting(entryId);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  setRouting: (modelId, productId, entries) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? {
        ...m,
        routing: [...m.routing.filter((r) => r.product_id !== productId), ...entries],
        updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const,
      } : m),
    }));
    const model = get().models.find(m => m.id === modelId);
    if (model) db.setRouting(modelId, productId, entries, model.operations);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },

  addIBOM: (modelId, entry) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, ibom: [...m.ibom, entry], updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.insertIBOM(modelId, entry);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  updateIBOM: (modelId, entryId, data) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, ibom: m.ibom.map((e) => e.id === entryId ? { ...e, ...data } : e), updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.updateIBOM(entryId, data);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  deleteIBOM: (modelId, entryId) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? { ...m, ibom: m.ibom.filter((e) => e.id !== entryId), updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const } : m),
    }));
    db.deleteIBOM(entryId);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
  setIBOMForParent: (modelId, parentId, entries) => {
    set((s) => ({
      models: s.models.map((m) => m.id === modelId ? {
        ...m,
        ibom: [...m.ibom.filter((e) => e.parent_product_id !== parentId), ...entries],
        updated_at: new Date().toISOString(), run_status: 'needs_recalc' as const,
      } : m),
    }));
    db.setIBOMForParent(modelId, parentId, entries);
    db.updateModel(modelId, { run_status: 'needs_recalc' });
  },
}));
