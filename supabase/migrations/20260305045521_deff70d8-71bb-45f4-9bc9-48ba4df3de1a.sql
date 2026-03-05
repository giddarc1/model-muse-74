-- Users table policies
drop policy if exists "users_select" on users;
drop policy if exists "users_insert" on users;
drop policy if exists "users_update" on users;

create policy "users_select" on users for select using (auth.uid() is not null and org_id = get_my_org_id());
create policy "users_insert" on users for insert with check (auth.uid() is not null and org_id = get_my_org_id());
create policy "users_update" on users for update using (auth.uid() is not null and org_id = get_my_org_id());

-- Organizations table
drop policy if exists "org_select" on organizations;
create policy "org_select" on organizations for select using (auth.uid() is not null and id = get_my_org_id());

-- Models table
drop policy if exists "models_select" on models;
drop policy if exists "models_insert" on models;
drop policy if exists "models_update" on models;
drop policy if exists "models_delete" on models;
drop policy if exists "models_update_starred" on models;

create policy "models_select" on models for select using (auth.uid() is not null and org_id = get_my_org_id());
create policy "models_insert" on models for insert with check (auth.uid() is not null and org_id = get_my_org_id());
create policy "models_update" on models for update using (auth.uid() is not null and org_id = get_my_org_id());
create policy "models_delete" on models for delete using (auth.uid() is not null and org_id = get_my_org_id());

-- All model_* tables with model_id foreign key
do $$ declare t text;
begin
  foreach t in array array[
    'model_general','model_labor','model_equipment',
    'model_products','model_operations','model_routing','model_ibom',
    'model_param_names','model_families','model_scenarios',
    'model_versions'
  ] loop
    execute format($f$
      drop policy if exists "%s_select" on %s;
      drop policy if exists "%s_insert" on %s;
      drop policy if exists "%s_update" on %s;
      drop policy if exists "%s_delete" on %s;

      create policy "%s_select" on %s for select
        using (auth.uid() is not null and model_id in (select id from models where org_id = get_my_org_id()));
      create policy "%s_insert" on %s for insert
        with check (auth.uid() is not null and model_id in (select id from models where org_id = get_my_org_id()));
      create policy "%s_update" on %s for update
        using (auth.uid() is not null and model_id in (select id from models where org_id = get_my_org_id()));
      create policy "%s_delete" on %s for delete
        using (auth.uid() is not null and model_id in (select id from models where org_id = get_my_org_id()));
    $f$, t,t, t,t, t,t, t,t, t,t, t,t, t,t, t,t);
  end loop;
end $$;

-- Scenario changes
drop policy if exists "changes_select" on model_scenario_changes;
drop policy if exists "changes_insert" on model_scenario_changes;
drop policy if exists "changes_update" on model_scenario_changes;
drop policy if exists "changes_delete" on model_scenario_changes;

create policy "changes_select" on model_scenario_changes for select
  using (auth.uid() is not null and scenario_id in (select s.id from model_scenarios s join models m on m.id = s.model_id where m.org_id = get_my_org_id()));
create policy "changes_insert" on model_scenario_changes for insert
  with check (auth.uid() is not null and scenario_id in (select s.id from model_scenarios s join models m on m.id = s.model_id where m.org_id = get_my_org_id()));
create policy "changes_update" on model_scenario_changes for update
  using (auth.uid() is not null and scenario_id in (select s.id from model_scenarios s join models m on m.id = s.model_id where m.org_id = get_my_org_id()));
create policy "changes_delete" on model_scenario_changes for delete
  using (auth.uid() is not null and scenario_id in (select s.id from model_scenarios s join models m on m.id = s.model_id where m.org_id = get_my_org_id()));

-- Scenario results
drop policy if exists "results_select" on model_scenario_results;
drop policy if exists "results_insert" on model_scenario_results;
drop policy if exists "results_update" on model_scenario_results;
drop policy if exists "results_delete" on model_scenario_results;

create policy "results_select" on model_scenario_results for select
  using (auth.uid() is not null and scenario_id in (select s.id from model_scenarios s join models m on m.id = s.model_id where m.org_id = get_my_org_id()));
create policy "results_insert" on model_scenario_results for insert
  with check (auth.uid() is not null and scenario_id in (select s.id from model_scenarios s join models m on m.id = s.model_id where m.org_id = get_my_org_id()));
create policy "results_update" on model_scenario_results for update
  using (auth.uid() is not null and scenario_id in (select s.id from model_scenarios s join models m on m.id = s.model_id where m.org_id = get_my_org_id()));
create policy "results_delete" on model_scenario_results for delete
  using (auth.uid() is not null and scenario_id in (select s.id from model_scenarios s join models m on m.id = s.model_id where m.org_id = get_my_org_id()));