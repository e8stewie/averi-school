revoke execute on function public.my_family_id() from public, anon;
revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_family_id(), public.my_role() to authenticated;
create or replace function public.submit_study_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns table(attempt_id uuid, score integer)
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_family uuid; v_questions jsonb; v_total integer; v_correct integer := 0; v_i integer; v_answer integer; v_id uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select m.family_id into v_family from public.memberships m where m.user_id=v_user and m.role in ('admin','parent','student');
 if v_family is null then raise exception 'Family membership required'; end if;
 select q.questions into v_questions from public.study_quizzes q where q.id=p_quiz_id and q.family_id=v_family;
 if v_questions is null then raise exception 'Quiz unavailable'; end if;
 v_total := jsonb_array_length(v_questions);
 if v_total<>10 or jsonb_typeof(p_answers)<>'object' or (select count(*) from jsonb_object_keys(p_answers))<>v_total then raise exception 'Answer all questions'; end if;
 for v_i in 0..v_total-1 loop
  if not (p_answers ? v_i::text) or jsonb_typeof(p_answers->v_i::text)<>'number' then raise exception 'Invalid answers'; end if;
  v_answer := (p_answers->>v_i::text)::integer;
  if v_answer<0 or v_answer>3 then raise exception 'Invalid choice'; end if;
  if v_answer=(v_questions->v_i->>'answer')::integer then v_correct:=v_correct+1; end if;
 end loop;
 insert into public.study_quiz_attempts(family_id,quiz_id,user_id,answers,score)
 values(v_family,p_quiz_id,v_user,p_answers,round(100.0*v_correct/v_total)::integer)
 returning id into v_id;
 return query select v_id,round(100.0*v_correct/v_total)::integer;
end $$;
revoke all on function public.submit_study_quiz_attempt(uuid,jsonb) from public,anon;
grant execute on function public.submit_study_quiz_attempt(uuid,jsonb) to authenticated;
revoke insert on public.study_quiz_attempts from authenticated;