import React, { createContext, useContext, useMemo } from 'react';

import { useSupabaseRepository } from './useSupabaseRepository';
import type { Repository, RepositoryStatus } from './types';

/**
 * Supplies the repository a screen reads from (SPEC.md 8.9).
 *
 * With no provider above it, a screen gets the signed-in user's own data. That is the
 * default on purpose: the app is a record of the games *you* went to, and a screen that
 * quietly shows the reference's fixture account instead is untestable — you cannot tell a
 * bug from sample data. Demo mode is a build flag (`EXPO_PUBLIC_DEMO`, SPEC.md 8.9) read
 * inside {@link useSupabaseRepository}, not a fallback that happens when a query is slow.
 *
 * A provider still overrides it, which is what the unit tests use to render a screen
 * against fixed data without a backend.
 */
type RepositoryValue = { repository: Repository; status: RepositoryStatus };

const RepositoryContext = createContext<RepositoryValue | null>(null);

export function RepositoryProvider({
  repository,
  status = 'ready',
  children,
}: {
  repository: Repository;
  /** Defaults to 'ready': a provided repository has nothing left to load. */
  status?: RepositoryStatus;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ repository, status }), [repository, status]);
  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

/**
 * The repository and how settled it is.
 *
 * The hook below it is called unconditionally, provider or not, so the hook order is the
 * same on every render. Its queries are all keyed off the signed-in user id and do nothing
 * while a provider is supplying data instead.
 */
export function useRepositoryState(): RepositoryValue {
  const provided = useContext(RepositoryContext);
  const live = useSupabaseRepository();
  return provided ?? live;
}

export function useRepository(): Repository {
  return useRepositoryState().repository;
}

/**
 * Whether the repository is still loading, already settled, or serving demo fixtures.
 *
 * Screens use this to tell "you have not logged anything yet" apart from "your games have
 * not arrived yet". Both render an empty screen; only one of them is a fact about the user.
 */
export function useRepositoryStatus(): RepositoryStatus {
  return useRepositoryState().status;
}
