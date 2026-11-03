/** an in-memory localStorage stand-in for tests; `broken` makes every call throw like blocked storage does */
export class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  broken = false;
  get length(): number {
    return this.m.size;
  }
  private check(): void {
    if (this.broken) throw new Error('SecurityError: storage is blocked');
  }
  clear(): void {
    this.check();
    this.m.clear();
  }
  getItem(k: string): string | null {
    this.check();
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string): void {
    this.check();
    this.m.delete(k);
  }
  setItem(k: string, v: string): void {
    this.check();
    this.m.set(k, String(v));
  }
}

export function installStorage(): MemoryStorage {
  const s = new MemoryStorage();
  (globalThis as unknown as { localStorage: Storage }).localStorage = s;
  return s;
}
