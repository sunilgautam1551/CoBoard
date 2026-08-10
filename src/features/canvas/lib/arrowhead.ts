import type { ArrowheadStyle } from '@/types';

export type ArrowheadMarker =
  | { kind: 'triangle'; points: number[]; filled: boolean }
  | { kind: 'bar'; points: number[] }
  | { kind: 'dot'; x: number; y: number; radius: number };

/**
 * Builds the marker geometry for one end of an arrow, given the tip
 * point and the adjacent point on the line (used only for direction).
 */
export function buildArrowhead(
  style: ArrowheadStyle,
  tipX: number,
  tipY: number,
  fromX: number,
  fromY: number,
  size: number,
): ArrowheadMarker | null {
  if (style === 'none') return null;
  const angle = Math.atan2(tipY - fromY, tipX - fromX);

  if (style === 'dot') {
    const radius = size * 0.35;
    // Pull the dot's center back so it doesn't bury the line's own tip.
    return { kind: 'dot', x: tipX - radius * Math.cos(angle), y: tipY - radius * Math.sin(angle), radius };
  }

  if (style === 'bar') {
    const half = size * 0.5;
    const perp = angle + Math.PI / 2;
    return {
      kind: 'bar',
      points: [
        tipX - half * Math.cos(perp),
        tipY - half * Math.sin(perp),
        tipX + half * Math.cos(perp),
        tipY + half * Math.sin(perp),
      ],
    };
  }

  // triangle / triangle_outline share the same shape, differing only in fill.
  const spread = Math.PI / 7;
  const backX1 = tipX - size * Math.cos(angle - spread);
  const backY1 = tipY - size * Math.sin(angle - spread);
  const backX2 = tipX - size * Math.cos(angle + spread);
  const backY2 = tipY - size * Math.sin(angle + spread);
  return {
    kind: 'triangle',
    points: [tipX, tipY, backX1, backY1, backX2, backY2],
    filled: style === 'triangle',
  };
}

/** Back-compat helper — a plain filled triangle at (x2,y2) pointing away from (x1,y1). */
export function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number, size: number): number[] {
  const marker = buildArrowhead('triangle', x2, y2, x1, y1, size);
  return marker && marker.kind === 'triangle' ? marker.points : [];
}
