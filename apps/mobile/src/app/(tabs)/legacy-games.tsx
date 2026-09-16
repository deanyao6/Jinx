import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';

import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { HistorySegment } from '@/features/games/ui/HistorySegment';
import { LogSegment } from '@/features/games/ui/LogSegment';
import { TodayBanner } from '@/features/games/ui/TodayBanner';
import { UpcomingSegment } from '@/features/games/ui/UpcomingSegment';
import { useNotificationRuntime } from '@/features/notifications/push';

type Segment = 'upcoming' | 'log' | 'history';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'log', label: 'Log a game' },
  { key: 'history', label: 'History' },
];

function isSegment(s: string | undefined): s is Segment {
  return s === 'upcoming' || s === 'log' || s === 'history';
}

export default function GamesScreen() {
  const {
    segment: param,
    q,
    date,
  } = useLocalSearchParams<{
    segment?: string;
    q?: string;
    date?: string;
  }>();
  const [segment, setSegment] = useState<Segment>(isSegment(param) ? param : 'history');
  // Follow the ?segment= param when it changes (onboarding, bulk mode, and imports deep-link here).
  const [seenParam, setSeenParam] = useState(`${param}|${q}|${date}`);
  const [prefillKey, setPrefillKey] = useState(0);
  if (`${param}|${q}|${date}` !== seenParam) {
    setSeenParam(`${param}|${q}|${date}`);
    setPrefillKey((k) => k + 1);
    if (isSegment(param)) setSegment(param);
  }
  useNotificationRuntime();

  return (
    <Screen>
      <Text variant="h1" style={{ marginBottom: 12 }}>
        Games
      </Text>
      <TodayBanner />
      <Segmented options={SEGMENTS} value={segment} onChange={setSegment} />
      {segment === 'upcoming' ? <UpcomingSegment onLog={() => setSegment('log')} /> : null}
      {segment === 'log' ? (
        <LogSegment key={prefillKey} initialQuery={q ?? ''} initialDate={date ?? ''} />
      ) : null}
      {segment === 'history' ? <HistorySegment onLog={() => setSegment('log')} /> : null}
    </Screen>
  );
}
