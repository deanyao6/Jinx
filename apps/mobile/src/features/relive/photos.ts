import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { useAuthStore } from '@/features/auth/store';
import { supabase } from '@/lib/supabase';

/**
 * Photos and videos for one attended game (SPEC.md 6.19, 9).
 *
 * Objects live in the private `attendance-photos` bucket at
 * `<user_id>/<attendance_id>/<uuid>.<ext>`; `attendance_photos` holds the metadata and is what
 * decides who may see an item. Nothing is ever public by URL: even a public photo is shown
 * through a signed URL that expires, so a leaked link cannot be replayed.
 */

export type PhotoVisibility = 'private' | 'followers' | 'public';

export type GamePhoto = {
  id: string;
  userId: string;
  kind: 'photo' | 'video';
  visibility: PhotoVisibility | null;
  storagePath: string;
  /** Signed, short-lived. Null when signing failed; the tile then shows a placeholder. */
  url: string | null;
};

/** Game photos default to followers-only (SPEC.md 9). The owner can change each item. */
export const DEFAULT_PHOTO_VISIBILITY: PhotoVisibility = 'followers';

export const VISIBILITY_LABEL: Record<PhotoVisibility, string> = {
  private: 'Only you',
  followers: 'Your followers',
  public: 'Everyone at this game',
};

/** The bucket's own limit (migration 20260916000100). Checked here so the message is ours. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const SIGNED_URL_SECONDS = 60 * 60;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

export type PickedMedia = {
  uri: string;
  mimeType: string;
  kind: 'photo' | 'video';
  bytes: number | null;
};

/** The extension and content type the bucket will accept, or null for a type it will not. */
export function uploadTypeFor(media: Pick<PickedMedia, 'mimeType' | 'uri'>): {
  ext: string;
  contentType: string;
} | null {
  const mime = media.mimeType.toLowerCase();
  if (EXT_BY_MIME[mime]) return { ext: EXT_BY_MIME[mime], contentType: mime };
  // The picker sometimes reports a bare "image" or nothing useful; trust the file name then.
  const fromName = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(media.uri)?.[1]?.toLowerCase();
  const normal = fromName === 'jpeg' ? 'jpg' : fromName;
  const entry = Object.entries(EXT_BY_MIME).find(([, ext]) => ext === normal);
  return entry ? { ext: entry[1], contentType: entry[0] } : null;
}

export function photoPath(userId: string, attendanceId: string, id: string, ext: string): string {
  return `${userId}/${attendanceId}/${id}.${ext}`;
}

/** Why an item cannot be uploaded, in words, or null when it can. */
export function uploadProblem(media: PickedMedia): string | null {
  if (!uploadTypeFor(media))
    return 'That file type is not supported. Use a photo, or an MP4 or MOV video.';
  if (media.bytes != null && media.bytes > MAX_UPLOAD_BYTES) {
    return 'That video is over 50 MB. Trim it and try again.';
  }
  return null;
}

export async function pickMedia(): Promise<PickedMedia[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 0.9,
    // Location and device data stay on the phone (SPEC.md 9: never store raw coordinates).
    exif: false,
  });
  if (res.canceled) return [];
  return res.assets.map((a) => ({
    uri: a.uri,
    mimeType: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    kind: a.type === 'video' ? 'video' : 'photo',
    bytes: a.fileSize ?? null,
  }));
}

export const photoKeys = {
  game: (userId: string | null, gameId: string | undefined) =>
    ['relive-photos', userId, gameId] as const,
};

async function sign(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data, error } = await supabase.storage
    .from('attendance-photos')
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw error;
  for (const row of data ?? []) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  return out;
}

/**
 * Your own items for this game, and the public ones from other fans who were there.
 *
 * The fan list comes from `game_fan_photos`, which is where the rules live: public items only,
 * public accounts only, nobody blocked in either direction, and never your own. The storage
 * policy applies the same check again when each URL is signed, so the two cannot disagree.
 */
export function useGamePhotos(gameId: string | undefined, attendanceId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    // The attendance row loads after the game does. Keyed on it so "mine" is fetched again the
    // moment it is known, while invalidating by the game prefix still reaches this query.
    queryKey: [...photoKeys.game(userId, gameId), attendanceId ?? null],
    enabled: !!userId && !!gameId,
    // Signed URLs last an hour, so the list must be younger than that when it is shown.
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<{ mine: GamePhoto[]; fans: GamePhoto[] }> => {
      const mineRows = attendanceId
        ? await supabase
            .from('attendance_photos')
            .select('id, user_id, storage_path, kind, visibility, created_at')
            .eq('attendance_id', attendanceId)
            .eq('user_id', userId as string)
            .order('created_at', { ascending: true })
            .limit(200)
        : { data: [], error: null };
      if (mineRows.error) throw mineRows.error;
      const fanRows = await supabase.rpc('game_fan_photos', {
        p_game_id: gameId as string,
        p_limit: 30,
      });
      if (fanRows.error) throw fanRows.error;

      const mine = mineRows.data ?? [];
      const fans = fanRows.data ?? [];
      const urls = await sign([...mine, ...fans].map((r) => r.storage_path));
      return {
        mine: mine.map((r) => ({
          id: r.id,
          userId: r.user_id,
          kind: r.kind === 'video' ? 'video' : 'photo',
          visibility: r.visibility as PhotoVisibility,
          storagePath: r.storage_path,
          url: urls.get(r.storage_path) ?? null,
        })),
        fans: fans.map((r) => ({
          id: r.id,
          userId: r.user_id,
          kind: r.kind === 'video' ? 'video' : 'photo',
          visibility: null,
          storagePath: r.storage_path,
          url: urls.get(r.storage_path) ?? null,
        })),
      };
    },
  });
}

export type UploadOutcome = { uploaded: number; problems: string[] };

export function useAddPhotos(gameId: string | undefined, attendanceId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (media: PickedMedia[]): Promise<UploadOutcome> => {
      if (!userId || !attendanceId) throw new Error('Log this game first, then add photos.');
      const outcome: UploadOutcome = { uploaded: 0, problems: [] };
      for (const item of media) {
        const problem = uploadProblem(item);
        const type = uploadTypeFor(item);
        if (problem || !type) {
          outcome.problems.push(problem ?? 'That file type is not supported.');
          continue;
        }
        const path = photoPath(userId, attendanceId, Crypto.randomUUID(), type.ext);
        const bytes = await new File(item.uri).arrayBuffer();
        if (bytes.byteLength > MAX_UPLOAD_BYTES) {
          outcome.problems.push('That video is over 50 MB. Trim it and try again.');
          continue;
        }
        const { error: uploadError } = await supabase.storage
          .from('attendance-photos')
          .upload(path, bytes, { contentType: type.contentType, upsert: false });
        if (uploadError) {
          outcome.problems.push(uploadError.message);
          continue;
        }
        const { error: rowError } = await supabase.from('attendance_photos').insert({
          attendance_id: attendanceId,
          user_id: userId,
          storage_path: path,
          kind: item.kind,
          visibility: DEFAULT_PHOTO_VISIBILITY,
        });
        if (rowError) {
          // No row means nothing can ever show or clean up the object. Take it back out.
          await supabase.storage.from('attendance-photos').remove([path]);
          outcome.problems.push(rowError.message);
          continue;
        }
        outcome.uploaded += 1;
      }
      return outcome;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: photoKeys.game(userId, gameId) }),
  });
}

export function useSetPhotoVisibility(gameId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; visibility: PhotoVisibility }) => {
      const { error } = await supabase
        .from('attendance_photos')
        .update({ visibility: input.visibility })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: photoKeys.game(userId, gameId) }),
  });
}

export function useDeletePhoto(gameId: string | undefined) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photo: Pick<GamePhoto, 'id' | 'storagePath'>) => {
      // The object first. If the row went first and this failed, the file would be orphaned
      // with nothing left that knows its path.
      const { error: objectError } = await supabase.storage
        .from('attendance-photos')
        .remove([photo.storagePath]);
      if (objectError) throw objectError;
      const { error } = await supabase.from('attendance_photos').delete().eq('id', photo.id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: photoKeys.game(userId, gameId) }),
  });
}

/** "12 photos", "1 photo"; the header count for "From fans at this game". */
export function fanCountLabel(count: number): string {
  return count === 1 ? '1 photo' : `${count} photos`;
}
