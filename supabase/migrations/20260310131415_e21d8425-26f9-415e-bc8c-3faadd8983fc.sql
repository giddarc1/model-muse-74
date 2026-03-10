-- Create table for model-specific Group/Dept/Area values
CREATE TABLE public.model_dept_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  value text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  UNIQUE(model_id, value)
);

-- Enable RLS
ALTER TABLE public.model_dept_codes ENABLE ROW LEVEL SECURITY;

-- RLS policies (matching other model_* tables pattern)
CREATE POLICY "model_dept_codes_select" ON public.model_dept_codes
  AS RESTRICTIVE FOR SELECT TO public
  USING (auth.uid() IS NOT NULL AND model_id IN (SELECT id FROM models WHERE org_id = get_my_org_id()));

CREATE POLICY "model_dept_codes_insert" ON public.model_dept_codes
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL AND model_id IN (SELECT id FROM models WHERE org_id = get_my_org_id()));

CREATE POLICY "model_dept_codes_update" ON public.model_dept_codes
  AS RESTRICTIVE FOR UPDATE TO public
  USING (auth.uid() IS NOT NULL AND model_id IN (SELECT id FROM models WHERE org_id = get_my_org_id()));

CREATE POLICY "model_dept_codes_delete" ON public.model_dept_codes
  AS RESTRICTIVE FOR DELETE TO public
  USING (auth.uid() IS NOT NULL AND model_id IN (SELECT id FROM models WHERE org_id = get_my_org_id()));