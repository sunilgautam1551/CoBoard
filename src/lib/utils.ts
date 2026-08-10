import { customAlphabet } from 'nanoid';

const urlSafeAlphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const nanoid = customAlphabet(urlSafeAlphabet, 10);

export function newBoardId(): string {
  return nanoid();
}

export function newElementId(): string {
  return nanoid();
}

export function newClientId(): string {
  return nanoid();
}

const ADJECTIVES = [
  'Swift',
  'Quiet',
  'Bright',
  'Curious',
  'Gentle',
  'Bold',
  'Lucky',
  'Sunny',
  'Clever',
  'Nimble',
  'Calm',
  'Wild',
  'Jolly',
  'Brave',
  'Cosmic',
];

const ANIMALS = [
  'Otter',
  'Falcon',
  'Panda',
  'Fox',
  'Heron',
  'Lynx',
  'Koala',
  'Wolf',
  'Sparrow',
  'Badger',
  'Dolphin',
  'Rabbit',
  'Tiger',
  'Owl',
  'Yak',
];

export function randomName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adjective} ${animal}`;
}

// Deterministic HSL color derived from a hash of the given string, so a
// given clientId always renders with the same cursor/avatar color.
export function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}
