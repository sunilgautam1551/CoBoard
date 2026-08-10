import type { Element } from '@/types';

export type Bounds = { x: number; y: number; w: number; h: number };

/** Approximate axis-aligned world-space bounds for an element, for hit/marquee tests. */
export function getElementBounds(element: Element): Bounds {
  switch (element.type) {
    case 'rect':
    case 'ellipse':
      return { x: element.x ?? 0, y: element.y ?? 0, w: element.w ?? 0, h: element.h ?? 0 };
    case 'line':
    case 'arrow':
    case 'path': {
      const points = element.points ?? [];
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < points.length; i += 2) {
        minX = Math.min(minX, points[i]);
        maxX = Math.max(maxX, points[i]);
        minY = Math.min(minY, points[i + 1]);
        maxY = Math.max(maxY, points[i + 1]);
      }
      if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    case 'text': {
      const fontSize = element.fontSize ?? 20;
      const width = element.w ?? (element.text?.length ?? 1) * fontSize * 0.6;
      return { x: element.x ?? 0, y: element.y ?? 0, w: width, h: fontSize * 1.4 };
    }
    default:
      return { x: 0, y: 0, w: 0, h: 0 };
  }
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
