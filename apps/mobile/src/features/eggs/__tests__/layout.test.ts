import {
  CONFETTI_MAX,
  CONFETTI_MIN,
  confettiPieces,
  mirrorShards,
  polygonArea,
  seeded,
  seedFrom,
} from '@/features/eggs/layout';
import { EGG_SPORTS } from '@/features/eggs/live';

describe('seeded', () => {
  it('gives the same numbers for the same seed, in [0, 1)', () => {
    const a = seeded(42);
    const b = seeded(42);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(seeded(43)()).not.toBe(first[0]);
  });

  it('turns an id into a seed', () => {
    expect(seedFrom('game-1')).toBe(seedFrom('game-1'));
    expect(seedFrom('game-1')).not.toBe(seedFrom('game-2'));
  });
});

describe('mirrorShards', () => {
  it('is 8 to 14 shards, the same every time for one seed', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const shards = mirrorShards(seed);
      expect(shards.length).toBeGreaterThanOrEqual(8);
      expect(shards.length).toBeLessThanOrEqual(14);
    }
    expect(mirrorShards(7)).toEqual(mirrorShards(7));
    expect(mirrorShards(7)).not.toEqual(mirrorShards(8));
  });

  it('covers the whole mirror and nothing outside it', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const shards = mirrorShards(seed);
      const area = shards.reduce((sum, shard) => sum + polygonArea(shard.points), 0);
      expect(area).toBeCloseTo(1, 6);
      for (const shard of shards) {
        expect(shard.points.length).toBeGreaterThanOrEqual(3);
        expect(shard.delay).toBeGreaterThanOrEqual(0);
        expect(shard.delay).toBeLessThanOrEqual(1);
        for (const p of shard.points) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(1);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('confettiPieces', () => {
  it('is 24 to 36 pieces, the same every time for one seed', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const pieces = confettiPieces(seed, EGG_SPORTS.mlb!.pieces);
      expect(pieces.length).toBeGreaterThanOrEqual(CONFETTI_MIN);
      expect(pieces.length).toBeLessThanOrEqual(CONFETTI_MAX);
    }
    const kinds = EGG_SPORTS.nfl!.pieces;
    expect(confettiPieces(5, kinds)).toEqual(confettiPieces(5, kinds));
  });

  it("uses only the sport's own pieces, all of them", () => {
    for (const row of Object.values(EGG_SPORTS)) {
      const used = new Set(confettiPieces(11, row.pieces).map((p) => p.kind));
      expect([...used].sort()).toEqual([...row.pieces].sort());
    }
  });

  it('starts every piece on screen and lands it before the shower ends', () => {
    for (const piece of confettiPieces(3, EGG_SPORTS.mlb!.pieces)) {
      expect(piece.x).toBeGreaterThanOrEqual(0);
      expect(piece.x).toBeLessThanOrEqual(1);
      expect(piece.delay + piece.duration).toBeLessThanOrEqual(1 + 1e-9);
      expect(piece.duration).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('is nothing for a sport with no pieces', () => {
    expect(confettiPieces(1, [])).toEqual([]);
  });
});
