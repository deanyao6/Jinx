import {
  MAX_AVATAR_BYTES,
  avatarPath,
  avatarUploadType,
  removeAvatar,
  replaceAvatar,
  staleAvatarPaths,
  type AvatarBackend,
} from '../avatar';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-file-system', () => ({ File: class {} }));

const USER = 'a1b2c3d4-0000-4000-8000-000000000001';

/** A storage client that records every call in order, and fails where a test tells it to. */
function fakeBackend(opts: {
  names?: string[];
  fail?: Partial<Record<keyof AvatarBackend, string>>;
}) {
  const calls: string[] = [];
  const result = (op: keyof AvatarBackend) => ({
    error: opts.fail?.[op] ? { message: opts.fail[op] as string } : null,
  });
  const backend: AvatarBackend = {
    upload: async (path, _bytes, contentType) => {
      calls.push(`upload ${path} ${contentType}`);
      return result('upload');
    },
    setProfilePath: async (path) => {
      calls.push(`profile ${path}`);
      return result('setProfilePath');
    },
    list: async (folder) => {
      calls.push(`list ${folder}`);
      return { names: opts.names ?? [], ...result('list') };
    },
    remove: async (paths) => {
      calls.push(`remove ${paths.join(',')}`);
      return result('remove');
    },
  };
  return { backend, calls };
}

const input = (over: Partial<Parameters<typeof replaceAvatar>[1]> = {}) => ({
  userId: USER,
  oldPath: `${USER}/avatar-100.jpg`,
  bytes: new ArrayBuffer(8),
  contentType: 'image/jpeg',
  ext: 'jpg',
  now: 200,
  ...over,
});

describe('avatarPath', () => {
  it('is <user>/avatar-<timestamp>.<ext>, under the folder the storage policy allows', () => {
    expect(avatarPath(USER, 1758100000000)).toBe(`${USER}/avatar-1758100000000.jpg`);
    expect(avatarPath(USER, 5, 'png')).toBe(`${USER}/avatar-5.png`);
  });

  it('is a new path for every upload, so no cache can serve the old picture', () => {
    expect(avatarPath(USER, 1)).not.toBe(avatarPath(USER, 2));
  });
});

describe('avatarUploadType', () => {
  it('takes the type the picker reports', () => {
    expect(avatarUploadType({ uri: 'file:///a.jpg', mimeType: 'image/jpeg' })).toEqual({
      ext: 'jpg',
      contentType: 'image/jpeg',
    });
    expect(avatarUploadType({ uri: 'file:///a', mimeType: 'IMAGE/PNG' }).ext).toBe('png');
  });

  it('falls back to the file name, and then to the JPEG the cropper writes', () => {
    expect(avatarUploadType({ uri: 'file:///tmp/IMG_1.HEIC', mimeType: 'image' }).contentType).toBe(
      'image/heic',
    );
    expect(avatarUploadType({ uri: 'file:///tmp/blob', mimeType: '' })).toEqual({
      ext: 'jpg',
      contentType: 'image/jpeg',
    });
  });
});

describe('staleAvatarPaths', () => {
  it('is everything in the folder except the avatar being kept', () => {
    expect(
      staleAvatarPaths(USER, ['avatar-100.jpg', 'avatar-200.jpg'], `${USER}/avatar-200.jpg`),
    ).toEqual([`${USER}/avatar-100.jpg`]);
  });

  it('is the whole folder when the photo is removed', () => {
    expect(staleAvatarPaths(USER, ['avatar-100.jpg'], null)).toEqual([`${USER}/avatar-100.jpg`]);
  });
});

describe('replaceAvatar', () => {
  it('uploads, then points the profile at it, and only then deletes the old object', async () => {
    const { backend, calls } = fakeBackend({ names: ['avatar-100.jpg', 'avatar-200.jpg'] });
    const path = await replaceAvatar(backend, input());
    expect(path).toBe(`${USER}/avatar-200.jpg`);
    expect(calls).toEqual([
      `upload ${USER}/avatar-200.jpg image/jpeg`,
      `profile ${USER}/avatar-200.jpg`,
      `list ${USER}`,
      `remove ${USER}/avatar-100.jpg`,
    ]);
  });

  it('never deletes the picture it just uploaded', async () => {
    const { backend, calls } = fakeBackend({ names: ['avatar-200.jpg'] });
    await replaceAvatar(backend, input({ oldPath: null }));
    expect(calls.some((c) => c.startsWith('remove'))).toBe(false);
  });

  it('sweeps strays an earlier failed cleanup left behind', async () => {
    const { backend, calls } = fakeBackend({
      names: ['avatar-50.jpg', 'avatar-100.jpg', 'avatar-200.jpg'],
    });
    await replaceAvatar(backend, input());
    expect(calls[calls.length - 1]).toBe(`remove ${USER}/avatar-50.jpg,${USER}/avatar-100.jpg`);
  });

  it('touches nothing else when the upload fails', async () => {
    const { backend, calls } = fakeBackend({ fail: { upload: 'too big' } });
    await expect(replaceAvatar(backend, input())).rejects.toThrow('too big');
    expect(calls).toEqual([`upload ${USER}/avatar-200.jpg image/jpeg`]);
  });

  it('takes the new object back out when the profile cannot be pointed at it, and keeps the old one', async () => {
    const { backend, calls } = fakeBackend({ fail: { setProfilePath: 'offline' } });
    await expect(replaceAvatar(backend, input())).rejects.toThrow('offline');
    expect(calls).toEqual([
      `upload ${USER}/avatar-200.jpg image/jpeg`,
      `profile ${USER}/avatar-200.jpg`,
      `remove ${USER}/avatar-200.jpg`,
    ]);
  });

  it('still succeeds when the cleanup fails: the profile is already right', async () => {
    const { backend } = fakeBackend({ names: ['avatar-100.jpg'], fail: { remove: 'nope' } });
    await expect(replaceAvatar(backend, input())).resolves.toBe(`${USER}/avatar-200.jpg`);
  });

  it('falls back to the known old path when the folder cannot be listed', async () => {
    const { backend, calls } = fakeBackend({ fail: { list: 'nope' } });
    await replaceAvatar(backend, input());
    expect(calls[calls.length - 1]).toBe(`remove ${USER}/avatar-100.jpg`);
  });

  it('refuses a file over the bucket limit before sending it', async () => {
    const { backend, calls } = fakeBackend({});
    await expect(
      replaceAvatar(backend, input({ bytes: new ArrayBuffer(MAX_AVATAR_BYTES + 1) })),
    ).rejects.toThrow('over 5 MB');
    expect(calls).toEqual([]);
  });
});

describe('removeAvatar', () => {
  it('clears the profile first, then deletes the object', async () => {
    const { backend, calls } = fakeBackend({ names: ['avatar-100.jpg'] });
    await removeAvatar(backend, { userId: USER, oldPath: `${USER}/avatar-100.jpg` });
    expect(calls).toEqual([`profile null`, `list ${USER}`, `remove ${USER}/avatar-100.jpg`]);
  });

  it('deletes nothing when the profile could not be cleared', async () => {
    const { backend, calls } = fakeBackend({ fail: { setProfilePath: 'offline' } });
    await expect(
      removeAvatar(backend, { userId: USER, oldPath: `${USER}/avatar-100.jpg` }),
    ).rejects.toThrow('offline');
    expect(calls).toEqual(['profile null']);
  });
});
