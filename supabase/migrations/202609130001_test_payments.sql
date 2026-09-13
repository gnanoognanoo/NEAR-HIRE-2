-- Extend the existing accounting model; never rewrite historical package snapshots.
alter table public.credit_packages add column sort_order integer not null default 0;
alter table public.credit_packages add column currency text not null default 'INR' check(currency='INR');
update public.credit_packages set active=false;
insert into public.credit_packages(id,label,credits,amount_paise,active,sort_order) values
 ('single','occasionalHiring',1,900,true,1),('five','popular',5,3900,true,2),('ten','bestValue',10,6900,true,3)
on conflict(id) do update set label=excluded.label,credits=excluded.credits,amount_paise=excluded.amount_paise,active=true,sort_order=excluded.sort_order;
update public.pricing_config set free_post_limit=5,job_post_price_paise=900 where id;
create table public.payment_config(id boolean primary key default true check(id), payments_enabled_test boolean not null default true, live_enabled boolean not null default false check(not live_enabled));
insert into public.payment_config default values;
alter table public.payment_config enable row level security;
create policy payment_config_read on public.payment_config for select to authenticated using(true);
grant select on public.payment_config to authenticated;
grant all on public.payment_config to service_role;

-- Retain financial records, detach from deleted personal accounts. Retention duration is an owner policy decision.
alter table public.credit_transactions drop constraint credit_transactions_user_id_fkey;
alter table public.credit_transactions alter column user_id drop not null;
alter table public.credit_transactions add foreign key(user_id) references public.profiles on delete set null;
alter table public.payment_orders drop constraint payment_orders_user_id_fkey;
alter table public.payment_orders alter column user_id drop not null;
alter table public.payment_orders add foreign key(user_id) references public.profiles on delete set null;
alter table public.payments drop constraint payments_order_id_fkey;
alter table public.payments add foreign key(order_id) references public.payment_orders on delete restrict;
alter table public.payment_orders drop constraint payment_orders_status_check;
alter table public.payment_orders add check(status in ('created','pending','paid','failed','cancelled','refunded'));
alter table public.payment_orders add column updated_at timestamptz not null default now();
alter table public.payment_orders add column provider_payment_id text unique;
alter table public.payment_orders add column mode text not null default 'test' check(mode='test');
alter table public.credit_transactions add column metadata jsonb not null default '{}';
alter table public.payment_events add column kind text not null default 'captured';
create unique index welcome_once on public.credit_transactions(user_id) where reason='signup';

create or replace function public.prepare_payment(p_package text,p_request_id uuid) returns public.payment_orders language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); pack public.credit_packages; result public.payment_orders; begin
 if not exists(select 1 from public.payment_config where id and payments_enabled_test and not live_enabled) then raise exception 'PAYMENTS_DISABLED'; end if;
 if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_request_id::text,0));
 select * into result from public.payment_orders where user_id=u and request_id=p_request_id;
 if result.id is not null then
   if result.package_id<>p_package then raise exception 'REQUEST_CONFLICT'; end if;
   return result;
 end if;
 perform private.throttle(u||':payment',10,3600);
 select * into pack from public.credit_packages where id=p_package and active;
 if pack.id is null then raise exception 'PACKAGE_UNAVAILABLE'; end if;
 insert into public.payment_orders(user_id,request_id,package_id,credits,amount_paise,currency) values(u,p_request_id,pack.id,pack.credits,pack.amount_paise,pack.currency) returning * into result;
 return result;
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
 if o.user_id is not null then
   update public.job_credits set balance=balance+o.credits where user_id=o.user_id;
   if not found then raise exception 'CREDIT_ACCOUNT_MISSING'; end if;
 end if;
 insert into public.credit_transactions(user_id,delta,reason,reference,metadata) values(o.user_id,o.credits,'purchase','payment:'||p_payment_id,jsonb_build_object('order_id',o.id,'amount_paise',o.amount_paise,'package_id',o.package_id,'detached',o.user_id is null));
 update public.payment_orders set status=case when status='refunded' then status else 'paid' end,provider_payment_id=p_payment_id,updated_at=now() where id=o.id;
end $$;

-- Refunds require manual credit resolution; never silently deduct already spent credits.
create function public.record_payment_event(p_event_id text,p_payment_id text,p_order_id text,p_kind text) returns void language plpgsql security definer set search_path='' as $$
declare o public.payment_orders; begin
 if p_kind not in ('failed','refunded') then raise exception 'INVALID_EVENT'; end if;
 select * into o from public.payment_orders where provider_order_id=p_order_id for update;
 if o.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
 if p_kind='refunded' and o.provider_payment_id is not null and o.provider_payment_id<>p_payment_id then raise exception 'PAYMENT_MISMATCH'; end if;
 insert into public.payment_events(event_id,payment_id,kind) values(p_event_id,p_payment_id,p_kind) on conflict do nothing;
 if not found then return; end if;
 update public.payment_orders set status=case when p_kind='refunded' then 'refunded' when status in ('created','pending') then 'failed' else status end,updated_at=now() where id=o.id;
end $$;
revoke all on function public.record_payment_event(text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_payment_event(text,text,text,text) to service_role;

-- Keep existing publish/repost transactions. Add human-readable audit metadata without changing credit arithmetic.
create function private.credit_metadata() returns trigger language plpgsql security definer set search_path='' as $$
declare j public.jobs; begin
 if new.reason='publish' then
   select * into j from public.jobs where id::text=replace(new.reference,'publish:','');
   new.metadata:=jsonb_build_object('job_id',j.id,'title',j.title);
   if j.repost_of is not null then new.reason:='repost'; end if;
 end if;
 return new;
end $$;
create trigger credit_metadata before insert on public.credit_transactions for each row execute function private.credit_metadata();
revoke all on function private.credit_metadata() from public,anon,authenticated;
