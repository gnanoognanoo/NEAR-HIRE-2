-- Credit V2: preserve historical ledger, payment ownership and atomic publish/repost.
begin;
lock table public.job_credits, public.credit_transactions in share row exclusive mode;
do $$ begin
 if exists(select 1 from public.job_credits c where c.balance<>(select coalesce(sum(delta),0) from public.credit_transactions t where t.user_id=c.user_id)) then
  raise exception 'CREDIT_RECONCILIATION_REQUIRED';
 end if;
end $$;
alter table public.pricing_config add column monthly_free_credits integer not null default 2 check(monthly_free_credits between 0 and 100),
 add column monthly_enabled boolean not null default true,
 add column monthly_expiry_days integer not null default 30 check(monthly_expiry_days between 1 and 366),
 add column publish_cost integer not null default 1 check(publish_cost=1),
 add column repost_cost integer not null default 1 check(repost_cost=1);
update public.pricing_config set free_post_limit=10 where id;
alter table public.credit_transactions add column grant_month date, add column expires_at timestamptz;
create unique index monthly_credit_once on public.credit_transactions(user_id,grant_month) where reason='monthly_free';
create unique index welcome_upgrade_once on public.credit_transactions(user_id) where reason='welcome_upgrade';
alter table public.credit_transactions add constraint monthly_credit_shape check(reason<>'monthly_free' or (delta>0 and grant_month is not null and expires_at is not null));

create table public.credit_lots(
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.profiles on delete set null,
 transaction_id uuid not null unique references public.credit_transactions on delete restrict,
 source text not null, original_amount integer not null check(original_amount>0),
 remaining integer not null check(remaining>=0 and remaining<=original_amount),
 granted_at timestamptz not null, expires_at timestamptz,
 check((source='monthly_free')=(expires_at is not null))
);
create index credit_lots_spend on public.credit_lots(user_id,expires_at,granted_at,id) where remaining>0;
alter table public.credit_lots enable row level security;
create policy lots_self on public.credit_lots for select to authenticated using(user_id=auth.uid());
grant select on public.credit_lots to authenticated;
grant all on public.credit_lots to service_role;
-- Allocate old debits FIFO across historical positives without modifying history or totals.
insert into public.credit_lots(user_id,transaction_id,source,original_amount,remaining,granted_at)
select user_id,id,reason,delta,
 greatest(0,delta-greatest(0,debits-prior_positive))::int,created_at
from (
 select t.*,coalesce(sum(delta) over(partition by user_id order by created_at,id rows between unbounded preceding and 1 preceding),0) prior_positive,
 (select -coalesce(sum(d.delta),0) from public.credit_transactions d where d.user_id=t.user_id and d.delta<0) debits
 from public.credit_transactions t where delta>0 and user_id is not null
) x;

-- All post-migration ledger writes drive both the cache and lots in the same transaction.
create function private.account_credit() returns trigger language plpgsql security definer set search_path='' as $$
declare l public.credit_lots; needed integer; used integer; begin
 if new.user_id is null then return new; end if;
 perform 1 from public.job_credits where user_id=new.user_id for update;
 if not found then raise exception 'CREDIT_ACCOUNT_MISSING'; end if;
 if new.delta>0 then
  insert into public.credit_lots(user_id,transaction_id,source,original_amount,remaining,granted_at,expires_at)
  values(new.user_id,new.id,new.reason,new.delta,new.delta,new.created_at,new.expires_at);
 elsif new.reason='monthly_expired' then
  update public.credit_lots set remaining=0 where id=(new.metadata->>'lot_id')::uuid and user_id=new.user_id and source='monthly_free' and remaining=-new.delta and expires_at<=now();
  if not found then raise exception 'INVALID_CREDIT_EXPIRY'; end if;
 else
  needed:=-new.delta;
  for l in select * from public.credit_lots where user_id=new.user_id and remaining>0 and (expires_at is null or expires_at>now())
   order by expires_at asc nulls last,case when source in ('signup','welcome_upgrade') then 0 else 1 end,granted_at,id for update
  loop
   used:=least(needed,l.remaining);
   update public.credit_lots set remaining=remaining-used where id=l.id;
   needed:=needed-used;
   exit when needed=0;
  end loop;
  if needed>0 then raise exception 'CREDITS_REQUIRED'; end if;
 end if;
 update public.job_credits set balance=balance+new.delta where user_id=new.user_id;
 return new;
end $$;
create trigger credit_accounting after insert on public.credit_transactions for each row execute function private.account_credit();
revoke all on function private.account_credit() from public,anon,authenticated;

create function private.expire_credits(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.credit_lots; begin
 perform 1 from public.job_credits where user_id=p_user for update;
 for l in select * from public.credit_lots where user_id=p_user and remaining>0 and expires_at<=now() order by expires_at,id for update loop
  insert into public.credit_transactions(user_id,delta,reason,reference,metadata,expires_at)
  values(p_user,-l.remaining,'monthly_expired','expire:'||l.id,jsonb_build_object('lot_id',l.id),l.expires_at) on conflict(reference) do nothing;
 end loop;
end $$;
create function private.ensure_monthly_credit(p_user uuid,p_at timestamptz default now()) returns void language plpgsql security definer set search_path='' as $$
declare c public.pricing_config; m date:=(date_trunc('month',p_at at time zone 'UTC'))::date; begin
 perform 1 from public.job_credits where user_id=p_user for update;
 if not found then return; end if;
 perform private.expire_credits(p_user);
 if not exists(select 1 from public.profiles p join auth.users a on a.id=p.id where p.id=p_user and not p.suspended)
  or exists(select 1 from public.admin_users where user_id=p_user) then return; end if;
 select * into c from public.pricing_config where id;
 if not c.monthly_enabled or c.monthly_free_credits=0 then return; end if;
 insert into public.credit_transactions(user_id,delta,reason,reference,created_at,grant_month,expires_at,metadata)
 values(p_user,c.monthly_free_credits,'monthly_free','monthly:'||p_user||':'||m,p_at,m,p_at+make_interval(days=>c.monthly_expiry_days),jsonb_build_object('expiry_days',c.monthly_expiry_days))
 on conflict do nothing;
end $$;
-- No public caller can choose an account, clock, amount, period or expiry.
revoke all on function private.expire_credits(uuid),private.ensure_monthly_credit(uuid,timestamptz) from public,anon,authenticated;

create function private.provision_credits(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare amount integer; begin
 insert into public.job_credits(user_id,balance) values(p_user,0) on conflict do nothing;
 perform 1 from public.job_credits where user_id=p_user for update;
 select free_post_limit into amount from public.pricing_config where id;
 if amount>0 then
  insert into public.credit_transactions(user_id,delta,reason,reference) values(p_user,amount,'signup','signup:'||p_user) on conflict do nothing;
 end if;
 perform private.ensure_monthly_credit(p_user);
end $$;
revoke all on function private.provision_credits(uuid) from public,anon,authenticated;
create or replace function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id) values(new.id) on conflict do nothing;
 insert into public.worker_profiles(user_id) values(new.id) on conflict do nothing;
 perform private.provision_credits(new.id);
 return new;
end $$;

create function private.upgrade_welcome(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.job_credits where user_id=p_user for update;
 -- Conservative: ambiguous positive admin/test awards need review, not an automatic top-up.
 if exists(select 1 from public.credit_transactions where user_id=p_user and reason='signup' and delta=5)
  and not exists(select 1 from public.credit_transactions where user_id=p_user and delta>0 and reason not in ('signup','purchase','monthly_free')) then
  insert into public.credit_transactions(user_id,delta,reason,reference,metadata)
  values(p_user,5,'welcome_upgrade','welcome_v2_adjustment:'||p_user,'{"previous_entitlement":5,"new_entitlement":10}') on conflict do nothing;
 end if;
end $$;
revoke all on function private.upgrade_welcome(uuid) from public,anon,authenticated;
select private.upgrade_welcome(user_id) from public.job_credits order by user_id;

create function public.credit_summary() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); result jsonb; begin
 perform private.ensure_monthly_credit(u);
 select jsonb_build_object('balance',coalesce(sum(remaining),0),
  'monthly',coalesce(sum(remaining) filter(where source='monthly_free'),0),
  'other',coalesce(sum(remaining) filter(where expires_at is null),0),
  'welcome',coalesce(sum(remaining) filter(where source in ('signup','welcome_upgrade')),0),
  'purchased',coalesce(sum(remaining) filter(where source='purchase'),0),
  'next_expiry',min(expires_at) filter(where remaining>0),
  'server_now',now(),'publish_cost',1,'repost_cost',1)
 into result from public.credit_lots where user_id=u and (expires_at is null or expires_at>now());
 return result;
end $$;
revoke all on function public.credit_summary() from public,anon,authenticated;
grant execute on function public.credit_summary() to authenticated;

create or replace function public.publish_job(p_job_id uuid) returns public.jobs language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); j public.jobs; begin
 select * into j from public.jobs where id=p_job_id and poster_id=u for update;
 if j.id is null then raise exception 'NOT_FOUND'; end if;
 if j.status='active' then return j; end if;
 if j.status<>'draft' then raise exception 'INVALID_TRANSITION'; end if;
 perform private.ensure_monthly_credit(u);
 insert into public.credit_transactions(user_id,delta,reason,reference) values(u,-1,'publish','publish:'||j.id);
 update public.jobs set status='active',published_at=now(),expires_at=now()+interval '24 hours' where id=j.id returning * into j;
 insert into public.analytics_events(user_id,event,job_id) values(u,'job_published',j.id);
 return j;
end $$;

create or replace function public.settle_payment(p_event_id text,p_payment_id text,p_order_id text,p_amount integer,p_currency text) returns void language plpgsql security definer set search_path='' as $$
declare o public.payment_orders; prior public.payment_events; begin
 select * into o from public.payment_orders where provider_order_id=p_order_id for update;
 if o.id is null or o.amount_paise<>p_amount or p_currency<>o.currency or p_payment_id is null or p_event_id is null then raise exception 'PAYMENT_MISMATCH'; end if;
 select * into prior from public.payment_events where event_id=p_event_id;
 if prior.event_id is not null and prior.payment_id<>p_payment_id then raise exception 'EVENT_CONFLICT'; end if;
 if o.provider_payment_id is not null and o.provider_payment_id<>p_payment_id then raise exception 'PAYMENT_CONFLICT'; end if;
 insert into public.payment_events(event_id,payment_id) values(p_event_id,p_payment_id) on conflict do nothing;
 if exists(select 1 from public.payments where order_id=o.id) then return; end if;
 insert into public.payments(id,order_id,amount_paise) values(p_payment_id,o.id,p_amount);

 insert into public.credit_transactions(user_id,delta,reason,reference,metadata) values(o.user_id,o.credits,'purchase','payment:'||p_payment_id,jsonb_build_object('order_id',o.id,'amount_paise',o.amount_paise,'package_id',o.package_id,'detached',o.user_id is null));
 update public.payment_orders set status=case when status='refunded' then status else 'paid' end,provider_payment_id=p_payment_id,updated_at=now() where id=o.id;
end $$;


-- Daily catch-up for the current UTC month only; same locks/uniqueness as on-demand access.
create function private.process_credit_entitlements() returns void language plpgsql security definer set search_path='' as $$
declare u uuid; begin
 for u in select user_id from public.job_credits order by user_id loop perform private.ensure_monthly_credit(u); end loop;
end $$;
revoke all on function private.process_credit_entitlements() from public,anon,authenticated;
select private.process_credit_entitlements();
select cron.schedule('nearhire-credit-entitlements','15 0 * * *','select private.process_credit_entitlements()');
create or replace function public.admin_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=private.actor(); begin
 if not exists(select 1 from public.admin_users where user_id=u) or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 return jsonb_build_object('users',(select count(*) from public.profiles),'completed_profiles',(select count(*) from public.profiles where name<>''),'active_jobs',(select count(*) from public.jobs where status='active' and expires_at>now()),'expired_jobs',(select count(*) from public.jobs where status='expired' or (status='active' and expires_at<=now())),'applications',(select count(*) from public.applications),'completed_jobs',(select count(*) from public.jobs where status='completed'),'open_reports',(select count(*) from public.reports where status='open'),'revenue_paise',(select coalesce(sum(amount_paise),0) from public.payments),'credits',(select coalesce(sum(remaining),0) from public.credit_lots where user_id is not null and (expires_at is null or expires_at>now())),'fill_rate',(select coalesce(count(*) filter(where status in ('filled','in_progress','completed'))::numeric/nullif(count(*) filter(where published_at is not null and status not in ('suspended','cancelled')),0),0) from public.jobs),'completion_rate',(select coalesce(count(*) filter(where status='completed')::numeric/nullif(count(*) filter(where status in ('filled','in_progress','completed')),0),0) from public.jobs),'average_applications',(select count(*)::numeric/nullif((select count(*) from public.jobs where published_at is not null),0) from public.applications),'first_application_seconds',(select avg(extract(epoch from x.first_at-j.published_at)) from public.jobs j join (select job_id,min(created_at) first_at from public.applications group by job_id) x on x.job_id=j.id));
end $$;

commit;
