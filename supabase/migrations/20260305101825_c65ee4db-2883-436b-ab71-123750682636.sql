
-- Gap D: Add out_of_area to equipment, dept_code to products
ALTER TABLE public.model_equipment ADD COLUMN IF NOT EXISTS out_of_area boolean DEFAULT false;
ALTER TABLE public.model_equipment ADD COLUMN IF NOT EXISTS unavail_pct numeric DEFAULT 0;
ALTER TABLE public.model_products ADD COLUMN IF NOT EXISTS dept_code text;
ALTER TABLE public.model_products ADD COLUMN IF NOT EXISTS setup_factor numeric DEFAULT 1.0;

-- Gap I: prioritize_use already exists on model_labor
-- Gap N: family fields on scenarios (already has family_id)
