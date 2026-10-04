-- The eight domain tables each reference an organization. Deleting that
-- organization removes their rows. Clerk is the source of the id; this table
-- exists so the foreign key and the cascade are real.

create table public.organizations (
  id text primary key
);

create table public.projects (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade
);

create table public.analyses (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  repository text not null,
  state text not null,
  created_at timestamptz not null default now(),
  constraint analyses_state_check check (
    state in ('queued', 'running', 'complete', 'failed')
  )
);

create table public.files (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade
);

create table public.edges (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade
);

create table public.routes (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade
);

create table public.explanations (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade
);

create table public.file_roles (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade
);

create table public.insights (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade
);

create index projects_organization_id_idx on public.projects (organization_id);
create index analyses_organization_id_idx on public.analyses (organization_id);
create index files_organization_id_idx on public.files (organization_id);
create index edges_organization_id_idx on public.edges (organization_id);
create index routes_organization_id_idx on public.routes (organization_id);
create index explanations_organization_id_idx on public.explanations (organization_id);
create index file_roles_organization_id_idx on public.file_roles (organization_id);
create index insights_organization_id_idx on public.insights (organization_id);

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.projects enable row level security;
alter table public.projects force row level security;
alter table public.analyses enable row level security;
alter table public.analyses force row level security;
alter table public.files enable row level security;
alter table public.files force row level security;
alter table public.edges enable row level security;
alter table public.edges force row level security;
alter table public.routes enable row level security;
alter table public.routes force row level security;
alter table public.explanations enable row level security;
alter table public.explanations force row level security;
alter table public.file_roles enable row level security;
alter table public.file_roles force row level security;
alter table public.insights enable row level security;
alter table public.insights force row level security;

-- org_id is read off the Clerk session token. The subquery lets the planner
-- evaluate the claim once per statement.
create policy organizations_select_organization
  on public.organizations
  for select
  to authenticated
  using (id = (select auth.jwt() ->> 'org_id'));

create policy projects_select_organization
  on public.projects
  for select
  to authenticated
  using (organization_id = (select auth.jwt() ->> 'org_id'));

create policy analyses_select_organization
  on public.analyses
  for select
  to authenticated
  using (organization_id = (select auth.jwt() ->> 'org_id'));

create policy files_select_organization
  on public.files
  for select
  to authenticated
  using (organization_id = (select auth.jwt() ->> 'org_id'));

create policy edges_select_organization
  on public.edges
  for select
  to authenticated
  using (organization_id = (select auth.jwt() ->> 'org_id'));

create policy routes_select_organization
  on public.routes
  for select
  to authenticated
  using (organization_id = (select auth.jwt() ->> 'org_id'));

create policy explanations_select_organization
  on public.explanations
  for select
  to authenticated
  using (organization_id = (select auth.jwt() ->> 'org_id'));

create policy file_roles_select_organization
  on public.file_roles
  for select
  to authenticated
  using (organization_id = (select auth.jwt() ->> 'org_id'));

create policy insights_select_organization
  on public.insights
  for select
  to authenticated
  using (organization_id = (select auth.jwt() ->> 'org_id'));

revoke all on table public.organizations from public, anon, authenticated;
revoke all on table public.projects from public, anon, authenticated;
revoke all on table public.analyses from public, anon, authenticated;
revoke all on table public.files from public, anon, authenticated;
revoke all on table public.edges from public, anon, authenticated;
revoke all on table public.routes from public, anon, authenticated;
revoke all on table public.explanations from public, anon, authenticated;
revoke all on table public.file_roles from public, anon, authenticated;
revoke all on table public.insights from public, anon, authenticated;

grant select on table public.organizations to authenticated;
grant select on table public.projects to authenticated;
grant select on table public.analyses to authenticated;
grant select on table public.files to authenticated;
grant select on table public.edges to authenticated;
grant select on table public.routes to authenticated;
grant select on table public.explanations to authenticated;
grant select on table public.file_roles to authenticated;
grant select on table public.insights to authenticated;

-- The two dev organizations, so switching teams changes this list.
insert into public.organizations (id)
values
  ('org_3KBZgfMcC7bKvWeKAxa1bzdQJVI'),
  ('org_3KBbz6B6ZRfWuIxHb2SqrayD4SI');

insert into public.analyses (organization_id, repository, state, created_at)
values
  (
    'org_3KBZgfMcC7bKvWeKAxa1bzdQJVI',
    'https://github.com/vercel/next.js',
    'complete',
    '2026-10-01T15:00:00Z'
  ),
  (
    'org_3KBZgfMcC7bKvWeKAxa1bzdQJVI',
    'https://github.com/clerk/javascript',
    'running',
    '2026-10-02T15:00:00Z'
  ),
  (
    'org_3KBbz6B6ZRfWuIxHb2SqrayD4SI',
    'https://github.com/supabase/supabase',
    'complete',
    '2026-10-01T16:00:00Z'
  );
