/** Flat [x,y,...] points for a filled triangular arrowhead at (x2,y2). */
export function arrowHeadPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number,
): number[] {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const spread = Math.PI / 7;
  const backX1 = x2 - size * Math.cos(angle - spread);
  const backY1 = y2 - size * Math.sin(angle - spread);
  const backX2 = x2 - size * Math.cos(angle + spread);
  const backY2 = y2 - size * Math.sin(angle + spread);
  return [x2, y2, backX1, backY1, backX2, backY2];
}
