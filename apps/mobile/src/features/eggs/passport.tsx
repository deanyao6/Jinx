import React from 'react';

import { CurseBreaker } from './CurseShatter';
import { eggs } from './flags';
import { RallyCapWordmark } from './RallyCap';
import { RecordRewind } from './RecordRewind';
import { useEggsLive } from './runtime';

type HeadEggs = { renderTitle?: (wordmark: React.ReactElement) => React.ReactNode };
type HeroEggs = {
  renderRecord?: (record: string, draw: (text: string) => React.ReactElement) => React.ReactNode;
  overlay?: React.ReactNode;
};

/**
 * The Passport's easter eggs, as props to spread onto its `Head` and `Hero`.
 *
 * An egg that is switched off, and every egg in demo mode, contributes no prop at all, so the
 * screen draws exactly what it drew before there were eggs: `npm run parity` compares this
 * screen with the reference pixel by pixel. The one place that decides is here.
 */
export function usePassportEggs(pill: string): { head: HeadEggs; hero: HeroEggs } {
  const live = useEggsLive();
  return React.useMemo(() => {
    const head: HeadEggs = {};
    const hero: HeroEggs = {};
    if (!live) return { head, hero };
    if (eggs.rallyCap) {
      head.renderTitle = (wordmark) => <RallyCapWordmark>{wordmark}</RallyCapWordmark>;
    }
    if (eggs.recordRewind) {
      hero.renderRecord = (record, draw) => (
        <RecordRewind pill={pill} record={record} draw={draw} />
      );
    }
    if (eggs.curseBreaker) hero.overlay = <CurseBreaker />;
    return { head, hero };
  }, [live, pill]);
}
