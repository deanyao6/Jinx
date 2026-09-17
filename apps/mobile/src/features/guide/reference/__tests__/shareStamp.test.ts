import type { StatsStamp } from '@/features/passport/types';

import { guideShareStamp } from '../StadiumGuideScreen';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const guide = { venue: 'Citizens Bank Park', subtitle: 'Philadelphia, PA' } as Parameters<
  typeof guideShareStamp
>[0];

const stamp = (venue_id: string, name: string, visits: number): StatsStamp => ({
  venue_id,
  name,
  city: 'San Francisco',
  state: 'CA',
  country: 'US',
  visits,
  first_visit: '2026-08-08',
  sports: ['mlb'],
  closed: false,
  lat: null,
  lng: null,
});

describe('guideShareStamp', () => {
  const stamps = [stamp('v-cbp', 'Citizens Bank Park', 12), stamp('v-oracle', 'Oracle Park', 3)];

  it("is the user's own stamp for the venue on the route", () => {
    expect(guideShareStamp(guide, stamps, 'v-oracle')).toEqual({
      kind: 'stamp',
      venue: 'Oracle Park',
      place: 'San Francisco, CA',
      visits: 3,
      firstVisit: '2026-08-08',
      stampCount: 2,
    });
  });

  it('never invents a visit to a stadium the user has not been to', () => {
    const card = guideShareStamp(guide, stamps, 'v-somewhere-else');
    expect(card).toMatchObject({ venue: 'Citizens Bank Park', visits: 0, firstVisit: null });
    expect(guideShareStamp(guide, [], undefined).visits).toBe(0);
  });
});
