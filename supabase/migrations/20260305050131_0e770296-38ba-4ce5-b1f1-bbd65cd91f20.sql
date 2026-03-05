-- Tighten users_update: users can only update their own record, or admins can update anyone in org
drop policy if exists "users_update" on users;
create policy "users_update" on users
  for update using (
    auth.uid() is not null
    and org_id = get_my_org_id()
    and (
      id = auth.uid()
      or exists (
        select 1 from public.users
        where id = auth.uid()
        and role = 'admin'
      )
    )
  );

-- Tighten users_insert: only admins can insert new users (signup uses service role)
drop policy if exists "users_insert" on users;
create policy "users_insert" on users
  for insert with check (
    auth.uid() is not null
    and org_id = get_my_org_id()
    and exists (
      select 1 from public.users
      where id = auth.uid()
      and role = 'admin'
    )
  );