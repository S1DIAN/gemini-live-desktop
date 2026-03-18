export class PlaybackQueue<T> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  drain(): T[] {
    const next = [...this.items];
    this.items = [];
    return next;
  }

  clear(): void {
    this.items = [];
  }

  size(): number {
    return this.items.length;
  }
}
