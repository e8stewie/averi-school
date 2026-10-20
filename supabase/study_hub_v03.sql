-- Study Hub v0.3: run in Supabase SQL Editor before testing this branch.
create table if not exists public.study_classes (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 student_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 100),
 created_at timestamptz not null default now()
);
create table if not exists public.study_folders (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.study_classes(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 100),
 created_at timestamptz not null default now(),
 unique(id,class_id),
 foreign key (class_id) references public.study_classes(id)
);
create table if not exists public.study_materials (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.study_classes(id) on delete cascade,
 folder_id uuid,
 family_id uuid not null references public.families(id) on delete cascade,
 student_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 200),
 kind text not null check(kind in ('note','file')),
 body text not null default '',
 storage_path text,
 mime_type text,
 created_at timestamptz not null default now(),
 foreign key (folder_id,class_id) references public.study_folders(id,class_id) on delete cascade,
 check ((kind='note' and storage_path is null) or (kind='file' and storage_path is not null))
);
create index if not exists study_classes_family on public.study_classes(family_id);
create index if not exists study_folders_class on public.study_folders(class_id);
create index if not exists study_materials_class on public.study_materials(class_id);
alter table public.study_classes enable row level security;
alter table public.study_folders enable row level security;
alter table public.study_materials enable row level security;
-- All enrolled family members (admin, parent, student) can manage shared Study Hub materials.
-- student_id records the creating user (historical column name); it does not limit edit rights.
create policy "study classes read" on public.study_classes for select to authenticated using (family_id=(select public.my_family_id()));
create policy "study classes insert" on public.study_classes for insert to authenticated with check (family_id=(select public.my_family_id()) and student_id=(select auth.uid()) and (select public.my_role()) in ('admin','parent','student'));
create policy "study classes update" on public.study_classes for update to authenticated using (family_id=(select public.my_family_id())) with check (family_id=(select public.my_family_id()) and exists(select 1 from public.memberships m where m.user_id=study_classes.student_id and m.family_id=study_classes.family_id));
create policy "study classes delete" on public.study_classes for delete to authenticated using (family_id=(select public.my_family_id()));
create policy "study folders read" on public.study_folders for select to authenticated using (family_id=(select public.my_family_id()) and exists(select 1 from public.study_classes c where c.id=study_folders.class_id and c.family_id=study_folders.family_id));
create policy "study folders insert" on public.study_folders for insert to authenticated with check (family_id=(select public.my_family_id()) and exists(select 1 from public.study_classes c where c.id=class_id and c.family_id=study_folders.family_id));
create policy "study folders update" on public.study_folders for update to authenticated using (family_id=(select public.my_family_id())) with check (family_id=(select public.my_family_id()) and exists(select 1 from public.study_classes c where c.id=class_id and c.family_id=study_folders.family_id));
create policy "study folders delete" on public.study_folders for delete to authenticated using (family_id=(select public.my_family_id()));
create policy "study materials read" on public.study_materials for select to authenticated using (family_id=(select public.my_family_id()) and exists(select 1 from public.study_classes c where c.id=class_id and c.family_id=study_materials.family_id));
create policy "study materials insert" on public.study_materials for insert to authenticated with check (family_id=(select public.my_family_id()) and student_id=(select auth.uid()) and exists(select 1 from public.study_classes c where c.id=class_id and c.family_id=study_materials.family_id) and (folder_id is null or exists(select 1 from public.study_folders f where f.id=folder_id and f.class_id=study_materials.class_id and f.family_id=study_materials.family_id)) and (storage_path is null or storage_path like family_id::text || '/' || (select auth.uid())::text || '/%'));
create policy "study materials update" on public.study_materials for update to authenticated using (family_id=(select public.my_family_id())) with check (family_id=(select public.my_family_id()) and exists(select 1 from public.memberships m where m.user_id=study_materials.student_id and m.family_id=study_materials.family_id) and exists(select 1 from public.study_classes c where c.id=class_id and c.family_id=study_materials.family_id) and (folder_id is null or exists(select 1 from public.study_folders f where f.id=folder_id and f.class_id=study_materials.class_id and f.family_id=study_materials.family_id)) and (storage_path is null or storage_path like family_id::text || '/' || student_id::text || '/%'));
create policy "study materials delete" on public.study_materials for delete to authenticated using (family_id=(select public.my_family_id()));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('study-materials','study-materials',false,10485760,array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict(id) do nothing;
-- Path format: family_id/uploader_user_id/random-file-name. All enrolled family members can access.
create policy "study file read" on storage.objects for select to authenticated using (
 bucket_id='study-materials' and (storage.foldername(name))[1]=(select public.my_family_id())::text
 and exists(select 1 from public.study_materials m where m.storage_path=storage.objects.name and m.family_id=(select public.my_family_id()) and m.student_id::text=(storage.foldername(name))[2])
);
create policy "study file upload" on storage.objects for insert to authenticated with check (
 bucket_id='study-materials' and (select public.my_role()) in ('admin','parent','student')
 and (storage.foldername(name))[1]=(select public.my_family_id())::text
 and (storage.foldername(name))[2]=(select auth.uid())::text
 and exists(select 1 from public.study_classes c where c.family_id=(select public.my_family_id()))
);
create policy "study file delete" on storage.objects for delete to authenticated using (
 bucket_id='study-materials' and (select public.my_role()) in ('admin','parent','student')
 and (storage.foldername(name))[1]=(select public.my_family_id())::text
 and exists(select 1 from public.study_materials m where m.storage_path=storage.objects.name and m.family_id=(select public.my_family_id()))
);
