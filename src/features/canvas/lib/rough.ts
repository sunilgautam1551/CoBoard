import rough from 'roughjs/bin/rough';
import type { Drawable, Options, OpSet } from 'roughjs/bin/core';

const generator = rough.generator();

export type RoughPath = { d: string; fill: boolean };

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

// Excalidraw's default fill style is 'solid', not 'hachure' — hachure is
// an option you opt into, not the default. Using it unconditionally read
// as "not filling completely" (a few diagonal lines instead of a filled
// shape), which is exactly the reported complaint.
const baseOptions = (seed: number, strokeWidth: number): Options => ({
  seed,
  roughness: 1.4,
  strokeWidth,
  fillStyle: 'solid',
  curveFitting: 0.98,
});

export function roughRect(
  w: number,
  h: number,
  seed: number,
  strokeWidth: number,
  options: Partial<Options>,
): RoughPath[] {
  return drawableToPaths(
    generator.rectangle(0, 0, w, h, { ...baseOptions(seed, strokeWidth), ...options }),
  );
}

/** Centered at local (0,0) — caller positions the group at the shape's center. */
export function roughEllipse(
  w: number,
  h: number,
  seed: number,
  strokeWidth: number,
  options: Partial<Options>,
): RoughPath[] {
  return drawableToPaths(
    generator.ellipse(0, 0, w, h, { ...baseOptions(seed, strokeWidth), ...options }),
  );
}

/** Diamond connecting the midpoints of a w×h bounding box's edges. */
export function roughDiamond(
  w: number,
  h: number,
  seed: number,
  strokeWidth: number,
  options: Partial<Options>,
): RoughPath[] {
  const points: [number, number][] = [
    [w / 2, 0],
    [w, h / 2],
    [w / 2, h],
    [0, h / 2],
  ];
  return drawableToPaths(
    generator.polygon(points, { ...baseOptions(seed, strokeWidth), ...options }),
  );
}

export function roughLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
  strokeWidth: number,
): RoughPath[] {
  return drawableToPaths(generator.line(x1, y1, x2, y2, baseOptions(seed, strokeWidth)));
}
