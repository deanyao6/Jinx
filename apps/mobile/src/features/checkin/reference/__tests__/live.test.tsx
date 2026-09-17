import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { demoRepository } from '@/features/data/demo';
import { renderScreen } from '@/test/renderScreen';
import { ReferenceThemeProvider } from '@/theme/reference/TeamTheme';

import { pickStatusText, pledgeFailureText } from '../PickASideLive';
import { PickASideView, type PickASideViewProps } from '../PickASideScreen';

const data = demoRepository.pickASide();

function view(props: Partial<PickASideViewProps>) {
  return (
    <ReferenceThemeProvider team="none">
      <PickASideView data={data} picked={undefined} onPick={() => {}} {...props} />
    </ReferenceThemeProvider>
  );
}

describe('Pick a side with a real game', () => {
  it('reports the side that was tapped, and leaves the state to its owner', async () => {
    const onPick = jest.fn();
    const { getByText, queryByText } = await renderScreen(view({ onPick }));
    await fireEvent.press(getByText('Root for SD Padres'));
    expect(onPick).toHaveBeenCalledWith('home');
    // Nothing is confirmed until the server says so: `picked` comes from the pledge row.
    expect(queryByText(/You're rooting for/)).toBeNull();
  });

  it('shows the countdown until the lock, then says it is locked', async () => {
    const open = await renderScreen(view({}));
    expect(open.getByText(`LOCKS IN ${data.lockCountdown}`)).toBeTruthy();
    const closed = await renderScreen(view({ locked: true }));
    expect(closed.getByText('LOCKED')).toBeTruthy();
    expect(closed.queryByText(/LOCKS IN/)).toBeNull();
  });

  it('does not take a pick after the lock', async () => {
    const onPick = jest.fn();
    const { getByText } = await renderScreen(view({ locked: true, onPick }));
    await fireEvent.press(getByText('Root for NY Mets'));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('does not take a second pick while the first is on its way', async () => {
    const onPick = jest.fn();
    const { getByText } = await renderScreen(view({ busy: true, onPick }));
    await fireEvent.press(getByText('Root for NY Mets'));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('says why a pick failed', async () => {
    const { getByText } = await renderScreen(view({ errorText: pledgeFailureText('game_over') }));
    expect(getByText('This game is over, so picks are closed.')).toBeTruthy();
  });

  it('explains an empty Storylines section instead of leaving a bare heading', async () => {
    const { getByText } = await renderScreen(
      view({
        data: { ...data, storylines: [] },
        storylinesNote: 'No storylines for this game yet.',
      }),
    );
    expect(getByText('No storylines for this game yet.')).toBeTruthy();
  });

  it('shows each storyline with its source label', async () => {
    const { getByText } = await renderScreen(view({}));
    const first = data.storylines[0];
    expect(first).toBeDefined();
    expect(getByText(first!.text)).toBeTruthy();
    expect(getByText(first!.source)).toBeTruthy();
  });
});

describe('pickStatusText', () => {
  it('is silent before a pick', () => {
    expect(
      pickStatusText({ locked: false, gameOver: false, pickedName: null, pickedProb: null }),
    ).toBeNull();
  });

  it('uses the reference confirmation while the pick can still change', () => {
    expect(
      pickStatusText({ locked: false, gameOver: false, pickedName: 'Mets', pickedProb: 0.58 }),
    ).toBe(
      "You're rooting for the Mets. Switch anytime before it locks. " +
        'A win adds +0.42 to your neutral record vs expected.',
    );
  });

  it('quotes the probability frozen at pick time once locked', () => {
    expect(
      pickStatusText({ locked: true, gameOver: false, pickedName: 'Bears', pickedProb: 0.38 }),
    ).toBe(
      'Locked in: the Bears, 38% to win when you picked. The result posts once the game is final.',
    );
  });

  it('tells a fan who never picked that the game stays neutral', () => {
    expect(
      pickStatusText({ locked: true, gameOver: false, pickedName: null, pickedProb: null }),
    ).toMatch(/No pick before the lock/);
    expect(
      pickStatusText({ locked: true, gameOver: true, pickedName: null, pickedProb: null }),
    ).toMatch(/The game ended before you picked/);
  });
});
