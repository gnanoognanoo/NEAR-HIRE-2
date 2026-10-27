-- Preserve strict create_job validation while adapting SQL time serialization.
-- No tables, RLS policies, auth or payment configuration are changed.
create or replace function public.repost_job(p_job_id uuid,p_request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); j public.jobs; loc public.job_locations; prior public.jobs; n uuid; begin
 if p_request_id is null then raise exception 'INVALID_JOB'; end if;
 select * into j from public.jobs where id=p_job_id and poster_id=u;
 if j.id is null or not(j.status='expired' or (j.status='active' and j.expires_at<=now())) then raise exception 'REPOST_UNAVAILABLE'; end if;
 -- Same lock/key as create_job: retries must not reassign an unrelated job.
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_request_id::text,0));
 select * into prior from public.jobs where poster_id=u and request_id=p_request_id;
 if prior.id is not null then
  if prior.repost_of is distinct from j.id then raise exception 'REPOST_REQUEST_CONFLICT'; end if;
  return prior.id;
 end if;
 select * into loc from public.job_locations where job_id=j.id;
 n:=public.create_job(to_jsonb(j)||jsonb_build_object(
  'start_time',coalesce(to_char(j.start_time,'HH24:MI'),''),
  'latitude',extensions.st_y(loc.location::extensions.geometry),
  'longitude',extensions.st_x(loc.location::extensions.geometry),
  'exact_address',loc.exact_address),p_request_id);
 update public.jobs set repost_of=j.id where id=n;
 perform public.publish_job(n);
 return n;
end $$;
revoke all on function public.repost_job(uuid,uuid) from public,anon;
grant execute on function public.repost_job(uuid,uuid) to authenticated;
