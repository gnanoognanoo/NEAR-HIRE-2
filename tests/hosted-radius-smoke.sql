-- Hosted smoke test: transaction-scoped identity only, no session tokens or durable fixtures.
begin;
do $$
declare tester uuid; r integer; n integer;
begin
 select id into tester from public.profiles where not suspended limit 1;
 if tester is null then
   tester := gen_random_uuid();
   insert into auth.users(id) values(tester);
 end if;
 perform set_config('request.jwt.claim.sub',tester::text,true);
 foreach r in array array[1000,3000,10000,17000,50000] loop
   select count(*) into n from public.nearby_jobs(13.085,80.21,r);
   if n>20 then raise exception 'HOSTED_PAGINATION_FAILED'; end if;
 end loop;
 foreach r in array array[0,-1000,1500,51000,null::integer] loop
   begin
     perform * from public.nearby_jobs(13.085,80.21,r);
     raise exception 'HOSTED_INVALID_RADIUS_ACCEPTED';
   exception when others then
     if sqlerrm <> 'INVALID_SEARCH' then raise; end if;
   end;
 end loop;
 if not exists(select 1 from pg_indexes where schemaname='public' and tablename='job_locations' and indexdef ilike '%gist%') then raise exception 'HOSTED_SPATIAL_INDEX_MISSING'; end if;
 if exists(select 1 from public.nearby_jobs(13.085,80.21,50000) x where x.job ? 'exact_address' or x.job ? 'latitude' or x.distance_m % 500 <> 0) then raise exception 'HOSTED_PRIVACY_FAILED'; end if;
end $$;
rollback;
select 'PASS' as hosted_radius_validation, 'PASS' as pagination_and_privacy, 'ROLLED_BACK' as test_changes;
