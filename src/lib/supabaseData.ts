import { supabase } from '@/integrations/supabase/client';
import type { Model, LaborGroup, EquipmentGroup, Product, Operation, RoutingEntry, IBOMEntry, GeneralData, ParamNames } from '@/stores/modelStore';
import { defaultParamNames } from '@/stores/modelStore';

// ─── Fetch all models with child data ───────────────────────────────
export async function fetchAllModels(): Promise<Model[]> {
  const { data: models, error } = await supabase.from('models').select('*');
  if (error) { console.error('fetchModels error:', error); return []; }
  if (!models?.length) return [];

  const ids = models.map(m => m.id);

  const [generalRes, laborRes, equipRes, prodRes, opsRes, routingRes, ibomRes, paramNamesRes] = await Promise.all([
    supabase.from('model_general').select('*').in('model_id', ids),
    supabase.from('model_labor').select('*').in('model_id', ids),
    supabase.from('model_equipment').select('*').in('model_id', ids),
    supabase.from('model_products').select('*').in('model_id', ids),
    supabase.from('model_operations').select('*').in('model_id', ids),
    supabase.from('model_routing').select('*').in('model_id', ids),
    supabase.from('model_ibom').select('*').in('model_id', ids),
    supabase.from('model_param_names').select('*').in('model_id', ids),
  ]);

  const group = <T extends { model_id: string }>(items: T[] | null) => {
    const map: Record<string, T[]> = {};
    (items || []).forEach(i => { (map[i.model_id] ||= []).push(i); });
    return map;
  };

  const generalByModel = Object.fromEntries((generalRes.data || []).map(g => [g.model_id, g]));
  const paramNamesByModel = Object.fromEntries((paramNamesRes.data || []).map(p => [p.model_id, p]));
  const laborByModel = group(laborRes.data);
  const equipByModel = group(equipRes.data);
  const prodByModel = group(prodRes.data);
  const opsByModel = group(opsRes.data);
  const routingByModel = group(routingRes.data);
  const ibomByModel = group(ibomRes.data);

  return models.map(m => {
    const g = generalByModel[m.id];
    const ops = opsByModel[m.id] || [];
    const opIdToName: Record<string, string> = {};
    ops.forEach(o => { opIdToName[o.id] = o.op_name; });

    const routing = (routingByModel[m.id] || []).map(r => ({
      id: r.id,
      product_id: r.product_id,
      from_op_name: r.from_op_id ? (opIdToName[r.from_op_id] || '') : '',
      to_op_name: r.to_op_name,
      pct_routed: Number(r.pct_routed),
    }));

    return {
      id: m.id,
      name: m.name,
      description: m.description || '',
      tags: m.tags || [],
      created_at: m.created_at || new Date().toISOString(),
      updated_at: m.updated_at || new Date().toISOString(),
      last_run_at: m.last_run_at,
      run_status: (m.run_status || 'never_run') as Model['run_status'],
      is_archived: m.is_archived || false,
      is_demo: m.is_demo || false,
      is_starred: m.is_starred || false,
      general: g ? {
        model_title: g.model_title || '',
        ops_time_unit: (g.ops_time_unit || 'MIN') as GeneralData['ops_time_unit'],
        mct_time_unit: (g.mct_time_unit || 'DAY') as GeneralData['mct_time_unit'],
        prod_period_unit: (g.prod_period_unit || 'YEAR') as GeneralData['prod_period_unit'],
        conv1: Number(g.conv1 ?? 480),
        conv2: Number(g.conv2 ?? 210),
        util_limit: Number(g.util_limit ?? 95),
        var_equip: Number(g.var_equip ?? 30),
        var_labor: Number(g.var_labor ?? 30),
        var_prod: Number(g.var_prod ?? 30),
        gen1: Number(g.gen1 ?? 0),
        gen2: Number(g.gen2 ?? 0),
        gen3: Number(g.gen3 ?? 0),
        gen4: Number(g.gen4 ?? 0),
        author: g.author || '',
        comments: g.comments || '',
      } : defaultGeneral(m.name),
      param_names: (() => {
        const pn = paramNamesByModel[m.id];
        if (!pn) return { ...defaultParamNames };
        return {
          gen1_name: pn.gen1_name || 'Gen1', gen2_name: pn.gen2_name || 'Gen2',
          gen3_name: pn.gen3_name || 'Gen3', gen4_name: pn.gen4_name || 'Gen4',
          lab1_name: pn.lab1_name || 'Lab1', lab2_name: pn.lab2_name || 'Lab2',
          lab3_name: pn.lab3_name || 'Lab3', lab4_name: pn.lab4_name || 'Lab4',
          eq1_name: pn.eq1_name || 'Eq1', eq2_name: pn.eq2_name || 'Eq2',
          eq3_name: pn.eq3_name || 'Eq3', eq4_name: pn.eq4_name || 'Eq4',
          prod1_name: pn.prod1_name || 'Prod1', prod2_name: pn.prod2_name || 'Prod2',
          prod3_name: pn.prod3_name || 'Prod3', prod4_name: pn.prod4_name || 'Prod4',
          oper1_name: pn.oper1_name || 'Oper1', oper2_name: pn.oper2_name || 'Oper2',
          oper3_name: pn.oper3_name || 'Oper3', oper4_name: pn.oper4_name || 'Oper4',
        } as ParamNames;
      })(),
      labor: (laborByModel[m.id] || []).map(l => ({
        id: l.id, name: l.name,
        count: l.count ?? 1,
        overtime_pct: Number(l.overtime_pct ?? 0),
        unavail_pct: Number(l.unavail_pct ?? 0),
        dept_code: l.dept_code || '',
        prioritize_use: l.prioritize_use || false,
        setup_factor: Number(l.setup_factor ?? 1),
        run_factor: Number(l.run_factor ?? 1),
        var_factor: Number(l.var_factor ?? 1),
        lab1: Number(l.lab1 ?? 0),
        lab2: Number(l.lab2 ?? 0),
        lab3: Number(l.lab3 ?? 0),
        lab4: Number(l.lab4 ?? 0),
        comments: l.comments || '',
      })),
      equipment: (equipByModel[m.id] || []).map(e => ({
        id: e.id, name: e.name,
        equip_type: (e.equip_type || 'standard') as EquipmentGroup['equip_type'],
        count: e.count ?? 1,
        mttf: Number(e.mttf ?? 0),
        mttr: Number(e.mttr ?? 0),
        overtime_pct: Number(e.overtime_pct ?? 0),
        labor_group_id: e.labor_group_id || '',
        dept_code: e.dept_code || '',
        out_of_area: (e as any).out_of_area || false,
        unavail_pct: Number((e as any).unavail_pct ?? 0),
        setup_factor: Number(e.setup_factor ?? 1),
        run_factor: Number(e.run_factor ?? 1),
        var_factor: Number(e.var_factor ?? 1),
        comments: e.comments || '',
      })),
      products: (prodByModel[m.id] || []).map(p => ({
        id: p.id, name: p.name,
        demand: Number(p.demand ?? 0),
        lot_size: Number(p.lot_size ?? 1),
        tbatch_size: Number(p.tbatch_size ?? -1),
        demand_factor: Number(p.demand_factor ?? 1),
        lot_factor: Number(p.lot_factor ?? 1),
        var_factor: Number(p.var_factor ?? 1),
        setup_factor: Number((p as any).setup_factor ?? 1),
        make_to_stock: p.make_to_stock || false,
        gather_tbatches: p.gather_tbatches ?? true,
        dept_code: (p as any).dept_code || '',
        comments: p.comments || '',
      })),
      operations: ops.map(o => ({
        id: o.id,
        product_id: o.product_id,
        op_name: o.op_name,
        op_number: o.op_number ?? 0,
        equip_id: o.equip_id || '',
        pct_assigned: Number(o.pct_assigned ?? 100),
        equip_setup_lot: Number(o.equip_setup_lot ?? 0),
        equip_setup_piece: Number(o.equip_setup_piece ?? 0),
        equip_setup_tbatch: Number(o.equip_setup_tbatch ?? 0),
        equip_run_piece: Number(o.equip_run_piece ?? 0),
        equip_run_lot: Number(o.equip_run_lot ?? 0),
        equip_run_tbatch: Number(o.equip_run_tbatch ?? 0),
        labor_setup_lot: Number(o.labor_setup_lot ?? 0),
        labor_setup_piece: Number(o.labor_setup_piece ?? 0),
        labor_setup_tbatch: Number(o.labor_setup_tbatch ?? 0),
        labor_run_piece: Number(o.labor_run_piece ?? 0),
        labor_run_lot: Number(o.labor_run_lot ?? 0),
        labor_run_tbatch: Number(o.labor_run_tbatch ?? 0),
      })),
      routing,
      ibom: (ibomByModel[m.id] || []).map(i => ({
        id: i.id,
        parent_product_id: i.parent_product_id,
        component_product_id: i.component_product_id,
        units_per_assy: Number(i.units_per_assy ?? 1),
      })),
    } satisfies Model;
  });
}

function defaultGeneral(name: string): GeneralData {
  return {
    model_title: name, ops_time_unit: 'MIN', mct_time_unit: 'DAY', prod_period_unit: 'YEAR',
    conv1: 480, conv2: 210, util_limit: 95, var_equip: 30, var_labor: 30, var_prod: 30,
    author: '', comments: '',
  };
}

// ─── Get current user's org_id ──────────────────────────────────────
async function getOrgId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_my_org_id');
  return data as string | null;
}

// ─── Save full model to DB ──────────────────────────────────────────
export async function saveFullModelToDB(model: Model): Promise<void> {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('No org found');

  // Insert model
  const { error: mErr } = await supabase.from('models').insert({
    id: model.id, name: model.name, description: model.description,
    tags: model.tags, org_id: orgId, is_demo: model.is_demo,
    run_status: model.run_status, is_archived: model.is_archived,
  });
  if (mErr) throw mErr;

  // Insert general
  await supabase.from('model_general').insert({
    model_id: model.id,
    model_title: model.general.model_title,
    ops_time_unit: model.general.ops_time_unit,
    mct_time_unit: model.general.mct_time_unit,
    prod_period_unit: model.general.prod_period_unit,
    conv1: model.general.conv1, conv2: model.general.conv2,
    util_limit: model.general.util_limit,
    var_equip: model.general.var_equip, var_labor: model.general.var_labor, var_prod: model.general.var_prod,
    author: model.general.author, comments: model.general.comments,
  });

  // Insert child data in parallel
  const inserts: any[] = [];

  if (model.labor.length) {
    inserts.push(supabase.from('model_labor').insert(

      model.labor.map(l => ({
        id: l.id, model_id: model.id, name: l.name, count: l.count,
        overtime_pct: l.overtime_pct, unavail_pct: l.unavail_pct, dept_code: l.dept_code || null,
        prioritize_use: l.prioritize_use,
        setup_factor: l.setup_factor, run_factor: l.run_factor, var_factor: l.var_factor,
        comments: l.comments || null,
      }))
    ).select());
  }

  if (model.equipment.length) {
    inserts.push(supabase.from('model_equipment').insert(
      model.equipment.map(e => ({
        id: e.id, model_id: model.id, name: e.name, equip_type: e.equip_type, count: e.count,
        mttf: e.mttf || null, mttr: e.mttr || null, overtime_pct: e.overtime_pct,
        labor_group_id: e.labor_group_id || null, dept_code: e.dept_code || null,
        out_of_area: e.out_of_area, unavail_pct: e.unavail_pct,
        setup_factor: e.setup_factor, run_factor: e.run_factor, var_factor: e.var_factor,
        comments: e.comments || null,
      }))
    ).select());
  }

  if (model.products.length) {
    inserts.push(supabase.from('model_products').insert(
      model.products.map(p => ({
        id: p.id, model_id: model.id, name: p.name, demand: p.demand,
        lot_size: p.lot_size, tbatch_size: p.tbatch_size,
        demand_factor: p.demand_factor, lot_factor: p.lot_factor, var_factor: p.var_factor,
        setup_factor: p.setup_factor,
        make_to_stock: p.make_to_stock, gather_tbatches: p.gather_tbatches,
        dept_code: p.dept_code || null,
        comments: p.comments || null,
      }))
    ).select());
  }

  if (model.operations.length) {
    inserts.push(supabase.from('model_operations').insert(
      model.operations.map(o => ({
        id: o.id, model_id: model.id, product_id: o.product_id, op_name: o.op_name,
        op_number: o.op_number, equip_id: o.equip_id || null, pct_assigned: o.pct_assigned,
        equip_setup_lot: o.equip_setup_lot, equip_setup_piece: o.equip_setup_piece, equip_setup_tbatch: o.equip_setup_tbatch,
        equip_run_piece: o.equip_run_piece, equip_run_lot: o.equip_run_lot, equip_run_tbatch: o.equip_run_tbatch,
        labor_setup_lot: o.labor_setup_lot, labor_setup_piece: o.labor_setup_piece, labor_setup_tbatch: o.labor_setup_tbatch,
        labor_run_piece: o.labor_run_piece, labor_run_lot: o.labor_run_lot, labor_run_tbatch: o.labor_run_tbatch,
      }))
    ).select());
  }

  await Promise.all(inserts);

  // Routing needs operation IDs resolved — operations must be inserted first
  if (model.routing.length) {
    // Build (product_id, op_name) → op.id
    const opKey = (pid: string, name: string) => `${pid}__${name}`;
    const opMap: Record<string, string> = {};
    model.operations.forEach(o => { opMap[opKey(o.product_id, o.op_name)] = o.id; });

    const routingRows = model.routing.map(r => ({
      id: r.id, model_id: model.id, product_id: r.product_id,
      from_op_id: opMap[opKey(r.product_id, r.from_op_name)] || null,
      to_op_name: r.to_op_name, pct_routed: r.pct_routed,
    })).filter(r => r.from_op_id); // skip if no matching operation

    if (routingRows.length) {
      await supabase.from('model_routing').insert(routingRows);
    }
  }

  if (model.ibom.length) {
    await supabase.from('model_ibom').insert(
      model.ibom.map(i => ({
        id: i.id, model_id: model.id,
        parent_product_id: i.parent_product_id,
        component_product_id: i.component_product_id,
        units_per_assy: i.units_per_assy,
      }))
    );
  }
}

// ─── Seed demo model ────────────────────────────────────────────────
export async function seedDemoModelToDB(): Promise<void> {
  // Import createDemoModel dynamically to avoid circular deps
  const { createDemoModel } = await import('@/stores/modelStore');
  const demo = createDemoModel();
  await saveFullModelToDB(demo);
}

// ─── Individual CRUD operations (fire-and-forget with error logging) ─

export const db = {
  // Models
  async updateModel(id: string, data: Record<string, any>) {
    const { error } = await supabase.from('models').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) console.error('updateModel:', error);
  },
  async deleteModel(id: string) {
    // Delete children first (cascade may handle this but be explicit)
    await Promise.all([
      supabase.from('model_routing').delete().eq('model_id', id),
      supabase.from('model_ibom').delete().eq('model_id', id),
      supabase.from('model_operations').delete().eq('model_id', id),
    ]);
    await Promise.all([
      supabase.from('model_labor').delete().eq('model_id', id),
      supabase.from('model_equipment').delete().eq('model_id', id),
      supabase.from('model_products').delete().eq('model_id', id),
      supabase.from('model_general').delete().eq('model_id', id),
    ]);
    const { error } = await supabase.from('models').delete().eq('id', id);
    if (error) console.error('deleteModel:', error);
  },

  // General
  async updateGeneral(modelId: string, data: Partial<GeneralData>) {
    const { error } = await supabase.from('model_general').update(data).eq('model_id', modelId);
    if (error) console.error('updateGeneral:', error);
  },

  // Labor
  async insertLabor(modelId: string, l: LaborGroup) {
    const { error } = await supabase.from('model_labor').insert({
      id: l.id, model_id: modelId, name: l.name, count: l.count,
      overtime_pct: l.overtime_pct, unavail_pct: l.unavail_pct, dept_code: l.dept_code || null,
      prioritize_use: l.prioritize_use,
      setup_factor: l.setup_factor, run_factor: l.run_factor, var_factor: l.var_factor,
      comments: l.comments || null,
    });
    if (error) console.error('insertLabor:', error);
  },
  async updateLabor(id: string, data: Partial<LaborGroup>) {
    const { error } = await supabase.from('model_labor').update(data).eq('id', id);
    if (error) console.error('updateLabor:', error);
  },
  async deleteLabor(id: string) {
    // Clear references from equipment
    await supabase.from('model_equipment').update({ labor_group_id: null }).eq('labor_group_id', id);
    const { error } = await supabase.from('model_labor').delete().eq('id', id);
    if (error) console.error('deleteLabor:', error);
  },

  // Equipment
  async insertEquipment(modelId: string, e: EquipmentGroup) {
    const { error } = await supabase.from('model_equipment').insert({
      id: e.id, model_id: modelId, name: e.name, equip_type: e.equip_type, count: e.count,
      mttf: e.mttf || null, mttr: e.mttr || null, overtime_pct: e.overtime_pct,
      labor_group_id: e.labor_group_id || null, dept_code: e.dept_code || null,
      out_of_area: e.out_of_area, unavail_pct: e.unavail_pct,
      setup_factor: e.setup_factor, run_factor: e.run_factor, var_factor: e.var_factor,
      comments: e.comments || null,
    });
    if (error) console.error('insertEquipment:', error);
  },
  async updateEquipment(id: string, data: Partial<EquipmentGroup>) {
    const mapped: Record<string, any> = { ...data };
    if ('labor_group_id' in mapped) mapped.labor_group_id = mapped.labor_group_id || null;
    const { error } = await supabase.from('model_equipment').update(mapped).eq('id', id);
    if (error) console.error('updateEquipment:', error);
  },
  async deleteEquipment(id: string) {
    await supabase.from('model_operations').update({ equip_id: null }).eq('equip_id', id);
    const { error } = await supabase.from('model_equipment').delete().eq('id', id);
    if (error) console.error('deleteEquipment:', error);
  },

  // Products
  async insertProduct(modelId: string, p: Product) {
    const { error } = await supabase.from('model_products').insert({
      id: p.id, model_id: modelId, name: p.name, demand: p.demand,
      lot_size: p.lot_size, tbatch_size: p.tbatch_size,
      demand_factor: p.demand_factor, lot_factor: p.lot_factor, var_factor: p.var_factor,
      setup_factor: p.setup_factor,
      make_to_stock: p.make_to_stock, gather_tbatches: p.gather_tbatches,
      dept_code: p.dept_code || null,
      comments: p.comments || null,
    });
    if (error) console.error('insertProduct:', error);
  },
  async updateProduct(id: string, data: Partial<Product>) {
    const { error } = await supabase.from('model_products').update(data).eq('id', id);
    if (error) console.error('updateProduct:', error);
  },
  async deleteProduct(modelId: string, productId: string) {
    await Promise.all([
      supabase.from('model_routing').delete().eq('product_id', productId).eq('model_id', modelId),
      supabase.from('model_ibom').delete().eq('model_id', modelId).or(`parent_product_id.eq.${productId},component_product_id.eq.${productId}`),
      supabase.from('model_operations').delete().eq('product_id', productId).eq('model_id', modelId),
    ]);
    const { error } = await supabase.from('model_products').delete().eq('id', productId);
    if (error) console.error('deleteProduct:', error);
  },

  // Operations
  async insertOperation(modelId: string, o: Operation) {
    const { error } = await supabase.from('model_operations').insert({
      id: o.id, model_id: modelId, product_id: o.product_id, op_name: o.op_name,
      op_number: o.op_number, equip_id: o.equip_id || null, pct_assigned: o.pct_assigned,
      equip_setup_lot: o.equip_setup_lot, equip_setup_piece: o.equip_setup_piece, equip_setup_tbatch: o.equip_setup_tbatch,
      equip_run_piece: o.equip_run_piece, equip_run_lot: o.equip_run_lot, equip_run_tbatch: o.equip_run_tbatch,
      labor_setup_lot: o.labor_setup_lot, labor_setup_piece: o.labor_setup_piece, labor_setup_tbatch: o.labor_setup_tbatch,
      labor_run_piece: o.labor_run_piece, labor_run_lot: o.labor_run_lot, labor_run_tbatch: o.labor_run_tbatch,
    });
    if (error) console.error('insertOperation:', error);
  },
  async updateOperation(id: string, data: Partial<Operation>) {
    const mapped: Record<string, any> = { ...data };
    if ('equip_id' in mapped) mapped.equip_id = mapped.equip_id || null;
    const { error } = await supabase.from('model_operations').update(mapped).eq('id', id);
    if (error) console.error('updateOperation:', error);
  },
  async deleteOperation(modelId: string, opId: string, opName: string, productId: string) {
    // Delete routing referencing this op
    const { data: ops } = await supabase.from('model_operations').select('id').eq('model_id', modelId).eq('op_name', opName).eq('product_id', productId);
    if (ops?.length) {
      await supabase.from('model_routing').delete().in('from_op_id', ops.map(o => o.id));
    }
    // Also delete routing where to_op_name matches
    await supabase.from('model_routing').delete().eq('model_id', modelId).eq('product_id', productId).eq('to_op_name', opName);
    const { error } = await supabase.from('model_operations').delete().eq('id', opId);
    if (error) console.error('deleteOperation:', error);
  },

  // Routing
  async insertRouting(modelId: string, r: RoutingEntry, operations: Operation[]) {
    const fromOp = operations.find(o => o.product_id === r.product_id && o.op_name === r.from_op_name);
    if (!fromOp) return;
    const { error } = await supabase.from('model_routing').insert({
      id: r.id, model_id: modelId, product_id: r.product_id,
      from_op_id: fromOp.id, to_op_name: r.to_op_name, pct_routed: r.pct_routed,
    });
    if (error) console.error('insertRouting:', error);
  },
  async updateRouting(id: string, data: Partial<RoutingEntry>) {
    const update: Record<string, any> = {};
    if (data.to_op_name !== undefined) update.to_op_name = data.to_op_name;
    if (data.pct_routed !== undefined) update.pct_routed = data.pct_routed;
    if (Object.keys(update).length) {
      const { error } = await supabase.from('model_routing').update(update).eq('id', id);
      if (error) console.error('updateRouting:', error);
    }
  },
  async deleteRouting(id: string) {
    const { error } = await supabase.from('model_routing').delete().eq('id', id);
    if (error) console.error('deleteRouting:', error);
  },
  async setRouting(modelId: string, productId: string, entries: RoutingEntry[], operations: Operation[]) {
    await supabase.from('model_routing').delete().eq('model_id', modelId).eq('product_id', productId);
    const opKey = (pid: string, name: string) => `${pid}__${name}`;
    const opMap: Record<string, string> = {};
    operations.forEach(o => { opMap[opKey(o.product_id, o.op_name)] = o.id; });
    const rows = entries.map(r => ({
      id: r.id, model_id: modelId, product_id: r.product_id,
      from_op_id: opMap[opKey(r.product_id, r.from_op_name)] || null,
      to_op_name: r.to_op_name, pct_routed: r.pct_routed,
    })).filter(r => r.from_op_id);
    if (rows.length) await supabase.from('model_routing').insert(rows);
  },

  // IBOM
  async insertIBOM(modelId: string, entry: IBOMEntry) {
    const { error } = await supabase.from('model_ibom').insert({
      id: entry.id, model_id: modelId,
      parent_product_id: entry.parent_product_id,
      component_product_id: entry.component_product_id,
      units_per_assy: entry.units_per_assy,
    });
    if (error) console.error('insertIBOM:', error);
  },
  async updateIBOM(id: string, data: Partial<IBOMEntry>) {
    const { error } = await supabase.from('model_ibom').update(data).eq('id', id);
    if (error) console.error('updateIBOM:', error);
  },
  async deleteIBOM(id: string) {
    const { error } = await supabase.from('model_ibom').delete().eq('id', id);
    if (error) console.error('deleteIBOM:', error);
  },
  async setIBOMForParent(modelId: string, parentId: string, entries: IBOMEntry[]) {
    await supabase.from('model_ibom').delete().eq('model_id', modelId).eq('parent_product_id', parentId);
    if (entries.length) {
      await supabase.from('model_ibom').insert(entries.map(e => ({
        id: e.id, model_id: modelId,
        parent_product_id: e.parent_product_id,
        component_product_id: e.component_product_id,
        units_per_assy: e.units_per_assy,
      })));
    }
  },
};
