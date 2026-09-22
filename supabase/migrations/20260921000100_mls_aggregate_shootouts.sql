-- Keep the individual match outcome separate from aggregate-series penalties.
alter table public.games drop constraint games_decision_method_check;
alter table public.games add constraint games_decision_method_check
  check (decision_method is null or (sport_id = 'mls' and status = 'final'
    and decision_method in ('regulation','extra_time','shootout','aggregate_shootout')));
alter table public.games drop constraint games_shootout_check;
alter table public.games add constraint games_shootout_check check (
  (home_shootout_score is null and away_shootout_score is null
    and decision_method is distinct from 'shootout' and decision_method is distinct from 'aggregate_shootout')
  or (sport_id = 'mls' and status = 'final'
    and decision_method is not null and decision_method in ('shootout','aggregate_shootout')
    and home_shootout_score is not null and away_shootout_score is not null
    and home_shootout_score >= 0 and away_shootout_score >= 0 and home_shootout_score <> away_shootout_score
    and home_score is not null and away_score is not null
    and (
      (decision_method = 'shootout' and home_score = away_score and not is_tie
        and winner_team_id is not null
        and winner_team_id = case when home_shootout_score > away_shootout_score then home_team_id else away_team_id end)
      or (decision_method = 'aggregate_shootout' and (
        (home_score = away_score and is_tie and winner_team_id is null)
        or (home_score <> away_score and not is_tie and winner_team_id is not null
          and winner_team_id = case when home_score > away_score then home_team_id else away_team_id end)
      ))
    ))
);
comment on column public.games.decision_method is
  'aggregate_shootout records series penalties; winner_team_id and is_tie still describe this individual match. Single-match shootout counts as a win/loss.';
