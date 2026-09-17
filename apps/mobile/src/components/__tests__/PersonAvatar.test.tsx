import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configure, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { luminance } from '@/theme/color';
import { ReferenceThemeProvider } from '@/theme/reference/TeamTheme';

import {
  AVATAR_HUES,
  PersonAvatar,
  avatarHue,
  avatarUrlKey,
  personInitials,
  textOn,
} from '../PersonAvatar';

const mockCreateSignedUrls = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({ createSignedUrls: (...a: unknown[]) => mockCreateSignedUrls(...a) }),
    },
  },
}));

// An avatar is decoration beside a name that is already read out, so it is hidden from
// accessibility, and the queries skip hidden elements unless told otherwise.
configure({ defaultIncludeHiddenElements: true });

const ALEX = '11111111-1111-4111-8111-111111111111';
const PATH = `${ALEX}/avatar-1.jpg`;

/** No garbage-collection timer, so nothing outlives the test. */
const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

function withClient(ui: React.ReactElement, client = newClient()) {
  return { client, ui: <QueryClientProvider client={client}>{ui}</QueryClientProvider> };
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

beforeEach(() => mockCreateSignedUrls.mockReset());

describe('personInitials', () => {
  it('takes the first and last word of a display name', () => {
    expect(personInitials('Dean Yao', 'deanyao')).toBe('DY');
    expect(personInitials('mary jo van der berg')).toBe('MB');
  });

  it('is one letter for a one-word name, which is what a placeholder usually is', () => {
    expect(personInitials('Dad')).toBe('D');
  });

  it('falls back to the handle, skipping what is not a letter or digit', () => {
    expect(personInitials('', 'fan_a7000000')).toBe('F');
    expect(personInitials('   ', '_zed')).toBe('Z');
    expect(personInitials('@sam_p', null)).toBe('S');
  });

  it('is a question mark when there is nothing to go on', () => {
    expect(personInitials(null, null)).toBe('?');
  });
});

describe('avatarHue', () => {
  it('is the same colour for the same person every time', () => {
    expect(avatarHue(ALEX)).toBe(avatarHue(ALEX));
    expect(AVATAR_HUES).toContain(avatarHue(ALEX));
  });

  it('spreads different people across the set', () => {
    const ids = Array.from(
      { length: 64 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    expect(new Set(ids.map(avatarHue)).size).toBeGreaterThan(AVATAR_HUES.length / 2);
  });
});

describe('textOn', () => {
  it('measures rather than assumes: ink on light fills, white on dark ones', () => {
    expect(textOn('#F2C26B')).toBe('#101318');
    expect(textOn('#0B162A')).toBe('#FFFFFF');
    expect(textOn('#E81828')).toBe('#FFFFFF');
  });

  it('reads at 4.5:1 or better on every generated hue', () => {
    for (const hue of AVATAR_HUES) expect(contrast(hue, textOn(hue))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('PersonAvatar', () => {
  it('draws the generated default, with initials, when there is no photo', async () => {
    const { getByTestId, getByText, queryByTestId } = await render(
      <PersonAvatar userId={ALEX} name="Alex Kim" size={38} />,
    );
    expect(getByText('AK')).toBeTruthy();
    expect(queryByTestId('person-avatar-photo')).toBeNull();
    const fill = StyleSheet.flatten(getByTestId('person-avatar-generated').props.style);
    expect(fill.backgroundColor).toBe(avatarHue(ALEX));
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });

  it('gives two people with the same name different colours when their ids differ', () => {
    const other = Array.from(
      { length: 32 },
      (_, i) => `${i}2222222-2222-4222-8222-222222222222`,
    ).find((id) => avatarHue(id) !== avatarHue(ALEX));
    expect(other).toBeDefined();
  });

  it('seeds a placeholder with no account from the name', async () => {
    const { getByTestId } = await render(<PersonAvatar name="Dad" size={38} />);
    const fill = StyleSheet.flatten(getByTestId('person-avatar-generated').props.style);
    expect(fill.backgroundColor).toBe(avatarHue('Dad'));
  });

  it('fills the default with the team in scope when ringed, in a colour that reads on it', async () => {
    const { getByTestId, getByText } = await render(
      <ReferenceThemeProvider team="phillies" scheme="light">
        <PersonAvatar userId={ALEX} name="Alex Kim" size={38} ring />
      </ReferenceThemeProvider>,
    );
    const fill = StyleSheet.flatten(getByTestId('person-avatar-generated').props.style)
      .backgroundColor as string;
    expect(AVATAR_HUES as readonly string[]).not.toContain(fill);
    const ink = StyleSheet.flatten(getByText('AK').props.style).color as string;
    expect(ink).toBe(textOn(fill));
    expect(contrast(fill, ink)).toBeGreaterThanOrEqual(4.5);
  });

  it('shows the photo through a signed URL from the private bucket', async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [{ path: PATH, signedUrl: 'https://signed.example/alex', error: null }],
      error: null,
    });
    const { ui } = withClient(<PersonAvatar userId={ALEX} name="Alex Kim" path={PATH} size={38} />);
    const { getByTestId, queryByTestId } = await render(ui);
    // Until the URL arrives the default stands in, so a row never shows a hole.
    expect(getByTestId('person-avatar-generated')).toBeTruthy();
    await waitFor(() => expect(getByTestId('person-avatar-photo')).toBeTruthy());
    expect(getByTestId('person-avatar-photo').props.source).toEqual({
      uri: 'https://signed.example/alex',
    });
    expect(queryByTestId('person-avatar-generated')).toBeNull();
    expect(mockCreateSignedUrls).toHaveBeenCalledWith([PATH], 24 * 60 * 60);
  });

  it('signs a whole list in one request', async () => {
    const paths = [1, 2, 3].map((n) => `${ALEX}/avatar-${n}.jpg`);
    mockCreateSignedUrls.mockImplementation(async (asked: string[]) => ({
      data: asked.map((path) => ({
        path,
        signedUrl: `https://signed.example/${path}`,
        error: null,
      })),
      error: null,
    }));
    const { ui } = withClient(
      <>
        {paths.map((p) => (
          <PersonAvatar key={p} userId={ALEX} name="Alex Kim" path={p} size={38} />
        ))}
      </>,
    );
    const { getAllByTestId } = await render(ui);
    await waitFor(() => expect(getAllByTestId('person-avatar-photo')).toHaveLength(3));
    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
    expect(mockCreateSignedUrls.mock.calls[0][0]).toEqual(paths);
  });

  it('reuses a cached URL for the same path instead of signing again', async () => {
    const client = newClient();
    client.setQueryData(avatarUrlKey(PATH), 'https://signed.example/cached');
    const { ui } = withClient(<PersonAvatar userId={ALEX} path={PATH} size={38} />, client);
    const { getByTestId } = await render(ui);
    expect(getByTestId('person-avatar-photo').props.source).toEqual({
      uri: 'https://signed.example/cached',
    });
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });

  it('falls back to the default when the picture is not ours to see (a block)', async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [{ path: PATH, signedUrl: null, error: 'Object not found' }],
      error: null,
    });
    const { ui, client } = withClient(
      <PersonAvatar userId={ALEX} name="Alex Kim" path={PATH} size={38} />,
    );
    const { getByTestId, queryByTestId } = await render(ui);
    await waitFor(() => expect(client.getQueryState(avatarUrlKey(PATH))?.status).toBe('success'));
    expect(client.getQueryData(avatarUrlKey(PATH))).toBeNull();
    expect(getByTestId('person-avatar-generated')).toBeTruthy();
    expect(queryByTestId('person-avatar-photo')).toBeNull();
  });

  it('draws the default and signs once more when the image fails to load', async () => {
    const client = newClient();
    client.setQueryData(avatarUrlKey(PATH), 'https://signed.example/expired');
    mockCreateSignedUrls.mockResolvedValue({
      data: [{ path: PATH, signedUrl: 'https://signed.example/fresh', error: null }],
      error: null,
    });
    const { ui } = withClient(
      <PersonAvatar userId={ALEX} name="Alex Kim" path={PATH} size={38} />,
      client,
    );
    const { getByTestId } = await render(ui);
    await fireEvent(getByTestId('person-avatar-photo'), 'error');
    await waitFor(() =>
      expect(getByTestId('person-avatar-photo').props.source).toEqual({
        uri: 'https://signed.example/fresh',
      }),
    );
    // A second failure is not an expired URL. It stays on the default and does not loop.
    await fireEvent(getByTestId('person-avatar-photo'), 'error');
    await waitFor(() => expect(getByTestId('person-avatar-generated')).toBeTruthy());
    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
  });
});
