-- Averi School: run once in Supabase SQL Editor. Never expose the service role key.
create extension if not exists pgcrypto;
create table if not exists public.families (id uuid primary key default gen_random_uuid(), name text not null default 'Averi School', created_at timestamptz not null default now());
create table if not exists public.memberships (user_id uuid primary key references auth.users(id) on delete cascade, family_id uuid not null references public.families(id) on delete cascade, role text not null check(role in ('admin','parent','student')), display_name text not null, created_at timestamptz not null default now());
create table if not exists public.assignments (id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade, title text not null check(length(title) between 1 and 250), subject text not null default '', due date not null, status text not null default 'todo' check(status in ('todo','working','done','submitted')), created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now());
create table if not exists public.tests (id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade, title text not null check(length(title) between 1 and 250), subject text not null default '', date date not null, created_at timestamptz not null default now());
create table if not exists public.checkins (id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade, student_id uuid not null references auth.users(id), day date not null, answers jsonb not null default '{}'::jsonb, minutes integer not null default 0 check(minutes between 0 and 240), created_at timestamptz not null default now(), unique(student_id,day));
create table if not exists public.help_requests (id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade, student_id uuid not null references auth.users(id), note text not null check(length(note) between 1 and 2000), created_at timestamptz not null default now());
create table if not exists public.submission_verifications (assignment_id uuid primary key references public.assignments(id) on delete cascade, family_id uuid not null references public.families(id) on delete cascade, verified_by uuid not null references auth.users(id), verified_at timestamptz not null default now());
-- SECURITY DEFINER avoids recursive membership policies. Restrict function search_path.
create or replace function public.my_family_id() returns uuid language sql stable security definer set search_path = '' as $$ select family_id from public.memberships where user_id = (select auth.uid()) $$;
create or replace function public.my_role() returns text language sql stable security definer set search_path = '' as $$ select role from public.memberships where user_id = (select auth.uid()) $$;
revoke all on function public.my_family_id() from public; revoke all on function public.my_role() from public;
grant execute on function public.my_family_id() to authenticated; grant execute on function public.my_role() to authenticated;
alter table public.families enable row level security;
alter table public.memberships enable row level security;
alter table public.assignments enable row level security;
alter table public.tests enable row level security;
alter table public.checkins enable row level security;
alter table public.help_requests enable row level security;
alter table public.submission_verifications enable row level security;
create policy "family visible" on public.families for select to authenticated using (id = (select public.my_family_id()));
create policy "members visible" on public.memberships for select to authenticated using (family_id = (select public.my_family_id()));
create policy "assignments read" on public.assignments for select to authenticated using (family_id = (select public.my_family_id()));
create policy "assignments add" on public.assignments for insert to authenticated with check (family_id = (select public.my_family_id()) and created_by = (select auth.uid()));
create policy "assignments edit" on public.assignments for update to authenticated using (family_id = (select public.my_family_id())) with check (family_id = (select public.my_family_id()));
create policy "assignments delete parents" on public.assignments for delete to authenticated using (family_id = (select public.my_family_id()) and (select public.my_role()) in ('admin','parent'));
create policy "tests read" on public.tests for select to authenticated using (family_id = (select public.my_family_id()));
create policy "tests add" on public.tests for insert to authenticated with check (family_id = (select public.my_family_id()));
create policy "tests delete parents" on public.tests for delete to authenticated using (family_id = (select public.my_family_id()) and (select public.my_role()) in ('admin','parent'));
create policy "checkins read" on public.checkins for select to authenticated using (family_id = (select public.my_family_id()));
create policy "student checkin insert" on public.checkins for insert to authenticated with check (family_id = (select public.my_family_id()) and student_id = (select auth.uid()) and (select public.my_role()) = 'student');
create policy "student checkin update" on public.checkins for update to authenticated using (family_id = (select public.my_family_id()) and student_id = (select auth.uid()) and (select public.my_role()) = 'student') with check (family_id = (select public.my_family_id()) and student_id = (select auth.uid()));
create policy "help read" on public.help_requests for select to authenticated using (family_id = (select public.my_family_id()));
create policy "help add student" on public.help_requests for insert to authenticated with check (family_id = (select public.my_family_id()) and student_id = (select auth.uid()) and (select public.my_role()) = 'student');
create policy "verification read" on public.submission_verifications for select to authenticated using (family_id = (select public.my_family_id()));
create policy "verification insert parents" on public.submission_verifications for insert to authenticated with check (family_id = (select public.my_family_id()) and verified_by = (select auth.uid()) and (select public.my_role()) in ('admin','parent') and exists(select 1 from public.assignments a where a.id=assignment_id and a.family_id=family_id));
create policy "verification delete parents" on public.submission_verifications for delete to authenticated using (family_id = (select public.my_family_id()) and (select public.my_role()) in ('admin','parent'));
-- No client INSERT/UPDATE/DELETE policy for memberships or families: enrollment must be admin-managed.
