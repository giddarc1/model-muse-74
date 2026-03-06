CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.id = auth.uid() then
    if NEW.role is distinct from OLD.role then
      raise exception 'Cannot modify your own role';
    end if;
  end if;
  return NEW;
end;
$function$;