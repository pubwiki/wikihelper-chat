import { EventEmitter } from "events";

interface StoredResult {
  value: any;
  expireAt: number;
}

class UseUIResult {
  private results = new Map<string, StoredResult>();
  private emitter = new EventEmitter();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private ttlMs = 10 * 60 * 1000, private sweepMs = 60 * 1000) {
    this.cleanupInterval = setInterval(() => this.sweep(), this.sweepMs);
  }

  setResult(chatId: string, result: any) {
    const expireAt = Date.now() + this.ttlMs;
    this.results.set(chatId, { value: result, expireAt });
    this.emitter.emit(chatId, result);
  }

  async getResult(chatId: string, timeoutMs = 30000): Promise<any> {
    const stored = this.results.get(chatId);
    if (stored) {
      this.results.delete(chatId);
      return stored.value;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.emitter.removeAllListeners(chatId);
        reject(new Error("Timeout waiting for UI result"));
      }, timeoutMs);

      this.emitter.once(chatId, (value) => {
        clearTimeout(timeout);
        this.results.delete(chatId);
        resolve(value);
      });

      // 👇 二次检查，避免 race condition
      const existing = this.results.get(chatId);
      if (existing) {
        this.emitter.emit(chatId, existing.value);
      }
    });
  }

  private sweep() {
    const now = Date.now();
    for (const [chatId, stored] of this.results.entries()) {
      if (stored.expireAt <= now) {
        this.results.delete(chatId);
      }
    }
  }

  stop() {
    clearInterval(this.cleanupInterval);
  }
}

/**
 * 🔑 确保全局单例（避免 API Route / MCP Server import 出现多个实例）
 */
declare global {
  // eslint-disable-next-line no-var
  var __useUIResult: UseUIResult | undefined;
}

export const useUIResult =
  global.__useUIResult ?? (global.__useUIResult = new UseUIResult());
