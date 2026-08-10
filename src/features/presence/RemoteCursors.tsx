import { Layer, Path, Label, Tag, Text, Group } from 'react-konva';
import { usePresenceStore } from './usePresenceStore';
import { useBoardStore } from '@/store/useBoardStore';

// A small filled cursor-arrow, tip at (0,0).
const CURSOR_PATH = 'M0 0 L0 14 L4 10.5 L6.5 15.5 L8.5 14.5 L6 9.5 L11 9.5 Z';

export function RemoteCursors() {
  const participants = usePresenceStore((s) => s.participants);
  const scale = useBoardStore((s) => s.viewport.scale);
  const counterScale = 1 / scale;

  return (
    <Layer listening={false}>
      {Object.values(participants)
        .filter((p) => p.cursor !== null)
        .map((p) => (
          <Group
            key={p.clientId}
            x={p.cursor!.x}
            y={p.cursor!.y}
            scaleX={counterScale}
            scaleY={counterScale}
          >
            <Path data={CURSOR_PATH} fill={p.color} stroke="white" strokeWidth={1} />
            <Label x={14} y={2}>
              <Tag fill={p.color} cornerRadius={4} />
              <Text text={p.name} fontSize={11} padding={4} fill="white" />
            </Label>
          </Group>
        ))}
    </Layer>
  );
}
