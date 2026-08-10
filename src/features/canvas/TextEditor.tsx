'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type Konva from 'konva';
import { useBoardStore } from '@/store/useBoardStore';
import { useSyncStore } from '@/features/sync/useSyncStore';
import { TEXT_FONT_FAMILY, getLineHeight, wrapText, widestLineWidth } from './lib/text';
import { getContainerTextArea, getBoundTextLocalBox, getContainerGroupOrigin, requiredContainerHeight } from './lib/boundText';

type Props = {
  elementId: string;
  stage: Konva.Stage | null;
  onDone: () => void;
};

export function TextEditor({ elementId, stage, onDone }: Props) {
  const element = useBoardStore((s) => s.elements[elementId]);
  const container = useBoardStore((s) =>
    element?.containerId ? s.elements[element.containerId] : undefined,
  );
  const applyElement = useBoardStore((s) => s.applyElement);
  const commitElements = useBoardStore((s) => s.commitElements);
  const deleteElements = useBoardStore((s) => s.deleteElements);
  const [value, setValue] = useState(element?.text ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // The container never shrinks below whatever height it had when
  // editing started — only grows to fit — so backspacing text doesn't
  // make a deliberately-drawn box snap smaller than the user made it.
  const minHeightRef = useRef(container?.h ?? 0);

  useEffect(() => {
    // Deferred to the next frame: focusing synchronously on mount races
    // with React StrictMode's dev-only double-invoke of ref callbacks,
    // which can remove the (now-focused) throwaway node and fire a
    // spurious blur that deletes the element before the user types.
    const raf = requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Grows the container live while typing so bound text never overflows
  // it mid-edit — matches Excalidraw's "container expands as you type."
  // The internal no-op guard (needed === current height) makes this safe
  // to re-run whenever `container`'s reference changes, including from
  // its own update below.
  useEffect(() => {
    if (!element || !container) return;
    const fontSize = element.fontSize ?? 20;
    const needed = Math.max(minHeightRef.current, requiredContainerHeight(container, value, fontSize));
    if (Math.round(needed) !== Math.round(container.h ?? 0)) {
      const grown = { ...container, h: needed };
      applyElement(grown);
      useSyncStore.getState().sendUpsertThrottled(grown);
    }
  }, [value, element, container, applyElement]);

  if (!element || !stage) return null;

  function finish() {
    if (!element) return;
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      const updatedAt = Date.now();
      const deleted = deleteElements([element.id]);
      for (const id of deleted) useSyncStore.getState().sendDelete(id, updatedAt, element.updatedBy);
      onDone();
      return;
    }
    const finalText = { ...element, text: value, updatedAt: Date.now() };
    if (container) {
      const fontSize = finalText.fontSize ?? 20;
      const needed = Math.max(minHeightRef.current, requiredContainerHeight(container, value, fontSize));
      const finalContainer = { ...container, h: needed, updatedAt: Date.now() };
      commitElements([finalText, finalContainer]);
      useSyncStore.getState().sendUpsert(finalText);
      useSyncStore.getState().sendUpsert(finalContainer);
    } else {
      commitElements([finalText]);
      useSyncStore.getState().sendUpsert(finalText);
    }
    onDone();
  }

  const scale = stage.scaleX();
  const fontSize = element.fontSize ?? 20;
  const lineHeight = getLineHeight(fontSize);

  let left: number;
  let top: number;
  let width: number | undefined;
  let align: CSSProperties['textAlign'] = element.textAlign ?? 'left';
  let lineCount: number;

  if (container) {
    const box = getBoundTextLocalBox(container, value, fontSize);
    const origin = getContainerGroupOrigin(container);
    left = stage.x() + (origin.x + box.x) * scale;
    top = stage.y() + (origin.y + box.y) * scale;
    width = box.width * scale;
    align = element.textAlign ?? 'center';
    lineCount = Math.max(1, wrapText(value, fontSize, getContainerTextArea(container).width).length);
  } else {
    left = stage.x() + (element.x ?? 0) * scale;
    top = stage.y() + (element.y ?? 0) * scale;
    width = (widestLineWidth(value, fontSize) + 4) * scale;
    lineCount = Math.max(1, value.split('\n').length);
  }

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        // Enter always inserts a newline — matches Excalidraw, which never
        // treats Enter as "finish editing" for any text element, bound or
        // standalone. Only Escape or clicking away commits.
        if (e.key === 'Escape') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      aria-label="Text element editor"
      className="absolute resize-none overflow-hidden border-none bg-transparent p-0 outline-none"
      style={{
        left,
        top,
        width,
        height: lineCount * lineHeight * scale,
        fontSize: fontSize * scale,
        lineHeight: `${lineHeight * scale}px`,
        color: element.stroke,
        fontFamily: TEXT_FONT_FAMILY,
        textAlign: align,
        transformOrigin: 'top left',
      }}
    />
  );
}
