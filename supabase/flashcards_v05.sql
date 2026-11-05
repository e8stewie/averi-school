create table if not exists public.study_flashcard_decks (
 id uuid primary key default gen_random_uuid(),family_id uuid not null, class_id uuid not null references public.study_classes(id) on delete cascade,
 guide_id uuid references public.study_guides(id) on delete set null,created_by uuid not null references auth.users(id),title text not null check(length(title) between 1 and 200),
 cards jsonb not null default '[]'::jsonb check(jsonb_typeof(cards)='array' and jsonb_array_length(cards)<=100),created_at timestamptz not null default now()
);
create table if not exists public.study_flashcard_progress (
 deck_id uuid not null references public.study_flashcard_decks(id) on delete cascade,
 user_id uuid not null references auth.users(id),family_id uuid not null,
 card_index integer not null check(card_index>=0 and card_index<100),
 rating text not null check(rating in ('got','practice')),updated_at timestamptz not null default now(),
 primary key(deck_id,user_id,card_index)
);
create index if not exists study_flashcard_decks_family_class_idx on public.study_flashcard_decks(family_id,class_id);
alter table public.study_flashcard_decks enable row level security;
alter table public.study_flashcard_progress enable row level security;
create policy "family read decks" on public.study_flashcard_decks for select to authenticated using (family_id=(select public.my_family_id()));
create policy "family create decks" on public.study_flashcard_decks for insert to authenticated with check (family_id=(select public.my_family_id()) and created_by=(select auth.uid()) and exists(select 1 from public.study_classes c where c.id=class_id and c.family_id=family_id) and (guide_id is null or exists(select 1 from public.study_guides g where g.id=guide_id and g.family_id=family_id and g.class_id=class_id)));
create policy "family edit decks" on public.study_flashcard_decks for update to authenticated using (family_id=(select public.my_family_id())) with check (family_id=(select public.my_family_id()) and exists(select 1 from public.study_classes c where c.id=class_id and c.family_id=family_id) and (guide_id is null or exists(select 1 from public.study_guides g where g.id=guide_id and g.family_id=family_id and g.class_id=class_id)));
create policy "family delete decks" on public.study_flashcard_decks for delete to authenticated using (family_id=(select public.my_family_id()));
create policy "family read progress" on public.study_flashcard_progress for select to authenticated using (family_id=(select public.my_family_id()));
create policy "own insert progress" on public.study_flashcard_progress for insert to authenticated with check (family_id=(select public.my_family_id()) and user_id=(select auth.uid()) and exists(select 1 from public.study_flashcard_decks d where d.id=deck_id and d.family_id=family_id));
create policy "own update progress" on public.study_flashcard_progress for update to authenticated using (family_id=(select public.my_family_id()) and user_id=(select auth.uid())) with check (family_id=(select public.my_family_id()) and user_id=(select auth.uid()) and exists(select 1 from public.study_flashcard_decks d where d.id=deck_id and d.family_id=family_id));
grant select,insert,update,delete on public.study_flashcard_decks to authenticated;
grant select,insert,update on public.study_flashcard_progress to authenticated;