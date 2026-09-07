-- Logout may remove only this user's registration for this installation's token.
create function public.unregister_device(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.user_devices where token = p_token and user_id = auth.uid();
$$;
revoke all on function public.unregister_device(text) from public, anon;
grant execute on function public.unregister_device(text) to authenticated;
