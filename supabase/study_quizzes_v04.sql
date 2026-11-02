create table public.study_quizzes (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 class_id uuid not null,
 guide_id uuid not null references public.study_guides(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 title text not null check(length(trim(title)) between 1 and 200),
 questions jsonb not null check(jsonb_typeof(questions)='array'),
 created_at timestamptz not null default now(),
 foreign key(class_id,family_id) references public.study_classes(id,family_id) on delete cascade
);
create table public.study_quiz_attempts (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 quiz_id uuid not null references public.study_quizzes(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 answers jsonb not null,
 score integer not null check(score between 0 and 100),
 created_at timestamptz not null default now()
);
create index study_quizzes_guide on public.study_quizzes(guide_id,created_at desc);
create index study_quiz_attempts_quiz on public.study_quiz_attempts(quiz_id,created_at desc);
alter table public.study_quizzes enable row level security;
alter table public.study_quiz_attempts enable row level security;
grant select,insert on public.study_quizzes,public.study_quiz_attempts to authenticated;
create policy "family quiz read" on public.study_quizzes for select to authenticated using(family_id=(select public.my_family_id()));
create policy "family quiz create" on public.study_quizzes for insert to authenticated with check(family_id=(select public.my_family_id()) and created_by=(select auth.uid()) and (select public.my_role()) in ('admin','parent','student') and exists(select 1 from public.study_guides g where g.id=guide_id and g.family_id=study_quizzes.family_id and g.class_id=study_quizzes.class_id));
create policy "family attempts read" on public.study_quiz_attempts for select to authenticated using(family_id=(select public.my_family_id()));
create policy "family attempts create" on public.study_quiz_attempts for insert to authenticated with check(family_id=(select public.my_family_id()) and user_id=(select auth.uid()) and exists(select 1 from public.study_quizzes q where q.id=quiz_id and q.family_id=study_quiz_attempts.family_id));