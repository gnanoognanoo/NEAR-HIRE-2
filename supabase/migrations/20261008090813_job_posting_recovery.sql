-- Compatible posting recovery. Keep credit V2 publish_job, RLS and private locations intact.
alter table public.jobs add column is_urgent boolean not null default false;
alter table public.jobs add column start_time time;
-- GPS/manual coordinates are sufficient; reverse geocoding is optional.
alter table public.job_locations drop constraint job_locations_exact_address_check;
alter table public.job_locations add constraint job_locations_exact_address_check check(length(exact_address) between 0 and 500);
create or replace function public.create_job(p jsonb,p_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); j uuid; lat double precision:=(p->>'latitude')::double precision; lng double precision:=(p->>'longitude')::double precision; begin
 if p_request_id is null then raise exception 'INVALID_JOB'; end if;
 if coalesce(p->>'start_date','')<>'' then
  if p->>'start_date' !~ '^\d{4}-\d{2}-\d{2}$' or p->>'start_date'<'1900-01-01' then raise exception 'INVALID_DATE'; end if;
  begin perform (p->>'start_date')::date; exception when others then raise exception 'INVALID_DATE'; end;
 end if;
 if coalesce(p->>'start_time','')<>'' and p->>'start_time' !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'INVALID_TIME'; end if;
 if length(coalesce(p->>'business_name',''))>120 or length(coalesce(p->>'benefits',''))>1000 or length(coalesce(p->>'instructions',''))>1000 or length(coalesce(p->>'city',''))>120 or length(coalesce(p->>'district',''))>120 or length(coalesce(p->>'state',''))>120 then raise exception 'INVALID_JOB'; end if;
 perform private.throttle(u||':post',20,3600);
 if lat is null or lng is null or not(lat between -90 and 90 and lng between -180 and 180) then raise exception 'INVALID_LOCATION'; end if;
 if not exists(select 1 from public.profiles where id=u and length(trim(name))>=2) then raise exception 'PROFILE_REQUIRED'; end if;
 if not exists(select 1 from public.job_categories where id=p->>'category' and kind=p->>'kind') then raise exception 'INVALID_CATEGORY'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_request_id::text,0));
 select id into j from public.jobs where poster_id=u and request_id=p_request_id for update;
 if j is not null and exists(select 1 from public.jobs where id=j and status<>'draft') then return j; end if;
 insert into public.jobs(poster_id,title,business_name,kind,category,description,pay,pay_unit,employment_type,schedule,workers_required,locality,city,district,state,country,required_languages,required_skills,experience_years,start_date,benefits,instructions,is_urgent,start_time,request_id)
 values(u,trim(p->>'title'),coalesce(p->>'business_name',''),p->>'kind',p->>'category',trim(p->>'description'),(p->>'pay')::numeric,p->>'pay_unit',coalesce(p->>'employment_type','temporary'),p->>'schedule',coalesce((p->>'workers_required')::int,1),p->>'locality',coalesce(p->>'city',''),coalesce(p->>'district',''),coalesce(p->>'state',''),coalesce(p->>'country','IN'),array(select jsonb_array_elements_text(p->'required_languages')),array(select jsonb_array_elements_text(p->'required_skills')),coalesce((p->>'experience_years')::numeric,0),nullif(p->>'start_date','')::date,coalesce(p->>'benefits',''),coalesce(p->>'instructions',''),coalesce((p->>'is_urgent')::boolean,false),nullif(p->>'start_time','')::time,p_request_id)
 on conflict(poster_id,request_id) do update set title=excluded.title,business_name=excluded.business_name,kind=excluded.kind,category=excluded.category,description=excluded.description,pay=excluded.pay,pay_unit=excluded.pay_unit,employment_type=excluded.employment_type,schedule=excluded.schedule,workers_required=excluded.workers_required,locality=excluded.locality,city=excluded.city,district=excluded.district,state=excluded.state,country=excluded.country,required_languages=excluded.required_languages,required_skills=excluded.required_skills,experience_years=excluded.experience_years,start_date=excluded.start_date,benefits=excluded.benefits,instructions=excluded.instructions,is_urgent=excluded.is_urgent,start_time=excluded.start_time
 where public.jobs.status='draft' returning id into j;
 insert into public.job_locations values(j,extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography,coalesce(p->>'exact_address',''))
 on conflict(job_id) do update set location=excluded.location,exact_address=excluded.exact_address;
 insert into public.analytics_events(user_id,event,job_id) select u,'job_created',j where not exists(select 1 from public.analytics_events where user_id=u and event='job_created' and job_id=j);
 return j;
end $$;

create or replace function public.nearby_jobs(p_lat double precision,p_lng double precision,p_radius integer default 3000,p_filter jsonb default '{}',p_offset integer default 0)
returns table(job jsonb,distance_m integer,match_score integer,approx_lat double precision,approx_lng double precision)
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); origin extensions.geography; begin
 if p_lat is null or p_lng is null or not(p_lat between -90 and 90 and p_lng between -180 and 180) or p_radius is null or p_offset is null or (p_radius < 1000 or p_radius > 50000 or p_radius % 1000 <> 0) or p_offset<0 or p_offset>10000 then raise exception 'INVALID_SEARCH'; end if;
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
 ) select jsonb_build_object('id',c.id,'poster_id',c.poster_id,'title',c.title,'business_name',c.business_name,'kind',c.kind,'category',c.category,'description',c.description,'pay',c.pay,'pay_unit',c.pay_unit,'employment_type',c.employment_type,'schedule',c.schedule,'required_skills',c.required_skills,'required_languages',c.required_languages,'workers_required',c.workers_required,'experience_years',c.experience_years,'start_date',c.start_date,'start_time',c.start_time,'isUrgent',c.is_urgent,'benefits',c.benefits,'locality',c.locality,'city',c.city,'district',c.district,'state',c.state,'country',c.country,'status',c.status,'published_at',c.published_at,'expires_at',c.expires_at,'created_at',c.created_at), (ceil(c.d/500)*500)::integer,c.score,c.alat,c.alng from candidates c
 order by case when p_filter->>'sort'='pay' then c.pay end desc,case when p_filter->>'sort'='newest' then c.published_at end desc,case when p_filter->>'sort'='nearest' then c.d end asc,case when coalesce(p_filter->>'sort','recommended')='recommended' then c.score end desc,c.d,c.id limit 20 offset p_offset;
end $$;

revoke all on function public.create_job(jsonb,uuid),public.nearby_jobs(double precision,double precision,integer,jsonb,integer) from public,anon;
grant execute on function public.create_job(jsonb,uuid),public.nearby_jobs(double precision,double precision,integer,jsonb,integer) to authenticated;
