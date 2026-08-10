import type Konva from 'konva';
import type { Element } from '@/types';

/** Pointer position in world/content coordinates (undoes stage pan+zoom). */
export function getWorldPointer(stage: Konva.Stage): { x: number; y: number } {
  const pos = stage.getPointerPosition() ?? { x: 0, y: 0 };
  return {
    x: (pos.x - stage.x()) / stage.scaleX(),
    y: (pos.y - stage.y()) / stage.scaleY(),
  };
}

/**
 * Bakes a Konva node's post-transform x/y/scale/rotation into element
 * geometry, then the caller should reset the node's scale to 1 so the
 * next transform starts clean.
 */
export function bakeNodeTransform(element: Element, node: Konva.Node): Element {
  const x = node.x();
  const y = node.y();
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  const rotation = node.rotation();

  switch (element.type) {
    case 'rect':
    case 'diamond': {
      return {
        ...element,
        x,
        y,
        w: (element.w ?? 0) * scaleX,
        h: (element.h ?? 0) * scaleY,
        rotation,
      };
    }
    case 'ellipse': {
      const w = (element.w ?? 0) * scaleX;
      const h = (element.h ?? 0) * scaleY;
      return {
        ...element,
        x: x - w / 2,
        y: y - h / 2,
        w,
        h,
        rotation,
      };
    }
    case 'text': {
      const scale = (scaleX + scaleY) / 2;
      return {
        ...element,
        x,
        y,
        fontSize: Math.max(6, (element.fontSize ?? 20) * scale),
        rotation,
      };
    }
    case 'line':
    case 'arrow':
    case 'path': {
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const points = element.points ?? [];
      const next: number[] = [];
      for (let i = 0; i < points.length; i += 2) {
        const px = points[i] * scaleX;
        const py = points[i + 1] * scaleY;
        next.push(x + px * cos - py * sin, y + px * sin + py * cos);
      }
      return { ...element, points: next, rotation: 0 };
    }
    default:
      return element;
  }
}

/** Translates a line/arrow/path element's points by a drag delta. */
export function translatePoints(points: number[], dx: number, dy: number): number[] {
  const next: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    next.push(points[i] + dx, points[i + 1] + dy);
  }
  return next;
}
