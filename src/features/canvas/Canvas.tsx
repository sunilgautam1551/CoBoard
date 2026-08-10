'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useBoardStore } from '@/store/useBoardStore';
import { useSyncStore } from '@/features/sync/useSyncStore';
import { config } from '@/lib/config';
import { newElementId } from '@/lib/utils';
import type { Element, ElementType } from '@/types';
import { ElementRenderer } from './ElementRenderer';
import { getWorldPointer, bakeNodeTransform, translatePoints } from './lib/transform';
import { getElementBounds, boundsIntersect } from './lib/bounds';
import { TextEditor } from './TextEditor';
import { LineEndpointHandles } from './LineEndpointHandles';
import { RemoteCursors } from '@/features/presence/RemoteCursors';
import { ContextMenu } from './ContextMenu';
import {
  duplicateSelectionAndBroadcast,
  deleteSelectionAndBroadcast,
  reorderSelectionAndBroadcast,
  copySelectionToClipboard,
  pasteClipboardAndBroadcast,
} from './lib/elementActions';
import { isContainerType, findBoundText, requiredContainerHeight } from './lib/boundText';
import { applyEndpointBindings, recomputeBoundArrow, findBoundArrows } from './lib/binding';

const SHAPE_TOOLS: ElementType[] = ['rect', 'diamond', 'ellipse', 'line', 'arrow'];

/**
 * The infinite drawing surface itself: a Konva `Stage` plus all pointer,
 * keyboard, wheel, and touch handling that turns raw input into board
 * elements. This component owns every drawing *gesture* (click-drag to
 * draw or select, click-click to build a multi-point line, drag to pan,
 * scroll/pinch to zoom) — the resulting element data lives in
 * `useBoardStore`, and `ElementRenderer` turns that data into the
 * actual Konva nodes on screen. Local React state here is limited to
 * transient UI (marquee rectangle, context menu position, which text is
 * being edited); anything that needs to survive a re-render across
 * gestures or be visible to other clients lives in the store instead.
 */
export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodesRef = useRef<Map<string, Konva.Node>>(new Map());

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const elements = useBoardStore((s) => s.elements);
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const tool = useBoardStore((s) => s.tool);
  const style = useBoardStore((s) => s.style);
  const viewport = useBoardStore((s) => s.viewport);
  const setViewport = useBoardStore((s) => s.setViewport);
  const setSelectedIds = useBoardStore((s) => s.setSelectedIds);
  const applyElement = useBoardStore((s) => s.applyElement);
  const commitElement = useBoardStore((s) => s.commitElement);
  const commitElements = useBoardStore((s) => s.commitElements);
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
  // isMultiPoint distinguishes a line/arrow being built via repeated
  // clicks ("click to add a vertex, double-click/Enter/Escape to
  // finish") from a plain click-drag 2-point line — see handlePointerUp
  // for how that's detected.
  const drawing = useRef<{
    id: string;
    startX: number;
    startY: number;
    isMultiPoint: boolean;
    downAt: { x: number; y: number };
  } | null>(null);
  const panning = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  // Where/when the last vertex-click of a multi-point line landed — a
  // second click in nearly the same spot shortly after is treated as
  // "double-click to finish". Konva's own onDblClick fires from timing
  // alone with no distance check, so a *third* quick click anywhere
  // during multi-point drawing was wrongly read as "finish"; this
  // position-aware check is what actually replaces it.
  const lastPointClick = useRef<{ x: number; y: number; time: number } | null>(null);
  const suppressNextDblClick = useRef(false);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // Last known cursor position in world space — used to paste at the
  // cursor instead of always at a fixed offset from the copied element.
  const lastPointerWorld = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const isPanMode = spaceDown || tool === 'hand';

  /** Tracks each element's live Konva node by id so the Transformer can be pointed at the current selection. */
  const registerNode = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodesRef.current.set(id, node);
    else nodesRef.current.delete(id);
  }, []);

  // A single selected 2-point line/arrow gets endpoint-
  // drag handles instead of a generic bounding-box Transformer — see
  // LineEndpointHandles for why (a box's 8 handles are fiddly for a thin
  // diagonal shape when "move one end" is all you usually want). A
  // multi-point line has more than 2 vertices to manage, so it falls
  // back to the Transformer (which scales/rotates every point at once).
  const singleSelectedElement =
    selectedIds.length === 1 ? elements[selectedIds[0]] : null;
  const usesEndpointHandles =
    (singleSelectedElement?.type === 'line' || singleSelectedElement?.type === 'arrow') &&
    (singleSelectedElement.points?.length ?? 0) === 4;

  // Keep transformer in sync with selection. Hidden entirely while a
  // text (bound or standalone) is being edited, since there's nothing
  // to resize/rotate mid-edit.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const nodes = usesEndpointHandles || editingTextId
      ? []
      : selectedIds
          .map((id) => nodesRef.current.get(id))
          .filter((n): n is Konva.Node => Boolean(n));
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, elements, usesEndpointHandles, editingTextId]);

  /**
   * Begins a new shape/line/arrow/pen-stroke gesture at the given world
   * point: creates the element with zero size (or a degenerate 2-point
   * line) and stores it as a transient (uncommitted) update so
   * `handlePointerMove` can grow it as the pointer moves.
   */
  const startShapeDraw = useCallback(
    (type: ElementType, world: { x: number; y: number }) => {
      const id = newElementId();
      const now = Date.now();
      const base = {
        id,
        stroke: style.stroke,
        fill: style.fill,
        strokeWidth: style.strokeWidth,
        roughness: style.roughness,
        strokeStyle: style.strokeStyle,
        edges: style.edges,
        opacity: style.opacity,
        z: now,
        updatedAt: now,
        updatedBy: useBoardStore.getState().clientId,
      };
      let element: Element;
      if (type === 'rect' || type === 'diamond' || type === 'ellipse') {
        element = { ...base, type, x: world.x, y: world.y, w: 0, h: 0 };
      } else if (type === 'line' || type === 'arrow') {
        element = {
          ...base,
          type,
          points: [world.x, world.y, world.x, world.y],
          ...(type === 'arrow'
            ? { startArrowhead: style.startArrowhead, endArrowhead: style.endArrowhead }
            : {}),
        };
      } else {
        element = { ...base, type: 'path', points: [world.x, world.y] };
      }
      drawing.current = { id, startX: world.x, startY: world.y, isMultiPoint: false, downAt: world };
      applyElement(element);
    },
    [applyElement, style],
  );

  /**
   * Finishes a multi-point line/arrow (Escape, Enter, or double-click),
   * snapping its endpoints to any shape they landed on/near and
   * recording the binding so the arrow follows that shape later.
   */
  const finishMultiPointLine = useCallback(() => {
    if (!drawing.current?.isMultiPoint) return;
    const id = drawing.current.id;
    drawing.current = null;
    const current = useBoardStore.getState().elements[id];
    if (!current) return;
    const bound = applyEndpointBindings(current, Object.values(useBoardStore.getState().elements));
    const final = { ...bound, updatedAt: Date.now() };
    commitElement(final);
    useSyncStore.getState().sendUpsert(final);
    setTool('select');
    setSelectedIds([final.id]);
  }, [commitElement, setSelectedIds, setTool]);

  /** Creates a new free-floating (non-bound) text element at `world` and immediately opens it for editing. */
  const createTextAt = useCallback(
    (world: { x: number; y: number }) => {
      const id = newElementId();
      const now = Date.now();
      const element: Element = {
        id,
        type: 'text',
        x: world.x,
        y: world.y,
        text: '',
        fontSize: style.fontSize,
        stroke: style.stroke,
        fill: style.fill,
        strokeWidth: style.strokeWidth,
        opacity: style.opacity,
        textAlign: style.textAlign,
        z: now,
        updatedAt: now,
        updatedBy: useBoardStore.getState().clientId,
      };
      commitElement(element);
      setEditingTextId(id);
      setSelectedIds([id]);
      setTool('select');
    },
    [style, commitElement, setSelectedIds, setTool],
  );

  /**
   * Double-clicking inside a shape binds a label to it ("container
   * text") instead of dropping a free-floating text element on top —
   * the label centers itself, wraps to the shape's width, and the
   * shape grows to fit it instead of the text spilling out past it.
   */
  const createBoundTextAt = useCallback(
    (container: Element) => {
      const id = newElementId();
      const now = Date.now();
      const element: Element = {
        id,
        type: 'text',
        text: '',
        fontSize: style.fontSize,
        stroke: style.stroke,
        fill: style.fill,
        strokeWidth: style.strokeWidth,
        opacity: style.opacity,
        textAlign: 'center',
        containerId: container.id,
        z: now,
        updatedAt: now,
        updatedBy: useBoardStore.getState().clientId,
      };
      commitElement(element);
      setEditingTextId(id);
      setSelectedIds([container.id]);
      setTool('select');
    },
    [style, commitElement, setSelectedIds, setTool],
  );

  /** Right-click: selects the clicked element (if not already selected) and opens the context menu there. */
  const handleContextMenu = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      const container = containerRef.current;
      if (!stage || !container) return;
      const target = e.target;
      const id = target !== stage ? target.id() : '';
      if (!id) {
        setContextMenu(null);
        return;
      }
      const current = useBoardStore.getState().selectedIds;
      if (!current.includes(id)) setSelectedIds([id]);
      const rect = container.getBoundingClientRect();
      setContextMenu({ x: e.evt.clientX - rect.left, y: e.evt.clientY - rect.top });
    },
    [setSelectedIds],
  );

  /**
   * Routes a pointer-down to whatever the active tool means by it:
   * start panning (middle-mouse or hand tool), start a marquee
   * selection, erase, drop a text element, extend an in-progress
   * multi-point line, or start drawing a new shape/line/pen-stroke.
   */
  const handlePointerDown = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      setContextMenu(null);
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
        if (clickedOnEmpty) {
          marqueeStart.current = world;
          setMarqueeRect({ x: world.x, y: world.y, w: 0, h: 0 });
        }
        return;
      }

      if (tool === 'eraser') {
        const target = e.target;
        if (target !== stage && target.id()) {
          const id = target.id();
          const updatedAt = Date.now();
          const deleted = deleteElements([id]);
          for (const did of deleted) {
            useSyncStore.getState().sendDelete(did, updatedAt, useBoardStore.getState().clientId);
          }
        }
        return;
      }

      if (tool === 'text') {
        createTextAt(world);
        return;
      }

      if (tool === 'pen' || SHAPE_TOOLS.includes(tool as ElementType)) {
        const shapeType = tool === 'pen' ? 'path' : (tool as ElementType);
        if ((shapeType === 'line' || shapeType === 'arrow') && drawing.current?.isMultiPoint) {
          const last = lastPointClick.current;
          const closeInSpace = last && Math.hypot(world.x - last.x, world.y - last.y) < 6 / viewport.scale;
          const closeInTime = last && Date.now() - last.time < 500;
          if (closeInSpace && closeInTime) {
            // A second click in nearly the same spot shortly after the
            // last one — a double-click to finish, not a new vertex.
            lastPointClick.current = null;
            suppressNextDblClick.current = true;
            finishMultiPointLine();
            return;
          }
          // Another click while building a multi-point line/arrow: lock
          // in the current rubber-band point as a fixed vertex and start
          // rubber-banding a new segment from it.
          const existing = useBoardStore.getState().elements[drawing.current.id];
          if (existing) {
            const next = { ...existing, points: [...(existing.points ?? []), world.x, world.y] };
            applyElement(next);
            useSyncStore.getState().sendUpsertThrottled(next);
            drawing.current = { ...drawing.current, downAt: world };
            lastPointClick.current = { x: world.x, y: world.y, time: Date.now() };
          }
          return;
        }
        startShapeDraw(shapeType, world);
      }
    },
    [isPanMode, tool, viewport, deleteElements, startShapeDraw, createTextAt, applyElement, finishMultiPointLine],
  );

  /**
   * Double-click with the select tool — "you don't need a separate text
   * tool" behavior:
   * - On an existing standalone text element, re-opens it for editing.
   * - On a shape (rect/diamond/ellipse), opens its bound label if it has
   *   one, or creates one — this is what a bound text's own Konva node
   *   resolves to too, since it renders with listening=false and lets
   *   clicks fall through to the container's hit target beneath it.
   * - Anywhere else, creates a free-floating text element.
   *
   * Also absorbs Konva's dblclick synthesis for a multi-point line/arrow
   * that just finished via `handlePointerDown`'s own click-based
   * detection, so that finishing double-click doesn't *also* fall
   * through to the text-creation logic below.
   */
  const handleDoubleClick = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      // A multi-point line/arrow's finishing double-click is already
      // fully handled in handlePointerDown (see lastPointClick) — Konva's
      // own dblclick synthesis is timing-only with no distance check, so
      // it also fires after any two quick clicks anywhere on the stage
      // and can't be trusted to mean "finish the line" on its own.
      if (suppressNextDblClick.current) {
        suppressNextDblClick.current = false;
        return;
      }
      if (drawing.current?.isMultiPoint) return;

      if (tool !== 'select') return;
      const target = e.target;
      if (target !== stage && target.id()) {
        const clicked = useBoardStore.getState().elements[target.id()];
        if (clicked?.type === 'text' && !clicked.containerId) {
          setSelectedIds([clicked.id]);
          setEditingTextId(clicked.id);
          return;
        }
        if (clicked && isContainerType(clicked.type)) {
          const bound = findBoundText(useBoardStore.getState().elements, clicked.id);
          if (bound) {
            setSelectedIds([clicked.id]);
            setEditingTextId(bound.id);
          } else {
            createBoundTextAt(clicked);
          }
          return;
        }
      }
      createTextAt(getWorldPointer(stage));
    },
    [tool, setSelectedIds, createTextAt, createBoundTextAt],
  );

  /**
   * Per-frame pointer tracking: broadcasts the live cursor position for
   * presence, and — depending on what's in progress — pans, grows the
   * marquee rectangle, erases whatever's under the pointer, or grows
   * the shape currently being drawn.
   */
  const handlePointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      const world = getWorldPointer(stage);
      lastPointerWorld.current = world;
      useSyncStore.getState().updateCursor(world.x, world.y);

      if (panning.current) {
        const dx = e.evt.clientX - panning.current.startX;
        const dy = e.evt.clientY - panning.current.startY;
        setViewport({ x: panning.current.originX + dx, y: panning.current.originY + dy });
        return;
      }

      if (marqueeStart.current) {
        const start = marqueeStart.current;
        setMarqueeRect({
          x: Math.min(start.x, world.x),
          y: Math.min(start.y, world.y),
          w: Math.abs(world.x - start.x),
          h: Math.abs(world.y - start.y),
        });
        return;
      }

      if (tool === 'eraser' && e.evt.buttons === 1) {
        const target = e.target;
        if (target !== stage && target.id()) {
          const id = target.id();
          const updatedAt = Date.now();
          const deleted = deleteElements([id]);
          for (const did of deleted) {
            useSyncStore.getState().sendDelete(did, updatedAt, useBoardStore.getState().clientId);
          }
        }
        return;
      }

      if (!drawing.current) return;
      const current = useBoardStore.getState().elements[drawing.current.id];
      if (!current) return;

      let next: Element | null = null;
      if (current.type === 'rect' || current.type === 'diamond' || current.type === 'ellipse') {
        next = {
          ...current,
          w: world.x - drawing.current.startX,
          h: world.y - drawing.current.startY,
        };
      } else if (current.type === 'line' || current.type === 'arrow') {
        // Rubber-band only the last point — earlier ones are fixed
        // vertices locked in by previous clicks (multi-point mode).
        const pts = current.points ?? [];
        next = {
          ...current,
          points: [...pts.slice(0, -2), world.x, world.y],
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

  /**
   * Ends whatever gesture was in progress: stops panning, resolves the
   * marquee rectangle into a selection, or finishes a shape/line/arrow
   * draw — except a line/arrow drawn with a plain click (no drag) is
   * *not* finished here; it hands off to multi-point mode instead.
   */
  const handlePointerUp = useCallback(
    () => {
      if (panning.current) {
        panning.current = null;
        return;
      }
      if (marqueeStart.current) {
        const rect = marqueeRect;
        marqueeStart.current = null;
        setMarqueeRect(null);
        if (rect && (rect.w > 2 || rect.h > 2)) {
          // Bound text isn't independently selectable — marquee-selecting
          // over a labeled shape should pick up the shape, not its label.
          const hits = Object.values(useBoardStore.getState().elements)
            .filter((el) => !el.deleted && !el.containerId && boundsIntersect(getElementBounds(el), rect))
            .map((el) => el.id);
          setSelectedIds(hits);
        } else {
          setSelectedIds([]);
        }
        return;
      }
      if (drawing.current) {
        const current = useBoardStore.getState().elements[drawing.current.id];
        const isLineOrArrow = current?.type === 'line' || current?.type === 'arrow';

        if (isLineOrArrow) {
          const stage = stageRef.current;
          const world = stage ? getWorldPointer(stage) : { x: drawing.current.downAt.x, y: drawing.current.downAt.y };
          const moved = Math.hypot(world.x - drawing.current.downAt.x, world.y - drawing.current.downAt.y);
          const clickThreshold = 4 / viewport.scale;
          if (moved < clickThreshold) {
            // A click, not a drag: enter/stay in multi-point mode instead
            // of finishing — this is the dual "click to build a
            // polyline vs. drag for a simple segment" behavior.
            drawing.current = { ...drawing.current, isMultiPoint: true };
            lastPointClick.current = { x: drawing.current.downAt.x, y: drawing.current.downAt.y, time: Date.now() };
            return;
          }
        }

        drawing.current = null;
        if (current) {
          // Normalize negative width/height so hit-testing and selection
          // behave correctly.
          let final: Element;
          if (current.type === 'rect' || current.type === 'diamond' || current.type === 'ellipse') {
            const x = current.w! < 0 ? current.x! + current.w! : current.x!;
            const y = current.h! < 0 ? current.y! + current.h! : current.y!;
            final = { ...current, x, y, w: Math.abs(current.w!), h: Math.abs(current.h!) };
          } else if (isLineOrArrow) {
            final = applyEndpointBindings(
              { ...current, updatedAt: Date.now() },
              Object.values(useBoardStore.getState().elements),
            );
          } else {
            final = { ...current, updatedAt: Date.now() };
          }
          commitElement(final);
          useSyncStore.getState().sendUpsert(final);
          if (tool !== 'pen') setTool('select');
          setSelectedIds([current.id]);
        }
      }
    },
    [commitElement, setSelectedIds, tool, setTool, marqueeRect, viewport.scale],
  );

  /** Mouse-wheel/trackpad zoom, keeping the point under the cursor fixed on screen as the scale changes. */
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

  /** Basic two-finger pinch-to-zoom + pan for touch devices, keeping the pinch midpoint fixed on screen. */
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

  /** Resets pinch-zoom tracking once a touch gesture ends. */
  const handleTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
  }, []);

  /** Element click/tap: replaces the selection, or toggles membership in it when Shift is held. */
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

  // Arrows bound to a container aren't its Konva children (unlike bound
  // text) — they're independent top-level elements connected only by id,
  // so moving/resizing the container has to explicitly push their
  // endpoints along too.

  /** Mid-drag/transform: re-snaps every arrow bound to `container` and broadcasts each one (no history entry). */
  const followBoundArrowsLive = useCallback(
    (container: Element) => {
      if (!isContainerType(container.type)) return;
      const boundArrows = findBoundArrows(Object.values(useBoardStore.getState().elements), container.id);
      for (const arrow of boundArrows) {
        const updated = recomputeBoundArrow(arrow, container);
        applyElement(updated);
        useSyncStore.getState().sendUpsertThrottled(updated);
      }
    },
    [applyElement],
  );

  /** End of drag/transform: computes the final re-snapped position of every arrow bound to `container`, for the caller to commit. */
  const followBoundArrowsFinal = useCallback((container: Element): Element[] => {
    if (!isContainerType(container.type)) return [];
    const boundArrows = findBoundArrows(Object.values(useBoardStore.getState().elements), container.id);
    return boundArrows.map((arrow) => recomputeBoundArrow(arrow, container));
  }, []);

  /** Mid-drag: broadcasts the dragged element's tentative position (Konva already moves it locally) and drags any bound arrows along with it. */
  const handleShapeDragMove = useCallback(
    (id: string, node: Konva.Node) => {
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
      followBoundArrowsLive(tentative);
    },
    [followBoundArrowsLive],
  );

  /** End of drag: bakes the node's final position into the element, commits it (and any bound arrows) as one history entry, and broadcasts. */
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
      const updatedArrows = followBoundArrowsFinal(final);
      if (updatedArrows.length > 0) {
        commitElements([final, ...updatedArrows]);
        useSyncStore.getState().sendUpsert(final);
        for (const arrow of updatedArrows) useSyncStore.getState().sendUpsert(arrow);
        return;
      }
      commitElement(final);
      useSyncStore.getState().sendUpsert(final);
    },
    [commitElement, commitElements, followBoundArrowsFinal],
  );

  /** Mid-resize/rotate: broadcasts every selected node's tentative baked geometry and drags any bound arrows along with it. */
  const handleTransform = useCallback(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    for (const node of tr.nodes()) {
      const element = useBoardStore.getState().elements[node.id()];
      if (!element) continue;
      const baked = bakeNodeTransform(element, node);
      useSyncStore.getState().sendUpsertThrottled(baked);
      followBoundArrowsLive(baked);
    }
  }, [followBoundArrowsLive]);

  /**
   * End of resize/rotate: bakes each transformed node's final geometry,
   * resets the node's own scale/position so the next transform starts
   * clean, grows a resized container to keep fitting its bound text if
   * needed, and commits everything (plus any bound arrows) together.
   */
  const handleTransformEnd = useCallback(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    for (const node of tr.nodes()) {
      const id = node.id();
      const element = useBoardStore.getState().elements[id];
      if (!element) continue;
      let baked = { ...bakeNodeTransform(element, node), updatedAt: Date.now() };
      node.scaleX(1);
      node.scaleY(1);
      if (baked.type === 'line' || baked.type === 'arrow' || baked.type === 'path') {
        node.position({ x: 0, y: 0 });
        node.rotation(0);
      }
      if (isContainerType(baked.type)) {
        const bound = findBoundText(useBoardStore.getState().elements, baked.id);
        if (bound) {
          const needed = requiredContainerHeight(baked, bound.text ?? '', bound.fontSize ?? 20);
          if (needed > (baked.h ?? 0)) baked = { ...baked, h: needed };
        }
      }
      const updatedArrows = followBoundArrowsFinal(baked);
      if (updatedArrows.length > 0) {
        commitElements([baked, ...updatedArrows]);
        useSyncStore.getState().sendUpsert(baked);
        for (const arrow of updatedArrows) useSyncStore.getState().sendUpsert(arrow);
        continue;
      }
      commitElement(baked);
      useSyncStore.getState().sendUpsert(baked);
    }
  }, [commitElement, commitElements, followBoundArrowsFinal]);

  // Keyboard: delete selection, Ctrl/Cmd+D to duplicate, Ctrl/Cmd+C/V to
  // copy/paste, Enter/Escape to finish a multi-point line/arrow
  // currently being built by clicking.
  useEffect(() => {
    /** Global keydown handler for the shortcuts above — ignored while focus is in a text input/textarea. */
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (drawing.current?.isMultiPoint && (e.key === 'Escape' || e.key === 'Enter')) {
        e.preventDefault();
        finishMultiPointLine();
        return;
      }
      if (e.key === 'Escape') {
        setContextMenu(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        deleteSelectionAndBroadcast(selectedIds);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selectedIds.length > 0) {
        e.preventDefault();
        duplicateSelectionAndBroadcast();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && selectedIds.length > 0) {
        e.preventDefault();
        copySelectionToClipboard(selectedIds);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteClipboardAndBroadcast(lastPointerWorld.current);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIds, finishMultiPointLine]);

  const elementList = useMemo(
    () =>
      Object.values(elements)
        .filter((el) => !el.deleted)
        .sort((a, b) => (a.z ?? a.updatedAt) - (b.z ?? b.updatedAt)),
    [elements],
  );

  // Bound text renders nested inside its container's own Group (see
  // ElementRenderer) rather than as its own top-level node — nesting is
  // what makes it move/rotate with the container for free.
  const topLevelElements = useMemo(() => elementList.filter((el) => !el.containerId), [elementList]);
  const boundTextByContainer = useMemo(() => {
    const map: Record<string, Element> = {};
    for (const el of elementList) {
      if (el.containerId) map[el.containerId] = el;
    }
    return map;
  }, [elementList]);

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
          onDblClick={handleDoubleClick}
          onDblTap={handleDoubleClick}
          onWheel={handleWheel}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={handleContextMenu}
        >
          <Layer>
            {topLevelElements.map((element) => (
              <ElementRenderer
                key={element.id}
                element={element}
                selectable={tool === 'select'}
                onSelect={handleSelect}
                onDragMove={handleShapeDragMove}
                onDragEnd={handleShapeDragEnd}
                registerNode={registerNode}
                boundText={boundTextByContainer[element.id]}
                editingTextId={editingTextId}
              />
            ))}
            <Transformer
              ref={transformerRef}
              onTransform={handleTransform}
              onTransformEnd={handleTransformEnd}
              rotateEnabled
              flipEnabled={false}
              borderStroke="#7c3aed"
              borderStrokeWidth={1.5}
              borderDash={[4, 4]}
              anchorStroke="#7c3aed"
              anchorFill="#ffffff"
              anchorSize={8}
              anchorCornerRadius={4}
              rotateAnchorOffset={24}
              boundBoxFunc={(oldBox, newBox) =>
                Math.abs(newBox.width) < 4 || Math.abs(newBox.height) < 4 ? oldBox : newBox
              }
            />
            {usesEndpointHandles && singleSelectedElement && (
              <LineEndpointHandles element={singleSelectedElement} scale={viewport.scale} />
            )}
            {marqueeRect && (
              <Rect
                x={marqueeRect.x}
                y={marqueeRect.y}
                width={marqueeRect.w}
                height={marqueeRect.h}
                fill="rgba(124, 58, 237, 0.08)"
                stroke="#7c3aed"
                strokeWidth={1 / viewport.scale}
                listening={false}
              />
            )}
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
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDuplicate={duplicateSelectionAndBroadcast}
          onDelete={() => deleteSelectionAndBroadcast(useBoardStore.getState().selectedIds)}
          onBringToFront={() => reorderSelectionAndBroadcast('front')}
          onSendToBack={() => reorderSelectionAndBroadcast('back')}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
