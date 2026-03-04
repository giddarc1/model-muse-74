
-- Add UPDATE RLS policy for model_scenario_changes
CREATE POLICY "changes_update" ON public.model_scenario_changes
FOR UPDATE TO authenticated
USING (scenario_id IN (
  SELECT s.id FROM model_scenarios s JOIN models m ON m.id = s.model_id WHERE m.org_id = get_my_org_id()
));

-- Add UPDATE RLS policy for model_scenario_results
CREATE POLICY "results_update" ON public.model_scenario_results
FOR UPDATE TO authenticated
USING (scenario_id IN (
  SELECT s.id FROM model_scenarios s JOIN models m ON m.id = s.model_id WHERE m.org_id = get_my_org_id()
));

-- Create model_versions table for checkpoint history
CREATE TABLE public.model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Auto-save',
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_versions_select" ON public.model_versions
FOR SELECT TO authenticated
USING (model_id IN (SELECT id FROM models WHERE org_id = get_my_org_id()));

CREATE POLICY "model_versions_insert" ON public.model_versions
FOR INSERT TO authenticated
WITH CHECK (model_id IN (SELECT id FROM models WHERE org_id = get_my_org_id()));

CREATE POLICY "model_versions_delete" ON public.model_versions
FOR DELETE TO authenticated
USING (model_id IN (SELECT id FROM models WHERE org_id = get_my_org_id()));
