import {
  DEFAULT_PHOTO_VISIBILITY,
  MAX_UPLOAD_BYTES,
  fanCountLabel,
  photoPath,
  uploadProblem,
  uploadTypeFor,
} from '../photos';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('uploadTypeFor', () => {
  it('accepts what the bucket accepts', () => {
    expect(uploadTypeFor({ mimeType: 'image/jpeg', uri: 'file:///a.jpg' })).toEqual({
      ext: 'jpg',
      contentType: 'image/jpeg',
    });
    expect(uploadTypeFor({ mimeType: 'video/quicktime', uri: 'file:///a.mov' })?.ext).toBe('mov');
    expect(uploadTypeFor({ mimeType: 'IMAGE/HEIC', uri: 'file:///a.heic' })?.ext).toBe('heic');
  });

  it('falls back to the file name when the picker gives no usable type', () => {
    expect(uploadTypeFor({ mimeType: 'image', uri: 'file:///tmp/IMG_0042.JPEG' })).toEqual({
      ext: 'jpg',
      contentType: 'image/jpeg',
    });
  });

  it('refuses a type the bucket would reject, before uploading it', () => {
    expect(uploadTypeFor({ mimeType: 'image/gif', uri: 'file:///a.gif' })).toBeNull();
    expect(uploadTypeFor({ mimeType: 'application/pdf', uri: 'file:///a.pdf' })).toBeNull();
  });
});

describe('uploadProblem', () => {
  const photo = { uri: 'file:///a.jpg', mimeType: 'image/jpeg', kind: 'photo' as const };

  it('passes an ordinary photo', () => {
    expect(uploadProblem({ ...photo, bytes: 3_000_000 })).toBeNull();
    expect(uploadProblem({ ...photo, bytes: null })).toBeNull();
  });

  it('explains the size limit instead of failing at the bucket', () => {
    expect(
      uploadProblem({
        uri: 'file:///a.mov',
        mimeType: 'video/quicktime',
        kind: 'video',
        bytes: MAX_UPLOAD_BYTES + 1,
      }),
    ).toMatch(/over 50 MB/);
  });
});

describe('photoPath', () => {
  it('starts with the user id, which is what the storage policy checks', () => {
    expect(photoPath('user-1', 'att-9', 'abc', 'jpg')).toBe('user-1/att-9/abc.jpg');
  });
});

describe('defaults and labels', () => {
  it('uploads as followers-only, per SPEC 9', () => {
    expect(DEFAULT_PHOTO_VISIBILITY).toBe('followers');
  });

  it('counts fan photos in words', () => {
    expect(fanCountLabel(1)).toBe('1 photo');
    expect(fanCountLabel(12)).toBe('12 photos');
  });
});
