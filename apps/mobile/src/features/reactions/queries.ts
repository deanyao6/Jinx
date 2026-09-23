/**
 * Reactions: the reads and writes (docs/prompts/social/03; 00_repo_reality.md R2 gives this
 * feature the `reactions` table). Photos live in the private `reaction-photos` bucket at
 * `<user_id>/<game_id>/<uuid>-back.jpg` and `-front.jpg`, read through signed URLs that expire,
 * and the row decides who may see them (migration 20260924020100).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { promptSlots, type PromptSummary } from '@jinx/core';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import { attendanceKeys } from '@/features/attendances/queries';
import { useAuthStore } from '@/features/auth/store';
import { checkinKeys, type GameContext } from '@/features/checkin/queries';
import { supabase, type Rpc, type Tables } from '@/lib/supabase';

export const REACTION_BUCKET = 'reaction-photos';
const SIGNED_URL_SECONDS = 60 * 60;

export type ReactionPrompt = Tables<'reaction_prompts'>;
export type PromptDelivery = Tables<'reaction_prompt_deliveries'> & { prompt: ReactionPrompt | null };
export type GameReactionRow = Rpc<'game_reactions'>[number];
export type GameReaction = GameReactionRow & { backUrl: string | null; frontUrl: string | null };
export type ReactionVisibility = 'followers' | 'public' | 'private';

export const reactionKeys = {
  all: ['reactions'] as const,
  game: (userId: string | null, gameId: string) => ['reactions', 'game', userId, gameId] as const,
  prompts: (gameId: string) => ['reactions', 'prompts', gameId] as const,
  deliveries: (userId: string | null, gameId: string) => ['reactions', 'deliveries', userId, gameId] as const,
  alsoHere: (userId: string | null, gameId: string) => ['reactions', 'also-here', userId, gameId] as const,
  session: (userId: string | null) => ['reactions', 'session', userId] as const,
};

export function reactionPhotoPath(userId: string, gameId: string, id: string, which: 'back' | 'front'): string {
  return `${userId}/${gameId}/${id}-${which}.jpg`;
}

async function sign(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data, error } = await supabase.storage.from(REACTION_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw error;
  for (const row of data ?? []) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  return out;
}

/** A game's reactions I may see: mine always, others' by their post. With signed photo URLs. */
export function useGameReactions(gameId: string | undefined, enabled = true) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: reactionKeys.game(userId, gameId ?? ''),
    enabled: !!userId && !!gameId && enabled,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<GameReaction[]> => {
      const { data, error } = await supabase.rpc('game_reactions', { p_game_id: gameId as string, p_limit: 60 });
      if (error) throw error;
      const rows = data ?? [];
      const urls = await sign(rows.flatMap((r) => [r.back_path, r.front_path]));
      return rows.map((r) => ({ ...r, backUrl: urls.get(r.back_path) ?? null, frontUrl: urls.get(r.front_path) ?? null }));
    },
  });
}

/** Every prompt fired at a game, for the slots ("1 of 3 used"). Any fan may read them. */
export function useGamePrompts(gameId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: reactionKeys.prompts(gameId ?? ''),
    enabled: !!gameId && enabled,
    staleTime: 20_000,
    refetchInterval: enabled ? 30_000 : false,
    queryFn: async (): Promise<ReactionPrompt[]> => {
      const { data, error } = await supabase.from('reaction_prompts').select('*').eq('game_id', gameId as string).order('fired_at');
      if (error) throw error;
      return data;
    },
  });
}

export function slotsOf(prompts: readonly Pick<ReactionPrompt, 'kind' | 'fired_at'>[] | undefined) {
  const summary: PromptSummary[] = (prompts ?? []).map((p) => ({ kind: p.kind as 'checkin' | 'event', firedAt: p.fired_at }));
  return promptSlots(summary);
}

/** The prompts that reached me at a game, newest last, each with its prompt. */
export function useMyDeliveries(gameId: string | undefined, enabled = true, pollMs = 20_000) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: reactionKeys.deliveries(userId, gameId ?? ''),
    enabled: !!userId && !!gameId && enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? pollMs : false,
    queryFn: async (): Promise<PromptDelivery[]> => {
      const { data, error } = await supabase
        .from('reaction_prompt_deliveries')
        .select('*, prompt:reaction_prompts(*)')
        .eq('user_id', userId as string)
        .eq('game_id', gameId as string)
        .order('fired_at');
      if (error) throw error;
      return (data as unknown as PromptDelivery[]) ?? [];
    },
  });
}

/** One delivery by prompt id, for the capture screen opened from a push. */
export function useMyDelivery(gameId: string | undefined, promptId: string | undefined) {
  const deliveries = useMyDeliveries(gameId, !!promptId, 0);
  return { ...deliveries, data: deliveries.data?.find((d) => d.prompt_id === promptId) ?? null };
}

export function useMarkPromptOpened() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: { promptId: string; gameId: string }) => {
      const { error } = await supabase
        .from('reaction_prompt_deliveries')
        .update({ opened_at: new Date().toISOString() })
        .eq('prompt_id', input.promptId)
        .eq('user_id', userId as string)
        .is('opened_at', null);
      if (error) throw error;
    },
    onSettled: (_r, _e, input) => queryClient.invalidateQueries({ queryKey: reactionKeys.deliveries(userId, input.gameId) }),
  });
}

export type CaptureInput = {
  gameId: string;
  attendanceId: string;
  promptId: string | null;
  /** Local file URIs from the camera. */
  backUri: string;
  frontUri: string;
  /** "Only me" is private with no post; otherwise a reaction post is created at once. */
  visibility: ReactionVisibility;
  /** The scorebug label at capture time, for a self-triggered reaction. */
  periodLabel: string | null;
};

/**
 * Posting: two objects up, one `reactions` row, and for anything but "Only me" a `posts` row of
 * kind `reaction` the reaction is attached to. Lateness is the server's (the trigger reads the
 * prompt's clock), which is also what makes a queued offline capture honestly "late by 4 min".
 */
export async function postReaction(userId: string, input: CaptureInput): Promise<{ id: string; postId: string | null }> {
  const id = Crypto.randomUUID();
  const backPath = reactionPhotoPath(userId, input.gameId, id, 'back');
  const frontPath = reactionPhotoPath(userId, input.gameId, id, 'front');
  const upload = async (path: string, uri: string) => {
    const bytes = await new File(uri).arrayBuffer();
    const { error } = await supabase.storage.from(REACTION_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
  };
  await upload(backPath, input.backUri);
  try {
    await upload(frontPath, input.frontUri);
  } catch (e) {
    await supabase.storage.from(REACTION_BUCKET).remove([backPath]);
    throw e;
  }
  const { data: reaction, error } = await supabase
    .from('reactions')
    .insert({
      id,
      user_id: userId,
      game_id: input.gameId,
      prompt_id: input.promptId,
      attendance_id: input.attendanceId,
      back_path: backPath,
      front_path: frontPath,
      visibility: input.visibility,
      period_label: input.periodLabel,
    })
    .select('id')
    .single();
  if (error) {
    await supabase.storage.from(REACTION_BUCKET).remove([backPath, frontPath]);
    throw error;
  }
  let postId: string | null = null;
  if (input.visibility !== 'private') {
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({ author_id: userId, kind: 'reaction', reaction_id: reaction.id, game_id: input.gameId, visibility: input.visibility })
      .select('id')
      .single();
    if (postError) throw postError;
    postId = post.id;
    const { error: linkError } = await supabase.from('reactions').update({ post_id: post.id }).eq('id', reaction.id);
    if (linkError) throw linkError;
  }
  return { id: reaction.id, postId };
}

export function usePostReaction() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: CaptureInput) => {
      if (!userId) throw new Error('Not signed in');
      return postReaction(userId, input);
    },
    onSettled: (_r, _e, input) => {
      queryClient.invalidateQueries({ queryKey: reactionKeys.game(userId, input.gameId) });
      queryClient.invalidateQueries({ queryKey: reactionKeys.deliveries(userId, input.gameId) });
      queryClient.invalidateQueries({ queryKey: reactionKeys.prompts(input.gameId) });
    },
  });
}

/** Deleting a reaction deletes its post (cascade), its photos in Storage, and its slot in Relive. */
export function useDeleteReaction() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (r: Pick<GameReaction, 'id' | 'back_path' | 'front_path'> & { gameId: string }) => {
      const { error: objectError } = await supabase.storage.from(REACTION_BUCKET).remove([r.back_path, r.front_path]);
      if (objectError) throw objectError;
      const { error } = await supabase.from('reactions').delete().eq('id', r.id);
      if (error) throw error;
    },
    onSettled: (_r, _e, r) => queryClient.invalidateQueries({ queryKey: reactionKeys.game(userId, r.gameId) }),
  });
}

export function useSetReactionVisibility() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: { id: string; gameId: string; visibility: ReactionVisibility }) => {
      const { error } = await supabase.from('reactions').update({ visibility: input.visibility }).eq('id', input.id);
      if (error) throw error;
    },
    onSettled: (_r, _e, input) => queryClient.invalidateQueries({ queryKey: reactionKeys.game(userId, input.gameId) }),
  });
}

// ---------------------------------------------------------------------------
// The session: presence, leaving, muting, and what the phone reports
// ---------------------------------------------------------------------------

export type AlsoHereRow = Rpc<'also_here'>[number];

export function useAlsoHere(gameId: string | undefined, enabled = true) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: reactionKeys.alsoHere(userId, gameId ?? ''),
    enabled: !!userId && !!gameId && enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
    queryFn: async (): Promise<AlsoHereRow[]> => {
      const { data, error } = await supabase.rpc('also_here', { p_game_id: gameId as string });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useApplyContext() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return (gameId: string, ctx: GameContext) => {
    queryClient.setQueryData(checkinKeys.context(userId, gameId), ctx);
    queryClient.invalidateQueries({ queryKey: attendanceKeys.list(userId) });
    queryClient.invalidateQueries({ queryKey: reactionKeys.session(userId) });
  };
}

export function useEndCheckin() {
  const apply = useApplyContext();
  return useMutation({
    mutationFn: async (gameId: string) => {
      const { data, error } = await supabase.rpc('end_checkin', { p_game_id: gameId });
      if (error) throw error;
      return data as unknown as { ok: boolean; reason?: string } & Partial<GameContext>;
    },
    onSuccess: (res, gameId) => {
      if (res.ok) apply(gameId, res as GameContext);
    },
  });
}

export function useMuteCheckinPrompts() {
  const apply = useApplyContext();
  return useMutation({
    mutationFn: async (input: { gameId: string; muted: boolean }) => {
      const { data, error } = await supabase.rpc('mute_checkin_prompts', { p_game_id: input.gameId, p_muted: input.muted });
      if (error) throw error;
      return data as unknown as { ok: boolean } & Partial<GameContext>;
    },
    onSuccess: (res, input) => {
      if (res.ok) apply(input.gameId, res as GameContext);
    },
  });
}

export type LiveMomentReport = {
  gameId: string;
  kind: 'checkin' | 'event';
  label: string;
  audience: 'home' | 'away' | 'all';
  significance: number | null;
  eventKey: string | null;
  homeScore: number;
  awayScore: number;
  periodLabel: string | null;
  rule: string | null;
  benefitSide: 'home' | 'away' | null;
  inScheduledWindow: boolean;
};

/** What a checked-in phone tells the server about the NBA, MLS or NFL feed it read. */
export async function reportLiveMoment(r: LiveMomentReport): Promise<{ ok: boolean; reason?: string; prompt_id?: string }> {
  const { data, error } = await supabase.rpc('report_live_moment', {
    p_game_id: r.gameId,
    p_kind: r.kind,
    p_label: r.label,
    p_audience: r.audience,
    p_significance: r.significance ?? undefined,
    p_event_key: r.eventKey ?? undefined,
    p_home_score: r.homeScore,
    p_away_score: r.awayScore,
    p_period_label: r.periodLabel ?? undefined,
    p_rule: r.rule ?? undefined,
    p_benefit_side: r.benefitSide ?? undefined,
    p_in_scheduled_window: r.inScheduledWindow,
  });
  if (error) throw error;
  return data as unknown as { ok: boolean; reason?: string; prompt_id?: string };
}

export type OpenSession = {
  game_id: string;
  started_at: string;
  prompts_muted: boolean;
  visibility: string;
};

/** My open session, if any: the one game I am at right now. */
export function useMyOpenSession(enabled = true) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: reactionKeys.session(userId),
    enabled: !!userId && enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
    queryFn: async (): Promise<OpenSession | null> => {
      const { data, error } = await supabase
        .from('checkins')
        .select('game_id, started_at, prompts_muted, visibility')
        .eq('user_id', userId as string)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
