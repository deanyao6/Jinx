import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useRef, useState } from 'react';
import { Image, View } from 'react-native';

import { Text } from '@/components/Text';
import { supabase } from '@/lib/supabase';
import { luminance } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';
import { lightColors } from '@/theme/tokens';

/**
 * A real person, wherever one appears (SPEC.md 8.6): their photo when they have one, and until
 * then a generated default that is theirs alone, so two people in a list can be told apart.
 *
 * The photo is read through a SIGNED URL from the private `avatars` bucket, not a public one. A
 * public bucket serves any object to anyone holding the URL and never consults a policy, so a
 * blocked user could keep loading the picture; signing goes through the storage policy, which is
 * the same rule as the profile card (not blocked in either direction). The URL is cached by
 * path, and a new upload is always a new path, so a cached URL can never be the wrong picture.
 *
 * Demo mode does not use this. The reference's six drawn faces (`components/reference/Avatar`)
 * are fixture art that `npm run parity` compares pixel for pixel.
 */

type Props = {
  /** The account behind the person, when there is one. Seeds the generated colour. */
  userId?: string | null;
  /** Display name. Initials come from this. */
  name?: string | null;
  /** Used for the initials when there is no name. */
  handle?: string | null;
  /** `profiles.avatar_path`. Null or absent draws the generated default. */
  path?: string | null;
  /** Diameter of the portrait. A ring and its gap are added outside it. */
  size: number;
  /** Ring it in the colour of the team in scope, and fill the default with that team. */
  ring?: boolean;
};

export const AVATAR_BUCKET = 'avatars';
/** A day. Long, so a list of faces is not re-signed and re-downloaded every visit. */
const SIGNED_URL_SECONDS = 24 * 60 * 60;
/** Half the life of the URL, so a cached one is always replaced well before it dies. */
const URL_STALE_MS = 12 * 60 * 60 * 1000;

/** First key is in `SKIP_PERSIST` (app/_layout.tsx): a signed URL restored from disk days later is dead. */
export const avatarUrlKey = (path: string) => ['avatar-url', path] as const;

/**
 * The reference's own avatar backdrops (`AVATARS` in components/reference/palettes.ts) plus two
 * in the same key. Mid-light pastels: each reads as a shape on the white card and on the dark
 * one, which a theme colour that flips with the scheme would not guarantee.
 */
export const AVATAR_HUES = [
  '#7FB3D5',
  '#9BC7A6',
  '#E8B4C8',
  '#F2C26B',
  '#A7B8F0',
  '#B5DDD1',
  '#F0A58A',
  '#C5B3E6',
] as const;

/** The same person is the same colour on every screen and every launch. */
export function avatarHue(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length] as string;
}

/** WCAG contrast ratio between two `#RRGGBB` colours, 1 to 21. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Ink or white, whichever reads better on `fill`. Never assumed: measured. */
export function textOn(fill: string): string {
  const ink = lightColors.ink;
  const white = lightColors.card;
  return contrast(fill, ink) >= contrast(fill, white) ? ink : white;
}

/** "Dean Yao" is DY, "Dad" is D, no name falls back to the handle, and nothing at all is "?". */
export function personInitials(name?: string | null, handle?: string | null): string {
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (words.length > 0) {
    const first = Array.from(words[0] as string)[0] ?? '';
    const last = words.length > 1 ? (Array.from(words[words.length - 1] as string)[0] ?? '') : '';
    return (first + last).toUpperCase();
  }
  const fromHandle = Array.from((handle ?? '').replace(/[^\p{L}\p{N}]/gu, ''))[0];
  return fromHandle ? fromHandle.toUpperCase() : '?';
}

// ---------------------------------------------------------------------------
// Signing. A list of thirty people asks for thirty URLs in the same tick; they go out as one
// request rather than thirty.
// ---------------------------------------------------------------------------

type Waiter = (url: string | null) => void;
let pending = new Map<string, Waiter[]>();
let scheduled = false;

async function flush(): Promise<void> {
  const batch = pending;
  pending = new Map();
  scheduled = false;
  const paths = [...batch.keys()];
  const urls = new Map<string, string>();
  try {
    const { data } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const row of data ?? []) if (row.path && row.signedUrl) urls.set(row.path, row.signedUrl);
  } catch {
    // Every waiter gets null below and draws the generated default.
  }
  for (const [path, waiters] of batch) for (const done of waiters) done(urls.get(path) ?? null);
}

/** Null when the picture cannot be read: gone, or not ours to see. The default is drawn then. */
export function signAvatarUrl(path: string): Promise<string | null> {
  return new Promise((resolve) => {
    pending.set(path, [...(pending.get(path) ?? []), resolve]);
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => void flush(), 0);
  });
}

function Photo({
  path,
  size,
  fallback,
}: {
  path: string;
  size: number;
  fallback: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  // The URL that failed, not a flag: a fresh URL for the same path is a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // One fresh signature per mount. A picture that fails twice is not an expired URL, and asking
  // again on every failure would loop.
  const retried = useRef(false);
  const url = useQuery({
    queryKey: avatarUrlKey(path),
    queryFn: () => signAvatarUrl(path),
    staleTime: URL_STALE_MS,
  }).data;

  if (!url || url === failedUrl) return <>{fallback}</>;
  return (
    <Image
      testID="person-avatar-photo"
      source={{ uri: url }}
      style={{ width: size, height: size }}
      // An expired URL, or a picture replaced since it was signed: draw the default now and sign
      // again, rather than leave a blank circle.
      onError={() => {
        setFailedUrl(url);
        if (retried.current) return;
        retried.current = true;
        void queryClient.invalidateQueries({ queryKey: avatarUrlKey(path) });
      }}
    />
  );
}

function Generated({ initials, fill, size }: { initials: string; fill: string; size: number }) {
  const fontSize = Math.round(size * (initials.length > 1 ? 0.42 : 0.5));
  return (
    <View
      testID="person-avatar-generated"
      style={{
        width: size,
        height: size,
        backgroundColor: fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        variant="stat"
        allowFontScaling={false}
        style={{ color: textOn(fill), fontSize, lineHeight: Math.round(fontSize * 1.08) }}
      >
        {initials}
      </Text>
    </View>
  );
}

export function PersonAvatar({ userId, name, handle, path, size, ring = false }: Props) {
  const theme = useTheme();
  const fill = ring ? theme.accent.fill : avatarHue(userId || name || handle || '?');
  const generated = <Generated initials={personInitials(name, handle)} fill={fill} size={size} />;
  const portrait = (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      {path ? <Photo path={path} size={size} fallback={generated} /> : generated}
    </View>
  );
  if (!ring) {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {portrait}
      </View>
    );
  }
  // The ring is art, like the one in the reference, not a card outline (docs/subpage-style.md 2).
  const width = size >= 64 ? 3 : 2;
  const outer = size + width * 4;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: outer,
        height: outer,
        borderRadius: outer / 2,
        borderWidth: width,
        borderColor: theme.accent.text,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {portrait}
    </View>
  );
}
