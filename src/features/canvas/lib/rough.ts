import rough from 'roughjs/bin/rough';
import type { Drawable, Options, OpSet } from 'roughjs/bin/core';
import type { StrokeStyle, Edges, FillStyle } from '@/types';

const generator = rough.generator();

export type RoughPath = { d: string; fill: boolean };

export type ShapeStyle = {
  stroke: string;
  fill?: string;
  roughness: number;
  strokeStyle: StrokeStyle;
  fillStyle?: FillStyle;
};

function opSetToSvgPath(opSet: OpSet): string {
  const parts: string[] = [];
  for (const { op, data } of opSet.ops) {
    if (op === 'move') parts.push(`M${data[0]} ${data[1]}`);
    else if (op === 'lineTo') parts.push(`L${data[0]} ${data[1]}`);
    else if (op === 'bcurveTo') {
      parts.push(`C${data[0]} ${data[1]}, ${data[2]} ${data[3]}, ${data[4]} ${data[5]}`);
    }
  }
  return parts.join(' ');
}

function drawableToPaths(drawable: Drawable): RoughPath[] {
  return drawable.sets.map((set) => ({
    d: opSetToSvgPath(set),
    fill: set.type !== 'path',
  }));
}

/** A small deterministic hash so the same element always sketches the same way. */
export function seedFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2 ** 31 || 1;
}

export const ROUGHNESS_PRESETS = { architect: 0.5, artist: 1.4, cartoonist: 2.8 } as const;

const STROKE_DASH: Record<StrokeStyle, number[] | undefined> = {
  solid: undefined,
  dashed: [8, 6],
  dotted: [2, 6],
};

function toRoughOptions(seed: number, strokeWidth: number, style: ShapeStyle): Options {
  return {
    seed,
    strokeWidth,
    roughness: style.roughness,
    stroke: style.stroke,
    fill: style.fill,
    // Defaults to 'solid' ( own default) rather than
    // 'hachure' — hachure is an opt-in choice, not the default; using it
    // unconditionally previously read as "not filling completely".
    fillStyle: style.fillStyle ?? 'solid',
    strokeLineDash: STROKE_DASH[style.strokeStyle],
    curveFitting: 0.98,
  };
}

function roundedRectPath(w: number, h: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (r === 0) return `M0,0 L${w},0 L${w},${h} L0,${h} Z`;
  return [
    `M${r},0`,
    `L${w - r},0`,
    `A${r},${r} 0 0 1 ${w},${r}`,
    `L${w},${h - r}`,
    `A${r},${r} 0 0 1 ${w - r},${h}`,
    `L${r},${h}`,
    `A${r},${r} 0 0 1 0,${h - r}`,
    `L0,${r}`,
    `A${r},${r} 0 0 1 ${r},0`,
    'Z',
  ].join(' ');
}

function roundedPolygonPath(points: [number, number][], radius: number): string {
  const n = points.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];

    const toPrev = [prev[0] - curr[0], prev[1] - curr[1]];
    const toNext = [next[0] - curr[0], next[1] - curr[1]];
    const lenPrev = Math.hypot(toPrev[0], toPrev[1]) || 1;
    const lenNext = Math.hypot(toNext[0], toNext[1]) || 1;
    const r = Math.min(radius, lenPrev / 2, lenNext / 2);

    const p1: [number, number] = [curr[0] + (toPrev[0] / lenPrev) * r, curr[1] + (toPrev[1] / lenPrev) * r];
    const p2: [number, number] = [curr[0] + (toNext[0] / lenNext) * r, curr[1] + (toNext[1] / lenNext) * r];

    parts.push(i === 0 ? `M${p1[0]},${p1[1]}` : `L${p1[0]},${p1[1]}`);
    parts.push(`Q${curr[0]},${curr[1]} ${p2[0]},${p2[1]}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

const cornerRadius = (w: number, h: number) => Math.min(Math.min(Math.abs(w), Math.abs(h)) * 0.25, 24);

export function roughRect(
  w: number,
  h: number,
  seed: number,
  strokeWidth: number,
  edges: Edges,
  style: ShapeStyle,
): RoughPath[] {
  const opts = toRoughOptions(seed, strokeWidth, style);
  const drawable =
    edges === 'round'
      ? generator.path(roundedRectPath(w, h, cornerRadius(w, h)), opts)
      : generator.rectangle(0, 0, w, h, opts);
  return drawableToPaths(drawable);
}

/** Centered at local (0,0) — caller positions the group at the shape's center. */
export function roughEllipse(
  w: number,
  h: number,
  seed: number,
  strokeWidth: number,
  style: ShapeStyle,
): RoughPath[] {
  return drawableToPaths(generator.ellipse(0, 0, w, h, toRoughOptions(seed, strokeWidth, style)));
}

/** Diamond connecting the midpoints of a w×h bounding box's edges. */
export function roughDiamond(
  w: number,
  h: number,
  seed: number,
  strokeWidth: number,
  edges: Edges,
  style: ShapeStyle,
): RoughPath[] {
  const points: [number, number][] = [
    [w / 2, 0],
    [w, h / 2],
    [w / 2, h],
    [0, h / 2],
  ];
  const opts = toRoughOptions(seed, strokeWidth, style);
  const drawable =
    edges === 'round'
      ? generator.path(roundedPolygonPath(points, cornerRadius(w, h)), opts)
      : generator.polygon(points, opts);
  return drawableToPaths(drawable);
}

export function roughLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
  strokeWidth: number,
  style: Pick<ShapeStyle, 'stroke' | 'roughness' | 'strokeStyle'>,
): RoughPath[] {
  return drawableToPaths(
    generator.line(x1, y1, x2, y2, toRoughOptions(seed, strokeWidth, style)),
  );
}

/** Connected straight-segment path through 2+ points — a multi-point line/arrow. */
export function roughPolyline(
  points: number[],
  seed: number,
  strokeWidth: number,
  style: Pick<ShapeStyle, 'stroke' | 'roughness' | 'strokeStyle'>,
): RoughPath[] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < points.length; i += 2) pairs.push([points[i], points[i + 1]]);
  if (pairs.length < 2) return [];
  if (pairs.length === 2) return roughLine(pairs[0][0], pairs[0][1], pairs[1][0], pairs[1][1], seed, strokeWidth, style);
  return drawableToPaths(generator.linearPath(pairs, toRoughOptions(seed, strokeWidth, style)));
}
