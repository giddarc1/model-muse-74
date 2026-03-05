ALTER TABLE public.model_scenarios ADD COLUMN IF NOT EXISTS whatif_family_id uuid DEFAULT NULL;
ALTER TABLE public.model_scenarios ADD COLUMN IF NOT EXISTS family_position integer DEFAULT NULL;