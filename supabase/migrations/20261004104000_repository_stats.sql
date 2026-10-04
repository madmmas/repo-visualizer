-- The figures shown before a run, kept on the row afterwards.
-- analysed_at is when that run finished or failed, not when the row was created.

alter table public.analyses
  add column repository_bytes bigint,
  add column repository_files integer,
  add column analysed_at timestamptz;

alter table public.analyses
  add constraint analyses_repository_bytes_check
    check (repository_bytes is null or repository_bytes >= 0),
  add constraint analyses_repository_files_check
    check (repository_files is null or repository_files >= 0);
