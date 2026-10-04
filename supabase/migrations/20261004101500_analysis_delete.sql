-- Deleting an analysis is the same organization check as reading one.
-- Files and edges follow the row through the foreign key.

create policy analyses_delete_organization
  on public.analyses
  for delete
  to authenticated
  using (organization_id = (((select auth.jwt()) -> 'o') ->> 'id'));

grant delete on table public.analyses to authenticated;
