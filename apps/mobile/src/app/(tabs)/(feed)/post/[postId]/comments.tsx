import React from 'react';

import { RoutePlaceholder } from '@/features/navigation/ui/RoutePlaceholder';

/** The thread on one post. A placeholder until prompt 2 builds comments. */
export default function CommentsRoute() {
  return (
    <RoutePlaceholder
      icon="i-users"
      title="Comments are coming"
      body="The thread on this post will open here, with report, block and mute."
    />
  );
}
