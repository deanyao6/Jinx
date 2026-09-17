import type { PieceKind } from './live';

/**
 * Deterministic layouts for the two eggs that scatter things: the mirror's shards and the
 * confetti. Same seed, same picture, so a test can pin one down and nothing calls
 * `Math.random()` while rendering.
 */

/** mulberry32: a tiny seeded generator. Returns numbers in [0, 1). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number from a string, so a game id or a user id can be a seed. */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Point = { x: number; y: number };

export type Shard = {
  /** Corners in the unit square: multiply by the hero's width and height. */
  points: Point[];
  /** Where it falls from, for ordering the fall: the middle of the shard. */
  center: Point;
  /** 0 to 1: when this shard lets go, as a share of the stagger. */
  delay: number;
  /** Degrees it turns while falling. Either way. */
  spin: number;
  /** Sideways drift while falling, in unit widths. */
  drift: number;
};

const CORNERS: readonly (Point & { angle: (c: Point) => number })[] = [
  { x: 1, y: 0, angle: (c) => Math.atan2(0 - c.y, 1 - c.x) },
  { x: 1, y: 1, angle: (c) => Math.atan2(1 - c.y, 1 - c.x) },
  { x: 0, y: 1, angle: (c) => Math.atan2(1 - c.y, 0 - c.x) },
  { x: 0, y: 0, angle: (c) => Math.atan2(0 - c.y, 0 - c.x) },
];

/** Where a ray from `c` at `angle` leaves the unit square. */
function edgeHit(c: Point, angle: number): Point {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (1 - c.x) / dx);
  if (dx < -1e-9) t = Math.min(t, (0 - c.x) / dx);
  if (dy > 1e-9) t = Math.min(t, (1 - c.y) / dy);
  if (dy < -1e-9) t = Math.min(t, (0 - c.y) / dy);
  return { x: clamp01(c.x + dx * t), y: clamp01(c.y + dy * t) };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Normalises an angle into [0, 2pi). */
function turn(angle: number): number {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

function centroid(points: readonly Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * A cracked mirror: cracks run out from one point of impact to the edges, and a ring of
 * shorter cracks joins them, so every wedge is an inner shard and an outer one.
 *
 * 5 to 7 cracks, so 10 to 14 shards, which together cover the unit square exactly.
 */
export function mirrorShards(seed: number): Shard[] {
  const rand = seeded(seed);
  const impact: Point = { x: 0.3 + rand() * 0.4, y: 0.32 + rand() * 0.36 };
  const rays = 5 + Math.floor(rand() * 3);
  const first = rand() * Math.PI * 2;
  const angles: number[] = [];
  for (let i = 0; i < rays; i += 1) {
    const jitter = (rand() - 0.5) * 0.5;
    angles.push(turn(first + ((i + jitter) * Math.PI * 2) / rays));
  }
  angles.sort((a, b) => a - b);

  const hits = angles.map((angle) => edgeHit(impact, angle));
  const inner = hits.map((hit) => {
    const share = 0.3 + rand() * 0.25;
    return { x: impact.x + (hit.x - impact.x) * share, y: impact.y + (hit.y - impact.y) * share };
  });

  const shards: Shard[] = [];
  const push = (points: Point[]) => {
    const center = centroid(points);
    shards.push({
      points,
      center,
      // The bottom goes first, as glass does, with a little disorder.
      delay: clamp01((1 - center.y) * 0.75 + rand() * 0.25),
      spin: (rand() - 0.5) * 70,
      drift: (center.x - impact.x) * 0.5 + (rand() - 0.5) * 0.1,
    });
  };

  for (let i = 0; i < rays; i += 1) {
    const j = (i + 1) % rays;
    const from = angles[i] as number;
    const sweep = turn((angles[j] as number) - from);
    // The square's corners that lie inside this wedge belong to its outer shard, in order.
    const corners = CORNERS.map((corner) => ({ corner, at: turn(corner.angle(impact) - from) }))
      .filter((c) => c.at > 0 && c.at < sweep)
      .sort((a, b) => a.at - b.at)
      .map((c) => ({ x: c.corner.x, y: c.corner.y }));
    push([impact, inner[i] as Point, inner[j] as Point]);
    push([inner[i] as Point, hits[i] as Point, ...corners, hits[j] as Point, inner[j] as Point]);
  }
  return shards;
}

/** The area of a polygon (shoelace). For tests: the shards must tile the square. */
export function polygonArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i] as Point;
    const b = points[(i + 1) % points.length] as Point;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export type ConfettiPiece = {
  kind: PieceKind;
  /** Where it starts across the screen, 0 to 1. */
  x: number;
  /** Sideways travel on the way down, in screen widths. Either way. */
  drift: number;
  /** When it sets off and how long it falls, as shares of the whole shower. */
  delay: number;
  duration: number;
  /** Drawn size in points. */
  size: number;
  /** Degrees at the start, and how many it turns through. */
  rotate: number;
  spin: number;
};

export const CONFETTI_MIN = 24;
export const CONFETTI_MAX = 36;

/** 24 to 36 pieces, the sport's own kinds in turn, spread across the width. */
export function confettiPieces(seed: number, kinds: readonly PieceKind[]): ConfettiPiece[] {
  if (kinds.length === 0) return [];
  const rand = seeded(seed);
  const count = CONFETTI_MIN + Math.floor(rand() * (CONFETTI_MAX - CONFETTI_MIN + 1));
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i += 1) {
    const delay = rand() * 0.35;
    pieces.push({
      kind: kinds[i % kinds.length] as PieceKind,
      // One column each, jittered, so they never bunch up on one side.
      x: clamp01((i + 0.15 + rand() * 0.7) / count),
      drift: (rand() - 0.5) * 0.18,
      delay,
      duration: 0.5 + rand() * (1 - delay - 0.5),
      size: 20 + Math.floor(rand() * 11),
      rotate: rand() * 360,
      spin: (rand() - 0.5) * 540,
    });
  }
  // Columns in order would read as a wave from left to right; shuffle who goes where.
  for (let i = pieces.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const a = pieces[i] as ConfettiPiece;
    const b = pieces[j] as ConfettiPiece;
    const ax = a.x;
    a.x = b.x;
    b.x = ax;
  }
  return pieces;
}
