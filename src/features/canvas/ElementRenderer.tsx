import { Arrow, Ellipse, Line, Path, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Element } from '@/types';
import { pointsToSvgPath } from './lib/freehand';

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
    onDragMove: (e: KonvaEventObject<DragEvent>) =>
      onDragMove(element.id, e.target),
    onDragEnd: (e: KonvaEventObject<DragEvent>) =>
      onDragEnd(element.id, e.target),
    ref: (node: Konva.Node | null) => registerNode(element.id, node),
    perfectDrawEnabled: false,
    shadowColor: isSelected ? '#4f46e5' : undefined,
    shadowBlur: isSelected ? 8 : 0,
    shadowOpacity: isSelected ? 0.5 : 0,
  };

  switch (element.type) {
    case 'rect':
      return (
        <Rect
          {...common}
          x={element.x ?? 0}
          y={element.y ?? 0}
          width={element.w ?? 0}
          height={element.h ?? 0}
          rotation={element.rotation ?? 0}
          stroke={element.stroke}
          fill={element.fill === 'transparent' ? undefined : element.fill}
          strokeWidth={element.strokeWidth}
        />
      );
    case 'ellipse': {
      const w = element.w ?? 0;
      const h = element.h ?? 0;
      return (
        <Ellipse
          {...common}
          x={(element.x ?? 0) + w / 2}
          y={(element.y ?? 0) + h / 2}
          radiusX={Math.abs(w) / 2}
          radiusY={Math.abs(h) / 2}
          rotation={element.rotation ?? 0}
          stroke={element.stroke}
          fill={element.fill === 'transparent' ? undefined : element.fill}
          strokeWidth={element.strokeWidth}
        />
      );
    }
    case 'line':
      return (
        <Line
          {...common}
          points={element.points ?? []}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(20, element.strokeWidth)}
        />
      );
    case 'arrow':
      return (
        <Arrow
          {...common}
          points={element.points ?? []}
          stroke={element.stroke}
          fill={element.stroke}
          strokeWidth={element.strokeWidth}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(20, element.strokeWidth)}
        />
      );
    case 'path':
      return (
        <Path
          {...common}
          data={pointsToSvgPath(element.points ?? [], element.strokeWidth)}
          fill={element.stroke}
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
          fill={element.stroke}
          width={element.w}
        />
      );
    default:
      return null;
  }
}
