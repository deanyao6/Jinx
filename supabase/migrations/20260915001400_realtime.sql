-- Live state and notifications stream to the app over Realtime (RLS still applies).
alter publication supabase_realtime add table public.game_live_state;
alter publication supabase_realtime add table public.notifications;
