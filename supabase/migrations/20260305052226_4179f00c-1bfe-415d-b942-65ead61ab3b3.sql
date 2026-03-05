-- FIX: Prevent users from modifying their own role or user_level
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If the caller is updating their own record, block role/user_level changes
  if NEW.id = auth.uid() then
    if NEW.role is distinct from OLD.role then
      raise exception 'Cannot modify your own role';
    end if;
    if NEW.user_level is distinct from OLD.user_level then
      raise exception 'Cannot modify your own user_level';
    end if;
  end if;
  return NEW;
end;
$$;

create trigger trg_prevent_self_privilege_escalation
  before update on public.users
  for each row
  execute function public.prevent_self_privilege_escalation();

-- Tighten org_insert: only allow via service role (signup edge function)
-- Restrict to: user can only create org if no org exists for them yet
drop policy if exists "org_insert" on organizations;
create policy "org_insert" on organizations
  for insert with check (
    auth.uid() is not null
    and not exists (
      select 1 from public.users where id = auth.uid() and org_id is not null
    )
  );