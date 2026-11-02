create table public.study_guides (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 class_id uuid not null,
 created_by uuid not null references auth.users(id),
 title text not null check (length(trim(title)) between 1 and 200),
 body text not null check (length(body) between 1 and 100000),
 source_material_ids uuid[] not null default '{}',
 created_at timestamptz not null default now(),
 foreign key (class_id,family_id) references public.study_classes(id,family_id) on delete cascade
);
create index study_guides_class_created on public.study_guides(class_id,created_at desc);
alter table public.study_guides enable row level security;
grant select,insert,delete on public.study_guides to authenticated;
create policy "study guides read" on public.study_guides for select to authenticated using (family_id=(select public.my_family_id()));
create policy "study guides insert" on public.study_guides for insert to authenticated with check (
 family_id=(select public.my_family_id()) and created_by=(select auth.uid()) and (select public.my_role()) in ('admin','parent','student')
 and exists(select 1 from public.study_classes c where c.id=class_id and c.family_id=study_guides.family_id)
);
create policy "study guides delete" on public.study_guides for delete to authenticated using (
 family_id=(select public.my_family_id()) and (select public.my_role()) in ('admin','parent','student')
);