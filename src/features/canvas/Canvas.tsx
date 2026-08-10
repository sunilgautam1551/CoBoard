'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useBoardStore } from '@/store/useBoardStore';
import { useSyncStore } from '@/features/sync/useSyncStore';
import { config } from '@/lib/config';
import { newElementId } from '@/lib/utils';
import type { Element, ElementType } from '@/types';
import { ElementRenderer } from './ElementRenderer';
import { getWorldPointer, bakeNodeTransform, translatePoints } from './lib/transform';
import { TextEditor } from './TextEditor';
import { RemoteCursors } from '@/features/presence/RemoteCursors';

const SHAPE_TOOLS: ElementType[] = ['rect', 'ellipse', 'line', 'arrow'];

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodesRef = useRef<Map<string, Konva.Node>>(new Map());

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const elements = useBoardStore((s) => s.elements);
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const tool = useBoardStore((s) => s.tool);
  const style = useBoardStore((s) => s.style);
  const viewport = useBoardStore((s) => s.viewport);
  const setViewport = useBoardStore((s) => s.setViewport);
  const setSelectedIds = useBoardStore((s) => s.setSelectedIds);
  const applyElement = useBoardStore((s) => s.applyElement);
  const commitElement = useBoardStore((s) => s.commitElement);
  const deleteElements = useBoardStore((s) => s.deleteElements);
  const setTool = useBoardStore((s) => s.setTool);

  // Resize the stage to fill its container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Space bar held → pan mode.
  const [spaceDown, setSpaceDown] = useState(false);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement | null;
        if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
        setSpaceDown(true);
        e.preventDefault();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setSpaceDown(false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Drawing gesture state (kept in refs — no re-render needed mid-gesture).
  const drawing = useRef<{
    id: string;
    startX: number;
    startY: number;
  } | null>(null);
  const panning = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);

  const isPanMode = spaceDown;

  const registerNode = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodesRef.current.set(id, node);
    else nodesRef.current.delete(id);
  }, []);

  // Keep transformer in sync with selection.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const nodes = selectedIds
      .map((id) => nodesRef.current.get(id))
      .filter((n): n is Konva.Node => Boolean(n));
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, elements]);

  const startShapeDraw = useCallback(
    (type: ElementType, world: { x: number; y: number }) => {
      const id = newElementId();
      const base = {
        id,
        stroke: style.stroke,
        fill: style.fill,
        strokeWidth: style.strokeWidth,
        updatedAt: Date.now(),
        updatedBy: useBoardStore.getState().clientId,
      };
      let element: Element;
      if (type === 'rect' || type === 'ellipse') {
        element = { ...base, type, x: world.x, y: world.y, w: 0, h: 0 };
      } else if (type === 'line' || type === 'arrow') {
        element = { ...base, type, points: [world.x, world.y, world.x, world.y] };
      } else {
        element = { ...base, type: 'path', points: [world.x, world.y] };
      }
      drawing.current = { id, startX: world.x, startY: world.y };
      applyElement(element);
    },
    [applyElement, style],
  );

  const handlePointerDown = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;
      const isMiddle = e.evt.button === 1;
      const clickedOnEmpty = e.target === stage;

      if (isMiddle || isPanMode) {
        panning.current = {
          startX: e.evt.clientX,
          startY: e.evt.clientY,
          originX: viewport.x,
          originY: viewport.y,
        };
        return;
      }

      const world = getWorldPointer(stage);

      if (tool === 'select') {
        if (clickedOnEmpty) setSelectedIds([]);
        return;
      }

      if (tool === 'eraser') {
        const target = e.target;
        if (target !== stage && target.id()) {
          const id = target.id();
          const updatedAt = Date.now();
          deleteElements([id]);
          useSyncStore.getState().sendDelete(id, updatedAt, useBoardStore.getState().clientId);
        }
        return;
      }

      if (tool === 'text') {
        const id = newElementId();
        const element: Element = {
          id,
          type: 'text',
          x: world.x,
          y: world.y,
          text: '',
          fontSize: 20,
          stroke: style.stroke,
          fill: style.fill,
          strokeWidth: style.strokeWidth,
          updatedAt: Date.now(),
          updatedBy: useBoardStore.getState().clientId,
        };
        commitElement(element);
        setEditingTextId(id);
        return;
      }

      if (tool === 'pen' || SHAPE_TOOLS.includes(tool as ElementType)) {
        startShapeDraw(tool === 'pen' ? 'path' : (tool as ElementType), world);
      }
    },
    [isPanMode, tool, viewport, setSelectedIds, deleteElements, style, commitElement, startShapeDraw],
  );

  const handlePointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      const world = getWorldPointer(stage);
      useSyncStore.getState().updateCursor(world.x, world.y);

      if (panning.current) {
        const dx = e.evt.clientX - panning.current.startX;
        const dy = e.evt.clientY - panning.current.startY;
        setViewport({ x: panning.current.originX + dx, y: panning.current.originY + dy });
        return;
      }

      if (tool === 'eraser' && e.evt.buttons === 1) {
        const target = e.target;
        if (target !== stage && target.id()) {
          const id = target.id();
          const updatedAt = Date.now();
          deleteElements([id]);
          useSyncStore.getState().sendDelete(id, updatedAt, useBoardStore.getState().clientId);
        }
        return;
      }

      if (!drawing.current) return;
      const current = useBoardStore.getState().elements[drawing.current.id];
      if (!current) return;

      let next: Element | null = null;
      if (current.type === 'rect' || current.type === 'ellipse') {
        next = {
          ...current,
          w: world.x - drawing.current.startX,
          h: world.y - drawing.current.startY,
        };
      } else if (current.type === 'line' || current.type === 'arrow') {
        next = {
          ...current,
          points: [drawing.current.startX, drawing.current.startY, world.x, world.y],
        };
      } else if (current.type === 'path') {
        next = {
          ...current,
          points: [...(current.points ?? []), world.x, world.y],
        };
      }
      if (next) {
        applyElement(next);
        useSyncStore.getState().sendUpsertThrottled(next);
      }
    },
    [tool, applyElement, deleteElements, setViewport],
  );

  const handlePointerUp = useCallback(() => {
    if (panning.current) {
      panning.current = null;
      return;
    }
    if (drawing.current) {
      const current = useBoardStore.getState().elements[drawing.current.id];
      drawing.current = null;
      if (current) {
        // Normalize negative width/height for rect/ellipse so hit-testing
        // and selection behave correctly.
        let final: Element;
        if (current.type === 'rect' || current.type === 'ellipse') {
          const x = current.w! < 0 ? current.x! + current.w! : current.x!;
          const y = current.h! < 0 ? current.y! + current.h! : current.y!;
          final = { ...current, x, y, w: Math.abs(current.w!), h: Math.abs(current.h!) };
        } else {
          final = { ...current, updatedAt: Date.now() };
        }
        commitElement(final);
        useSyncStore.getState().sendUpsert(final);
        if (tool !== 'pen') setTool('select');
        setSelectedIds([current.id]);
      }
    }
  }, [commitElement, setSelectedIds, tool, setTool]);

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const oldScale = viewport.scale;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const factor = config.zoomStep;
      const newScale = Math.min(
        config.zoomMax,
        Math.max(config.zoomMin, direction > 0 ? oldScale * factor : oldScale / factor),
      );

      const worldX = (pointer.x - viewport.x) / oldScale;
      const worldY = (pointer.y - viewport.y) / oldScale;

      setViewport({
        scale: newScale,
        x: pointer.x - worldX * newScale,
        y: pointer.y - worldY * newScale,
      });
    },
    [viewport, setViewport],
  );

  // Basic two-finger pinch-to-zoom + pan for touch devices.
  const handleTouchMove = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches;
      if (touches.length !== 2) return;
      e.evt.preventDefault();
      const [t1, t2] = [touches[0], touches[1]];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const center = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };

      if (lastPinchDist.current == null) {
        lastPinchDist.current = dist;
        return;
      }

      const scaleDelta = dist / lastPinchDist.current;
      const newScale = Math.min(config.zoomMax, Math.max(config.zoomMin, viewport.scale * scaleDelta));

      const stage = stageRef.current;
      const rect = stage?.container().getBoundingClientRect();
      const localX = rect ? center.x - rect.left : center.x;
      const localY = rect ? center.y - rect.top : center.y;

      const worldX = (localX - viewport.x) / viewport.scale;
      const worldY = (localY - viewport.y) / viewport.scale;

      setViewport({
        scale: newScale,
        x: localX - worldX * newScale,
        y: localY - worldY * newScale,
      });
      lastPinchDist.current = dist;
    },
    [viewport, setViewport],
  );

  const handleTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
  }, []);

  const handleSelect = useCallback(
    (id: string, e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (tool !== 'select') return;
      const additive = e.evt.shiftKey;
      const current = useBoardStore.getState().selectedIds;
      if (additive) {
        setSelectedIds(current.includes(id) ? current.filter((sid) => sid !== id) : [...current, id]);
      } else {
        setSelectedIds([id]);
      }
    },
    [tool, setSelectedIds],
  );

  const handleShapeDragMove = useCallback((id: string, node: Konva.Node) => {
    const element = useBoardStore.getState().elements[id];
    if (!element) return;
    const tentative: Element =
      element.type === 'line' || element.type === 'arrow' || element.type === 'path'
        ? { ...element, points: translatePoints(element.points ?? [], node.x(), node.y()) }
        : {
            ...element,
            x: element.type === 'ellipse' ? node.x() - (element.w ?? 0) / 2 : node.x(),
            y: element.type === 'ellipse' ? node.y() - (element.h ?? 0) / 2 : node.y(),
          };
    useSyncStore.getState().sendUpsertThrottled(tentative);
  }, []);

  const handleShapeDragEnd = useCallback(
    (id: string, node: Konva.Node) => {
      const element = useBoardStore.getState().elements[id];
      if (!element) return;
      let final: Element;
      if (element.type === 'line' || element.type === 'arrow' || element.type === 'path') {
        const dx = node.x();
        const dy = node.y();
        node.position({ x: 0, y: 0 });
        final = {
          ...element,
          points: translatePoints(element.points ?? [], dx, dy),
          updatedAt: Date.now(),
        };
      } else {
        final = {
          ...element,
          x: element.type === 'ellipse' ? node.x() - (element.w ?? 0) / 2 : node.x(),
          y: element.type === 'ellipse' ? node.y() - (element.h ?? 0) / 2 : node.y(),
          updatedAt: Date.now(),
        };
      }
      commitElement(final);
      useSyncStore.getState().sendUpsert(final);
    },
    [commitElement],
  );

  const handleTransform = useCallback(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    for (const node of tr.nodes()) {
      const element = useBoardStore.getState().elements[node.id()];
      if (!element) continue;
      useSyncStore.getState().sendUpsertThrottled(bakeNodeTransform(element, node));
    }
  }, []);

  const handleTransformEnd = useCallback(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    for (const node of tr.nodes()) {
      const id = node.id();
      const element = useBoardStore.getState().elements[id];
      if (!element) continue;
      const baked = { ...bakeNodeTransform(element, node), updatedAt: Date.now() };
      node.scaleX(1);
      node.scaleY(1);
      if (baked.type === 'line' || baked.type === 'arrow' || baked.type === 'path') {
        node.position({ x: 0, y: 0 });
        node.rotation(0);
      }
      commitElement(baked);
      useSyncStore.getState().sendUpsert(baked);
    }
  }, [commitElement]);

  // Keyboard: delete selection.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        const updatedAt = Date.now();
        const clientId = useBoardStore.getState().clientId;
        deleteElements(selectedIds);
        for (const id of selectedIds) {
          useSyncStore.getState().sendDelete(id, updatedAt, clientId);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIds, deleteElements]);

  const elementList = useMemo(() => Object.values(elements).filter((el) => !el.deleted), [elements]);

  const cursor = isPanMode
    ? 'grab'
    : tool === 'eraser'
      ? 'cell'
      : tool === 'select'
        ? 'default'
        : 'crosshair';

  return (
    <div ref={containerRef} className="relative h-full w-full touch-none overflow-hidden bg-neutral-50" style={{ cursor }}>
      {elementList.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 top-1/3 select-none text-center text-sm text-neutral-400">
          Pick a tool and start drawing — press{' '}
          <span className="rounded bg-neutral-200 px-1.5 py-0.5 font-mono text-xs">?</span>{' '}
          for shortcuts.
        </p>
      )}
      {size.width > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => useSyncStore.getState().clearCursor()}
          onWheel={handleWheel}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Layer>
            {elementList.map((element) => (
              <ElementRenderer
                key={element.id}
                element={element}
                isSelected={selectedIds.includes(element.id)}
                selectable={tool === 'select'}
                onSelect={handleSelect}
                onDragMove={handleShapeDragMove}
                onDragEnd={handleShapeDragEnd}
                registerNode={registerNode}
              />
            ))}
            <Transformer
              ref={transformerRef}
              onTransform={handleTransform}
              onTransformEnd={handleTransformEnd}
              rotateEnabled
              flipEnabled={false}
              boundBoxFunc={(oldBox, newBox) =>
                Math.abs(newBox.width) < 4 || Math.abs(newBox.height) < 4 ? oldBox : newBox
              }
            />
          </Layer>
          <RemoteCursors />
        </Stage>
      )}
      {editingTextId && (
        <TextEditor
          elementId={editingTextId}
          stage={stageRef.current}
          onDone={() => setEditingTextId(null)}
        />
      )}
    </div>
  );
}
