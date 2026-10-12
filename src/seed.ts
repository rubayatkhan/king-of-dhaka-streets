type RandomSource = { getRandomValues(array: Uint32Array): Uint32Array };

// A new seed per ride keeps hazard and traffic placement from repeating between sessions.
export function freshSeed(source: RandomSource | undefined = globalThis.crypto): number {
  try { if (source) { const value = source.getRandomValues(new Uint32Array(1))[0]; if (value > 0) return value; } }
  catch { /* Fall back below when crypto is blocked. */ }
  return Math.floor(Math.random() * 0xfffffffe) + 1;
}
