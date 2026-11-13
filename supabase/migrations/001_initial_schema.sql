-- Supabase Schema Migration: Initial Foundation
-- PRD Section 9: Data Model

create extension if not exists "uuid-ossp";

-- 1. Projects
create table if not exists projects (
    id uuid primary key default uuid_generate_v4(),
    code varchar(32) unique not null,
    title text not null,
    description text,
    created_at timestamptz default now()
);

-- 2. Members
create table if not exists members (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references projects(id) on delete cascade not null,
    name text not null,
    role text,
    skills text[] default '{}',
    capacity int default 40, -- jam per minggu
    preference_score float default 1.0,
    created_at timestamptz default now()
);

-- 3. Tasks
create table if not exists tasks (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references projects(id) on delete cascade not null,
    title text not null,
    description text,
    difficulty int check (difficulty between 1 and 5),
    estimated_hours int not null,
    required_skills text[] default '{}',
    embedding vector(768),
    created_at timestamptz default now()
);

-- 4. Recommendations
create table if not exists recommendations (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references projects(id) on delete cascade not null,
    task_id uuid references tasks(id) on delete cascade not null,
    member_id uuid references members(id) on delete cascade not null,
    score float not null,
    breakdown jsonb not null,
    created_at timestamptz default now()
);

-- 5. Assignments
create table if not exists assignments (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references projects(id) on delete cascade not null,
    task_id uuid references tasks(id) on delete cascade not null,
    member_id uuid references members(id) on delete cascade not null,
    status text default 'assigned',
    created_at timestamptz default now()
);

-- 6. Events
create table if not exists events (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references projects(id) on delete cascade not null,
    type text not null,
    payload jsonb not null,
    created_at timestamptz default now()
);

-- 7. EmbeddingCache
create table if not exists embedding_cache (
    id uuid primary key default uuid_generate_v4(),
    content_hash text unique not null,
    embedding vector(768) not null,
    created_at timestamptz default now()
);

-- 8. AiRun
create table if not exists ai_runs (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references projects(id) on delete cascade,
    prompt_tokens int,
    completion_tokens int,
    model text not null,
    status text not null,
    created_at timestamptz default now()
);

-- Row Level Security (RLS)
alter table projects enable row level security;
alter table members enable row level security;
alter table tasks enable row level security;
alter table recommendations enable row level security;
alter table assignments enable row level security;
alter table events enable row level security;
alter table embedding_cache enable row level security;
alter table ai_runs enable row level security;

-- Default permissive policies for MVP project access via server key
create policy "Allow all server access projects" on projects for all using (true) with check (true);
create policy "Allow all server access members" on members for all using (true) with check (true);
create policy "Allow all server access tasks" on tasks for all using (true) with check (true);
create policy "Allow all server access recommendations" on recommendations for all using (true) with check (true);
create policy "Allow all server access assignments" on assignments for all using (true) with check (true);
create policy "Allow all server access events" on events for all using (true) with check (true);
create policy "Allow all server access embedding_cache" on embedding_cache for all using (true) with check (true);
create policy "Allow all server access ai_runs" on ai_runs for all using (true) with check (true);
