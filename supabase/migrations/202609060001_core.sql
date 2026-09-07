create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '' check(length(name)<=80), preferred_language text not null default 'en' check(preferred_language in ('en','ta')),
 locality text not null default '' check(length(locality)<=120), city text not null default '', district text not null default '', state text not null default '', country text not null default 'IN',
 languages text[] not null default '{en}', avatar_path text, visible boolean not null default true, notifications_enabled boolean not null default true,
 suspended boolean not null default false, verified boolean not null default false, created_at timestamptz not null default now()
);
create table public.worker_profiles (
 user_id uuid primary key references public.profiles on delete cascade, categories text[] not null default '{}', skills text[] not null default '{}',
 employment_types text[] not null default '{}', experience_years numeric not null default 0 check(experience_years between 0 and 80),
 expected_pay numeric not null default 0 check(expected_pay between 0 and 1000000), pay_unit text not null default 'day' check(pay_unit in ('hour','day','job','month')),
 radius_m integer not null default 3000 check(radius_m in (1000,3000,5000)), available boolean not null default true,
 available_days text[] not null default '{}', available_time text not null default '' check(length(available_time)<=120)
);
create table public.job_categories (id text primary key, kind text not null check(kind in ('residential','business')), name_en text not null, name_ta text not null);
create table public.jobs (
 id uuid primary key default gen_random_uuid(), poster_id uuid not null references public.profiles on delete cascade,
 title text not null check(length(trim(title)) between 3 and 120), business_name text not null default '' check(length(business_name)<=120),
 kind text not null check(kind in ('residential','business')), category text not null references public.job_categories,
 description text not null check(length(trim(description)) between 10 and 3000), pay numeric not null check(pay>0 and pay<=1000000),
 pay_unit text not null check(pay_unit in ('hour','day','job','month')), employment_type text not null default 'temporary',
 schedule text not null check(length(trim(schedule)) between 1 and 200), required_skills text[] not null default '{}', required_languages text[] not null default '{ta}',
 workers_required integer not null default 1 check(workers_required between 1 and 100), experience_years numeric not null default 0 check(experience_years between 0 and 80),
 start_date date, benefits text not null default '' check(length(benefits)<=1000), instructions text not null default '' check(length(instructions)<=1000),
 locality text not null check(length(trim(locality)) between 2 and 120), city text not null default '', district text not null default '', state text not null default '', country text not null default 'IN',
 status text not null default 'draft' check(status in ('draft','active','filled','in_progress','completed','cancelled','expired','reported','suspended')),
 published_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now(), completed_at timestamptz,
 repost_of uuid references public.jobs on delete set null, request_id uuid not null, unique(poster_id,request_id),
 check((published_at is null and expires_at is null) or expires_at=published_at+interval '24 hours')
);
create table public.job_locations (job_id uuid primary key references public.jobs on delete cascade, location extensions.geography(Point,4326) not null, exact_address text not null check(length(exact_address) between 1 and 500));
create index job_locations_gist on public.job_locations using gist(location);
create index jobs_discovery on public.jobs(status,expires_at,category,kind);
create index jobs_poster on public.jobs(poster_id,created_at desc);
create table public.applications (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.jobs on delete cascade,
 worker_id uuid not null references public.profiles on delete cascade, status text not null default 'pending' check(status in ('pending','shortlisted','accepted','rejected','withdrawn','cancelled','completed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), worker_completed boolean not null default false, employer_completed boolean not null default false,
 unique(job_id,worker_id)
);
create index applications_worker on public.applications(worker_id,created_at desc);
create table public.application_status_history (id bigint generated always as identity primary key, application_id uuid not null references public.applications on delete cascade, actor_id uuid references public.profiles on delete set null, status text not null, created_at timestamptz not null default now());
create table public.reviews (id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications on delete cascade, author_id uuid not null references public.profiles on delete cascade, subject_id uuid not null references public.profiles on delete cascade, stars integer not null check(stars between 1 and 5), body text not null default '' check(length(body)<=1000), created_at timestamptz not null default now(), unique(application_id,author_id), check(author_id<>subject_id));
create table public.blocked_users (blocker_id uuid not null references public.profiles on delete cascade, blocked_id uuid not null references public.profiles on delete cascade, primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id));
create table public.reports (id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles on delete cascade, user_id uuid references public.profiles on delete cascade, job_id uuid references public.jobs on delete cascade, reason text not null check(length(reason) between 3 and 80), detail text not null default '' check(length(detail)<=2000), status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')), created_at timestamptz not null default now(), check(num_nonnulls(user_id,job_id)=1));
create table public.saved_jobs (user_id uuid not null references public.profiles on delete cascade, job_id uuid not null references public.jobs on delete cascade, primary key(user_id,job_id));
create table public.pricing_config (id boolean primary key default true check(id), free_post_limit integer not null default 5 check(free_post_limit between 0 and 100), job_post_price_paise integer not null default 1000 check(job_post_price_paise>0));
insert into public.pricing_config default values;
create table public.credit_packages (id text primary key, label text not null, credits integer not null check(credits>0), amount_paise integer not null check(amount_paise>0), active boolean not null default true);
insert into public.credit_packages values ('single','1 job post',1,1000,true),('ten','10 job posts',10,9000,true),('twenty-five','25 job posts',25,19900,true);
create table public.job_credits (user_id uuid primary key references public.profiles on delete cascade, balance integer not null default 0 check(balance>=0));
create table public.credit_transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade, delta integer not null check(delta<>0), reason text not null, reference text not null unique, created_at timestamptz not null default now());
create table public.payment_orders (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade, request_id uuid not null, provider_order_id text unique, package_id text not null references public.credit_packages, credits integer not null check(credits>0), amount_paise integer not null check(amount_paise>0), currency text not null default 'INR' check(currency='INR'), status text not null default 'created' check(status in ('created','paid','failed')), created_at timestamptz not null default now(), unique(user_id,request_id));
create table public.payments (id text primary key, order_id uuid not null unique references public.payment_orders on delete cascade, amount_paise integer not null, created_at timestamptz not null default now());
create table public.payment_events (event_id text primary key, payment_id text not null, created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade, event text not null, job_id uuid references public.jobs on delete cascade, read_at timestamptz, created_at timestamptz not null default now(), dedupe_key text unique);
create index notifications_user on public.notifications(user_id,created_at desc);
create table public.user_devices (token text primary key check(length(token) between 10 and 4096), user_id uuid not null references public.profiles on delete cascade, platform text not null check(platform in ('android','ios')), updated_at timestamptz not null default now());
create table private.notification_outbox (id uuid primary key references public.notifications on delete cascade, attempts integer not null default 0, available_at timestamptz not null default now(), delivered_at timestamptz, last_error text);
create table public.admin_users (user_id uuid primary key references public.profiles on delete cascade);
create table public.admin_actions (id bigint generated always as identity primary key, actor_id uuid references public.profiles on delete set null, action text not null, target_id uuid, reason text not null, created_at timestamptz not null default now());
create table public.analytics_events (id bigint generated always as identity primary key, user_id uuid references public.profiles on delete set null, event text not null, job_id uuid references public.jobs on delete set null, created_at timestamptz not null default now());
create table private.rate_limits (key text primary key, hits integer not null default 1, window_at timestamptz not null default now());

create function private.actor() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); begin
 if u is null or not exists(select 1 from public.profiles where id=u and not suspended) then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 return u;
end $$;
create function private.blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.blocked_users where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a)); $$;
create function private.throttle(k text,lim integer,seconds integer) returns void language plpgsql security definer set search_path='' as $$
declare n integer; begin
 insert into private.rate_limits(key) values(k) on conflict(key) do update set hits=case when private.rate_limits.window_at<now()-make_interval(secs=>seconds) then 1 else private.rate_limits.hits+1 end,window_at=case when private.rate_limits.window_at<now()-make_interval(secs=>seconds) then now() else private.rate_limits.window_at end returning hits into n;
 if n>lim then raise exception 'RATE_LIMITED'; end if;
end $$;
create function private.emit(u uuid,e text,j uuid,k text) returns void language plpgsql security definer set search_path='' as $$
declare n uuid; begin
 insert into public.notifications(user_id,event,job_id,dedupe_key) values(u,e,j,k) on conflict(dedupe_key) do nothing returning id into n;
 if n is not null then insert into private.notification_outbox(id) values(n); end if;
end $$;
create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare credits integer; begin
 insert into public.profiles(id) values(new.id);
 insert into public.worker_profiles(user_id) values(new.id);
 select free_post_limit into credits from public.pricing_config where id;
 insert into public.job_credits(user_id,balance) values(new.id,credits);
 if credits>0 then insert into public.credit_transactions(user_id,delta,reason,reference) values(new.id,credits,'signup','signup:'||new.id); end if;
 return new;
end $$;
create trigger nearhire_signup after insert on auth.users for each row execute function private.new_user();

-- Default deny. Only explicit read policies and security-definer RPCs grant access.
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy profiles_self on public.profiles for select to authenticated using(id=auth.uid());
create policy worker_self on public.worker_profiles for select to authenticated using(user_id=auth.uid());
create policy jobs_own on public.jobs for select to authenticated using(poster_id=auth.uid());
create policy locations_own on public.job_locations for select to authenticated using(exists(select 1 from public.jobs where id=job_id and poster_id=auth.uid()));
create policy applications_parties on public.applications for select to authenticated using(worker_id=auth.uid() or exists(select 1 from public.jobs where id=job_id and poster_id=auth.uid()));
create policy history_parties on public.application_status_history for select to authenticated using(exists(select 1 from public.applications where id=application_id));
create policy review_self on public.reviews for select to authenticated using(author_id=auth.uid() or subject_id=auth.uid());
create policy block_self on public.blocked_users for select to authenticated using(blocker_id=auth.uid());
create policy reports_self on public.reports for select to authenticated using(reporter_id=auth.uid());
create policy saved_self on public.saved_jobs for select to authenticated using(user_id=auth.uid());
create policy credits_self on public.job_credits for select to authenticated using(user_id=auth.uid());
create policy ledger_self on public.credit_transactions for select to authenticated using(user_id=auth.uid());
create policy orders_self on public.payment_orders for select to authenticated using(user_id=auth.uid());
create policy payments_self on public.payments for select to authenticated using(exists(select 1 from public.payment_orders where id=order_id and user_id=auth.uid()));
create policy notifications_self on public.notifications for select to authenticated using(user_id=auth.uid());
create policy devices_self on public.user_devices for select to authenticated using(user_id=auth.uid());
create policy categories_read on public.job_categories for select to authenticated using(true);
create policy pricing_read on public.pricing_config for select to authenticated using(true);
create policy packages_read on public.credit_packages for select to authenticated using(active);
create policy admin_self on public.admin_users for select to authenticated using(user_id=auth.uid());

create function public.save_profile(p jsonb) returns public.profiles language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); result public.profiles; begin
 if length(trim(p->>'name')) not between 2 and 80 or length(trim(p->>'locality')) not between 2 and 120 then raise exception 'INVALID_PROFILE'; end if;
 update public.profiles set name=trim(p->>'name'),preferred_language=coalesce(p->>'preferred_language','en'), locality=trim(p->>'locality'),city=coalesce(p->>'city',''),district=coalesce(p->>'district',''),state=coalesce(p->>'state',''),country=coalesce(p->>'country','IN'),languages=coalesce(array(select jsonb_array_elements_text(p->'languages')),'{en}'),visible=coalesce((p->>'visible')::boolean,true),notifications_enabled=coalesce((p->>'notifications_enabled')::boolean,true) where id=u returning * into result;
 return result;
end $$;
create function public.save_preferences(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); begin
 update public.worker_profiles set categories=array(select jsonb_array_elements_text(p->'categories')),skills=array(select jsonb_array_elements_text(p->'skills')),employment_types=array(select jsonb_array_elements_text(p->'employment_types')),experience_years=coalesce((p->>'experience_years')::numeric,0),expected_pay=coalesce((p->>'expected_pay')::numeric,0),pay_unit=coalesce(p->>'pay_unit','day'),radius_m=coalesce((p->>'radius_m')::integer,3000),available=coalesce((p->>'available')::boolean,true),available_days=array(select jsonb_array_elements_text(p->'available_days')),available_time=coalesce(p->>'available_time','') where user_id=u;
end $$;

create function public.create_job(p jsonb,p_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); j uuid; lat double precision:=(p->>'latitude')::double precision; lng double precision:=(p->>'longitude')::double precision; begin
 perform private.throttle(u||':post',20,3600);
 if lat is null or lng is null or not(lat between -90 and 90 and lng between -180 and 180) then raise exception 'INVALID_LOCATION'; end if;
 if not exists(select 1 from public.profiles where id=u and length(trim(name))>=2) then raise exception 'PROFILE_REQUIRED'; end if;
 if not exists(select 1 from public.job_categories where id=p->>'category' and kind=p->>'kind') then raise exception 'INVALID_CATEGORY'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_request_id::text,0));
 select id into j from public.jobs where poster_id=u and request_id=p_request_id;
 if j is not null then return j; end if;
 insert into public.jobs(poster_id,title,business_name,kind,category,description,pay,pay_unit,employment_type,schedule,workers_required,locality,city,district,state,country,required_languages,required_skills,experience_years,start_date,benefits,instructions,request_id)
 values(u,trim(p->>'title'),coalesce(p->>'business_name',''),p->>'kind',p->>'category',trim(p->>'description'),(p->>'pay')::numeric,p->>'pay_unit',coalesce(p->>'employment_type','temporary'),p->>'schedule',coalesce((p->>'workers_required')::int,1),p->>'locality',coalesce(p->>'city',''),coalesce(p->>'district',''),coalesce(p->>'state',''),coalesce(p->>'country','IN'),array(select jsonb_array_elements_text(p->'required_languages')),array(select jsonb_array_elements_text(p->'required_skills')),coalesce((p->>'experience_years')::numeric,0),nullif(p->>'start_date','')::date,coalesce(p->>'benefits',''),coalesce(p->>'instructions',''),p_request_id) returning id into j;
 insert into public.job_locations values(j,extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography,p->>'exact_address');
 insert into public.analytics_events(user_id,event,job_id) values(u,'job_created',j);
 return j;
end $$;
create function public.publish_job(p_job_id uuid) returns public.jobs language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); j public.jobs; begin
 select * into j from public.jobs where id=p_job_id and poster_id=u for update;
 if j.id is null then raise exception 'NOT_FOUND'; end if;
 if j.status='active' then return j; end if;
 if j.status<>'draft' then raise exception 'INVALID_TRANSITION'; end if;
 update public.job_credits set balance=balance-1 where user_id=u and balance>0;
 if not found then raise exception 'CREDITS_REQUIRED'; end if;
 insert into public.credit_transactions(user_id,delta,reason,reference) values(u,-1,'publish','publish:'||j.id);
 update public.jobs set status='active',published_at=now(),expires_at=now()+interval '24 hours' where id=j.id returning * into j;
 insert into public.analytics_events(user_id,event,job_id) values(u,'job_published',j.id);
 return j;
end $$;
create function public.repost_job(p_job_id uuid,p_request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); j public.jobs; loc public.job_locations; n uuid; begin
 select * into j from public.jobs where id=p_job_id and poster_id=u;
 if j.id is null or not(j.status='expired' or (j.status='active' and j.expires_at<=now())) then raise exception 'REPOST_UNAVAILABLE'; end if;
 select * into loc from public.job_locations where job_id=j.id;
 n:=public.create_job(to_jsonb(j)||jsonb_build_object('latitude',extensions.st_y(loc.location::extensions.geometry),'longitude',extensions.st_x(loc.location::extensions.geometry),'exact_address',loc.exact_address),p_request_id);
 update public.jobs set repost_of=j.id where id=n;
 perform public.publish_job(n);
 return n;
end $$;

create function public.nearby_jobs(p_lat double precision,p_lng double precision,p_radius integer default 3000,p_filter jsonb default '{}',p_offset integer default 0)
returns table(job jsonb,distance_m integer,match_score integer,approx_lat double precision,approx_lng double precision)
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=private.actor(); origin extensions.geography; begin
 if p_lat is null or p_lng is null or not(p_lat between -90 and 90 and p_lng between -180 and 180) or p_radius not in (1000,3000,5000) or p_offset<0 or p_offset>10000 then raise exception 'INVALID_SEARCH'; end if;
 origin:=extensions.st_setsrid(extensions.st_makepoint(p_lng,p_lat),4326)::extensions.geography;
 return query with candidates as (
 select j.*,extensions.st_distance(l.location,origin) d,round(extensions.st_y(l.location::extensions.geometry)::numeric,2)::double precision alat,round(extensions.st_x(l.location::extensions.geometry)::numeric,2)::double precision alng,
 (35*(1-least(1,extensions.st_distance(l.location,origin)/p_radius))+case when j.category=any(w.categories) then 25 else 0 end+case when w.available then 15 else 0 end+case when j.required_languages&&pr.languages then 10 else 0 end+case when w.pay_unit=j.pay_unit and j.pay>=w.expected_pay then 10 else 0 end+coalesce((select avg(r.stars) from public.reviews r where r.subject_id=j.poster_id),0))::int score
 from public.jobs j join public.job_locations l on l.job_id=j.id join public.profiles employer on employer.id=j.poster_id join public.worker_profiles w on w.user_id=u join public.profiles pr on pr.id=u
 where j.status='active' and j.expires_at>now() and j.poster_id<>u and not employer.suspended and not private.blocked(u,j.poster_id)
 and extensions.st_dwithin(l.location,origin,p_radius)
 and (coalesce(p_filter->>'kind','')='' or j.kind=p_filter->>'kind') and (coalesce(p_filter->>'category','')='' or j.category=p_filter->>'category')
 and (coalesce(p_filter->>'query','')='' or (j.title||' '||j.description||' '||j.locality) ilike '%'||left(p_filter->>'query',100)||'%')
 and (coalesce(p_filter->>'employment_type','')='' or j.employment_type=p_filter->>'employment_type')
 and (coalesce(p_filter->>'language','')='' or (p_filter->>'language')=any(j.required_languages))
 and j.pay>=coalesce((p_filter->>'min_pay')::numeric,0)
 ) select to_jsonb(c)-'d'-'alat'-'alng'-'score', (ceil(c.d/500)*500)::integer,c.score,c.alat,c.alng from candidates c
 order by case when p_filter->>'sort'='pay' then c.pay end desc,case when p_filter->>'sort'='newest' then c.published_at end desc,case when p_filter->>'sort'='nearest' then c.d end asc,case when coalesce(p_filter->>'sort','recommended')='recommended' then c.score end desc,c.d,c.id limit 20 offset p_offset;
end $$;

create function public.apply_job(p_job_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); j public.jobs; a uuid; begin
 perform private.throttle(u||':apply',30,3600);
 select * into j from public.jobs where id=p_job_id for update;
 if j.id is null or j.poster_id=u or j.status<>'active' or j.expires_at<=now() or private.blocked(u,j.poster_id) or exists(select 1 from public.profiles where id=j.poster_id and suspended) then raise exception 'JOB_UNAVAILABLE'; end if;
 insert into public.applications(job_id,worker_id) values(j.id,u) on conflict(job_id,worker_id) do update set status='pending',updated_at=now() where applications.status='withdrawn' returning id into a;
 if a is null then raise exception 'ALREADY_APPLIED'; end if;
 insert into public.application_status_history(application_id,actor_id,status) values(a,u,'pending');
 perform private.emit(j.poster_id,'application_received',j.id,'apply:'||a||':'||now());
 insert into public.analytics_events(user_id,event,job_id) values(u,'application_submitted',j.id);
 return a;
end $$;
create function public.decide_application(p_application_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); a public.applications; j public.jobs; jid uuid; begin
 select job_id into jid from public.applications where id=p_application_id;
 select * into j from public.jobs where id=jid for update;
 select * into a from public.applications where id=p_application_id for update;
 if a.id is null or private.blocked(a.worker_id,j.poster_id) then raise exception 'NOT_FOUND'; end if;
 if p_status='withdrawn' then
  if a.worker_id<>u or a.status not in ('pending','shortlisted') then raise exception 'INVALID_TRANSITION'; end if;
 else
  if j.poster_id<>u or p_status not in ('accepted','rejected','shortlisted') or a.status not in ('pending','shortlisted') then raise exception 'INVALID_TRANSITION'; end if;
  if p_status in ('accepted','shortlisted') and (j.status<>'active' or j.expires_at<=now()) then raise exception 'JOB_UNAVAILABLE'; end if;
  if p_status='accepted' and exists(select 1 from public.profiles where id=a.worker_id and suspended) then raise exception 'WORKER_UNAVAILABLE'; end if;
 end if;
 update public.applications set status=p_status,updated_at=now() where id=a.id;
 insert into public.application_status_history(application_id,actor_id,status) values(a.id,u,p_status);
 if p_status='accepted' and (select count(*) from public.applications where job_id=j.id and status='accepted')>=j.workers_required then
  update public.jobs set status='filled' where id=j.id;
 end if;
 perform private.emit(case when u=a.worker_id then j.poster_id else a.worker_id end,'application_'||p_status,j.id,'decision:'||a.id||':'||p_status);
 insert into public.analytics_events(user_id,event,job_id) values(u,'application_'||p_status,j.id);
end $$;
create function public.transition_job(p_job_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); j public.jobs; a record; begin
 select * into j from public.jobs where id=p_job_id and poster_id=u for update;
 if j.id is null then raise exception 'NOT_FOUND'; end if;
 if not((p_status='in_progress' and j.status='filled') or (p_status='cancelled' and j.status in ('draft','active','filled'))) then raise exception 'INVALID_TRANSITION'; end if;
 update public.jobs set status=p_status where id=j.id;
 if p_status='cancelled' then update public.applications set status='cancelled',updated_at=now() where job_id=j.id and status in ('pending','shortlisted','accepted'); end if;
 for a in select worker_id from public.applications where job_id=j.id loop perform private.emit(a.worker_id,'job_'||p_status,j.id,'job:'||j.id||':'||p_status||':'||a.worker_id); end loop;
end $$;
create function public.confirm_completion(p_application_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); a public.applications; j public.jobs; jid uuid; begin
 select job_id into jid from public.applications where id=p_application_id;
 select * into j from public.jobs where id=jid for update;
 select * into a from public.applications where id=p_application_id for update;
 if a.id is null or u not in (a.worker_id,j.poster_id) or j.status not in ('in_progress','completed') or a.status not in ('accepted','completed') then raise exception 'INVALID_TRANSITION'; end if;
 update public.applications set worker_completed=worker_completed or u=a.worker_id,employer_completed=employer_completed or u=j.poster_id where id=a.id returning * into a;
 if a.worker_completed and a.employer_completed then
  update public.applications set status='completed' where id=a.id;
  if not exists(select 1 from public.applications where job_id=j.id and status='accepted') then update public.jobs set status='completed',completed_at=now() where id=j.id; end if;
  perform private.emit(a.worker_id,'work_completed',j.id,'completed:'||a.id||':worker');
  perform private.emit(j.poster_id,'work_completed',j.id,'completed:'||a.id||':poster');
 end if;
end $$;
create function public.private_contact(p_application_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=private.actor(); a public.applications; j public.jobs; loc public.job_locations; other_id uuid; phone text; begin
 select * into a from public.applications where id=p_application_id;
 select * into j from public.jobs where id=a.job_id;
 if a.id is null or u not in (a.worker_id,j.poster_id) or a.status not in ('accepted','completed') or j.status in ('cancelled','suspended','reported') or private.blocked(a.worker_id,j.poster_id) then raise exception 'CONTACT_LOCKED' using errcode='42501'; end if;
 other_id:=case when u=a.worker_id then j.poster_id else a.worker_id end;
 if exists(select 1 from public.profiles where id=other_id and suspended) then raise exception 'CONTACT_LOCKED'; end if;
 select au.phone into phone from auth.users au where id=other_id;
 select * into loc from public.job_locations where job_id=j.id;
 return jsonb_build_object('phone',phone,'exact_address',loc.exact_address,'latitude',extensions.st_y(loc.location::extensions.geometry),'longitude',extensions.st_x(loc.location::extensions.geometry));
end $$;
create function public.submit_review(p_application_id uuid,p_stars integer,p_body text default '') returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); a public.applications; poster uuid; subject uuid; begin
 select * into a from public.applications where id=p_application_id;
 select poster_id into poster from public.jobs where id=a.job_id;
 if a.id is null or a.status<>'completed' or u not in (a.worker_id,poster) then raise exception 'REVIEW_UNAVAILABLE'; end if;
 subject:=case when u=poster then a.worker_id else poster end;
 insert into public.reviews(application_id,author_id,subject_id,stars,body) values(a.id,u,subject,p_stars,p_body);
 perform private.emit(subject,'new_review',a.job_id,'review:'||a.id||':'||u);
end $$;
create function public.safety_action(p_action text,p_target uuid,p_reason text default '',p_detail text default '') returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); begin
 perform private.throttle(u||':safety',20,3600);
 if p_action='block' then insert into public.blocked_users values(u,p_target) on conflict do nothing;
 elsif p_action='unblock' then delete from public.blocked_users where blocker_id=u and blocked_id=p_target;
 elsif p_action='report_job' then insert into public.reports(reporter_id,job_id,reason,detail) values(u,p_target,p_reason,p_detail);
 elsif p_action='report_user' then insert into public.reports(reporter_id,user_id,reason,detail) values(u,p_target,p_reason,p_detail);
 else raise exception 'INVALID_ACTION'; end if;
end $$;
create function public.toggle_saved(p_job_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); begin
 delete from public.saved_jobs where user_id=u and job_id=p_job_id; if found then return false; end if;
 if not exists(select 1 from public.jobs where id=p_job_id and status='active' and expires_at>now() and not private.blocked(u,poster_id)) then raise exception 'JOB_UNAVAILABLE'; end if;
 insert into public.saved_jobs values(u,p_job_id); return true;
end $$;
create function public.my_activity(p_mode text,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=private.actor(); result jsonb; begin
 if p_offset<0 or p_offset>10000 then raise exception 'INVALID_PAGE'; end if;
 if p_mode='posts' then select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select * from public.jobs where poster_id=u order by created_at desc,id limit 20 offset p_offset) x;
 elsif p_mode='saved' then select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select j.* from public.saved_jobs s join public.jobs j on j.id=s.job_id where s.user_id=u and not private.blocked(u,j.poster_id) order by j.created_at desc,j.id limit 20 offset p_offset) x;
 else select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select a.*,j.title,j.poster_id,j.status job_status,p.name worker_name,w.categories,w.skills,w.experience_years,(select avg(stars) from public.reviews where subject_id=p.id) rating from public.applications a join public.jobs j on j.id=a.job_id join public.profiles p on p.id=a.worker_id join public.worker_profiles w on w.user_id=a.worker_id where (p_mode='applications' and a.worker_id=u) or (p_mode='applicants' and j.poster_id=u) order by a.created_at desc,a.id limit 20 offset p_offset) x; end if;
 return result;
end $$;
create function public.register_device(p_token text,p_platform text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); begin
 perform private.throttle(u||':device',10,3600);
 insert into public.user_devices(token,user_id,platform) values(p_token,u,p_platform) on conflict(token) do update set user_id=u,updated_at=now();
end $$;
create function public.read_notification(p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin update public.notifications set read_at=now() where id=p_id and user_id=private.actor(); end $$;
create function public.expire_jobs() returns integer language plpgsql security definer set search_path='' as $$
declare j record; n integer:=0; begin
 for j in update public.jobs set status='expired' where status='active' and expires_at<=now() returning id,poster_id loop
  perform private.emit(j.poster_id,'job_expired',j.id,'expired:'||j.id); n:=n+1;
  insert into public.analytics_events(user_id,event,job_id) values(j.poster_id,'job_expired',j.id);
 end loop; return n;
end $$;

-- Explicit RPC allowlist; postgres-owned private helpers are never executable by clients.
revoke execute on all functions in schema public from public,anon,authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function public.save_profile(jsonb),public.save_preferences(jsonb),public.create_job(jsonb,uuid),public.publish_job(uuid),public.repost_job(uuid,uuid),public.nearby_jobs(double precision,double precision,integer,jsonb,integer),public.apply_job(uuid),public.decide_application(uuid,text),public.transition_job(uuid,text),public.confirm_completion(uuid),public.private_contact(uuid),public.submit_review(uuid,integer,text),public.safety_action(text,uuid,text,text),public.toggle_saved(uuid),public.my_activity(text,integer),public.register_device(text,text),public.read_notification(uuid) to authenticated;
grant execute on function public.expire_jobs() to service_role;
