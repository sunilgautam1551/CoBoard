'use client';

import { useState } from 'react';
import { usePresenceStore } from './usePresenceStore';
import { useBoardStore } from '@/store/useBoardStore';
import { NameEditorPopover } from './NameEditorPopover';

function initial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function AvatarStack() {
  const participants = usePresenceStore((s) => s.participants);
  const selfName = useBoardStore((s) => s.name);
  const selfColor = useBoardStore((s) => s.color);
  const [editingName, setEditingName] = useState(false);

  const others = Object.values(participants);
  const total = others.length + 1;

  return (
    <div
      className="relative flex items-center gap-2"
      role="group"
      aria-label={`${total} participant${total === 1 ? '' : 's'} online`}
    >
      <div className="flex -space-x-2">
        <button
          type="button"
          onClick={() => setEditingName((v) => !v)}
          title={`${selfName} (you) — click to change your name`}
          aria-label={`You are ${selfName}. Click to change your name.`}
          aria-haspopup="dialog"
          aria-expanded={editingName}
          style={{ backgroundColor: selfColor }}
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-medium text-white shadow-sm transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          {initial(selfName)}
        </button>
        {others.slice(0, 4).map((p) => (
          <div
            key={p.clientId}
            title={p.name}
            style={{ backgroundColor: p.color }}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-medium text-white shadow-sm"
          >
            {initial(p.name)}
          </div>
        ))}
      </div>
      {others.length > 4 && (
        <span className="text-xs text-neutral-500">+{others.length - 4}</span>
      )}
      <span className="text-xs text-neutral-500">{total} online</span>
      {editingName && <NameEditorPopover onClose={() => setEditingName(false)} />}
    </div>
  );
}
