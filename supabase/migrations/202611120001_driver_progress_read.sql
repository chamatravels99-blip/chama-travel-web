create or replace function public.list_driver_on_the_way()
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if not exists (
    select 1
      from public.profiles as p
      join public.user_roles as ur on ur.user_id = p.id and ur.revoked_at is null
      join public.roles as r on r.id = ur.role_id and r.code = 'driver'
     where p.id = v_user_id and p.account_status = 'active'
  ) then
    raise exception 'An active Driver account is required';
  end if;

  return array(
    select ba.id
      from public.booking_assignments as ba
     where ba.driver_user_id = v_user_id
       and ba.assignment_status in ('accepted', 'in_progress', 'completed')
       and exists (
         select 1 from public.booking_events as be
          where be.booking_id = ba.booking_id
            and be.event_type = 'driver_on_the_way'
            and be.details ->> 'assignment_id' = ba.id::text
       )
  );
end;
$function$;

revoke all on function public.list_driver_on_the_way()
  from public, anon, authenticated, service_role;
grant execute on function public.list_driver_on_the_way() to authenticated;
