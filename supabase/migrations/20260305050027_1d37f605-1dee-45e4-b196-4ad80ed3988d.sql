-- FIX 2: Add DELETE policy on users table (admin-only, no self-deletion)
create policy "users_delete" on users
  for delete using (
    auth.uid() is not null
    and org_id = get_my_org_id()
    and id != auth.uid()
    and exists (
      select 1 from public.users
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- FIX 3: Add INSERT/UPDATE/DELETE policies on organizations table
create policy "org_insert" on organizations
  for insert with check (auth.uid() is not null);

create policy "org_update" on organizations
  for update using (
    auth.uid() is not null
    and id = get_my_org_id()
    and exists (
      select 1 from public.users
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "org_delete" on organizations
  for delete using (false);