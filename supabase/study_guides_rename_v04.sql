grant update (title) on public.study_guides to authenticated;
create policy "study guides rename" on public.study_guides for update to authenticated
using (family_id=(select public.my_family_id()) and (select public.my_role()) in ('admin','parent','student'))
with check (family_id=(select public.my_family_id()) and (select public.my_role()) in ('admin','parent','student'));