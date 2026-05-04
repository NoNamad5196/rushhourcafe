export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function weightedPick<T>(
  entries: Array<[T, number]>,
  rng: () => number
): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = rng() * total;

  for (const [value, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) {
      return value;
    }
  }

  return entries[entries.length - 1][0];
}

