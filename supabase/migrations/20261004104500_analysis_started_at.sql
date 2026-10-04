-- When this run began, so the time taken is analysed_at minus started_at.

alter table public.analyses
  add column started_at timestamptz;
