-- A fan's export holds everything Jinx keeps about them (next-wave B.6, Dean's decision 15).
-- Added since the first version: handshakes (the secret-handshake egg), favorite players,
-- profile photos and attendance photos (paths only; the files are in the buckets the account
-- deletion walks), MLS results on each game (decision, shootout, winner), famous games seen,
-- blocks, reports, reactions, notifications and their preferences, device tokens, sign-in and
-- forwarding emails (no OTP hashes), and inbound rejections. `user_famous_games` is security
-- definer and revoked from callers, so it is read here, inside another security definer.
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'home_lat' - 'home_lng' || jsonb_build_object('home_lat', p.home_lat, 'home_lng', p.home_lng) from public.profiles p where p.id = auth.uid()),
    'teams', (select coalesce(jsonb_agg(jsonb_build_object('team_id', t.id, 'name', t.name, 'sport_id', t.sport_id)), '[]'::jsonb) from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = auth.uid()),
    'players', (select coalesce(jsonb_agg(jsonb_build_object('player_id', pl.id, 'name', pl.full_name, 'sport_id', pl.sport_id, 'since', up.created_at)), '[]'::jsonb) from public.user_players up join public.players pl on pl.id = up.player_id where up.user_id = auth.uid()),
    'attendances', (select coalesce(jsonb_agg(jsonb_build_object(
        'attendance', to_jsonb(a),
        'game', jsonb_build_object('id', g.id, 'sport_id', g.sport_id, 'season', g.season, 'season_label', g.season_label, 'game_type', g.game_type, 'scheduled_start', g.scheduled_start, 'status', g.status, 'home', ht.name, 'away', at.name, 'home_score', g.home_score, 'away_score', g.away_score, 'is_tie', g.is_tie, 'winner', wt.name, 'decision_method', g.decision_method, 'home_shootout_score', g.home_shootout_score, 'away_shootout_score', g.away_shootout_score, 'doubleheader_number', g.doubleheader_number, 'venue', v.name, 'venue_city', v.city),
        'seat', (select to_jsonb(s) from public.attendance_seats s where s.attendance_id = a.id),
        'companions', (select coalesce(jsonb_agg(p.display_name), '[]'::jsonb) from public.attendance_companions ac join public.people p on p.id = ac.person_id where ac.attendance_id = a.id),
        'photos', (select coalesce(jsonb_agg(to_jsonb(ph) order by ph.created_at), '[]'::jsonb) from public.attendance_photos ph where ph.attendance_id = a.id)
      ) order by g.scheduled_start), '[]'::jsonb)
      from public.attendances a join public.games g on g.id = a.game_id join public.teams ht on ht.id = g.home_team_id join public.teams at on at.id = g.away_team_id left join public.teams wt on wt.id = g.winner_team_id left join public.venues v on v.id = g.venue_id
      where a.user_id = auth.uid()),
    'people', (select coalesce(jsonb_agg(to_jsonb(p) - 'invite_token'), '[]'::jsonb) from public.people p where p.owner_user_id = auth.uid()),
    'pledges', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.pledges p where p.user_id = auth.uid()),
    'checkins', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.checkins c where c.user_id = auth.uid()),
    'handshakes', (select coalesce(jsonb_agg(jsonb_build_object(
        'game_id', h.game_id, 'game', jsonb_build_object('sport_id', g.sport_id, 'scheduled_start', g.scheduled_start, 'home', ht.name, 'away', at.name),
        'direction', case when h.from_user = auth.uid() then 'offered' else 'received' end,
        'other_handle', pr.handle, 'created_at', h.created_at,
        'completed', exists (select 1 from public.handshakes r where r.game_id = h.game_id and r.from_user = h.to_user and r.to_user = h.from_user)
      ) order by h.created_at), '[]'::jsonb)
      from public.handshakes h join public.games g on g.id = h.game_id join public.teams ht on ht.id = g.home_team_id join public.teams at on at.id = g.away_team_id
      join public.profiles pr on pr.id = case when h.from_user = auth.uid() then h.to_user else h.from_user end
      where h.from_user = auth.uid() or h.to_user = auth.uid()),
    'famous_games', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from public.user_famous_games(auth.uid()) f),
    'follows', (select coalesce(jsonb_agg(jsonb_build_object('handle', pr.handle, 'status', f.status, 'since', f.created_at)), '[]'::jsonb) from public.follows f join public.profiles pr on pr.id = f.followee_id where f.follower_id = auth.uid()),
    'followers', (select coalesce(jsonb_agg(jsonb_build_object('handle', pr.handle, 'status', f.status, 'since', f.created_at)), '[]'::jsonb) from public.follows f join public.profiles pr on pr.id = f.follower_id where f.followee_id = auth.uid()),
    'blocks', (select coalesce(jsonb_agg(jsonb_build_object('handle', pr.handle, 'since', b.created_at)), '[]'::jsonb) from public.blocks b join public.profiles pr on pr.id = b.blocked_id where b.blocker_id = auth.uid()),
    'reports', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.reports r where r.reporter_id = auth.uid()),
    'reactions', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.reactions r where r.user_id = auth.uid()),
    'goals', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from public.goals g where g.user_id = auth.uid()),
    'bucket_lists', (select coalesce(jsonb_agg(jsonb_build_object('title', b.title, 'definition', b.definition, 'progress', ub.progress)), '[]'::jsonb) from public.user_bucket_lists ub join public.bucket_lists b on b.id = ub.bucket_list_id where ub.user_id = auth.uid()),
    'ticket_imports', (select coalesce(jsonb_agg(to_jsonb(t) - 'storage_path'), '[]'::jsonb) from public.ticket_imports t where t.user_id = auth.uid()),
    'emails', (select coalesce(jsonb_agg(to_jsonb(e) - 'otp_hash' - 'otp_expires_at'), '[]'::jsonb) from public.user_emails e where e.user_id = auth.uid()),
    'inbound_addresses', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.inbound_addresses i where i.user_id = auth.uid()),
    'inbound_rejections', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.inbound_rejections i where i.user_id = auth.uid()),
    'notifications', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at), '[]'::jsonb) from public.notifications n where n.user_id = auth.uid()),
    'notification_prefs', (select to_jsonb(np) from public.notification_prefs np where np.user_id = auth.uid()),
    'device_tokens', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.device_tokens d where d.user_id = auth.uid()),
    'wrapped', (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) from public.wrapped_snapshots w where w.user_id = auth.uid()),
    'stats', (select payload from public.user_stats_cache where user_id = auth.uid())
  );
$$;
