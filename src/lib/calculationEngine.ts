/**
 * RMT Calculation Engine
 * Implements Rapid Modeling Technology queuing theory formulas for
 * equipment/labor utilization, MCT, WIP, and queue times.
 */

import type { Model, GeneralData, LaborGroup, EquipmentGroup, Product, Operation, RoutingEntry, IBOMEntry } from '@/stores/modelStore';
import type { Scenario, ScenarioChange } from '@/stores/scenarioStore';

// ── Result interfaces ──

export interface EquipmentResult {
  id: string;
  name: string;
  count: number;
  setupUtil: number;
  runUtil: number;
  repairUtil: number;
  waitLaborUtil: number;
  totalUtil: number;
  idle: number;
  laborGroup: string;
}

export interface LaborResult {
  id: string;
  name: string;
  count: number;
  setupUtil: number;
  runUtil: number;
  unavailPct: number;
  totalUtil: number;
  idle: number;
}

export interface ProductResult {
  id: string;
  name: string;
  demand: number;
  lotSize: number;
  goodMade: number;
  goodShipped: number;
  started: number;
  scrap: number;
  wip: number;
  mct: number;
  mctLotWait: number;
  mctQueue: number;
  mctWaitLabor: number;
  mctSetup: number;
  mctRun: number;
}

export interface CalcResults {
  equipment: EquipmentResult[];
  labor: LaborResult[];
  products: ProductResult[];
  warnings: string[];
  errors: string[];
  overLimitResources: string[];
  calculatedAt: string;
}

// ── Helpers ──

/** Apply What-If scenario changes on top of basecase model, returning a virtual model snapshot */
function applyScenario(model: Model, scenario: Scenario | null): Model {
  if (!scenario || scenario.changes.length === 0) return model;
  // Deep clone relevant arrays
  const m: Model = {
    ...model,
    labor: model.labor.map(l => ({ ...l })),
    equipment: model.equipment.map(e => ({ ...e })),
    products: model.products.map(p => ({ ...p })),
    operations: model.operations.map(o => ({ ...o })),
  };
  scenario.changes.forEach(c => {
    if (c.dataType === 'Labor') {
      const item = m.labor.find(l => l.id === c.entityId);
      if (item) (item as any)[c.field] = c.whatIfValue;
    } else if (c.dataType === 'Equipment') {
      const item = m.equipment.find(e => e.id === c.entityId);
      if (item) (item as any)[c.field] = c.whatIfValue;
    } else if (c.dataType === 'Product') {
      const item = m.products.find(p => p.id === c.entityId);
      if (item) (item as any)[c.field] = c.whatIfValue;
    }
  });
  return m;
}

/** Compute IBOM-driven demand: total demand for each product including component demand from parents */
function computeEffectiveDemand(
  products: Product[],
  ibom: IBOMEntry[],
  conv2: number, // MCT units per prod period (e.g. 210 days/year)
): Map<string, number> {
  // Build adjacency: parent → [{componentId, unitsPerAssy}]
  const children = new Map<string, { componentId: string; unitsPerAssy: number }[]>();
  ibom.forEach(entry => {
    const list = children.get(entry.parent_product_id) || [];
    list.push({ componentId: entry.component_product_id, unitsPerAssy: entry.units_per_assy });
    children.set(entry.parent_product_id, list);
  });

  // Start with end demand × demand_factor for each product
  const demand = new Map<string, number>();
  products.forEach(p => {
    const d = p.demand * p.demand_factor;
    demand.set(p.id, d);
  });

  // Topological propagation: parents push demand down to components
  // Simple iterative approach (works for DAGs without circular refs)
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const kids = children.get(id) || [];
    kids.forEach(k => visit(k.componentId));
    order.push(id);
  }
  products.forEach(p => visit(p.id));
  order.reverse(); // parents first

  order.forEach(parentId => {
    const parentDemand = demand.get(parentId) || 0;
    const kids = children.get(parentId) || [];
    kids.forEach(k => {
      const prev = demand.get(k.componentId) || 0;
      demand.set(k.componentId, prev + parentDemand * k.unitsPerAssy);
    });
  });

  return demand;
}

// ── Main calculation ──

export function calculate(model: Model, scenario: Scenario | null = null): CalcResults {
  const m = applyScenario(model, scenario);
  const g = m.general;
  const warnings: string[] = [];
  const errors: string[] = [];

  // Time conversions
  const conv1 = g.conv1; // ops time units per MCT time unit (e.g. 480 min/day)
  const conv2 = g.conv2; // MCT time units per prod period (e.g. 210 days/year)
  const opsPerPeriod = conv1 * conv2; // total ops time units per production period

  // Effective demand per product (units per production period, including IBOM propagation)
  const effectiveDemand = computeEffectiveDemand(m.products, m.ibom, conv2);

  // ── Equipment utilization ──
  const equipResults: EquipmentResult[] = [];
  const equipUtilMap = new Map<string, number>(); // equipId → total utilization fraction (0-1)

  m.equipment.forEach(eq => {
    const isDelay = eq.equip_type === 'delay';
    const count = isDelay ? 1 : eq.count;
    if (count <= 0 && !isDelay) {
      equipResults.push({
        id: eq.id, name: eq.name, count: eq.count,
        setupUtil: 0, runUtil: 0, repairUtil: 0, waitLaborUtil: 0, totalUtil: 0, idle: 100,
        laborGroup: '',
      });
      equipUtilMap.set(eq.id, 0);
      return;
    }

    const overtimeFactor = 1 + eq.overtime_pct / 100;
    const availableTime = count * overtimeFactor * opsPerPeriod * eq.setup_factor; // in ops time units per period
    // Actually: available time = count * (1 + OT%) * conv1 * conv2
    const availTime = count * overtimeFactor * opsPerPeriod;

    // Repair utilization
    let repairFraction = 0;
    if (eq.mttf > 0 && eq.mttr > 0) {
      repairFraction = eq.mttr / (eq.mttf + eq.mttr);
    }
    const effectiveAvailTime = availTime * (1 - repairFraction);

    // Sum setup and run demands from all operations assigned to this equipment
    let totalSetupTime = 0;
    let totalRunTime = 0;

    m.operations.forEach(op => {
      if (op.equip_id !== eq.id) return;
      const product = m.products.find(p => p.id === op.product_id);
      if (!product) return;

      const demand = effectiveDemand.get(product.id) || 0;
      if (demand <= 0) return;

      const lotSize = Math.max(1, product.lot_size * product.lot_factor);
      const assignFraction = op.pct_assigned / 100;
      const numLots = (demand / lotSize) * assignFraction;

      // Setup time per lot (in ops time units)
      const setupPerLot = op.equip_setup_lot * eq.setup_factor;
      // Run time per piece (in ops time units)  
      const runPerPiece = op.equip_run_piece * eq.run_factor;

      totalSetupTime += numLots * setupPerLot;
      totalRunTime += demand * assignFraction * runPerPiece;
    });

    const setupUtil = effectiveAvailTime > 0 ? (totalSetupTime / effectiveAvailTime) * 100 : 0;
    const runUtil = effectiveAvailTime > 0 ? (totalRunTime / effectiveAvailTime) * 100 : 0;
    const repairUtil = repairFraction * 100;
    
    // Wait-for-labor is computed after labor utilization
    const baseTotal = setupUtil + runUtil + repairUtil;
    equipUtilMap.set(eq.id, baseTotal / 100);

    const labor = m.labor.find(l => l.id === eq.labor_group_id);

    equipResults.push({
      id: eq.id, name: eq.name, count: eq.count,
      setupUtil: Math.round(setupUtil * 10) / 10,
      runUtil: Math.round(runUtil * 10) / 10,
      repairUtil: Math.round(repairUtil * 10) / 10,
      waitLaborUtil: 0, // filled in below
      totalUtil: 0,
      idle: 0,
      laborGroup: labor?.name || '',
    });
  });

  // ── Labor utilization ──
  const laborResults: LaborResult[] = [];
  const laborUtilMap = new Map<string, number>();

  m.labor.forEach(lab => {
    if (lab.count <= 0) {
      laborResults.push({
        id: lab.id, name: lab.name, count: lab.count,
        setupUtil: 0, runUtil: 0, unavailPct: lab.unavail_pct, totalUtil: lab.unavail_pct, idle: 100 - lab.unavail_pct,
      });
      laborUtilMap.set(lab.id, 0);
      return;
    }

    const overtimeFactor = 1 + lab.overtime_pct / 100;
    const unavailFactor = 1 - lab.unavail_pct / 100;
    const availTime = lab.count * overtimeFactor * unavailFactor * opsPerPeriod;

    let totalSetupTime = 0;
    let totalRunTime = 0;

    m.operations.forEach(op => {
      const eq = m.equipment.find(e => e.id === op.equip_id);
      if (!eq || eq.labor_group_id !== lab.id) return;

      const product = m.products.find(p => p.id === op.product_id);
      if (!product) return;

      const demand = effectiveDemand.get(product.id) || 0;
      if (demand <= 0) return;

      const lotSize = Math.max(1, product.lot_size * product.lot_factor);
      const assignFraction = op.pct_assigned / 100;
      const numLots = (demand / lotSize) * assignFraction;

      const setupPerLot = op.labor_setup_lot * lab.setup_factor;
      const runPerPiece = op.labor_run_piece * lab.run_factor;

      totalSetupTime += numLots * setupPerLot;
      totalRunTime += demand * assignFraction * runPerPiece;
    });

    const setupUtil = availTime > 0 ? (totalSetupTime / availTime) * 100 : 0;
    const runUtil = availTime > 0 ? (totalRunTime / availTime) * 100 : 0;
    const workUtil = setupUtil + runUtil;
    laborUtilMap.set(lab.id, workUtil / 100);

    laborResults.push({
      id: lab.id, name: lab.name, count: lab.count,
      setupUtil: Math.round(setupUtil * 10) / 10,
      runUtil: Math.round(runUtil * 10) / 10,
      unavailPct: lab.unavail_pct,
      totalUtil: Math.round((workUtil + lab.unavail_pct) * 10) / 10,
      idle: Math.round((100 - workUtil - lab.unavail_pct) * 10) / 10,
    });
  });

  // ── Wait-for-labor on equipment ──
  equipResults.forEach(er => {
    const eq = m.equipment.find(e => e.id === er.id);
    if (!eq || !eq.labor_group_id) return;
    const laborUtil = laborUtilMap.get(eq.labor_group_id) || 0;
    // Wait-for-labor approximation: proportional to labor utilization squared
    // WFL ≈ U_labor^2 / (1 - U_labor) × scaling, capped
    const safeLU = Math.min(laborUtil, 0.98);
    const wfl = safeLU > 0 ? (safeLU * safeLU / (1 - safeLU)) * (er.setupUtil + er.runUtil) / 100 * 15 : 0;
    er.waitLaborUtil = Math.round(Math.min(wfl, 30) * 10) / 10;
    er.totalUtil = Math.round((er.setupUtil + er.runUtil + er.repairUtil + er.waitLaborUtil) * 10) / 10;
    er.idle = Math.round(Math.max(0, 100 - er.totalUtil) * 10) / 10;
    // Update utilMap
    equipUtilMap.set(er.id, er.totalUtil / 100);
  });

  // ── Product MCT ──
  const productResults: ProductResult[] = [];
  const variabilityEq = (g.var_equip / 100);
  const variabilityLab = (g.var_labor / 100);
  const variabilityProd = (g.var_prod / 100);

  m.products.forEach(product => {
    const demand = effectiveDemand.get(product.id) || 0;
    const lotSize = Math.max(1, product.lot_size * product.lot_factor);
    const tbatchSize = product.tbatch_size === -1 ? lotSize : Math.max(1, product.tbatch_size);

    // Get operations for this product
    const ops = m.operations.filter(o => o.product_id === product.id);

    if (ops.length === 0 || demand <= 0) {
      // No operations or no demand — product has minimal MCT
      productResults.push({
        id: product.id, name: product.name, demand, lotSize,
        goodMade: Math.round(demand), goodShipped: Math.round(product.demand * product.demand_factor),
        started: Math.round(demand), scrap: 0, wip: 0, mct: 0,
        mctLotWait: 0, mctQueue: 0, mctWaitLabor: 0, mctSetup: 0, mctRun: 0,
      });
      return;
    }

    let totalSetupMCT = 0;
    let totalRunMCT = 0;
    let totalQueueMCT = 0;
    let totalLotWaitMCT = 0;
    let totalWaitLaborMCT = 0;
    let totalScrapFraction = 0;

    // Process each operation
    ops.forEach(op => {
      const eq = m.equipment.find(e => e.id === op.equip_id);
      if (!eq) return;

      const assignFrac = op.pct_assigned / 100;
      if (assignFrac <= 0) return;

      // Setup contribution to MCT (in ops time units, per lot)
      const setupTime = (op.equip_setup_lot * eq.setup_factor) / lotSize; // per piece
      const runTime = op.equip_run_piece * eq.run_factor;

      // Convert to MCT time units
      const setupMCT = (setupTime / conv1) * assignFrac;
      const runMCT = (runTime / conv1) * assignFrac;

      totalSetupMCT += setupMCT;
      totalRunMCT += runMCT;

      // Lot waiting: (lotSize - tbatchSize) / lotSize * runTime per piece * lotSize / conv1
      // Simplified: (lotSize - tbatchSize) * runTime / conv1
      if (product.gather_tbatches && tbatchSize < lotSize) {
        const lotWait = ((lotSize - tbatchSize) * runTime) / conv1 * assignFrac;
        totalLotWaitMCT += lotWait;
      }

      // Queue time — Kingman's formula: Wq = (Ca² + Cs²)/2 × U/(1-U) × meanServiceTime
      const equipUtil = equipUtilMap.get(eq.id) || 0;
      const safeUtil = Math.min(equipUtil, 0.99);
      if (safeUtil > 0 && eq.equip_type !== 'delay') {
        const Ca2 = variabilityProd * variabilityProd * product.var_factor * product.var_factor;
        const Cs2 = variabilityEq * variabilityEq * eq.var_factor * eq.var_factor;
        const meanService = (setupTime + runTime) / conv1;
        const queueTime = ((Ca2 + Cs2) / 2) * (safeUtil / (1 - safeUtil)) * meanService * assignFrac;
        totalQueueMCT += Math.max(0, queueTime);
      }

      // Wait-for-labor contribution
      if (eq.labor_group_id) {
        const laborUtil = laborUtilMap.get(eq.labor_group_id) || 0;
        const safeLU = Math.min(laborUtil, 0.98);
        if (safeLU > 0) {
          const laborWait = (safeLU * safeLU / (1 - safeLU)) * (runTime / conv1) * 0.5 * assignFrac;
          totalWaitLaborMCT += Math.max(0, laborWait);
        }
      }
    });

    // Routing-based scrap: look for routes to SCRAP
    const routesForProduct = m.routing.filter(r => r.product_id === product.id);
    routesForProduct.forEach(r => {
      if (r.to_op_name === 'SCRAP') {
        totalScrapFraction += r.pct_routed / 100;
      }
    });
    // Approximate: scrap is fraction of started pieces
    const scrapRate = Math.min(totalScrapFraction, 0.5);

    const totalMCT = totalSetupMCT + totalRunMCT + totalQueueMCT + totalLotWaitMCT + totalWaitLaborMCT;
    const goodMade = Math.round(demand);
    const started = scrapRate > 0 ? Math.round(demand / (1 - scrapRate)) : goodMade;
    const scrap = started - goodMade;
    // WIP via Little's Law: WIP = demand_rate × MCT
    // demand_rate = demand per MCT-time-unit = demand / conv2
    const demandRate = demand / conv2;
    const wip = Math.max(0, Math.round(demandRate * totalMCT * 10) / 10);

    productResults.push({
      id: product.id, name: product.name, demand, lotSize,
      goodMade, goodShipped: Math.round(product.demand * product.demand_factor),
      started, scrap, wip,
      mct: Math.round(totalMCT * 100) / 100,
      mctLotWait: Math.round(totalLotWaitMCT * 100) / 100,
      mctQueue: Math.round(totalQueueMCT * 100) / 100,
      mctWaitLabor: Math.round(totalWaitLaborMCT * 100) / 100,
      mctSetup: Math.round(totalSetupMCT * 100) / 100,
      mctRun: Math.round(totalRunMCT * 100) / 100,
    });
  });

  // ── Over-limit warnings ──
  const overLimitResources: string[] = [];
  equipResults.forEach(er => {
    if (er.totalUtil > g.util_limit) {
      overLimitResources.push(`Equipment: ${er.name} (${er.totalUtil}%)`);
      warnings.push(`Equipment group "${er.name}" utilization (${er.totalUtil}%) exceeds limit (${g.util_limit}%)`);
    }
  });
  laborResults.forEach(lr => {
    if (lr.totalUtil > g.util_limit) {
      overLimitResources.push(`Labor: ${lr.name} (${lr.totalUtil}%)`);
      warnings.push(`Labor group "${lr.name}" utilization (${lr.totalUtil}%) exceeds limit (${g.util_limit}%)`);
    }
  });

  // Validation errors
  if (m.operations.length === 0) {
    errors.push('No operations defined. Add operations to products before running calculations.');
  }

  return {
    equipment: equipResults,
    labor: laborResults,
    products: productResults,
    warnings,
    errors,
    overLimitResources,
    calculatedAt: new Date().toISOString(),
  };
}

/** Verify data only — check for errors without full calculation */
export function verifyData(model: Model): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (model.labor.length === 0) warnings.push('No labor groups defined.');
  if (model.equipment.length === 0) warnings.push('No equipment groups defined.');
  if (model.products.length === 0) errors.push('No products defined.');
  if (model.operations.length === 0) errors.push('No operations defined for any product.');

  // Check equipment references valid labor
  model.equipment.forEach(eq => {
    if (eq.labor_group_id && !model.labor.find(l => l.id === eq.labor_group_id)) {
      errors.push(`Equipment "${eq.name}" references non-existent labor group.`);
    }
  });

  // Check operations reference valid equipment
  model.operations.forEach(op => {
    if (!model.equipment.find(e => e.id === op.equip_id)) {
      errors.push(`Operation "${op.op_name}" references non-existent equipment.`);
    }
  });

  // Check products with demand but no operations
  model.products.forEach(p => {
    if (p.demand > 0 && !model.operations.find(o => o.product_id === p.id)) {
      warnings.push(`Product "${p.name}" has demand but no operations.`);
    }
  });

  // Check routing percentages sum to 100
  const productIds = [...new Set(model.routing.map(r => r.product_id))];
  productIds.forEach(pid => {
    const routes = model.routing.filter(r => r.product_id === pid);
    const fromOps = [...new Set(routes.map(r => r.from_op_name))];
    fromOps.forEach(fromOp => {
      const outgoing = routes.filter(r => r.from_op_name === fromOp);
      const total = outgoing.reduce((s, r) => s + r.pct_routed, 0);
      if (Math.abs(total - 100) > 0.1) {
        const product = model.products.find(p => p.id === pid);
        warnings.push(`Product "${product?.name}": routing from "${fromOp}" sums to ${total}%, not 100%.`);
      }
    });
  });

  return { errors, warnings };
}
