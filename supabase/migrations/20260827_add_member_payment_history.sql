create or replace function public.member_payment_history()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_result jsonb;
begin
  select a.player_id into v_player_id
  from public.access_profiles a
  where a.active = true
    and (a.user_id = auth.uid() or lower(a.email) = lower(coalesce(auth.jwt()->>'email','')))
  limit 1;

  if v_player_id is null then
    return jsonb_build_object('summary', jsonb_build_object('total',0,'paid',0,'open',0,'outstanding',0), 'items', '[]'::jsonb);
  end if;

  with obligations as (
    select t.id, 'season'::text as payment_type, s.name as label, s.starts_on as payment_date, t.amount, t.paid, t.paid_on
    from public.finance_season_tickets t
    join public.finance_seasons s on s.id = t.season_id
    where t.player_id = v_player_id
    union all
    select g.id, 'game'::text, 'Game · ' || to_char(g.game_date, 'DD Mon YYYY'), g.game_date, s.pay_per_game_amount,
      coalesce(pay.paid, false), null::date
    from public.game_players gp
    join public.games g on g.id = gp.game_id
    left join public.finance_seasons s on g.game_date between s.starts_on and s.ends_on
    left join public.finance_season_tickets st on st.player_id = v_player_id and st.season_id = s.id
    left join lateral (
      select p.paid from public.payments p
      where p.player_id = v_player_id and p.game_id = g.id and p.payment_type = 'game'
      order by p.created_at desc nulls last limit 1
    ) pay on true
    where gp.player_id = v_player_id and gp.attended = true and st.id is null
  )
  select jsonb_build_object(
    'summary', jsonb_build_object('total',count(*),'paid',count(*) filter(where paid),'open',count(*) filter(where not paid),'outstanding',coalesce(sum(case when not paid then amount else 0 end),0)),
    'items', coalesce(jsonb_agg(jsonb_build_object('id',id,'type',payment_type,'label',label,'date',payment_date,'amount',amount,'paid',paid,'paid_on',paid_on,'status',case when paid then 'Paid' else 'Open' end) order by payment_date desc,label),'[]'::jsonb)
  ) into v_result from obligations;

  return v_result;
end;
$$;

grant execute on function public.member_payment_history() to authenticated;

create or replace function public.admin_preview_member_payment_history(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin access required';
  end if;

  select a.player_id into v_player_id
  from public.access_profiles a
  where a.active = true and lower(a.email) = lower(trim(p_email))
  limit 1;

  if v_player_id is null then
    return jsonb_build_object('summary', jsonb_build_object('total',0,'paid',0,'open',0,'outstanding',0), 'items', '[]'::jsonb);
  end if;

  with obligations as (
    select t.id,'season'::text payment_type,s.name label,s.starts_on payment_date,t.amount,t.paid,t.paid_on
    from public.finance_season_tickets t join public.finance_seasons s on s.id=t.season_id where t.player_id=v_player_id
    union all
    select g.id,'game'::text,'Game · ' || to_char(g.game_date,'DD Mon YYYY'),g.game_date,s.pay_per_game_amount,coalesce(pay.paid,false),null::date
    from public.game_players gp join public.games g on g.id=gp.game_id
    left join public.finance_seasons s on g.game_date between s.starts_on and s.ends_on
    left join public.finance_season_tickets st on st.player_id=v_player_id and st.season_id=s.id
    left join lateral (select p.paid from public.payments p where p.player_id=v_player_id and p.game_id=g.id and p.payment_type='game' order by p.created_at desc nulls last limit 1) pay on true
    where gp.player_id=v_player_id and gp.attended=true and st.id is null
  )
  select jsonb_build_object(
    'summary',jsonb_build_object('total',count(*),'paid',count(*) filter(where paid),'open',count(*) filter(where not paid),'outstanding',coalesce(sum(case when not paid then amount else 0 end),0)),
    'items',coalesce(jsonb_agg(jsonb_build_object('id',id,'type',payment_type,'label',label,'date',payment_date,'amount',amount,'paid',paid,'paid_on',paid_on,'status',case when paid then 'Paid' else 'Open' end) order by payment_date desc,label),'[]'::jsonb)
  ) into v_result from obligations;

  return v_result;
end;
$$;

grant execute on function public.admin_preview_member_payment_history(text) to authenticated;
