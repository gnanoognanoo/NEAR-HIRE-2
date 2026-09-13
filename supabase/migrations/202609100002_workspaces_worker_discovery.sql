-- Workspace is a UI preference, never an authorization role. Discovery requires separate consent.
alter table public.profiles add column last_workspace text check(last_workspace in ('find','post'));
alter table public.worker_profiles add column discoverable_for_hire boolean not null default false;
create function public.set_workspace(p_workspace text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); begin
 if p_workspace is null or p_workspace not in ('find','post') then raise exception 'INVALID_WORKSPACE'; end if;
 update public.profiles set last_workspace=p_workspace where id=u;
end $$;
create function public.set_worker_discovery(p_enabled boolean,p_lat double precision default null,p_lng double precision default null) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); begin
 if p_enabled is null then raise exception 'INVALID_CONSENT'; end if;
 if p_enabled then perform public.set_worker_location(p_lat,p_lng,true); end if;
 update public.worker_profiles set discoverable_for_hire=p_enabled where user_id=u;
end $$;
-- Coarsen BEFORE distance, filtering and ordering to avoid exact-location membership oracles.
create function private.worker_public_point(p extensions.geography) returns extensions.geography
language sql immutable strict set search_path='' as $$
 select extensions.st_setsrid(extensions.st_makepoint(round(extensions.st_x(p::extensions.geometry)::numeric,2)::double precision,round(extensions.st_y(p::extensions.geometry)::numeric,2)::double precision),4326)::extensions.geography
$$;
create index worker_discovery_coarse_gist on private.worker_locations using gist(private.worker_public_point(location));
create function public.nearby_available_workers(p_lat double precision,p_lng double precision,p_radius integer default 3000,p_filter jsonb default '{}',p_offset integer default 0)
returns table(worker_id uuid,name text,locality text,skills text[],categories text[],employment_types text[],rating numeric,distance_m integer,approx_lat double precision,approx_lng double precision)
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); origin extensions.geography; begin
 if p_lat is null or p_lng is null or not(p_lat between -90 and 90 and p_lng between -180 and 180) or p_radius is null or p_radius not between 1000 and 50000 or p_radius%1000<>0 or p_offset is null or p_offset not between 0 and 10000 then raise exception 'INVALID_SEARCH'; end if;
 perform private.throttle(u||':nearby-workers',120,60);
 origin:=extensions.st_setsrid(extensions.st_makepoint(p_lng,p_lat),4326)::extensions.geography;
 return query select p.id,p.name,p.locality,w.skills,w.categories,w.employment_types,
 (select round(avg(r.stars),1) from public.reviews r where r.subject_id=p.id),
 (ceil(extensions.st_distance(private.worker_public_point(l.location),origin)/500)*500)::integer,
 extensions.st_y(private.worker_public_point(l.location)::extensions.geometry),extensions.st_x(private.worker_public_point(l.location)::extensions.geometry)
 from private.worker_locations l join public.worker_profiles w on w.user_id=l.user_id join public.profiles p on p.id=w.user_id
 where p.id<>u and p.visible and not p.suspended and w.available and w.discoverable_for_hire and l.updated_at>now()-interval '30 days' and not private.blocked(u,p.id)
 and extensions.st_dwithin(private.worker_public_point(l.location),origin,p_radius)
 and (coalesce(p_filter->>'category','')='' or (p_filter->>'category')=any(w.categories))
 and (coalesce(p_filter->>'employment_type','')='' or (p_filter->>'employment_type')=any(w.employment_types))
 and (coalesce(p_filter->>'query','')='' or (p.name||' '||p.locality||' '||array_to_string(w.skills,' ')) ilike '%'||left(p_filter->>'query',100)||'%')
 order by extensions.st_distance(private.worker_public_point(l.location),origin),p.id limit 20 offset p_offset;
end $$;
revoke all on function public.set_workspace(text),public.set_worker_discovery(boolean,double precision,double precision),public.nearby_available_workers(double precision,double precision,integer,jsonb,integer) from public,anon;
grant execute on function public.set_workspace(text),public.set_worker_discovery(boolean,double precision,double precision),public.nearby_available_workers(double precision,double precision,integer,jsonb,integer) to authenticated;
revoke all on function private.worker_public_point(extensions.geography) from public,anon,authenticated;
