-- POLISH 2: Add is_starred column to models
ALTER TABLE models ADD COLUMN IF NOT EXISTS is_starred boolean DEFAULT false;

-- Add UPDATE policy for model_versions (was missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'model_versions_update' AND tablename = 'model_versions') THEN
    CREATE POLICY model_versions_update ON model_versions FOR UPDATE
      USING (model_id IN (SELECT id FROM models WHERE org_id = get_my_org_id()));
  END IF;
END $$;