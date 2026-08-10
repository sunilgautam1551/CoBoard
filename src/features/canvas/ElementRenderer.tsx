import { useMemo } from 'react';
import { Circle, Ellipse, Group, Line, Path, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Element } from '@/types';
import { pointsToSvgPath } from './lib/freehand';
import {
  roughRect,
  roughDiamond,
  roughEllipse,
  roughPolyline,
  seedFromId,
  type RoughPath,
} from './lib/rough';
import { buildArrowhead, type ArrowheadMarker } from './lib/arrowhead';
import { TEXT_FONT_FAMILY } from './lib/text';
import { getBoundTextLocalBox } from './lib/boundText';

function ArrowheadMarkerView({ marker, stroke, strokeWidth }: { marker: ArrowheadMarker; stroke: string; strokeWidth: number }) {
  if (marker.kind === 'dot') {
    return <Circle x={marker.x} y={marker.y} radius={marker.radius} fill={stroke} listening={false} />;
  }
  if (marker.kind === 'bar') {
    return <Line points={marker.points} stroke={stroke} strokeWidth={strokeWidth} lineCap="round" listening={false} />;
  }
  return (
    <Line
      points={marker.points}
      closed
      fill={marker.filled ? stroke : undefined}
      stroke={stroke}
      strokeWidth={strokeWidth}
      lineJoin="round"
      listening={false}
    />
  );
}

type Props = {
  element: Element;
  selectable: boolean;
  onSelect: (id: string, e: KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragMove: (id: string, node: Konva.Node) => void;
  onDragEnd: (id: string, node: Konva.Node) => void;
  registerNode: (id: string, node: Konva.Node | null) => void;
  /** The text label bound to this element, if it's a container with one. */
  boundText?: Element;
  /** Suppresses rendering of whichever text (standalone or bound) is currently being edited — the textarea overlay is the visual for it instead. */
  editingTextId?: string | null;
};

/**
 * A container's bound text is rendered as a plain, non-interactive child
 * of its Group — nesting it means it automatically moves/rotates with
 * the container (Konva applies the parent transform to children for
 * free), and `listening={false}` means clicks/taps on the glyphs fall
 * through to the container's own hit target beneath, matching
 */
function BoundTextGlyphs({ container, text }: { container: Element; text: Element }) {
  const box = useMemo(
    () => getBoundTextLocalBox(container, text.text ?? '', text.fontSize ?? 20),
    [container, text.text, text.fontSize],
  );
  return (
    <Text
      listening={false}
      x={box.x}
      y={box.y}
      width={box.width}
      text={text.text ?? ''}
      fontSize={text.fontSize ?? 20}
      fontFamily={TEXT_FONT_FAMILY}
      fill={text.stroke}
      align={text.textAlign ?? 'center'}
      wrap="word"
      opacity={(text.opacity ?? 100) / 100}
    />
  );
}

// Selection feedback comes entirely from the Transformer's own outline
// and handles (or the endpoint circles for line/arrow) — matching
export function ElementRenderer({
  element,
  selectable,
  onSelect,
  onDragMove,
  onDragEnd,
  registerNode,
  boundText,
  editingTextId,
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
    opacity: (element.opacity ?? 100) / 100,
  };

  const seed = useMemo(() => seedFromId(element.id), [element.id]);
  const w = element.w ?? 0;
  const h = element.h ?? 0;
  // Memoized so this fallback array is referentially stable — otherwise
  // a fresh [0,0,0,0] literal on every render of a non-line/arrow
  // element would defeat the roughPaths memo below.
  const points = useMemo(() => element.points ?? [0, 0, 0, 0], [element.points]);
  const roughness = element.roughness ?? 1.4;
  const strokeStyle = element.strokeStyle ?? 'solid';
  const fillStyle = element.fillStyle ?? 'solid';
  const edges = element.edges ?? 'round';

  // Called unconditionally (rules-of-hooks) — branches internally so every
  // element instance still only pays for the shape it actually is.
  const roughPaths: RoughPath[] = useMemo(() => {
    const style = { stroke: element.stroke, roughness, strokeStyle, fillStyle };
    const fill = element.fill === 'transparent' ? undefined : element.fill;
    if (element.type === 'rect') {
      return roughRect(w, h, seed, element.strokeWidth, edges, { ...style, fill });
    }
    if (element.type === 'diamond') {
      return roughDiamond(w, h, seed, element.strokeWidth, edges, { ...style, fill });
    }
    if (element.type === 'ellipse') {
      return roughEllipse(w, h, seed, element.strokeWidth, { ...style, fill });
    }
    if (element.type === 'line' || element.type === 'arrow') {
      return roughPolyline(points, seed, element.strokeWidth, style);
    }
    return [];
  }, [
    element.type,
    w,
    h,
    points,
    seed,
    element.strokeWidth,
    element.stroke,
    element.fill,
    roughness,
    strokeStyle,
    fillStyle,
    edges,
  ]);

  const showBoundText = boundText && boundText.id !== editingTextId;

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
            />
          ))}
          {showBoundText && <BoundTextGlyphs container={element} text={boundText} />}
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
            />
          ))}
          {showBoundText && <BoundTextGlyphs container={element} text={boundText} />}
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
            />
          ))}
          {showBoundText && <BoundTextGlyphs container={element} text={boundText} />}
        </Group>
      );
    case 'line':
    case 'arrow': {
      const headSize = Math.max(12, element.strokeWidth * 4);
      const n = points.length;
      const [startX, startY, afterStartX, afterStartY] = points;
      const [beforeEndX, beforeEndY, endX, endY] = points.slice(n - 4);
      const startMarker =
        element.type === 'arrow'
          ? buildArrowhead(element.startArrowhead ?? 'none', startX, startY, afterStartX, afterStartY, headSize)
          : null;
      const endMarker =
        element.type === 'arrow'
          ? buildArrowhead(element.endArrowhead ?? 'triangle', endX, endY, beforeEndX, beforeEndY, headSize)
          : null;
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
            />
          ))}
          {startMarker && <ArrowheadMarkerView marker={startMarker} stroke={element.stroke} strokeWidth={element.strokeWidth} />}
          {endMarker && <ArrowheadMarkerView marker={endMarker} stroke={element.stroke} strokeWidth={element.strokeWidth} />}
        </Group>
      );
    }
    case 'path':
      return (
        <Path
          {...common}
          data={pointsToSvgPath(element.points ?? [], element.strokeWidth)}
          fill={element.stroke}
        />
      );
    case 'text': {
      if (element.id === editingTextId) return null;
      return (
        <Text
          {...common}
          x={element.x ?? 0}
          y={element.y ?? 0}
          text={element.text ?? ''}
          fontSize={element.fontSize ?? 20}
          fontFamily={TEXT_FONT_FAMILY}
          fill={element.stroke}
          width={element.w}
          align={element.textAlign ?? 'left'}
        />
      );
    }
    default:
      return null;
  }
}
