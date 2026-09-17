import { useMutation, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { AVATAR_BUCKET, avatarUrlKey } from '@/components/PersonAvatar';
import { useAuthStore } from '@/features/auth/store';
import { peopleKeys } from '@/features/people/queries';
import { profileKeys, type Profile } from '@/features/profile/queries';
import { socialKeys } from '@/features/social/queries';
import { supabase } from '@/lib/supabase';

/**
 * Profile photos (SPEC.md 8.6, 9).
 *
 * The object lives in the private `avatars` bucket at `<user_id>/avatar-<timestamp>.<ext>` and
 * `profiles.avatar_path` names the current one. Every upload takes a NEW path: the picture is
 * shown through a URL cached by path (components/PersonAvatar.tsx), so a reused path would keep
 * serving yesterday's face from every cache between here and the screen.
 *
 * Who can see it is decided by the storage policy (migration 20260917000700): whoever can see
 * the profile card, which is every signed-in user who is not blocked in either direction.
 */

export { AVATAR_BUCKET };

/** The bucket's own limit. Checked here so the message is ours rather than the server's. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
};

export type PickedAvatar = { uri: string; mimeType: string };

/** The extension and content type the bucket accepts. The cropped picker output is a JPEG. */
export function avatarUploadType(picked: PickedAvatar): { ext: string; contentType: string } {
  const mime = picked.mimeType.toLowerCase();
  if (EXT_BY_MIME[mime]) return { ext: EXT_BY_MIME[mime], contentType: mime };
  const fromName = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(picked.uri)?.[1]?.toLowerCase();
  const normal = fromName === 'jpeg' ? 'jpg' : fromName;
  const entry = Object.entries(EXT_BY_MIME).find(([, ext]) => ext === normal);
  return entry
    ? { ext: entry[1], contentType: entry[0] }
    : { ext: 'jpg', contentType: 'image/jpeg' };
}

/** `<user_id>/avatar-<timestamp>.<ext>`. The timestamp is what makes each upload a new path. */
export function avatarPath(userId: string, now: number, ext = 'jpg'): string {
  return `${userId}/avatar-${now}.${ext}`;
}

/** Everything in the user's folder that is not the avatar being kept. */
export function staleAvatarPaths(
  userId: string,
  listedNames: readonly string[],
  keepPath: string | null,
): string[] {
  return listedNames.map((name) => `${userId}/${name}`).filter((path) => path !== keepPath);
}

type StorageError = { message: string } | null;

/** The three calls the flow makes, so the ordering can be tested without a backend. */
export type AvatarBackend = {
  upload(path: string, bytes: ArrayBuffer, contentType: string): Promise<{ error: StorageError }>;
  setProfilePath(path: string | null): Promise<{ error: StorageError }>;
  /** File names directly under `<user_id>/`. */
  list(userId: string): Promise<{ names: string[]; error: StorageError }>;
  remove(paths: string[]): Promise<{ error: StorageError }>;
};

/**
 * Removes every object in the folder except `keepPath`. Best effort by design: by the time this
 * runs the profile already points at the right thing (or at nothing), and the storage policy
 * shows other people only the CURRENT avatar, so a file left behind is seen by nobody. The next
 * upload, or account deletion, sweeps it.
 */
async function sweep(
  backend: AvatarBackend,
  userId: string,
  keepPath: string | null,
  knownOldPath: string | null,
): Promise<void> {
  try {
    const listed = await backend.list(userId);
    const stale = listed.error
      ? knownOldPath && knownOldPath !== keepPath
        ? [knownOldPath]
        : []
      : staleAvatarPaths(userId, listed.names, keepPath);
    if (stale.length) await backend.remove(stale);
  } catch {
    // See above: nothing depends on this having worked.
  }
}

/**
 * Upload to a new path, point the profile at it, and only then delete the old object.
 *
 * In that order so there is never a moment when the profile names a file that does not exist.
 * If the profile update fails the new object is taken back out: nothing would ever point at it.
 */
export async function replaceAvatar(
  backend: AvatarBackend,
  input: {
    userId: string;
    oldPath: string | null;
    bytes: ArrayBuffer;
    contentType: string;
    ext: string;
    now: number;
  },
): Promise<string> {
  if (input.bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new Error('That photo is over 5 MB. Choose a smaller one.');
  }
  const path = avatarPath(input.userId, input.now, input.ext);
  const uploaded = await backend.upload(path, input.bytes, input.contentType);
  if (uploaded.error) throw new Error(uploaded.error.message);
  const pointed = await backend.setProfilePath(path);
  if (pointed.error) {
    await backend.remove([path]).catch(() => undefined);
    throw new Error(pointed.error.message);
  }
  await sweep(backend, input.userId, path, input.oldPath);
  return path;
}

/**
 * Clear the profile first, then delete the object. The other way round would leave the profile
 * naming a missing file, and everyone would see a broken picture instead of the initials.
 */
export async function removeAvatar(
  backend: AvatarBackend,
  input: { userId: string; oldPath: string | null },
): Promise<void> {
  const cleared = await backend.setProfilePath(null);
  if (cleared.error) throw new Error(cleared.error.message);
  await sweep(backend, input.userId, null, input.oldPath);
}

function supabaseBackend(userId: string): AvatarBackend {
  const bucket = () => supabase.storage.from(AVATAR_BUCKET);
  return {
    upload: async (path, bytes, contentType) => {
      const { error } = await bucket().upload(path, bytes, { contentType, upsert: false });
      return { error };
    },
    setProfilePath: async (path) => {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_path: path })
        .eq('id', userId);
      return { error };
    },
    list: async (folder) => {
      const { data, error } = await bucket().list(folder, { limit: 100 });
      return { names: (data ?? []).filter((o) => o.id !== null).map((o) => o.name), error };
    },
    remove: async (paths) => {
      const { error } = await bucket().remove(paths);
      return { error };
    },
  };
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  // The square crop is the resize: the picker hands back the cropped region, compressed.
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
  // Location and device data stay on the phone (SPEC.md 9).
  exif: false,
};

function firstAsset(res: ImagePicker.ImagePickerResult): PickedAvatar | null {
  const asset = res.canceled ? null : res.assets[0];
  return asset ? { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' } : null;
}

/** Null when the person backs out of the picker. */
export async function pickAvatarFromLibrary(): Promise<PickedAvatar | null> {
  return firstAsset(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));
}

/** Null when the person backs out. Throws, in words, when the camera is not allowed. */
export async function takeAvatarPhoto(): Promise<PickedAvatar | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      'Jinx cannot use the camera. Allow it in Settings, or choose from your library.',
    );
  }
  return firstAsset(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
}

/** My own face shows up in lists other queries own; refetch the ones that carry it. */
function useAfterAvatarChange() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return (path: string | null, localUri?: string) => {
    // The picture just chosen is already on the phone: show it now instead of waiting for a
    // signed URL to come back and the same bytes to download again.
    if (path && localUri) queryClient.setQueryData(avatarUrlKey(path), localUri);
    queryClient.setQueryData<Profile>(profileKeys.me(userId), (prev) =>
      prev ? { ...prev, avatar_path: path } : prev,
    );
    void queryClient.invalidateQueries({ queryKey: socialKeys.all });
    void queryClient.invalidateQueries({ queryKey: peopleKeys.all });
  };
}

export function useSetAvatar() {
  const userId = useAuthStore((s) => s.userId);
  const after = useAfterAvatarChange();
  return useMutation({
    mutationFn: async (input: { picked: PickedAvatar; oldPath: string | null }) => {
      if (!userId) throw new Error('Not signed in');
      const type = avatarUploadType(input.picked);
      const bytes = await new File(input.picked.uri).arrayBuffer();
      return replaceAvatar(supabaseBackend(userId), {
        userId,
        oldPath: input.oldPath,
        bytes,
        contentType: type.contentType,
        ext: type.ext,
        now: Date.now(),
      });
    },
    onSuccess: (path, input) => after(path, input.picked.uri),
  });
}

export function useRemoveAvatar() {
  const userId = useAuthStore((s) => s.userId);
  const after = useAfterAvatarChange();
  return useMutation({
    mutationFn: async (input: { oldPath: string | null }) => {
      if (!userId) throw new Error('Not signed in');
      await removeAvatar(supabaseBackend(userId), { userId, oldPath: input.oldPath });
    },
    onSuccess: () => after(null),
  });
}
