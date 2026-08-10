import { useMemo } from 'react';
import { Ellipse, Group, Line, Path, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Element } from '@/types';
import { pointsToSvgPath } from './lib/freehand';
import { roughRect, roughDiamond, roughEllipse, roughLine, seedFromId, type RoughPath } from './lib/rough';
import { arrowHeadPoints } from './lib/arrowhead';

type Props = {
  element: Element;
  isSelected: boolean;
  selectable: boolean;
  onSelect: (id: string, e: KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragMove: (id: string, node: Konva.Node) => void;
  onDragEnd: (id: string, node: Konva.Node) => void;
  registerNode: (id: string, node: Konva.Node | null) => void;
};

export function ElementRenderer({
  element,
  isSelected,
  selectable,
  onSelect,
  onDragMove,
  onDragEnd,
  registerNode,
}: Props) {
  const common = {
    id: element.id,
    draggable: selectable,
    onClick: (e: KonvaEventObject<MouseEvent>) => onSelect(element.id, e),
    onTap: (e: KonvaEventObject<TouchEvent>) => onSelect(element.id, e),
    onDragMove: (e: KonvaEventObject<DragEvent>) => onDragMove(element.id, e.target),
    onDragEnd: (e: KonvaEventObject<DragEvent>) => onDragEnd(element.id, e.target),
    ref: (node: Konva.Node | null) => registerNode(element.id, node),
    perfectDrawEnabled: false,
  };

  const shadow = {
    shadowColor: isSelected ? '#4f46e5' : undefined,
    shadowBlur: isSelected ? 10 : 0,
    shadowOpacity: isSelected ? 0.45 : 0,
  };

  const seed = useMemo(() => seedFromId(element.id), [element.id]);
  const w = element.w ?? 0;
  const h = element.h ?? 0;
  const [x1, y1, x2, y2] = element.points ?? [0, 0, 0, 0];

  // Called unconditionally (rules-of-hooks) — branches internally so every
  // element instance still only pays for the shape it actually is.
  const roughPaths: RoughPath[] = useMemo(() => {
    if (element.type === 'rect') {
      return roughRect(w, h, seed, element.strokeWidth, {
        stroke: element.stroke,
        fill: element.fill === 'transparent' ? undefined : element.fill,
      });
    }
    if (element.type === 'diamond') {
      return roughDiamond(w, h, seed, element.strokeWidth, {
        stroke: element.stroke,
        fill: element.fill === 'transparent' ? undefined : element.fill,
      });
    }
    if (element.type === 'ellipse') {
      return roughEllipse(w, h, seed, element.strokeWidth, {
        stroke: element.stroke,
        fill: element.fill === 'transparent' ? undefined : element.fill,
      });
    }
    if (element.type === 'line' || element.type === 'arrow') {
      return roughLine(x1, y1, x2, y2, seed, element.strokeWidth);
    }
    return [];
  }, [element.type, w, h, x1, y1, x2, y2, seed, element.strokeWidth, element.stroke, element.fill]);

  switch (element.type) {
    case 'rect':
      return (
        <Group {...common} x={element.x ?? 0} y={element.y ?? 0} rotation={element.rotation ?? 0}>
          {/* Invisible full-area hit target — the sketchy outline alone only
              covers a few border pixels, so without this a hollow shape
              could only be selected by clicking exactly on its edge. */}
          <Rect id={element.id} width={w} height={h} fill="transparent" />
          {roughPaths.map((p, i) => (
            <Path
              key={i}
              id={element.id}
              data={p.d}
              stroke={p.fill ? undefined : element.stroke}
              fill={p.fill ? element.fill : undefined}
              strokeWidth={element.strokeWidth}
              lineCap="round"
              lineJoin="round"
              hitStrokeWidth={Math.max(16, element.strokeWidth)}
              {...shadow}
            />
          ))}
        </Group>
      );
    case 'diamond':
      return (
        <Group {...common} x={element.x ?? 0} y={element.y ?? 0} rotation={element.rotation ?? 0}>
          <Line
            id={element.id}
            points={[w / 2, 0, w, h / 2, w / 2, h, 0, h / 2]}
            closed
            fill="transparent"
          />
          {roughPaths.map((p, i) => (
            <Path
              key={i}
              id={element.id}
              data={p.d}
              stroke={p.fill ? undefined : element.stroke}
              fill={p.fill ? element.fill : undefined}
              strokeWidth={element.strokeWidth}
              lineCap="round"
              lineJoin="round"
              hitStrokeWidth={Math.max(16, element.strokeWidth)}
              {...shadow}
            />
          ))}
        </Group>
      );
    case 'ellipse':
      return (
        <Group
          {...common}
          x={(element.x ?? 0) + w / 2}
          y={(element.y ?? 0) + h / 2}
          rotation={element.rotation ?? 0}
        >
          <Ellipse id={element.id} radiusX={w / 2} radiusY={h / 2} fill="transparent" />
          {roughPaths.map((p, i) => (
            <Path
              key={i}
              id={element.id}
              data={p.d}
              stroke={p.fill ? undefined : element.stroke}
              fill={p.fill ? element.fill : undefined}
              strokeWidth={element.strokeWidth}
              lineCap="round"
              lineJoin="round"
              hitStrokeWidth={Math.max(16, element.strokeWidth)}
              {...shadow}
            />
          ))}
        </Group>
      );
    case 'line':
    case 'arrow': {
      const headSize = Math.max(12, element.strokeWidth * 4);
      return (
        <Group {...common}>
          {roughPaths.map((p, i) => (
            <Path
              key={i}
              id={element.id}
              data={p.d}
              stroke={element.stroke}
              strokeWidth={element.strokeWidth}
              lineCap="round"
              lineJoin="round"
              hitStrokeWidth={Math.max(16, element.strokeWidth)}
              {...shadow}
            />
          ))}
          {element.type === 'arrow' && (
            <Line
              id={element.id}
              points={arrowHeadPoints(x1, y1, x2, y2, headSize)}
              closed
              fill={element.stroke}
              stroke={element.stroke}
              strokeWidth={element.strokeWidth}
              lineJoin="round"
              {...shadow}
            />
          )}
        </Group>
      );
    }
    case 'path':
      return (
        <Path
          {...common}
          data={pointsToSvgPath(element.points ?? [], element.strokeWidth)}
          fill={element.stroke}
          {...shadow}
        />
      );
    case 'text':
      return (
        <Text
          {...common}
          x={element.x ?? 0}
          y={element.y ?? 0}
          text={element.text ?? ''}
          fontSize={element.fontSize ?? 20}
          fontFamily="var(--font-geist-sans), sans-serif"
          fill={element.stroke}
          width={element.w}
          {...shadow}
        />
      );
    default:
      return null;
  }
}
