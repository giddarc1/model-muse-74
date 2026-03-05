create or replace function public.get_my_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.users
  where id = auth.uid()
  and auth.uid() is not null
$$;