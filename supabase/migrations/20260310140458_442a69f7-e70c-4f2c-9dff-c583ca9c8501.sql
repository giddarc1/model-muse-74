
-- Add section column to model_dept_codes
ALTER TABLE public.model_dept_codes 
  ADD COLUMN section text NOT NULL DEFAULT 'equipment';

-- Backfill existing rows: duplicate each non-default entry for labor and product sections
-- For default "out of area" entries, only keep them in equipment
INSERT INTO public.model_dept_codes (model_id, value, is_default, section)
SELECT model_id, value, false, 'labor'
FROM public.model_dept_codes
WHERE is_default = false;

INSERT INTO public.model_dept_codes (model_id, value, is_default, section)
SELECT model_id, value, false, 'product'
FROM public.model_dept_codes
WHERE is_default = false AND section = 'equipment';

-- Update the original non-default rows to be equipment section (already defaulted)
-- No action needed, they're already 'equipment'
