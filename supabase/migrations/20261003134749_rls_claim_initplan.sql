-- Wrap auth.jwt() itself. A subquery around the whole comparison still
-- re-evaluates the claim on every row.

drop policy organizations_select_organization on public.organizations;
create policy organizations_select_organization
  on public.organizations
  for select
  to authenticated
  using (id = ((select auth.jwt()) ->> 'org_id'));

drop policy projects_select_organization on public.projects;
create policy projects_select_organization
  on public.projects
  for select
  to authenticated
  using (organization_id = ((select auth.jwt()) ->> 'org_id'));

drop policy analyses_select_organization on public.analyses;
create policy analyses_select_organization
  on public.analyses
  for select
  to authenticated
  using (organization_id = ((select auth.jwt()) ->> 'org_id'));

drop policy files_select_organization on public.files;
create policy files_select_organization
  on public.files
  for select
  to authenticated
  using (organization_id = ((select auth.jwt()) ->> 'org_id'));

drop policy edges_select_organization on public.edges;
create policy edges_select_organization
  on public.edges
  for select
  to authenticated
  using (organization_id = ((select auth.jwt()) ->> 'org_id'));

drop policy routes_select_organization on public.routes;
create policy routes_select_organization
  on public.routes
  for select
  to authenticated
  using (organization_id = ((select auth.jwt()) ->> 'org_id'));

drop policy explanations_select_organization on public.explanations;
create policy explanations_select_organization
  on public.explanations
  for select
  to authenticated
  using (organization_id = ((select auth.jwt()) ->> 'org_id'));

drop policy file_roles_select_organization on public.file_roles;
create policy file_roles_select_organization
  on public.file_roles
  for select
  to authenticated
  using (organization_id = ((select auth.jwt()) ->> 'org_id'));

drop policy insights_select_organization on public.insights;
create policy insights_select_organization
  on public.insights
  for select
  to authenticated
  using (organization_id = ((select auth.jwt()) ->> 'org_id'));
