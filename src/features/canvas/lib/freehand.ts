import { getStroke } from 'perfect-freehand';

/**
 * Converts a flat [x0,y0,x1,y1,...] points array into a smoothed SVG path
 * string via perfect-freehand, for rendering as a filled Konva <Path>.
 */
export function pointsToSvgPath(
  flatPoints: number[],
  strokeWidth: number,
): string {
  if (flatPoints.length < 4) return '';

  const input: number[][] = [];
  for (let i = 0; i < flatPoints.length; i += 2) {
    input.push([flatPoints[i], flatPoints[i + 1]]);
  }

  const stroke = getStroke(input, {
    size: strokeWidth,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });

  return getSvgPathFromStroke(stroke);
}

function getSvgPathFromStroke(stroke: number[][]): string {
  if (stroke.length === 0) return '';

  const d: (string | number)[] = ['M', stroke[0][0], stroke[0][1], 'Q'];

  for (let i = 0; i < stroke.length; i++) {
    const [x0, y0] = stroke[i];
    const [x1, y1] = stroke[(i + 1) % stroke.length];
    d.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }

  d.push('Z');
  return d.join(' ');
}
