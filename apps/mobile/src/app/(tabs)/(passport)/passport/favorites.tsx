import React from 'react';

import { RoutePlaceholder } from '@/features/navigation/ui/RoutePlaceholder';

/** Four favorites. A placeholder until prompt 4 builds the picker. */
export default function FourFavoritesRoute() {
  return (
    <RoutePlaceholder
      icon="i-spark"
      title="Four favorites are coming"
      body="Pin four games to the top of your profile."
    />
  );
}
