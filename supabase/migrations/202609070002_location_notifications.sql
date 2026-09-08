-- Private worker search origin: never returned by public job discovery.
create table private.worker_locations (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 location extensions.geography(Point,4326) not null,
 updated_at timestamptz not null default now()
);
create index worker_locations_gist on private.worker_locations using gist(location);
create function public.set_worker_location(p_lat double precision,p_lng double precision,p_enabled boolean default true)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); begin
 if not p_enabled then delete from private.worker_locations where user_id=u; return; end if;
 if p_lat is null or p_lng is null or not(p_lat between -90 and 90 and p_lng between -180 and 180) then raise exception 'INVALID_LOCATION'; end if;
 insert into private.worker_locations(user_id,location) values(u,extensions.st_setsrid(extensions.st_makepoint(p_lng,p_lat),4326)::extensions.geography)
 on conflict(user_id) do update set location=excluded.location,updated_at=now();
end $$;
revoke all on function public.set_worker_location(double precision,double precision,boolean) from public,anon;
grant execute on function public.set_worker_location(double precision,double precision,boolean) to authenticated;

create function private.match_score(d double precision,radius integer,category_match boolean,available boolean,language_match boolean,pay_match boolean,rating numeric)
returns integer language sql immutable set search_path='' as $$
 select greatest(0,least(100,round((35*(1-least(1,greatest(0,d)/radius))+case when category_match then 25 else 0 end+case when available then 15 else 0 end+case when language_match then 10 else 0 end+case when pay_match then 10 else 0 end+least(5,greatest(0,coalesce(rating,0))))::numeric)::int));
$$;

-- Reject publication without a private point, including accidental privileged data mistakes.
create function private.validate_job_publication() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='active' and old.status<>'active' and not exists(select 1 from public.job_locations where job_id=new.id) then raise exception 'LOCATION_REQUIRED'; end if;
 return new;
end $$;
create trigger nearhire_validate_location before update of status on public.jobs for each row execute function private.validate_job_publication();

-- Targeting executes transactionally on first publication. Reposts have distinct job IDs.
create function private.job_location_events() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid; loc extensions.geography; begin
 if new.status='active' and old.status='draft' then
 select location into loc from public.job_locations where job_id=new.id;
 for target in
 select p.id from private.worker_locations l join public.worker_profiles w on w.user_id=l.user_id join public.profiles p on p.id=l.user_id
 where p.id<>new.poster_id and not p.suspended and p.notifications_enabled and w.available and l.updated_at>now()-interval '30 days'
 and extensions.st_dwithin(l.location,loc,5000) and extensions.st_dwithin(l.location,loc,w.radius_m)
 and (cardinality(w.categories)=0 or new.category=any(w.categories))
 and (cardinality(w.employment_types)=0 or new.employment_type=any(w.employment_types))
 and (cardinality(new.required_languages)=0 or new.required_languages&&p.languages)
 and (w.expected_pay=0 or (w.pay_unit=new.pay_unit and new.pay>=w.expected_pay))
 and not private.blocked(p.id,new.poster_id)
 loop perform private.emit(target,'nearby_job',new.id,'nearby:'||new.id||':'||target); end loop;
 if new.repost_of is not null then perform private.emit(new.poster_id,'job_reposted',new.id,'reposted:'||new.id); end if;
 elsif new.status='filled' and old.status<>'filled' then
 for target in select worker_id from public.applications where job_id=new.id and status='accepted'
 loop perform private.emit(target,'job_filled',new.id,'job:'||new.id||':filled:'||target); end loop;
 end if;
 return new;
end $$;
create trigger nearhire_location_events after update of status on public.jobs for each row execute function private.job_location_events();

-- Successful token deliveries are remembered across partial batch retries. FCM transport is at-least-once.
create table private.notification_deliveries (
 notification_id uuid references public.notifications(id) on delete cascade,
 token_hash text not null, delivered_at timestamptz not null default now(),primary key(notification_id,token_hash)
);
create function public.record_notification_delivery(p_id uuid,p_token text) returns void language sql security definer set search_path='' as $$
 insert into private.notification_deliveries(notification_id,token_hash) values(p_id,encode(extensions.digest(p_token,'sha256'),'hex')) on conflict do nothing;
$$;
revoke all on function public.record_notification_delivery(uuid,text) from public,anon,authenticated;
grant execute on function public.record_notification_delivery(uuid,text) to service_role;
create or replace function public.claim_notifications() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 delete from public.user_devices where updated_at<now()-interval '90 days';
 update private.notification_outbox o set delivered_at=now(),last_error='SUPPRESSED'
 from public.notifications n join public.profiles p on p.id=n.user_id
 where o.id=n.id and o.delivered_at is null and (not p.notifications_enabled or p.suspended or
 (n.event='nearby_job' and not exists(select 1 from public.jobs j where j.id=n.job_id and j.status='active' and j.expires_at>now() and not private.blocked(n.user_id,j.poster_id) and exists(select 1 from private.worker_locations wl join public.worker_profiles wp on wp.user_id=wl.user_id join public.job_locations jl on jl.job_id=j.id where wl.user_id=n.user_id and wp.available and wl.updated_at>now()-interval '30 days' and extensions.st_dwithin(wl.location,jl.location,wp.radius_m) and (cardinality(wp.categories)=0 or j.category=any(wp.categories)) and (cardinality(wp.employment_types)=0 or j.employment_type=any(wp.employment_types)) and (cardinality(j.required_languages)=0 or j.required_languages&&p.languages) and (wp.expected_pay=0 or (wp.pay_unit=j.pay_unit and j.pay>=wp.expected_pay))))));
 with claimed as(select id from private.notification_outbox where delivered_at is null and attempts<8 and available_at<=now() order by available_at,id for update skip locked limit 30),
 updated as(update private.notification_outbox o set attempts=attempts+1,available_at=now()+interval '5 minutes' where id in(select id from claimed) returning o.id)
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'user_id',n.user_id,'event',n.event,'job_id',n.job_id,'tokens',
 (select coalesce(jsonb_agg(d.token),'[]') from public.user_devices d where d.user_id=n.user_id and not exists(select 1 from private.notification_deliveries done where done.notification_id=n.id and done.token_hash=encode(extensions.digest(d.token,'sha256'),'hex'))))),'[]') into result
 from updated x join public.notifications n on n.id=x.id;
 return result;
end $$;

create or replace function public.nearby_jobs(p_lat double precision,p_lng double precision,p_radius integer default 3000,p_filter jsonb default '{}',p_offset integer default 0)
returns table(job jsonb,distance_m integer,match_score integer,approx_lat double precision,approx_lng double precision)
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); origin extensions.geography; begin
 if p_lat is null or p_lng is null or not(p_lat between -90 and 90 and p_lng between -180 and 180) or p_radius is null or p_offset is null or p_radius not in (1000,3000,5000) or p_offset<0 or p_offset>10000 then raise exception 'INVALID_SEARCH'; end if;
 perform private.throttle(u||':nearby',120,60);
 origin:=extensions.st_setsrid(extensions.st_makepoint(p_lng,p_lat),4326)::extensions.geography;
 return query with candidates as (
 select j.*,extensions.st_distance(l.location,origin) d,round(extensions.st_y(l.location::extensions.geometry)::numeric,2)::double precision alat,round(extensions.st_x(l.location::extensions.geometry)::numeric,2)::double precision alng,
 private.match_score(ceil(extensions.st_distance(l.location,origin)/500)*500,p_radius,j.category=any(w.categories) or j.required_skills&&w.skills,w.available,j.required_languages&&pr.languages,w.pay_unit=j.pay_unit and j.pay>=w.expected_pay,(select avg(r.stars) from public.reviews r where r.subject_id=j.poster_id)) score
 from public.jobs j join public.job_locations l on l.job_id=j.id join public.profiles employer on employer.id=j.poster_id join public.worker_profiles w on w.user_id=u join public.profiles pr on pr.id=u
 where j.status='active' and j.expires_at>now() and j.poster_id<>u and not employer.suspended and not private.blocked(u,j.poster_id)
 and extensions.st_dwithin(l.location,origin,p_radius)
 and (coalesce(p_filter->>'kind','')='' or j.kind=p_filter->>'kind') and (coalesce(p_filter->>'category','')='' or j.category=p_filter->>'category')
 and (coalesce(p_filter->>'query','')='' or (j.title||' '||j.description||' '||j.locality) ilike '%'||left(p_filter->>'query',100)||'%')
 and (coalesce(p_filter->>'employment_type','')='' or j.employment_type=p_filter->>'employment_type')
 and (coalesce(p_filter->>'language','')='' or (p_filter->>'language')=any(j.required_languages))
 and j.pay>=coalesce((p_filter->>'min_pay')::numeric,0) and j.pay<=coalesce((p_filter->>'max_pay')::numeric,1000000) and (coalesce(p_filter->>'pay_unit','')='' or j.pay_unit=p_filter->>'pay_unit')
 ) select jsonb_build_object('id',c.id,'poster_id',c.poster_id,'title',c.title,'business_name',c.business_name,'kind',c.kind,'category',c.category,'description',c.description,'pay',c.pay,'pay_unit',c.pay_unit,'employment_type',c.employment_type,'schedule',c.schedule,'required_skills',c.required_skills,'required_languages',c.required_languages,'workers_required',c.workers_required,'experience_years',c.experience_years,'start_date',c.start_date,'benefits',c.benefits,'locality',c.locality,'city',c.city,'district',c.district,'state',c.state,'country',c.country,'status',c.status,'published_at',c.published_at,'expires_at',c.expires_at,'created_at',c.created_at), (ceil(c.d/500)*500)::integer,c.score,c.alat,c.alng from candidates c
 order by case when p_filter->>'sort'='pay' then c.pay end desc,case when p_filter->>'sort'='newest' then c.published_at end desc,case when p_filter->>'sort'='nearest' then c.d end asc,case when coalesce(p_filter->>'sort','recommended')='recommended' then c.score end desc,c.d,c.id limit 20 offset p_offset;
end $$;


create index notification_outbox_pending on private.notification_outbox(available_at,id) where delivered_at is null;
