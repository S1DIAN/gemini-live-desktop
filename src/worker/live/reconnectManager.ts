export class ReconnectManager {
  private timer: NodeJS.Timeout | null = null;
  private attempts = 0;

  get reconnectCount(): number {
    return this.attempts;
  }

  reset(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.attempts = 0;
  }

  schedule(task: () => Promise<void> | void): number {
    this.attempts += 1;
    const delay = Math.min(1000 * 2 ** (this.attempts - 1), 15000);
    this.timer = setTimeout(() => {
      this.timer = null;
      void task();
    }, delay);
    return delay;
  }
}
