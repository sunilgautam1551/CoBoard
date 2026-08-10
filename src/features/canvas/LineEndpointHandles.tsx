import { Circle } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useBoardStore } from '@/store/useBoardStore';
import { useSyncStore } from '@/features/sync/useSyncStore';
import type { Element } from '@/types';
import { applyEndpointBindings } from './lib/binding';

/**
 * Endpoint-drag handles for a single selected 2-point line/arrow — drag
 * either end directly, instead of a generic bounding-box Transformer
 * (which reads as fiddly for a thin diagonal shape: you're fighting 8
 * box handles to move one point). Only used for exactly-2-point
 * lines/arrows; a multi-point polyline falls back to the Transformer
 * since these handles only ever model a single segment.
 */
export function LineEndpointHandles({ element, scale }: { element: Element; scale: number }) {
  const applyElement = useBoardStore((s) => s.applyElement);
  const commitElement = useBoardStore((s) => s.commitElement);
  const [x1, y1, x2, y2] = element.points ?? [0, 0, 0, 0];
  const radius = 6 / scale;
  const strokeWidth = 2 / scale;

  /** Live-updates the dragged endpoint's position (no history entry) and broadcasts it, mid-drag. */
  function move(which: 'start' | 'end', node: Konva.Node) {
    const next =
      which === 'start'
        ? [node.x(), node.y(), x2, y2]
        : [x1, y1, node.x(), node.y()];
    const updated = { ...element, points: next };
    applyElement(updated);
    useSyncStore.getState().sendUpsertThrottled(updated);
  }

  /** Finalizes the drag: re-evaluates shape binding at the new position, then commits and broadcasts. */
  function commit(which: 'start' | 'end', node: Konva.Node) {
    const next =
      which === 'start'
        ? [node.x(), node.y(), x2, y2]
        : [x1, y1, node.x(), node.y()];
    // Re-checks binding at the new position — rebinds to whatever shape
    // the endpoint now sits on/near, or unbinds if it was dragged away.
    const updated = applyEndpointBindings(
      { ...element, points: next, updatedAt: Date.now() },
      Object.values(useBoardStore.getState().elements),
    );
    commitElement(updated);
    useSyncStore.getState().sendUpsert(updated);
  }

  const handleProps = {
    radius,
    fill: 'white',
    stroke: '#7c3aed',
    strokeWidth,
    draggable: true,
    hitStrokeWidth: radius * 3,
  };

  return (
    <>
      <Circle
        {...handleProps}
        x={x1}
        y={y1}
        onDragMove={(e: KonvaEventObject<DragEvent>) => move('start', e.target)}
        onDragEnd={(e: KonvaEventObject<DragEvent>) => commit('start', e.target)}
      />
      <Circle
        {...handleProps}
        x={x2}
        y={y2}
        onDragMove={(e: KonvaEventObject<DragEvent>) => move('end', e.target)}
        onDragEnd={(e: KonvaEventObject<DragEvent>) => commit('end', e.target)}
      />
    </>
  );
}
