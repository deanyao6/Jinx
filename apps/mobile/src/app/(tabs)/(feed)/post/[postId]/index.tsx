import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { RoutePlaceholder } from '@/features/navigation/ui/RoutePlaceholder';

/** One post. A placeholder until prompt 2 builds posts; push notifications will open it. */
export default function PostRoute() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return (
    <RoutePlaceholder
      icon="i-news"
      title="Posts are coming"
      body="A game someone logged, with its kudos and comments, will open here."
      links={[{ label: 'Comments', href: `/post/${postId}/comments` }]}
    />
  );
}
