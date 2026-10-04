-- The run records the commit the archive came from, the stage it is in, and
-- why it failed. One analysis per repository per organization. Files and edges
-- are the parser's output for that analysis.

alter table public.analyses
  add column repository_key text,
  add column commit_sha text,
  add column stage text,
  add column stage_message text,
  add column failure text,
  add column updated_at timestamptz,
  add column adapter text,
  add column files_found integer,
  add column files_parsed integer,
  add column files_skipped integer,
  add column imports_seen integer,
  add column imports_resolved integer,
  add column imports_unresolved integer,
  add column coverage_percent smallint;

update public.analyses
set
  repository_key = regexp_replace(
    lower(substring(repository from 'github\.com/([^/]+/[^/#?]+)')),
    '\.git$',
    ''
  ),
  updated_at = created_at;

alter table public.analyses
  alter column repository_key set not null,
  alter column updated_at set not null,
  alter column updated_at set default now();

alter table public.analyses
  add constraint analyses_repository_key_check
    check (repository_key ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$'),
  add constraint analyses_commit_sha_check
    check (commit_sha is null or commit_sha ~ '^[0-9a-f]{40}$'),
  add constraint analyses_stage_check
    check (stage is null or stage in ('fetch', 'select', 'parse', 'store')),
  add constraint analyses_files_found_check
    check (files_found is null or files_found >= 0),
  add constraint analyses_files_parsed_check
    check (files_parsed is null or files_parsed >= 0),
  add constraint analyses_files_skipped_check
    check (files_skipped is null or files_skipped >= 0),
  add constraint analyses_imports_seen_check
    check (imports_seen is null or imports_seen >= 0),
  add constraint analyses_imports_resolved_check
    check (imports_resolved is null or imports_resolved >= 0),
  add constraint analyses_imports_unresolved_check
    check (imports_unresolved is null or imports_unresolved >= 0),
  add constraint analyses_coverage_percent_check
    check (coverage_percent is null or coverage_percent between 0 and 100);

create unique index analyses_organization_repository_key_idx
  on public.analyses (organization_id, repository_key);

create index analyses_organization_created_idx
  on public.analyses (organization_id, created_at desc);

alter table public.files
  add column analysis_id bigint not null references public.analyses (id) on delete cascade,
  add column path text not null,
  add column folder text not null,
  add column lines integer not null,
  add column hash text not null,
  add column fan_in integer not null,
  add column fan_out integer not null,
  add constraint files_lines_check check (lines >= 0),
  add constraint files_fan_in_check check (fan_in >= 0),
  add constraint files_fan_out_check check (fan_out >= 0),
  add constraint files_hash_check check (hash ~ '^[a-f0-9]{64}$'),
  add constraint files_analysis_path_key unique (analysis_id, path);

create index files_analysis_id_idx on public.files (analysis_id);

alter table public.edges
  add column analysis_id bigint not null references public.analyses (id) on delete cascade,
  add column from_path text not null,
  add column to_path text not null,
  add column kind text not null,
  add column specifier text not null,
  add constraint edges_kind_check check (kind in ('import', 'reexport', 'dynamic')),
  add constraint edges_analysis_edge_key unique (analysis_id, from_path, to_path, kind);

create index edges_analysis_id_idx on public.edges (analysis_id);

-- Stage changes publish stage and message on analysis:<id>. The row itself is
-- not the message. The policy below is the channel pattern: a topic that is
-- not one of these is not subscribable, and a publish there never shows up.

create or replace function public.publish_analysis_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stage is null then
    return null;
  end if;
  if tg_op = 'UPDATE'
    and new.stage is not distinct from old.stage
    and new.stage_message is not distinct from old.stage_message
  then
    return null;
  end if;
  perform realtime.send(
    jsonb_build_object(
      'stage', new.stage,
      'message', coalesce(new.stage_message, '')
    ),
    'stage',
    'analysis:' || new.id::text,
    true
  );
  return null;
end;
$$;

create trigger analyses_publish_stage
  after insert or update of stage, stage_message on public.analyses
  for each row
  execute function public.publish_analysis_stage();

create or replace function public.touch_analysis_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.publish_analysis_stage() from public, anon;
grant execute on function public.publish_analysis_stage() to authenticated;

revoke all on function public.touch_analysis_updated_at() from public, anon;
grant execute on function public.touch_analysis_updated_at() to authenticated;

create trigger analyses_touch_updated_at
  before update on public.analyses
  for each row
  execute function public.touch_analysis_updated_at();

-- The session token carries the active organization at o.id. Same claim the
-- existing select policies read.

create policy analyses_insert_organization
  on public.analyses
  for insert
  to authenticated
  with check (organization_id = (((select auth.jwt()) -> 'o') ->> 'id'));

create policy analyses_update_organization
  on public.analyses
  for update
  to authenticated
  using (organization_id = (((select auth.jwt()) -> 'o') ->> 'id'))
  with check (organization_id = (((select auth.jwt()) -> 'o') ->> 'id'));

create policy files_insert_organization
  on public.files
  for insert
  to authenticated
  with check (
    organization_id = (((select auth.jwt()) -> 'o') ->> 'id')
    and exists (
      select 1
      from public.analyses
      where analyses.id = analysis_id
        and analyses.organization_id = organization_id
    )
  );

create policy files_delete_organization
  on public.files
  for delete
  to authenticated
  using (organization_id = (((select auth.jwt()) -> 'o') ->> 'id'));

create policy edges_insert_organization
  on public.edges
  for insert
  to authenticated
  with check (
    organization_id = (((select auth.jwt()) -> 'o') ->> 'id')
    and exists (
      select 1
      from public.analyses
      where analyses.id = analysis_id
        and analyses.organization_id = organization_id
    )
  );

create policy edges_delete_organization
  on public.edges
  for delete
  to authenticated
  using (organization_id = (((select auth.jwt()) -> 'o') ->> 'id'));

create policy organizations_insert_self
  on public.organizations
  for insert
  to authenticated
  with check (id = (((select auth.jwt()) -> 'o') ->> 'id'));

create policy analysis_channels_select
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and exists (
      select 1
      from public.analyses
      where (select realtime.topic()) = 'analysis:' || analyses.id::text
        and analyses.organization_id = (((select auth.jwt()) -> 'o') ->> 'id')
    )
  );

grant insert, update on table public.analyses to authenticated;
grant insert, delete on table public.files to authenticated;
grant insert, delete on table public.edges to authenticated;
grant insert on table public.organizations to authenticated;

grant usage, select on sequence public.analyses_id_seq to authenticated;
grant usage, select on sequence public.files_id_seq to authenticated;
grant usage, select on sequence public.edges_id_seq to authenticated;
