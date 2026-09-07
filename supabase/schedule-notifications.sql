-- Run once in the Supabase SQL editor AFTER provisioning Vault secrets:
-- nearhire_functions_url = https://PROJECT_REF.supabase.co/functions/v1
-- nearhire_outbox_secret = the same random secret as OUTBOX_SECRET on Edge Functions.
-- Add the secrets in the dashboard; do not commit real values here.
create extension if not exists pg_net with schema extensions;
select cron.schedule('nearhire-notifications','* * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='nearhire_functions_url')||'/notification-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='nearhire_outbox_secret')),
  body:='{}'::jsonb, timeout_milliseconds:=10000
 );
$job$);
