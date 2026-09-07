-- Supabase's service role still needs object privileges in addition to bypassing RLS.
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
alter table public.jobs add constraint published_pair check((published_at is null)=(expires_at is null));
alter table public.jobs add constraint active_has_expiry check(status not in ('active','filled','in_progress','completed','expired') or expires_at is not null);
alter table public.jobs add constraint job_region_limits check(length(city)<=120 and length(district)<=120 and length(state)<=120 and length(country)=2);
alter table public.profiles add constraint profile_region_limits check(length(city)<=120 and length(district)<=120 and length(state)<=120 and length(country)=2);
alter table public.jobs add constraint job_arrays_limit check(cardinality(required_languages)<=20 and cardinality(required_skills)<=30);
alter table public.worker_profiles add constraint worker_arrays_limit check(cardinality(categories)<=50 and cardinality(skills)<=30 and cardinality(employment_types)<=10 and cardinality(available_days)<=7);
alter table public.profiles add constraint profile_languages_limit check(cardinality(languages)<=20);

create function public.update_draft(p_job_id uuid,p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); j public.jobs; lat double precision:=(p->>'latitude')::double precision; lng double precision:=(p->>'longitude')::double precision; begin
 select * into j from public.jobs where id=p_job_id and poster_id=u for update;
 if j.id is null or j.status<>'draft' then raise exception 'DRAFT_REQUIRED'; end if;
 if lat is null or lng is null or not(lat between -90 and 90 and lng between -180 and 180) then raise exception 'INVALID_LOCATION'; end if;
 if not exists(select 1 from public.job_categories where id=p->>'category' and kind=p->>'kind') then raise exception 'INVALID_CATEGORY'; end if;
 update public.jobs set title=p->>'title',business_name=coalesce(p->>'business_name',''),description=p->>'description',kind=p->>'kind',category=p->>'category',pay=(p->>'pay')::numeric,pay_unit=p->>'pay_unit',schedule=p->>'schedule',workers_required=(p->>'workers_required')::int,locality=p->>'locality',city=coalesce(p->>'city',''),district=coalesce(p->>'district',''),state=coalesce(p->>'state',''),required_languages=array(select jsonb_array_elements_text(p->'required_languages')),required_skills=array(select jsonb_array_elements_text(p->'required_skills')) where id=j.id;
 update public.job_locations set location=extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography,exact_address=p->>'exact_address' where job_id=j.id;
end $$;
revoke all on function public.update_draft(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.update_draft(uuid,jsonb) to authenticated;

-- Use a protected RPC to mark a partly staffed job filled before its remaining slots expire.
create function public.fill_job(p_job_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); j public.jobs; begin
 select * into j from public.jobs where id=p_job_id and poster_id=u for update;
 if j.id is null or j.status not in ('active','expired') or not exists(select 1 from public.applications where job_id=j.id and status='accepted') then raise exception 'INVALID_TRANSITION'; end if;
 update public.jobs set status='filled' where id=j.id;
end $$;
revoke all on function public.fill_job(uuid) from public,anon,authenticated;
grant execute on function public.fill_job(uuid) to authenticated;

create function public.admin_pricing(p_free integer,p_price integer) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); begin
 if not exists(select 1 from public.admin_users where user_id=u) or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'ADMIN_REQUIRED'; end if;
 update public.pricing_config set free_post_limit=p_free,job_post_price_paise=p_price where id;
 update public.credit_packages set amount_paise=p_price where id='single';
 insert into public.admin_actions(actor_id,action,reason) values(u,'pricing_changed',jsonb_build_object('free_posts',p_free,'single_price_paise',p_price)::text);
end $$;
revoke all on function public.admin_pricing(integer,integer) from public,anon,authenticated;
grant execute on function public.admin_pricing(integer,integer) to authenticated;

