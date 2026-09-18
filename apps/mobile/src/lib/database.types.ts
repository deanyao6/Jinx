export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attendance_companions: {
        Row: {
          attendance_id: string
          person_id: string
        }
        Insert: {
          attendance_id: string
          person_id: string
        }
        Update: {
          attendance_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_companions_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_companions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_photos: {
        Row: {
          attendance_id: string
          created_at: string
          id: string
          kind: string
          storage_path: string
          user_id: string
          visibility: string
        }
        Insert: {
          attendance_id: string
          created_at?: string
          id?: string
          kind: string
          storage_path: string
          user_id: string
          visibility?: string
        }
        Update: {
          attendance_id?: string
          created_at?: string
          id?: string
          kind?: string
          storage_path?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_photos_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_seats: {
        Row: {
          attendance_id: string
          price_cents: number | null
          row: string | null
          seat: string | null
          section: string | null
        }
        Insert: {
          attendance_id: string
          price_cents?: number | null
          row?: string | null
          seat?: string | null
          section?: string | null
        }
        Update: {
          attendance_id?: string
          price_cents?: number | null
          row?: string | null
          seat?: string | null
          section?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_seats_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: true
            referencedRelation: "attendances"
            referencedColumns: ["id"]
          },
        ]
      }
      attendances: {
        Row: {
          created_at: string
          game_id: string
          id: string
          note: string | null
          rooting_basis: string | null
          rooting_team_id: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
          verified: boolean
          verified_via: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          note?: string | null
          rooting_basis?: string | null
          rooting_team_id?: string | null
          source: string
          status?: string
          updated_at?: string
          user_id: string
          verified?: boolean
          verified_via?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          note?: string | null
          rooting_basis?: string | null
          rooting_team_id?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
          verified_via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendances_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_rooting_team_id_fkey"
            columns: ["rooting_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bucket_lists: {
        Row: {
          created_at: string
          definition: Json
          description: string | null
          id: string
          is_curated: boolean
          owner_user_id: string | null
          slug: string | null
          title: string
        }
        Insert: {
          created_at?: string
          definition: Json
          description?: string | null
          id?: string
          is_curated?: boolean
          owner_user_id?: string | null
          slug?: string | null
          title: string
        }
        Update: {
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_curated?: boolean
          owner_user_id?: string | null
          slug?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "bucket_lists_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          accuracy_m: number
          checked_in_at: string
          distance_m: number
          game_id: string
          id: string
          user_id: string
        }
        Insert: {
          accuracy_m: number
          checked_in_at?: string
          distance_m: number
          game_id: string
          id?: string
          user_id: string
        }
        Update: {
          accuracy_m?: number
          checked_in_at?: string
          distance_m?: number
          game_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      detail_queue: {
        Row: {
          attempts: number
          done_at: string | null
          game_id: string
          last_error: string | null
          reason: string
          requested_at: string
        }
        Insert: {
          attempts?: number
          done_at?: string | null
          game_id: string
          last_error?: string | null
          reason: string
          requested_at?: string
        }
        Update: {
          attempts?: number
          done_at?: string | null
          game_id?: string
          last_error?: string | null
          reason?: string
          requested_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "detail_queue_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          platform?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      famous_games: {
        Row: {
          about_team_id: string | null
          category: string
          created_at: string
          game_id: string
          id: string
          source: string
          story: string
          title: string
        }
        Insert: {
          about_team_id?: string | null
          category: string
          created_at?: string
          game_id: string
          id?: string
          source: string
          story?: string
          title: string
        }
        Update: {
          about_team_id?: string | null
          category?: string
          created_at?: string
          game_id?: string
          id?: string
          source?: string
          story?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "famous_games_about_team_id_fkey"
            columns: ["about_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "famous_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      famous_rounds: {
        Row: {
          edition_base: number | null
          edition_style: string
          round: string
          sport_id: string
          story: string
          title: string
        }
        Insert: {
          edition_base?: number | null
          edition_style?: string
          round: string
          sport_id: string
          story: string
          title: string
        }
        Update: {
          edition_base?: number | null
          edition_style?: string
          round?: string
          sport_id?: string
          story?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "famous_rounds_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_events: {
        Row: {
          actor_user_id: string
          created_at: string
          game_id: string | null
          id: string
          payload: Json
          type: string
          visibility: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          game_id?: string | null
          id?: string
          payload?: Json
          type: string
          visibility?: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          game_id?: string | null
          id?: string
          payload?: Json
          type?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          accepted_at: string | null
          created_at: string
          followee_id: string
          follower_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          followee_id: string
          follower_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          followee_id?: string
          follower_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_players: {
        Row: {
          from_season: number
          id: string
          player_id: string
          source: string
          team_id: string | null
          to_season: number | null
        }
        Insert: {
          from_season: number
          id?: string
          player_id: string
          source?: string
          team_id?: string | null
          to_season?: number | null
        }
        Update: {
          from_season?: number
          id?: string
          player_id?: string
          source?: string
          team_id?: string | null
          to_season?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "franchise_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "franchise_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      game_appearances: {
        Row: {
          game_id: string
          player_id: string
          team_id: string
        }
        Insert: {
          game_id: string
          player_id: string
          team_id: string
        }
        Update: {
          game_id?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_appearances_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_appearances_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      game_events: {
        Row: {
          detail: Json
          game_id: string
          id: string
          occurred_at: string | null
          player_id: string | null
          team_id: string | null
          type: string
        }
        Insert: {
          detail?: Json
          game_id: string
          id?: string
          occurred_at?: string | null
          player_id?: string | null
          team_id?: string | null
          type: string
        }
        Update: {
          detail?: Json
          game_id?: string
          id?: string
          occurred_at?: string | null
          player_id?: string | null
          team_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      game_live_state: {
        Row: {
          away_score: number
          clock: string | null
          fetched_at: string
          game_id: string
          home_score: number
          inning: number | null
          inning_state: string | null
          lock_reason: string | null
          locked: boolean
          status: string
        }
        Insert: {
          away_score?: number
          clock?: string | null
          fetched_at?: string
          game_id: string
          home_score?: number
          inning?: number | null
          inning_state?: string | null
          lock_reason?: string | null
          locked?: boolean
          status: string
        }
        Update: {
          away_score?: number
          clock?: string | null
          fetched_at?: string
          game_id?: string
          home_score?: number
          inning?: number | null
          inning_state?: string | null
          lock_reason?: string | null
          locked?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_live_state_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_scoring_timeline: {
        Row: {
          away_score: number
          clock: string | null
          description: string
          game_id: string
          half: string | null
          home_score: number
          kind: string | null
          occurred_at: string | null
          period: number
          scorer_name: string | null
          scorer_player_id: string | null
          scoring_side: string
          seq: number
        }
        Insert: {
          away_score: number
          clock?: string | null
          description?: string
          game_id: string
          half?: string | null
          home_score: number
          kind?: string | null
          occurred_at?: string | null
          period: number
          scorer_name?: string | null
          scorer_player_id?: string | null
          scoring_side: string
          seq: number
        }
        Update: {
          away_score?: number
          clock?: string | null
          description?: string
          game_id?: string
          half?: string | null
          home_score?: number
          kind?: string | null
          occurred_at?: string | null
          period?: number
          scorer_name?: string | null
          scorer_player_id?: string | null
          scoring_side?: string
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_scoring_timeline_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_scoring_timeline_scorer_player_id_fkey"
            columns: ["scorer_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      game_story_steps: {
        Row: {
          away_score: number
          game_id: string
          home_score: number
          kind: string | null
          label: string
          scorer_name: string | null
          scorer_player_id: string | null
          seq: number
          text: string
          wp_seq: number
        }
        Insert: {
          away_score: number
          game_id: string
          home_score: number
          kind?: string | null
          label: string
          scorer_name?: string | null
          scorer_player_id?: string | null
          seq: number
          text: string
          wp_seq: number
        }
        Update: {
          away_score?: number
          game_id?: string
          home_score?: number
          kind?: string | null
          label?: string
          scorer_name?: string | null
          scorer_player_id?: string | null
          seq?: number
          text?: string
          wp_seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_story_steps_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_story_steps_game_id_wp_seq_fkey"
            columns: ["game_id", "wp_seq"]
            isOneToOne: false
            referencedRelation: "game_wp_timeline"
            referencedColumns: ["game_id", "seq"]
          },
          {
            foreignKeyName: "game_story_steps_scorer_player_id_fkey"
            columns: ["scorer_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      game_win_prob: {
        Row: {
          computed_at: string
          game_id: string
          home_win_prob: number
          method: string
        }
        Insert: {
          computed_at?: string
          game_id: string
          home_win_prob: number
          method?: string
        }
        Update: {
          computed_at?: string
          game_id?: string
          home_win_prob?: number
          method?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_win_prob_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_wp_timeline: {
        Row: {
          game_id: string
          half: string | null
          home_wp: number
          occurred_at: string | null
          period: number
          seq: number
        }
        Insert: {
          game_id: string
          half?: string | null
          home_wp: number
          occurred_at?: string | null
          period: number
          seq: number
        }
        Update: {
          game_id?: string
          half?: string | null
          home_wp?: number
          occurred_at?: string | null
          period?: number
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_wp_timeline_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          attendance: number | null
          away_score: number | null
          away_team_id: string
          detail_ingested_at: string | null
          detail_rechecked_at: string | null
          doubleheader_number: number | null
          duration_minutes: number | null
          final_at: string | null
          game_type: string
          home_score: number | null
          home_team_id: string
          id: string
          innings_or_periods: number | null
          is_neutral_site: boolean
          is_tie: boolean
          pledge_lock_at: string | null
          pledge_lock_reliable: boolean | null
          provider: string
          provider_game_id: string
          relive_checked_at: string | null
          rescheduled_from_game_id: string | null
          rescheduled_to_game_id: string | null
          scheduled_start: string
          season: number
          sport_id: string
          status: string
          temperature_f: number | null
          timestamps_reliable: boolean | null
          updated_at: string
          venue_id: string | null
          winner_team_id: string | null
        }
        Insert: {
          attendance?: number | null
          away_score?: number | null
          away_team_id: string
          detail_ingested_at?: string | null
          detail_rechecked_at?: string | null
          doubleheader_number?: number | null
          duration_minutes?: number | null
          final_at?: string | null
          game_type: string
          home_score?: number | null
          home_team_id: string
          id?: string
          innings_or_periods?: number | null
          is_neutral_site?: boolean
          is_tie?: boolean
          pledge_lock_at?: string | null
          pledge_lock_reliable?: boolean | null
          provider: string
          provider_game_id: string
          relive_checked_at?: string | null
          rescheduled_from_game_id?: string | null
          rescheduled_to_game_id?: string | null
          scheduled_start: string
          season: number
          sport_id: string
          status: string
          temperature_f?: number | null
          timestamps_reliable?: boolean | null
          updated_at?: string
          venue_id?: string | null
          winner_team_id?: string | null
        }
        Update: {
          attendance?: number | null
          away_score?: number | null
          away_team_id?: string
          detail_ingested_at?: string | null
          detail_rechecked_at?: string | null
          doubleheader_number?: number | null
          duration_minutes?: number | null
          final_at?: string | null
          game_type?: string
          home_score?: number | null
          home_team_id?: string
          id?: string
          innings_or_periods?: number | null
          is_neutral_site?: boolean
          is_tie?: boolean
          pledge_lock_at?: string | null
          pledge_lock_reliable?: boolean | null
          provider?: string
          provider_game_id?: string
          relive_checked_at?: string | null
          rescheduled_from_game_id?: string | null
          rescheduled_to_game_id?: string | null
          scheduled_start?: string
          season?: number
          sport_id?: string
          status?: string
          temperature_f?: number | null
          timestamps_reliable?: boolean | null
          updated_at?: string
          venue_id?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_rescheduled_from_game_id_fkey"
            columns: ["rescheduled_from_game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_rescheduled_to_game_id_fkey"
            columns: ["rescheduled_to_game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          completed_at: string | null
          created_at: string
          definition: Json
          id: string
          progress: Json
          source: string
          title: string
          user_id: string
          year: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          definition: Json
          id?: string
          progress?: Json
          source: string
          title: string
          user_id: string
          year: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          definition?: Json
          id?: string
          progress?: Json
          source?: string
          title?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      handshakes: {
        Row: {
          created_at: string
          from_user: string
          game_id: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          game_id: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          game_id?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "handshakes_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handshakes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handshakes_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      honor_kinds: {
        Row: {
          honor: string
          label: string
          rank: number
          season_first: boolean
          sport_id: string
          window_seasons: number
        }
        Insert: {
          honor: string
          label: string
          rank: number
          season_first?: boolean
          sport_id: string
          window_seasons?: number
        }
        Update: {
          honor?: string
          label?: string
          rank?: number
          season_first?: boolean
          sport_id?: string
          window_seasons?: number
        }
        Relationships: [
          {
            foreignKeyName: "honor_kinds_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_addresses: {
        Row: {
          created_at: string
          rotated_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          rotated_at?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          rotated_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_rejections: {
        Row: {
          notified_on: string
          user_id: string
        }
        Insert: {
          notified_on: string
          user_id: string
        }
        Update: {
          notified_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_rejections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_progress: {
        Row: {
          detail: Json
          job: string
          key: string
          status: string
          updated_at: string
        }
        Insert: {
          detail?: Json
          job: string
          key: string
          status: string
          updated_at?: string
        }
        Update: {
          detail?: Json
          job?: string
          key?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          kind: string
          read_at: string | null
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id?: string
          kind: string
          read_at?: string | null
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          read_at?: string | null
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          created_at: string
          display_name: string
          id: string
          invite_token: string | null
          linked_user_id: string | null
          owner_user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          invite_token?: string | null
          linked_user_id?: string | null
          owner_user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          invite_token?: string | null
          linked_user_id?: string | null
          owner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_firsts: {
        Row: {
          game_id: string
          kind: string
          player_id: string
        }
        Insert: {
          game_id: string
          kind: string
          player_id: string
        }
        Update: {
          game_id?: string
          kind?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_firsts_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_firsts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_honors: {
        Row: {
          honor: string
          player_id: string
          season: number
          source: string
        }
        Insert: {
          honor: string
          player_id: string
          season: number
          source: string
        }
        Update: {
          honor?: string
          player_id?: string
          season?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_honors_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_moves: {
        Row: {
          joined_on: string
          kind: string
          player_id: string
          source: string
          team_id: string
        }
        Insert: {
          joined_on: string
          kind: string
          player_id: string
          source: string
          team_id: string
        }
        Update: {
          joined_on?: string
          kind?: string
          player_id?: string
          source?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_moves_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_moves_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          debut_on: string | null
          full_name: string
          id: string
          provider: string
          provider_player_id: string
          rookie_season: number | null
          sport_id: string
        }
        Insert: {
          debut_on?: string | null
          full_name: string
          id?: string
          provider: string
          provider_player_id: string
          rookie_season?: number | null
          sport_id: string
        }
        Update: {
          debut_on?: string | null
          full_name?: string
          id?: string
          provider?: string
          provider_player_id?: string
          rookie_season?: number | null
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      pledges: {
        Row: {
          estimated_lock_at: string | null
          game_id: string
          id: string
          pledged_at: string
          result: string | null
          status: string
          team_id: string
          user_id: string
          validated_at: string | null
          void_reason: string | null
          win_prob_at_pledge: number
        }
        Insert: {
          estimated_lock_at?: string | null
          game_id: string
          id?: string
          pledged_at?: string
          result?: string | null
          status?: string
          team_id: string
          user_id: string
          validated_at?: string | null
          void_reason?: string | null
          win_prob_at_pledge: number
        }
        Update: {
          estimated_lock_at?: string | null
          game_id?: string
          id?: string
          pledged_at?: string
          result?: string | null
          status?: string
          team_id?: string
          user_id?: string
          validated_at?: string | null
          void_reason?: string | null
          win_prob_at_pledge?: number
        }
        Relationships: [
          {
            foreignKeyName: "pledges_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pledges_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pledges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          birth_date: string | null
          created_at: string
          display_name: string
          handle: string
          home_city: string | null
          home_lat: number | null
          home_lng: number | null
          id: string
          is_private: boolean
          onboarded_at: string | null
          share_seats: boolean
          show_on_overlap: boolean
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string
          handle: string
          home_city?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id: string
          is_private?: boolean
          onboarded_at?: string | null
          share_seats?: boolean
          show_on_overlap?: boolean
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string
          handle?: string
          home_city?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          is_private?: boolean
          onboarded_at?: string | null
          share_seats?: boolean
          show_on_overlap?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          emoji: string
          feed_event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          feed_event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          feed_event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_feed_event_id_fkey"
            columns: ["feed_event_id"]
            isOneToOne: false
            referencedRelation: "feed_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      storylines: {
        Row: {
          facts: Json
          game_id: string
          generated_at: string
          id: string
          source: string
          team_id: string | null
          text: string
        }
        Insert: {
          facts?: Json
          game_id: string
          generated_at?: string
          id?: string
          source: string
          team_id?: string | null
          text: string
        }
        Update: {
          facts?: Json
          game_id?: string
          generated_at?: string
          id?: string
          source?: string
          team_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "storylines_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storylines_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_aliases: {
        Row: {
          alias: string
          team_id: string
        }
        Insert: {
          alias: string
          team_id: string
        }
        Update: {
          alias?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_aliases_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_colors: {
        Row: {
          fill_hex: string
          on_fill_hex: string
          primary_dark_hex: string
          primary_light_hex: string
          secondary_dark_hex: string
          secondary_light_hex: string
          source: string
          team_id: string
          updated_at: string
        }
        Insert: {
          fill_hex: string
          on_fill_hex: string
          primary_dark_hex: string
          primary_light_hex: string
          secondary_dark_hex: string
          secondary_light_hex: string
          source?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          fill_hex?: string
          on_fill_hex?: string
          primary_dark_hex?: string
          primary_light_hex?: string
          secondary_dark_hex?: string
          secondary_light_hex?: string
          source?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_colors_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_elo: {
        Row: {
          as_of: string
          rating: number
          team_id: string
        }
        Insert: {
          as_of: string
          rating: number
          team_id: string
        }
        Update: {
          as_of?: string
          rating?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_elo_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_rosters: {
        Row: {
          jersey: string | null
          player_id: string
          position: string | null
          season: number
          status: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          jersey?: string | null
          player_id: string
          position?: string | null
          season: number
          status?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          jersey?: string | null
          player_id?: string
          position?: string | null
          season?: number
          status?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_rosters_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_rosters_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          abbreviation: string
          active: boolean
          city: string
          division: string | null
          franchise_id: string
          home_venue_id: string | null
          id: string
          name: string
          nickname: string | null
          primary_color_hex: string | null
          provider: string
          provider_team_id: string
          sport_id: string
        }
        Insert: {
          abbreviation: string
          active?: boolean
          city: string
          division?: string | null
          franchise_id: string
          home_venue_id?: string | null
          id?: string
          name: string
          nickname?: string | null
          primary_color_hex?: string | null
          provider: string
          provider_team_id: string
          sport_id: string
        }
        Update: {
          abbreviation?: string
          active?: boolean
          city?: string
          division?: string | null
          franchise_id?: string
          home_venue_id?: string | null
          id?: string
          name?: string
          nickname?: string | null
          primary_color_hex?: string | null
          provider?: string
          provider_team_id?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_home_venue_id_fkey"
            columns: ["home_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_imports: {
        Row: {
          candidate_game_ids: string[]
          created_at: string
          error: string | null
          id: string
          image_deleted_at: string | null
          matched_attendance_id: string | null
          parsed: Json | null
          raw_text: string | null
          resolved_at: string | null
          source: string
          status: string
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          candidate_game_ids?: string[]
          created_at?: string
          error?: string | null
          id?: string
          image_deleted_at?: string | null
          matched_attendance_id?: string | null
          parsed?: Json | null
          raw_text?: string | null
          resolved_at?: string | null
          source: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          candidate_game_ids?: string[]
          created_at?: string
          error?: string | null
          id?: string
          image_deleted_at?: string | null
          matched_attendance_id?: string | null
          parsed?: Json | null
          raw_text?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_imports_matched_attendance_id_fkey"
            columns: ["matched_attendance_id"]
            isOneToOne: false
            referencedRelation: "attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_imports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bucket_lists: {
        Row: {
          added_at: string
          bucket_list_id: string
          progress: Json
          user_id: string
        }
        Insert: {
          added_at?: string
          bucket_list_id: string
          progress?: Json
          user_id: string
        }
        Update: {
          added_at?: string
          bucket_list_id?: string
          progress?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bucket_lists_bucket_list_id_fkey"
            columns: ["bucket_list_id"]
            isOneToOne: false
            referencedRelation: "bucket_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bucket_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_emails: {
        Row: {
          created_at: string
          email: string
          otp_expires_at: string | null
          otp_hash: string | null
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          email: string
          otp_expires_at?: string | null
          otp_hash?: string | null
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          otp_expires_at?: string | null
          otp_hash?: string | null
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_players: {
        Row: {
          created_at: string
          player_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          player_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          player_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats_cache: {
        Row: {
          computed_at: string
          payload: Json
          user_id: string
        }
        Insert: {
          computed_at?: string
          payload?: Json
          user_id: string
        }
        Update: {
          computed_at?: string
          payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_teams: {
        Row: {
          created_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_teams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_aliases: {
        Row: {
          alias: string
          venue_id: string
        }
        Insert: {
          alias: string
          venue_id: string
        }
        Update: {
          alias?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_aliases_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_shapes: {
        Row: {
          shape_key: string
          simplified_at: string | null
          source: string
          svg_path: string | null
          venue_id: string
        }
        Insert: {
          shape_key: string
          simplified_at?: string | null
          source?: string
          svg_path?: string | null
          venue_id: string
        }
        Update: {
          shape_key?: string
          simplified_at?: string | null
          source?: string
          svg_path?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_shapes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          city: string | null
          closed_year: number | null
          country: string | null
          elevation_ft: number | null
          geofence_m: number
          id: string
          key: string
          lat: number | null
          lng: number | null
          name: string
          opened_year: number | null
          provider_ids: Json
          state: string | null
          tz: string | null
        }
        Insert: {
          city?: string | null
          closed_year?: number | null
          country?: string | null
          elevation_ft?: number | null
          geofence_m?: number
          id?: string
          key: string
          lat?: number | null
          lng?: number | null
          name: string
          opened_year?: number | null
          provider_ids?: Json
          state?: string | null
          tz?: string | null
        }
        Update: {
          city?: string | null
          closed_year?: number | null
          country?: string | null
          elevation_ft?: number | null
          geofence_m?: number
          id?: string
          key?: string
          lat?: number | null
          lng?: number | null
          name?: string
          opened_year?: number | null
          provider_ids?: Json
          state?: string | null
          tz?: string | null
        }
        Relationships: []
      }
      wrapped_snapshots: {
        Row: {
          generated_at: string
          payload: Json
          published_at: string | null
          season: number
          sport_id: string
          user_id: string
        }
        Insert: {
          generated_at?: string
          payload: Json
          published_at?: string | null
          season: number
          sport_id: string
          user_id: string
        }
        Update: {
          generated_at?: string
          payload?: Json
          published_at?: string | null
          season?: number
          sport_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wrapped_snapshots_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrapped_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_person_invite: { Args: { p_token: string }; Returns: Json }
      attendance_visible: {
        Args: { p_attendance_id: string }
        Returns: boolean
      }
      blocked_users: {
        Args: never
        Returns: {
          blocked_at: string
          display_name: string
          handle: string
          user_id: string
        }[]
      }
      call_edge_function: {
        Args: { p_body?: Json; p_name: string }
        Returns: number
      }
      can_view_attendance_photo: {
        Args: { p_photo_id: string }
        Returns: boolean
      }
      can_view_avatar: { Args: { p_object_name: string }; Returns: boolean }
      can_view_profile: { Args: { target: string }; Returns: boolean }
      can_view_seats: { Args: { p_attendance_id: string }; Returns: boolean }
      can_view_user: { Args: { target: string }; Returns: boolean }
      check_in: {
        Args: { p_accuracy_m: number; p_distance_m: number; p_game_id: string }
        Returns: Json
      }
      companion_games: {
        Args: { p_person_id: string }
        Returns: {
          away_score: number
          away_team_name: string
          game_id: string
          home_score: number
          home_team_name: string
          result: string
          scheduled_start: string
          venue_name: string
        }[]
      }
      companion_records: {
        Args: never
        Returns: {
          display_name: string
          games: number
          last_game: string
          linked_avatar_path: string
          linked_handle: string
          linked_user_id: string
          losses: number
          person_id: string
          ties: number
          wins: number
        }[]
      }
      compute_rooting: {
        Args: {
          p_current_basis: string
          p_current_team: string
          p_game: string
          p_user: string
        }
        Returns: {
          basis: string
          team_id: string
        }[]
      }
      compute_user_stats: { Args: { p_user: string }; Returns: Json }
      confirm_ticket_import: {
        Args: { p_game_id: string; p_import_id: string }
        Returns: Json
      }
      confirm_ticket_import_for: {
        Args: { p_game_id: string; p_import_id: string; p_user: string }
        Returns: Json
      }
      create_person_invite: { Args: { p_person_id: string }; Returns: string }
      detail_queue_pending: {
        Args: { p_limit?: number; p_provider: string }
        Returns: {
          attempts: number
          game_id: string
          provider_game_id: string
          reason: string
        }[]
      }
      detail_queue_settle: { Args: never; Returns: number }
      discard_ticket_import: {
        Args: { p_import_id: string }
        Returns: undefined
      }
      distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      enqueue_game_detail: {
        Args: { p_game_id: string; p_reason: string }
        Returns: undefined
      }
      estimated_pledge_lock: {
        Args: { p_sport: string; p_start: string }
        Returns: string
      }
      evaluate_goals_for_users: {
        Args: { p_users: string[] }
        Returns: undefined
      }
      export_my_data: { Args: never; Returns: Json }
      famous_game_headline: { Args: { p_game_id: string }; Returns: Json }
      favorite_players_seen: {
        Args: never
        Returns: {
          full_name: string
          last_game_id: string
          last_seen: string
          player_id: string
          seen: number
          sport_id: string
          team_id: string
        }[]
      }
      feed: {
        Args: { p_before?: string; p_limit?: number }
        Returns: {
          actor_avatar_path: string
          actor_display_name: string
          actor_handle: string
          actor_user_id: string
          created_at: string
          game: Json
          game_id: string
          id: string
          my_reaction: string
          payload: Json
          reactions: Json
          type: string
        }[]
      }
      follows_active: {
        Args: { p_followee: string; p_follower: string }
        Returns: boolean
      }
      game_context: { Args: { p_game_id: string }; Returns: Json }
      game_day_reminders: { Args: never; Returns: number }
      game_famous: {
        Args: { p_game_id: string }
        Returns: {
          about_team_id: string
          category: string
          joined_on: string
          kind: string
          personal: boolean
          player_id: string
          player_name: string
          source: string
          story: string
          team_id: string
          team_nickname: string
          title: string
        }[]
      }
      game_fan_photos: {
        Args: { p_game_id: string; p_limit?: number }
        Returns: {
          created_at: string
          id: string
          kind: string
          storage_path: string
          user_id: string
        }[]
      }
      game_local_date: {
        Args: { p_start: string; p_tz: string }
        Returns: string
      }
      game_stars: {
        Args: { p_game_id: string }
        Returns: {
          full_name: string
          honor: string
          label: string
          player_id: string
          season: number
          season_first: boolean
          team_id: string
        }[]
      }
      games_in_year: { Args: { p_year: number }; Returns: number }
      games_needing_detail: {
        Args: { p_limit?: number; p_provider: string }
        Returns: {
          provider_game_id: string
        }[]
      }
      games_needing_live_poll: {
        Args: never
        Returns: {
          game_id: string
          provider_game_id: string
          scheduled_start: string
          sport_id: string
        }[]
      }
      games_needing_relive: {
        Args: { p_limit?: number; p_provider: string }
        Returns: {
          away_name: string
          away_score: number
          game_id: string
          home_name: string
          home_score: number
          provider_game_id: string
          season: number
        }[]
      }
      games_needing_scorers: {
        Args: { p_limit?: number; p_provider: string }
        Returns: {
          game_id: string
          provider_game_id: string
          season: number
        }[]
      }
      generate_wrapped: {
        Args: { p_season: number; p_sport: string; p_user: string }
        Returns: Json
      }
      goal_games: { Args: { p_user: string }; Returns: Json }
      going_game_starts_between: {
        Args: { p_from: string; p_to: string }
        Returns: boolean
      }
      handshake_candidates: {
        Args: { p_game_id: string }
        Returns: {
          avatar_path: string
          user_id: string
        }[]
      }
      import_tagged_games: {
        Args: { p_game_ids: string[]; p_owner: string }
        Returns: number
      }
      is_blocked_between: { Args: { a: string; b: string }; Returns: boolean }
      is_mutual: { Args: { a: string; b: string }; Returns: boolean }
      is_superstar: {
        Args: { p_player: string; p_season: number }
        Returns: boolean
      }
      make_pledge: {
        Args: { p_game_id: string; p_team_id: string }
        Returns: Json
      }
      mark_notifications_read: {
        Args: { p_ids?: string[] }
        Returns: undefined
      }
      mark_pushes_sent: { Args: { p_ids: string[] }; Returns: undefined }
      mutuals_at_game: {
        Args: { p_game_id: string }
        Returns: {
          display_name: string
          handle: string
          user_id: string
        }[]
      }
      my_famous_games: {
        Args: never
        Returns: {
          away: string
          away_nickname: string
          away_score: number
          away_team_id: string
          category: string
          game_id: string
          home: string
          home_nickname: string
          home_score: number
          home_team_id: string
          joined_on: string
          kind: string
          personal: boolean
          player_id: string
          player_name: string
          scheduled_start: string
          source: string
          sport_id: string
          story: string
          team_id: string
          team_nickname: string
          title: string
        }[]
      }
      my_handshakes: {
        Args: { p_game_id: string }
        Returns: {
          avatar_path: string
          completed_at: string
          display_name: string
          handle: string
          offered_at: string
          state: string
          user_id: string
        }[]
      }
      my_storage_paths: { Args: never; Returns: string[] }
      my_tags_at_game: {
        Args: { p_game_id: string }
        Returns: {
          attendance_id: string
          owner_display_name: string
          owner_handle: string
          owner_user_id: string
          person_id: string
        }[]
      }
      my_wrapped: {
        Args: { p_force?: boolean; p_season: number; p_sport: string }
        Returns: Json
      }
      notification_enabled: {
        Args: { p_kind: string; p_user: string }
        Returns: boolean
      }
      offer_handshake: {
        Args: { p_game_id: string; p_to_user: string }
        Returns: Json
      }
      overlaps: {
        Args: never
        Returns: {
          away_team_name: string
          before_connected: boolean
          game_id: string
          home_team_name: string
          other_display_name: string
          other_handle: string
          other_user_id: string
          scheduled_start: string
          section_gap: number
          venue_name: string
        }[]
      }
      pending_pushes: {
        Args: { p_limit?: number }
        Returns: {
          body: string
          data: Json
          kind: string
          notification_id: string
          title: string
          tokens: string[]
          user_id: string
        }[]
      }
      person_for_user: {
        Args: { p_linked: string; p_owner: string }
        Returns: string
      }
      players_seen: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_user: string
        }
        Returns: {
          full_name: string
          last_seen: string
          player_id: string
          seen: number
          sport_id: string
        }[]
      }
      process_game_final: { Args: { p_game_id: string }; Returns: Json }
      profile_view: { Args: { p_handle: string }; Returns: Json }
      publish_wrapped_if_season_over: {
        Args: { p_season: number; p_sport: string }
        Returns: number
      }
      rebuild_curated_bucket_lists: { Args: never; Returns: undefined }
      rebuild_schedule_famous_games: { Args: never; Returns: number }
      recompute_rooting_for_user: {
        Args: { p_user: string }
        Returns: undefined
      }
      record_json: {
        Args: { p_losses: number; p_ties: number; p_wins: number }
        Returns: Json
      }
      refresh_all_user_stats: { Args: never; Returns: number }
      refresh_my_stats: { Args: never; Returns: Json }
      refresh_user_stats: { Args: { p_user: string }; Returns: undefined }
      remove_device_tokens: { Args: { p_tokens: string[] }; Returns: undefined }
      rivalries: {
        Args: never
        Returns: {
          my_meetings_attended: number
          my_wins: number
          rival_display_name: string
          rival_handle: string
          rival_meetings_attended: number
          rival_teams: Json
          rival_user_id: string
          rival_wins: number
          ties: number
          together_my_wins: number
          together_rival_wins: number
        }[]
      }
      roman_numeral: { Args: { p_n: number }; Returns: string }
      rotate_inbound_token: { Args: never; Returns: string }
      search_games: {
        Args: {
          p_from?: string
          p_limit?: number
          p_query?: string
          p_season?: number
          p_sport?: string
          p_team_id?: string
          p_to?: string
          p_venue_id?: string
        }
        Returns: {
          away_abbr: string
          away_score: number
          away_team_id: string
          away_team_name: string
          doubleheader_number: number
          game_type: string
          home_abbr: string
          home_score: number
          home_team_id: string
          home_team_name: string
          id: string
          is_tie: boolean
          scheduled_start: string
          season: number
          sport_id: string
          status: string
          venue_city: string
          venue_id: string
          venue_name: string
        }[]
      }
      search_profiles: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          avatar_path: string
          display_name: string
          follow_status: string
          follows_me: boolean
          handle: string
          id: string
          is_private: boolean
        }[]
      }
      search_teams: {
        Args: { p_limit?: number; p_query: string; p_sport?: string }
        Returns: {
          abbreviation: string
          active: boolean
          city: string
          id: string
          name: string
          sport_id: string
        }[]
      }
      search_venues: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          city: string
          closed_year: number
          id: string
          name: string
          state: string
        }[]
      }
      set_bucket_list_progress: {
        Args: { p_bucket_list_id: string; p_progress: Json }
        Returns: undefined
      }
      set_goal_progress: {
        Args: { p_completed: boolean; p_goal_id: string; p_progress: Json }
        Returns: undefined
      }
      superstar_honor: {
        Args: { p_player: string; p_season: number }
        Returns: {
          honor: string
          label: string
          season: number
          season_first: boolean
        }[]
      }
      tagged_games_for_me: {
        Args: { p_owner: string }
        Returns: {
          already_logged: boolean
          attendance_id: string
          away_team_name: string
          game_id: string
          home_team_name: string
          scheduled_start: string
          venue_name: string
        }[]
      }
      team_elo_as_of: {
        Args: { p_date: string; p_team_id: string }
        Returns: number
      }
      team_roster: {
        Args: { p_limit?: number; p_query?: string; p_team_id: string }
        Returns: {
          appearances: number
          full_name: string
          id: string
          on_roster: boolean
          position: string
          seen_by_you: number
        }[]
      }
      team_season_games: {
        Args: {
          p_home_only?: boolean
          p_include_preseason?: boolean
          p_season: number
          p_team_id: string
        }
        Returns: {
          attendance: number | null
          away_score: number | null
          away_team_id: string
          detail_ingested_at: string | null
          detail_rechecked_at: string | null
          doubleheader_number: number | null
          duration_minutes: number | null
          final_at: string | null
          game_type: string
          home_score: number | null
          home_team_id: string
          id: string
          innings_or_periods: number | null
          is_neutral_site: boolean
          is_tie: boolean
          pledge_lock_at: string | null
          pledge_lock_reliable: boolean | null
          provider: string
          provider_game_id: string
          relive_checked_at: string | null
          rescheduled_from_game_id: string | null
          rescheduled_to_game_id: string | null
          scheduled_start: string
          season: number
          sport_id: string
          status: string
          temperature_f: number | null
          timestamps_reliable: boolean | null
          updated_at: string
          venue_id: string | null
          winner_team_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "games"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      user_famous_games: {
        Args: { p_user: string }
        Returns: {
          about_team_id: string
          category: string
          game_id: string
          joined_on: string
          kind: string
          personal: boolean
          player_id: string
          player_name: string
          source: string
          story: string
          team_id: string
          title: string
        }[]
      }
      user_game_results: {
        Args: { p_user: string }
        Returns: {
          attendance: number
          attendance_id: string
          away_score: number
          away_team_id: string
          counted: boolean
          duration_minutes: number
          game_id: string
          home_score: number
          home_team_id: string
          innings_or_periods: number
          result: string
          rooting_basis: string
          rooting_team_id: string
          scheduled_start: string
          season: number
          sport_id: string
          status: string
          temperature_f: number
          venue_id: string
        }[]
      }
      validate_pledges_for_game: {
        Args: { p_game_id: string }
        Returns: number
      }
      venue_noun: {
        Args: { p_plural?: boolean; p_sport: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

