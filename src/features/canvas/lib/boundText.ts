import type { Element, ElementType } from '@/types';
import { measureWrappedText } from './text';

export const BOUND_TEXT_PADDING = 5;

export function isContainerType(type: ElementType): boolean {
  return type === 'rect' || type === 'diamond' || type === 'ellipse';
}

/**
 * Usable width/height for text inside a container, accounting for shape
 * geometry — a diamond/ellipse can't use its full bounding box or text
 * pokes out past the sloped edges before the box itself is "full".
 */
export function getContainerTextArea(container: Element): { width: number; height: number } {
  const w = container.w ?? 0;
  const h = container.h ?? 0;
  const pad = BOUND_TEXT_PADDING * 2;
  if (container.type === 'diamond') {
    // Largest axis-aligned rectangle inscribed in a rhombus with
    // diagonals w,h is exactly w/2 x h/2.
    return { width: Math.max(w / 2 - pad, 1), height: Math.max(h / 2 - pad, 1) };
  }
  if (container.type === 'ellipse') {
    // Largest inscribed axis-aligned rectangle in an ellipse w,h is
    // w/sqrt(2) x h/sqrt(2).
    return { width: Math.max(w / Math.SQRT2 - pad, 1), height: Math.max(h / Math.SQRT2 - pad, 1) };
  }
  return { width: Math.max(w - pad, 1), height: Math.max(h - pad, 1) };
}

/** Container height required to fit `text` at `fontSize` without clipping. */
export function requiredContainerHeight(container: Element, text: string, fontSize: number): number {
  const { width } = getContainerTextArea(container);
  const { height } = measureWrappedText(text, fontSize, width);
  const contentHeight = height + BOUND_TEXT_PADDING * 4;
  if (container.type === 'diamond') return contentHeight * 2;
  if (container.type === 'ellipse') return contentHeight * Math.SQRT2;
  return contentHeight;
}

export function findBoundText(
  elements: Record<string, Element>,
  containerId: string,
): Element | undefined {
  return Object.values(elements).find((el) => el.containerId === containerId && !el.deleted);
}

/**
 * Local-space box (relative to the container's own Konva Group render
 * origin) the bound text should occupy — rect/diamond groups render
 * from their top-left at (0,0); the ellipse group renders centered at
 * its own origin, see ElementRenderer.
 */
export function getBoundTextLocalBox(container: Element, text: string, fontSize: number) {
  const { width: maxWidth } = getContainerTextArea(container);
  const { height } = measureWrappedText(text, fontSize, maxWidth);
  const w = container.w ?? 0;
  const h = container.h ?? 0;
  if (container.type === 'ellipse') {
    return { x: -maxWidth / 2, y: -height / 2, width: maxWidth, height };
  }
  return { x: (w - maxWidth) / 2, y: (h - height) / 2, width: maxWidth, height };
}

/** World-space origin of a container's own Konva Group (see ElementRenderer). */
export function getContainerGroupOrigin(container: Element): { x: number; y: number } {
  if (container.type === 'ellipse') {
    return { x: (container.x ?? 0) + (container.w ?? 0) / 2, y: (container.y ?? 0) + (container.h ?? 0) / 2 };
  }
  return { x: container.x ?? 0, y: container.y ?? 0 };
}
