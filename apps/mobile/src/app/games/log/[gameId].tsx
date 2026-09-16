import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { LogSheet } from '@/features/attendances/LogSheet';

export default function LogGameRoute() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  return <LogSheet gameId={gameId} />;
}
