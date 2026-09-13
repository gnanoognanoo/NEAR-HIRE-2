-- V1 integer-kilometre search range. Existing indexes, privacy projection, scoring,
-- rate limiting and 20-row pagination remain unchanged. RPC accepts metres.
alter table public.worker_profiles drop constraint worker_profiles_radius_m_check;
alter table public.worker_profiles add constraint worker_profiles_radius_m_check
  check (radius_m between 1000 and 50000 and radius_m % 1000 = 0);

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
 ) select jsonb_build_object('id',c.id,'poster_id',c.poster_id,'title',c.title,'business_name',c.business_name,'kind',c.kind,'category',c.category,'description',c.description,'pay',c.pay,'pay_unit',c.pay_unit,'employment_type',c.employment_type,'schedule',c.schedule,'required_skills',c.required_skills,'required_languages',c.required_languages,'workers_required',c.workers_required,'experience_years',c.experience_years,'start_date',c.start_date,'benefits',c.benefits,'locality',c.locality,'city',c.city,'district',c.district,'state',c.state,'country',c.country,'status',c.status,'published_at',c.published_at,'expires_at',c.expires_at,'created_at',c.created_at), (ceil(c.d/500)*500)::integer,c.score,c.alat,c.alng from candidates c
 order by case when p_filter->>'sort'='pay' then c.pay end desc,case when p_filter->>'sort'='newest' then c.published_at end desc,case when p_filter->>'sort'='nearest' then c.d end asc,case when coalesce(p_filter->>'sort','recommended')='recommended' then c.score end desc,c.d,c.id limit 20 offset p_offset;
end $$;
