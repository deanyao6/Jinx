import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { SearchScreen } from '@/features/games/search/SearchScreen';
import { env } from '@/lib/env';

export default function GameSearch() {
  const { scope, q } = useLocalSearchParams<{ scope?: string; q?: string }>();
  if (!env.searchV2) return <Redirect href="/legacy-games?segment=log" />;
  return <SearchScreen initialScope={scope === 'mine' ? 'mine' : 'all'} initialQuery={q ?? ''} />;
}
