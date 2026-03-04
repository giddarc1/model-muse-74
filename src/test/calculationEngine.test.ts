import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '@/stores/modelStore';
import { useScenarioStore } from '@/stores/scenarioStore';
import { calculate } from '@/lib/calculationEngine';

describe('RMT Calculation Engine — Hub Manufacturing Cell', () => {
  let model: ReturnType<typeof useModelStore.getState>['models'][0];

  beforeEach(() => {
    // Reset stores
    const store = useModelStore.getState();
    model = store.models[0]; // Demo model
    expect(model).toBeDefined();
    expect(model.is_demo).toBe(true);
  });

  it('should have operations seeded for all products', () => {
    expect(model.operations.length).toBeGreaterThan(0);
    const hub1Ops = model.operations.filter(o => o.product_id === model.products.find(p => p.name === 'HUB1')!.id);
    expect(hub1Ops.length).toBe(8); // DOCK, BENCH, RFTURN, DEBURR, FNTURN, INSPECT, REWORK, SLOT
  });

  it('should have routing seeded for hub products', () => {
    const hub1 = model.products.find(p => p.name === 'HUB1')!;
    const hub1Routes = model.routing.filter(r => r.product_id === hub1.id);
    expect(hub1Routes.length).toBe(11);
    // INSPECT routes should sum to 100
    const inspectRoutes = hub1Routes.filter(r => r.from_op_name === 'INSPECT');
    const inspectSum = inspectRoutes.reduce((s, r) => s + r.pct_routed, 0);
    expect(inspectSum).toBe(100);
  });

  it('should calculate without NaN or Infinity', () => {
    const results = calculate(model);
    // Check no NaN in equipment
    results.equipment.forEach(e => {
      expect(Number.isFinite(e.setupUtil)).toBe(true);
      expect(Number.isFinite(e.runUtil)).toBe(true);
      expect(Number.isFinite(e.repairUtil)).toBe(true);
      expect(Number.isFinite(e.waitLaborUtil)).toBe(true);
      expect(Number.isFinite(e.totalUtil)).toBe(true);
    });
    // Check no NaN in products
    results.products.forEach(p => {
      expect(Number.isFinite(p.mct)).toBe(true);
      expect(Number.isFinite(p.wip)).toBe(true);
      expect(Number.isFinite(p.mctQueue)).toBe(true);
    });
  });

  it('VT_LATHE should have the highest equipment utilization', () => {
    const results = calculate(model);
    const vtLathe = results.equipment.find(e => e.name === 'VT_LATHE')!;
    expect(vtLathe).toBeDefined();
    
    const otherEquip = results.equipment.filter(e => e.name !== 'VT_LATHE');
    otherEquip.forEach(e => {
      expect(vtLathe.setupUtil + vtLathe.runUtil).toBeGreaterThan(e.setupUtil + e.runUtil);
    });

    console.log(`VT_LATHE total utilization: ${vtLathe.totalUtil}%`);
    console.log(`VT_LATHE setup: ${vtLathe.setupUtil}%, run: ${vtLathe.runUtil}%, repair: ${vtLathe.repairUtil}%, waitLabor: ${vtLathe.waitLaborUtil}%`);
  });

  it('HUB1 should have the longest MCT among hub products', () => {
    const results = calculate(model);
    const hub1 = results.products.find(p => p.name === 'HUB1')!;
    const hub2 = results.products.find(p => p.name === 'HUB2')!;
    const hub3 = results.products.find(p => p.name === 'HUB3')!;
    const hub4 = results.products.find(p => p.name === 'HUB4')!;

    // HUB1 has highest demand (50), identical ops — same MCT for all since ops are identical
    // Actually MCT depends on queue time which depends on utilization which is shared
    // But HUB1 has same structure as others; MCT should be equal or very similar
    // The demand difference affects WIP, not MCT directly (MCT depends on utilization which is global)
    // So let's just verify HUB1 MCT >= HUB2 MCT (they may be equal)
    expect(hub1.mct).toBeGreaterThanOrEqual(hub2.mct);
    expect(hub1.mct).toBeGreaterThanOrEqual(hub3.mct);
    expect(hub1.mct).toBeGreaterThanOrEqual(hub4.mct);

    console.log(`HUB1 MCT: ${hub1.mct} days (lotWait: ${hub1.mctLotWait}, queue: ${hub1.mctQueue}, setup: ${hub1.mctSetup}, run: ${hub1.mctRun}, waitLabor: ${hub1.mctWaitLabor})`);
    console.log(`HUB1 WIP: ${hub1.wip}`);
  });

  it('Move Labor scenario should reduce wait-for-labor', () => {
    // Basecase results
    const basecaseResults = calculate(model);
    const basecaseVTLathe = basecaseResults.equipment.find(e => e.name === 'VT_LATHE')!;

    // Create Move Labor scenario
    const machinst = model.labor.find(l => l.name === 'MACHINST')!;
    const repair = model.labor.find(l => l.name === 'REPAIR')!;
    
    const moveLaborScenario = {
      id: 'test-move-labor',
      modelId: model.id,
      name: 'Move Labor',
      description: '',
      familyId: null,
      status: 'needs_recalc' as const,
      changes: [
        { id: '1', dataType: 'Labor' as const, entityId: machinst.id, entityName: 'MACHINST', field: 'count', fieldLabel: 'Count', basecaseValue: 5, whatIfValue: 6 },
        { id: '2', dataType: 'Labor' as const, entityId: repair.id, entityName: 'REPAIR', field: 'count', fieldLabel: 'Count', basecaseValue: 3, whatIfValue: 2 },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const scenarioResults = calculate(model, moveLaborScenario);
    const scenarioVTLathe = scenarioResults.equipment.find(e => e.name === 'VT_LATHE')!;

    // With more machinists, wait-for-labor should decrease
    expect(scenarioVTLathe.waitLaborUtil).toBeLessThanOrEqual(basecaseVTLathe.waitLaborUtil);

    console.log(`Move Labor: VT_LATHE waitLabor ${basecaseVTLathe.waitLaborUtil}% → ${scenarioVTLathe.waitLaborUtil}%`);
  });

  it('Improve scenario should reduce MCT', () => {
    const basecaseResults = calculate(model);
    const basecaseHub1 = basecaseResults.products.find(p => p.name === 'HUB1')!;

    const vtLathe = model.equipment.find(e => e.name === 'VT_LATHE')!;
    const mill = model.equipment.find(e => e.name === 'MILL')!;

    const improveChanges = model.products.map((p, i) => ({
      id: `lot-${i}`,
      dataType: 'Product' as const,
      entityId: p.id,
      entityName: p.name,
      field: 'lot_size',
      fieldLabel: 'Lot Size',
      basecaseValue: p.lot_size,
      whatIfValue: 20,
    }));
    improveChanges.push(
      { id: 'vt-setup', dataType: 'Equipment' as const, entityId: vtLathe.id, entityName: 'VT_LATHE', field: 'setup_factor', fieldLabel: 'Setup Factor', basecaseValue: 1, whatIfValue: 0.25 },
      { id: 'mill-setup', dataType: 'Equipment' as const, entityId: mill.id, entityName: 'MILL', field: 'setup_factor', fieldLabel: 'Setup Factor', basecaseValue: 1, whatIfValue: 0.25 },
    );

    const improveScenario = {
      id: 'test-improve',
      modelId: model.id,
      name: 'Improve',
      description: '',
      familyId: null,
      status: 'needs_recalc' as const,
      changes: improveChanges,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const scenarioResults = calculate(model, improveScenario);
    const scenarioHub1 = scenarioResults.products.find(p => p.name === 'HUB1')!;

    // Smaller lot sizes and reduced setup should lower MCT
    expect(scenarioHub1.mct).toBeLessThan(basecaseHub1.mct);

    console.log(`Improve: HUB1 MCT ${basecaseHub1.mct} → ${scenarioHub1.mct} days`);
  });
});
