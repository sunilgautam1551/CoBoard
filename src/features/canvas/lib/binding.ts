import type { Element } from '@/types';
import { isContainerType } from './boundText';
import { getElementBounds } from './bounds';

/** Visual gap kept between a bound arrow's tip and the shape's own edge. */
const BINDING_GAP = 4;
/** How close (in world px) a release point needs to be to a shape to bind to it. */
const BINDING_DISTANCE = 20;

/** Topmost container whose (slightly expanded) bounds contain `point`. */
export function findBindableContainer(
  elements: Element[],
  point: { x: number; y: number },
  excludeId?: string,
): Element | undefined {
  const candidates = elements
    .filter((el) => !el.deleted && el.id !== excludeId && isContainerType(el.type))
    .sort((a, b) => (b.z ?? b.updatedAt) - (a.z ?? a.updatedAt));
  for (const el of candidates) {
    const b = getElementBounds(el);
    const withinX = point.x >= b.x - BINDING_DISTANCE && point.x <= b.x + b.w + BINDING_DISTANCE;
    const withinY = point.y >= b.y - BINDING_DISTANCE && point.y <= b.y + b.h + BINDING_DISTANCE;
    if (withinX && withinY) return el;
  }
  return undefined;
}

/**
 * Point on `container`'s boundary, in the direction of `from`, offset
 * outward by a small gap — where a bound arrow endpoint should sit so it
 * touches the shape without overlapping its stroke.
 */
export function getBindingPoint(container: Element, from: { x: number; y: number }): { x: number; y: number } {
  const b = getElementBounds(container);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const dx = from.x - cx;
  const dy = from.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const len = Math.hypot(dx, dy) || 1;
  const rx = b.w / 2 || 1;
  const ry = b.h / 2 || 1;

  let ex: number;
  let ey: number;
  if (container.type === 'ellipse') {
    const t = Math.atan2(dy / ry, dx / rx);
    ex = rx * Math.cos(t);
    ey = ry * Math.sin(t);
  } else if (container.type === 'diamond') {
    const s = 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry || 1);
    ex = dx * s;
    ey = dy * s;
  } else {
    const scaleX = dx !== 0 ? rx / Math.abs(dx) : Infinity;
    const scaleY = dy !== 0 ? ry / Math.abs(dy) : Infinity;
    const s = Math.min(scaleX, scaleY);
    ex = dx * s;
    ey = dy * s;
  }
  return {
    x: cx + ex + (BINDING_GAP * dx) / len,
    y: cy + ey + (BINDING_GAP * dy) / len,
  };
}

/**
 * Snaps a just-drawn line/arrow's endpoints to any shape they were
 * released on/near, recording the binding so the endpoint follows that
 * shape when it later moves or resizes (see `recomputeBoundArrow`).
 */
export function applyEndpointBindings(el: Element, elements: Element[]): Element {
  if (el.type !== 'line' && el.type !== 'arrow') return el;
  const pts = [...(el.points ?? [])];
  const n = pts.length;
  if (n < 4) return el;

  let startBinding: string | undefined;
  let endBinding: string | undefined;

  const startContainer = findBindableContainer(elements, { x: pts[0], y: pts[1] }, el.id);
  if (startContainer) {
    startBinding = startContainer.id;
    const p = getBindingPoint(startContainer, { x: pts[2], y: pts[3] });
    pts[0] = p.x;
    pts[1] = p.y;
  }
  const endContainer = findBindableContainer(elements, { x: pts[n - 2], y: pts[n - 1] }, el.id);
  if (endContainer) {
    endBinding = endContainer.id;
    const p = getBindingPoint(endContainer, { x: pts[n - 4], y: pts[n - 3] });
    pts[n - 2] = p.x;
    pts[n - 1] = p.y;
  }
  return { ...el, points: pts, startBinding, endBinding };
}

/** Recomputes a bound arrow's endpoint(s) against its container's current geometry (after a move/resize). */
export function recomputeBoundArrow(el: Element, container: Element): Element {
  const pts = [...(el.points ?? [])];
  const n = pts.length;
  if (n < 4) return el;
  if (el.startBinding === container.id) {
    const otherPoint = n >= 4 ? { x: pts[2], y: pts[3] } : { x: pts[n - 2], y: pts[n - 1] };
    const p = getBindingPoint(container, otherPoint);
    pts[0] = p.x;
    pts[1] = p.y;
  }
  if (el.endBinding === container.id) {
    const otherPoint = n >= 4 ? { x: pts[n - 4], y: pts[n - 3] } : { x: pts[0], y: pts[1] };
    const p = getBindingPoint(container, otherPoint);
    pts[n - 2] = p.x;
    pts[n - 1] = p.y;
  }
  return { ...el, points: pts, updatedAt: Date.now() };
}

/** Arrows/lines bound to `containerId` at either end. */
export function findBoundArrows(elements: Element[], containerId: string): Element[] {
  return elements.filter(
    (el) =>
      !el.deleted &&
      (el.type === 'line' || el.type === 'arrow') &&
      (el.startBinding === containerId || el.endBinding === containerId),
  );
}
