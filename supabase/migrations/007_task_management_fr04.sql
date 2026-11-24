-- Supabase Migration: Task Management Alignment for FR-04 & FR-05
-- PRD Section 9: Task Model

-- 1. Add missing attributes to tasks table
-- Ensure source is NOT NULL, setting default 'manual' for existing tasks
alter table tasks
    add column if not exists source text check (source in ('template', 'manual')),
    add column if not exists due_date date,
    add column if not exists locked boolean not null default false,
    add column if not exists effort int check (effort between 1 and 5);

-- 2. Backfill effort from existing difficulty
-- Difficulty is already 1-5, so it maps directly to effort
update tasks
set effort = difficulty
where effort is null and difficulty is not null;

-- 3. Set effort default for remaining tasks
update tasks
set effort = 3
where effort is null;

-- 4. Alter effort to be NOT NULL now that it is backfilled
alter table tasks
    alter column effort set default 3,
    alter column effort set not null;

-- 5. Backfill source for existing tasks
update tasks
set source = 'manual'
where source is null;

-- 6. Alter source to be NOT NULL
alter table tasks
    alter column source set default 'manual',
    alter column source set not null;
