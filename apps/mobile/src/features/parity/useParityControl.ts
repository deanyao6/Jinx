import { useEffect, useState } from 'react';

import { resolveParityScreen, type ParityScreenId } from './screens';

/**
 * Development-only channel that lets the visual parity harness choose which screen the
 * app shows (SPEC.md M0.5).
 *
 * It polls rather than receiving a deep link because iOS 26 puts a confirmation dialog
 * in front of every custom-scheme open and `simctl` cannot dismiss it. The reasoning is
 * written up in scripts/parity/control.mjs.
 *
 * When the harness is not running, every request fails and this stays inactive, so a
 * normal `npm run ios` is unaffected.
 */

const PORT = 8790;
const URL = `http://127.0.0.1:${PORT}/current`;
const IDLE_POLL_MS = 1000;
const ACTIVE_POLL_MS = 150;

export type ParityControl = {
  active: boolean;
  screenId: ParityScreenId | null;
};

export function useParityControl(): ParityControl {
  const [state, setState] = useState<ParityControl>({ active: false, screenId: null });

  useEffect(() => {
    if (!__DEV__) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      let next: ParityControl = { active: false, screenId: null };
      try {
        const res = await fetch(URL);
        if (res.ok) {
          const body = (await res.json()) as {
            screen: string | null;
            params?: Record<string, string>;
          };
          next = {
            active: true,
            screenId: body.screen ? resolveParityScreen(body.screen, body.params ?? {}) : null,
          };
        }
      } catch {
        // The harness is not running. Stay out of the way.
      }
      if (cancelled) return;
      setState((prev) =>
        prev.active === next.active && prev.screenId === next.screenId ? prev : next,
      );
      timer = setTimeout(poll, next.active ? ACTIVE_POLL_MS : IDLE_POLL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return state;
}
