'use client';

import { useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { useBoardStore } from '@/store/useBoardStore';

type Props = {
  elementId: string;
  stage: Konva.Stage | null;
  onDone: () => void;
};

export function TextEditor({ elementId, stage, onDone }: Props) {
  const element = useBoardStore((s) => s.elements[elementId]);
  const commitElement = useBoardStore((s) => s.commitElement);
  const deleteElements = useBoardStore((s) => s.deleteElements);
  const [value, setValue] = useState(element?.text ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  if (!element || !stage) return null;

  function finish() {
    if (!element) return;
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      deleteElements([element.id]);
    } else {
      commitElement({ ...element, text: value, updatedAt: Date.now() });
    }
    onDone();
  }

  const scale = stage.scaleX();
  const left = stage.x() + (element.x ?? 0) * scale;
  const top = stage.y() + (element.y ?? 0) * scale;
  const fontSize = (element.fontSize ?? 20) * scale;

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.currentTarget.blur();
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      aria-label="Text element editor"
      className="absolute min-w-[4ch] resize-none overflow-hidden border-none bg-transparent p-0 outline-none"
      style={{
        left,
        top,
        fontSize,
        lineHeight: 1.2,
        color: element.stroke,
        fontFamily: 'inherit',
        transformOrigin: 'top left',
      }}
      rows={1}
    />
  );
}
