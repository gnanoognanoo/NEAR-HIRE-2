create function public.admin_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=private.actor(); begin
 if not exists(select 1 from public.admin_users where user_id=u) or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 return jsonb_build_object('users',(select count(*) from public.profiles),'completed_profiles',(select count(*) from public.profiles where name<>''),'active_jobs',(select count(*) from public.jobs where status='active' and expires_at>now()),'expired_jobs',(select count(*) from public.jobs where status='expired' or (status='active' and expires_at<=now())),'applications',(select count(*) from public.applications),'completed_jobs',(select count(*) from public.jobs where status='completed'),'open_reports',(select count(*) from public.reports where status='open'),'revenue_paise',(select coalesce(sum(amount_paise),0) from public.payments),'credits',(select coalesce(sum(balance),0) from public.job_credits),'fill_rate',(select coalesce(count(*) filter(where status in ('filled','in_progress','completed'))::numeric/nullif(count(*) filter(where published_at is not null and status not in ('suspended','cancelled')),0),0) from public.jobs),'completion_rate',(select coalesce(count(*) filter(where status='completed')::numeric/nullif(count(*) filter(where status in ('filled','in_progress','completed')),0),0) from public.jobs),'average_applications',(select count(*)::numeric/nullif((select count(*) from public.jobs where published_at is not null),0) from public.applications),'first_application_seconds',(select avg(extract(epoch from x.first_at-j.published_at)) from public.jobs j join (select job_id,min(created_at) first_at from public.applications group by job_id) x on x.job_id=j.id));
end $$;
create function public.admin_list(p_table text,p_query text default '',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=private.actor(); result jsonb; begin
 if not exists(select 1 from public.admin_users where user_id=u) or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_table not in ('profiles','jobs','reports','payment_orders','admin_actions','credit_transactions') or p_offset<0 or p_offset>100000 then raise exception 'INVALID_QUERY'; end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]'') from (select * from public.%I where to_jsonb(%I)::text ilike $1 order by created_at desc limit 30 offset $2) x',p_table,p_table) into result using '%'||left(p_query,100)||'%',p_offset;
 return result;
end $$;
create function public.admin_moderate(p_action text,p_target uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); begin
 if not exists(select 1 from public.admin_users where user_id=u) or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if length(trim(p_reason)) not between 5 and 1000 then raise exception 'REASON_REQUIRED'; end if;
 if p_action in ('suspend_user','unsuspend_user','verify_user') then
  if p_target=u then raise exception 'SELF_MODERATION_FORBIDDEN'; end if;
  if p_action='verify_user' then update public.profiles set verified=true where id=p_target; else update public.profiles set suspended=(p_action='suspend_user') where id=p_target; end if;
 elsif p_action='suspend_job' then update public.jobs set status='suspended' where id=p_target;
 elsif p_action in ('resolve_report','dismiss_report') then update public.reports set status=case when p_action='resolve_report' then 'resolved' else 'dismissed' end where id=p_target;
 else raise exception 'INVALID_ACTION'; end if;
 if not found then raise exception 'NOT_FOUND'; end if;
 insert into public.admin_actions(actor_id,action,target_id,reason) values(u,p_action,p_target,p_reason);
end $$;
create function public.prepare_payment(p_package text,p_request_id uuid) returns public.payment_orders language plpgsql security definer set search_path='' as $$
declare u uuid:=private.actor(); pack public.credit_packages; result public.payment_orders; begin
 perform private.throttle(u||':payment',10,3600);
 select * into pack from public.credit_packages where id=p_package and active;
 if pack.id is null then raise exception 'PACKAGE_UNAVAILABLE'; end if;
 insert into public.payment_orders(user_id,request_id,package_id,credits,amount_paise) values(u,p_request_id,pack.id,pack.credits,pack.amount_paise) on conflict(user_id,request_id) do nothing;
 select * into result from public.payment_orders where user_id=u and request_id=p_request_id;
 return result;
end $$;
create function public.settle_payment(p_event_id text,p_payment_id text,p_order_id text,p_amount integer,p_currency text) returns void language plpgsql security definer set search_path='' as $$
declare o public.payment_orders; begin
 select * into o from public.payment_orders where provider_order_id=p_order_id for update;
 if o.id is null or o.amount_paise<>p_amount or p_currency<>'INR' then raise exception 'PAYMENT_MISMATCH'; end if;
 insert into public.payment_events(event_id,payment_id) values(p_event_id,p_payment_id) on conflict do nothing;
 if o.status='paid' then return; end if;
 insert into public.payments(id,order_id,amount_paise) values(p_payment_id,o.id,p_amount);
 update public.job_credits set balance=balance+o.credits where user_id=o.user_id;
 insert into public.credit_transactions(user_id,delta,reason,reference) values(o.user_id,o.credits,'purchase','payment:'||p_payment_id);
 update public.payment_orders set status='paid' where id=o.id;
 insert into public.analytics_events(user_id,event) values(o.user_id,'payment_success');
end $$;
create function public.claim_notifications() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 with claimed as (select id from private.notification_outbox where delivered_at is null and attempts<8 and available_at<=now() order by available_at for update skip locked limit 30), updated as (update private.notification_outbox o set attempts=attempts+1,available_at=now()+interval '5 minutes' where id in (select id from claimed) returning o.id)
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'user_id',n.user_id,'event',n.event,'job_id',n.job_id,'tokens',(select coalesce(jsonb_agg(d.token),'[]') from public.user_devices d where d.user_id=n.user_id))),'[]') into result from updated x join public.notifications n on n.id=x.id join public.profiles p on p.id=n.user_id where p.notifications_enabled and not p.suspended;
 return result;
end $$;
create function public.finish_notification(p_id uuid,p_error text default null) returns void language plpgsql security definer set search_path='' as $$ begin update private.notification_outbox set delivered_at=case when p_error is null then now() else null end,last_error=left(p_error,200),available_at=now()+make_interval(secs=>least(3600,30*(2^attempts)::integer)) where id=p_id; end $$;
create function public.edge_rate_limit(p_kind text) returns void language plpgsql security definer set search_path='' as $$ declare u uuid:=private.actor(); begin if p_kind not in ('location','delete') then raise exception 'INVALID_KIND'; end if; perform private.throttle(u||':'||p_kind,case when p_kind='location' then 60 else 2 end,3600); end $$;
revoke all on function public.admin_overview(),public.admin_list(text,text,integer),public.admin_moderate(text,uuid,text),public.prepare_payment(text,uuid),public.settle_payment(text,text,text,integer,text),public.claim_notifications(),public.finish_notification(uuid,text),public.edge_rate_limit(text) from public,anon,authenticated;
grant execute on function public.admin_overview(),public.admin_list(text,text,integer),public.admin_moderate(text,uuid,text),public.prepare_payment(text,uuid),public.edge_rate_limit(text) to authenticated;
grant execute on function public.settle_payment(text,text,text,integer,text),public.claim_notifications(),public.finish_notification(uuid,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('avatars','avatars',false,2097152,array['image/jpeg','image/png','image/webp']),('job-images','job-images',false,5242880,array['image/jpeg','image/png','image/webp']),('verification-documents','verification-documents',false,5242880,array['image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
create policy upload_own on storage.objects for insert to authenticated with check(bucket_id in ('avatars','job-images','verification-documents') and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.profiles where id=auth.uid() and suspended));
create policy read_own_upload on storage.objects for select to authenticated using(bucket_id in ('avatars','job-images','verification-documents') and (storage.foldername(name))[1]=auth.uid()::text);
create policy delete_own_upload on storage.objects for delete to authenticated using(bucket_id in ('avatars','job-images','verification-documents') and (storage.foldername(name))[1]=auth.uid()::text);

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('nearhire-expire','* * * * *','select public.expire_jobs()');
select cron.schedule('nearhire-rate-limit-cleanup','17 3 * * *',$cron$delete from private.rate_limits where window_at<now()-interval '2 days'$cron$);

