import { supabase } from '@/integrations/supabase/client';
import type { Scenario, ScenarioChange } from '@/stores/scenarioStore';
import type { CalcResults } from '@/lib/calculationEngine';

// ─── Load scenarios + changes + results for a model ─────────────────
export async function loadScenariosForModel(modelId: string): Promise<{
  scenarios: Scenario[];
  results: Record<string, CalcResults>;
}> {
  const { data: rows, error } = await supabase
    .from('model_scenarios')
    .select('*')
    .eq('model_id', modelId)
    .eq('is_basecase', false);

  if (error) { console.error('loadScenarios:', error); return { scenarios: [], results: {} }; }
  if (!rows?.length) return { scenarios: [], results: {} };

  const scenarioIds = rows.map(r => r.id);

  const [changesRes, resultsRes] = await Promise.all([
    supabase.from('model_scenario_changes').select('*').in('scenario_id', scenarioIds),
    supabase.from('model_scenario_results').select('*').in('scenario_id', scenarioIds).eq('result_type', 'full'),
  ]);

  const changesByScenario: Record<string, ScenarioChange[]> = {};
  (changesRes.data || []).forEach(c => {
    (changesByScenario[c.scenario_id] ||= []).push({
      id: c.id,
      dataType: c.data_type as ScenarioChange['dataType'],
      entityId: c.entity_id || '',
      entityName: c.entity_name || '',
      field: c.field_name,
      fieldLabel: c.field_name, // use field_name as label when loading
      basecaseValue: c.basecase_value ?? '',
      whatIfValue: c.whatif_value ?? '',
    });
  });

  const resultsMap: Record<string, CalcResults> = {};
  (resultsRes.data || []).forEach(r => {
    if (r.result_data) {
      resultsMap[r.scenario_id] = r.result_data as unknown as CalcResults;
    }
  });

  const scenarios: Scenario[] = rows.map(r => ({
    id: r.id,
    modelId: r.model_id,
    name: r.name,
    description: r.description || '',
    familyId: r.family_id || null,
    status: (r.status || 'needs_recalc') as Scenario['status'],
    changes: changesByScenario[r.id] || [],
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  }));

  return { scenarios, results: resultsMap };
}

// ─── Load basecase results ──────────────────────────────────────────
export async function loadBasecaseResults(modelId: string): Promise<CalcResults | null> {
  const { data: bcRow } = await supabase
    .from('model_scenarios')
    .select('id')
    .eq('model_id', modelId)
    .eq('is_basecase', true)
    .single();

  if (!bcRow) return null;

  const { data: resultRow } = await supabase
    .from('model_scenario_results')
    .select('result_data')
    .eq('scenario_id', bcRow.id)
    .eq('result_type', 'full')
    .single();

  return resultRow?.result_data as unknown as CalcResults | null;
}

// ─── Ensure basecase scenario exists ────────────────────────────────
export async function ensureBasecaseScenario(modelId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('model_scenarios')
    .select('id')
    .eq('model_id', modelId)
    .eq('is_basecase', true)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('model_scenarios')
    .insert({ model_id: modelId, name: 'Basecase', is_basecase: true, status: 'needs_recalc' })
    .select('id')
    .single();

  if (error) { console.error('ensureBasecaseScenario:', error); return ''; }
  return created?.id || '';
}

// ─── CRUD operations ────────────────────────────────────────────────
export const scenarioDb = {
  async create(modelId: string, name: string, description: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('model_scenarios')
      .insert({ model_id: modelId, name, description, is_basecase: false, status: 'needs_recalc' })
      .select('id')
      .single();
    if (error) { console.error('createScenario:', error); return null; }
    return data?.id || null;
  },

  async update(id: string, data: { name?: string; description?: string; status?: string }) {
    const { error } = await supabase.from('model_scenarios').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) console.error('updateScenario:', error);
  },

  async delete(id: string) {
    const { error } = await supabase.from('model_scenarios').delete().eq('id', id);
    if (error) console.error('deleteScenario:', error);
  },

  async upsertChange(scenarioId: string, change: ScenarioChange) {
    // Try update first, insert if not exists
    const { data: existing } = await supabase
      .from('model_scenario_changes')
      .select('id')
      .eq('scenario_id', scenarioId)
      .eq('entity_id', change.entityId)
      .eq('field_name', change.field)
      .single();

    if (existing) {
      await supabase.from('model_scenario_changes').update({
        whatif_value: String(change.whatIfValue),
        basecase_value: String(change.basecaseValue),
      }).eq('id', existing.id);
    } else {
      await supabase.from('model_scenario_changes').insert({
        id: change.id,
        scenario_id: scenarioId,
        data_type: change.dataType,
        entity_id: change.entityId,
        entity_name: change.entityName,
        field_name: change.field,
        basecase_value: String(change.basecaseValue),
        whatif_value: String(change.whatIfValue),
      });
    }
  },

  async removeChange(changeId: string) {
    const { error } = await supabase.from('model_scenario_changes').delete().eq('id', changeId);
    if (error) console.error('removeChange:', error);
  },

  async saveResults(scenarioId: string, results: CalcResults) {
    // Delete old results, insert new
    await supabase.from('model_scenario_results').delete().eq('scenario_id', scenarioId).eq('result_type', 'full');
    const { error } = await supabase.from('model_scenario_results').insert({
      scenario_id: scenarioId,
      result_type: 'full',
      result_data: results as any,
    });
    if (error) console.error('saveResults:', error);
  },

  async saveBasecaseResults(modelId: string, results: CalcResults) {
    const bcId = await ensureBasecaseScenario(modelId);
    if (!bcId) return;
    await this.saveResults(bcId, results);
  },
};
