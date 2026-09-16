import React, { createContext, useContext } from 'react';

import { demoRepository } from './demo';
import type { Repository } from './types';

/**
 * Supplies the repository a screen reads from (SPEC.md 8.9).
 *
 * The default is the demo implementation. That is deliberate rather than a placeholder:
 * demo mode has to work with no backend at all, and the parity harness depends on it. A
 * Supabase-backed implementation will be provided here per milestone as each screen's real
 * queries land, and no screen will change when it is.
 */
const RepositoryContext = createContext<Repository>(demoRepository);

export function RepositoryProvider({
  repository,
  children,
}: {
  repository: Repository;
  children: React.ReactNode;
}) {
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): Repository {
  return useContext(RepositoryContext);
}
