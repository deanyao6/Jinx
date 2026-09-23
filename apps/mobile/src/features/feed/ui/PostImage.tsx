import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Image, View, type ViewStyle } from 'react-native';

import { PhotoScene } from '@/components/reference/PhotoScene';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * One photo from a private bucket, through a signed URL that expires in an hour. The bucket's
 * read policy asks the same question as the post (can this viewer see it?), so a URL is only
 * ever signed for someone allowed to look.
 *
 * `post-photos` is this prompt's; `reaction-photos` is prompt 3's. A `demo:<scene>:<seed>` path
 * draws the reference's placeholder scene instead (demo mode only).
 */
export type PhotoBucket = 'post-photos' | 'reaction-photos';

const SIGNED_SECONDS = 60 * 60;

export function useSignedUrl(bucket: PhotoBucket, path: string) {
  return useQuery({
    queryKey: ['signed-url', bucket, path],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_SECONDS);
      if (error) return null;
      return data.signedUrl;
    },
    enabled: !path.startsWith('demo:'),
    // Refresh well before the URL runs out.
    staleTime: (SIGNED_SECONDS - 10 * 60) * 1000,
    gcTime: SIGNED_SECONDS * 1000,
  });
}

function demoScene(path: string) {
  const [, kind, seed] = path.split(':');
  const scene = kind === 'selfie' || kind === 'field' || kind === 'board' ? kind : 'field';
  return <PhotoScene kind={scene} seed={Number(seed) || 0} />;
}

export function PostImage({
  bucket,
  path,
  style,
  accessibilityLabel,
}: {
  bucket: PhotoBucket;
  path: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const url = useSignedUrl(bucket, path);
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[{ overflow: 'hidden', backgroundColor: theme.colors.tint, borderRadius: theme.radius.md }, style]}
    >
      {path.startsWith('demo:') ? (
        demoScene(path)
      ) : url.data ? (
        <Image source={{ uri: url.data }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : null}
    </View>
  );
}
