import React, { useMemo } from 'react';

import { Seal } from '@/components/reference/Seal';

import { useSealLooks } from './useSealLooks';

/** Below this a seal is an ornament in a row: too small for a moving glint to read as one. */
const GLINT_FROM = 50;

/**
 * A real stadium's stamp: `Seal`, struck in the colours of the team that plays there, worn by
 * how often the person has been, and gold if they saw something rare (features/eggs).
 *
 * Every screen that draws a stamp from real data uses this, so a stadium looks the same on
 * the Passport, the Stamps page, a bucket list and a Wrapped card. Demo mode and the parity
 * shots keep drawing `Seal` directly, in the reference's brass and silver.
 */
export function VenueSeal({
  venueId,
  ring,
  shapeKey,
  size,
  inkColor,
  visits,
  scheme,
  still,
}: {
  venueId: string;
  ring: string;
  shapeKey: string;
  size?: number;
  inkColor: string;
  /** Visits, where the caller has them. Otherwise they are read from the stats payload. */
  visits?: number | null;
  /** For a region pinned to one appearance, such as a Wrapped card. */
  scheme?: 'light' | 'dark';
  still?: boolean;
}) {
  const lookFor = useSealLooks(scheme);
  const look = useMemo(() => lookFor(venueId, visits), [lookFor, venueId, visits]);
  return (
    <Seal
      ring={ring}
      shapeKey={shapeKey}
      metal={look.metal}
      wear={look.wear}
      seed={venueId}
      size={size}
      inkColor={inkColor}
      still={still ?? (size ?? 78) < GLINT_FROM}
    />
  );
}
