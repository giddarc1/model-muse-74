-- Drop existing restrictive policies
DROP POLICY IF EXISTS model_dept_codes_select ON public.model_dept_codes;
DROP POLICY IF EXISTS model_dept_codes_insert ON public.model_dept_codes;
DROP POLICY IF EXISTS model_dept_codes_update ON public.model_dept_codes;
DROP POLICY IF EXISTS model_dept_codes_delete ON public.model_dept_codes;

-- Recreate as PERMISSIVE
CREATE POLICY model_dept_codes_select ON public.model_dept_codes
  FOR SELECT TO authenticated
  USING (model_id IN (SELECT id FROM models WHERE org_id = get_my_org_id()));

CREATE POLICY model_dept_codes_insert ON public.model_dept_codes
  FOR INSERT TO authenticated
  WITH CHECK (model_id IN (SELECT id FROM models WHERE org_id = get_my_org_id()));

CREATE POLICY model_dept_codes_update ON public.model_dept_codes
  FOR UPDATE TO authenticated
  USING (model_id IN (SELECT id FROM models WHERE org_id = get_my_org_id()));

CREATE POLICY model_dept_codes_delete ON public.model_dept_codes
  FOR DELETE TO authenticated
  USING (model_id IN (SELECT id FROM models WHERE org_id = get_my_org_id()));