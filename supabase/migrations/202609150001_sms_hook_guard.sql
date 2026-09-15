-- Delivery reservations contain no phone numbers, OTPs, bodies, or provider secrets.
create table private.sms_hook_deliveries (
 event_id text primary key check(length(event_id) between 1 and 200),
 recipient_hash text not null check(recipient_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 sent boolean not null default false
);
create index sms_hook_recipient_time on private.sms_hook_deliveries(recipient_hash,created_at);
alter table private.sms_hook_deliveries enable row level security;
revoke all on private.sms_hook_deliveries from public,anon,authenticated;

create function public.reserve_sms_delivery(p_event text,p_recipient text) returns text
language plpgsql security definer set search_path='' as $$
declare previous private.sms_hook_deliveries; at_time timestamptz := clock_timestamp();
begin
 if p_event is null or length(p_event) not between 1 and 200 or p_recipient is null or p_recipient !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_REQUEST'; end if;
 -- Serialize the small development SMS budget across every Edge instance.
 perform pg_advisory_xact_lock(9152026);
 delete from private.sms_hook_deliveries where created_at < at_time - interval '24 hours';
 select * into previous from private.sms_hook_deliveries where event_id=p_event;
 if found then
  if previous.recipient_hash <> p_recipient then return 'denied'; end if;
  return case when previous.sent then 'sent' else 'pending' end;
 end if;
 if exists(select 1 from private.sms_hook_deliveries where recipient_hash=p_recipient and created_at>at_time-interval '60 seconds')
 or (select count(*) from private.sms_hook_deliveries where recipient_hash=p_recipient and created_at>at_time-interval '1 hour')>=5
 or (select count(*) from private.sms_hook_deliveries where created_at>at_time-interval '1 hour')>=60 then return 'limited'; end if;
 insert into private.sms_hook_deliveries(event_id,recipient_hash,created_at) values(p_event,p_recipient,at_time);
 return 'reserved';
end $$;
create function public.complete_sms_delivery(p_event text) returns void
language sql security definer set search_path='' as $$
 update private.sms_hook_deliveries set sent=true where event_id=p_event;
$$;
revoke all on function public.reserve_sms_delivery(text,text),public.complete_sms_delivery(text) from public,anon,authenticated;
grant execute on function public.reserve_sms_delivery(text,text),public.complete_sms_delivery(text) to service_role;
