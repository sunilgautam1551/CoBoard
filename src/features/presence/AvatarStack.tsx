'use client';

import { usePresenceStore } from './usePresenceStore';
import { useBoardStore } from '@/store/useBoardStore';

function initial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function AvatarStack() {
  const participants = usePresenceStore((s) => s.participants);
  const selfName = useBoardStore((s) => s.name);
  const selfColor = useBoardStore((s) => s.color);

  const others = Object.values(participants);
  const total = others.length + 1;

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label={`${total} participant${total === 1 ? '' : 's'} online`}
    >
      <div className="flex -space-x-2">
        <div
          title={`${selfName} (you)`}
          style={{ backgroundColor: selfColor }}
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-medium text-white shadow-sm"
        >
          {initial(selfName)}
        </div>
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
    </div>
  );
}
