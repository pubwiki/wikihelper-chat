import { EventEmitter } from "events";

interface StoredResult {
  value: any;
  expireAt: number;
}

class UIResultBridge {
  private results = new Map<string, StoredResult>();
  private emitter = new EventEmitter();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private ttlMs = 10 * 60 * 1000, private sweepMs = 60 * 1000) {
    // 定期清理过期数据
    this.cleanupInterval = setInterval(() => this.sweep(), this.sweepMs);
  }

  /**
   * 生成唯一键（chatId + taskName）
   */
  private key(chatId: string, taskName?: string) {
    return taskName ? `${chatId}:${taskName}` : chatId;
  }

  /**
   * 存储结果并触发等待中的 Promise
   */
  setResult(chatId: string, result: any, taskName?: string) {
    const key = this.key(chatId, taskName);
    const expireAt = Date.now() + this.ttlMs;
    this.results.set(key, { value: result, expireAt });
    this.emitter.emit(key, result);
  }

  /**
   * 获取结果（如果不存在则等待）
   */
  async getResult(chatId: string, taskName?: string, timeoutMs = 30000): Promise<any> {
    const key = this.key(chatId, taskName);
    const stored = this.results.get(key);

    if (stored) {
      this.results.delete(key);
      return stored.value;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.emitter.removeAllListeners(key);
        reject(new Error(`Timeout waiting for UI result (task: ${taskName ?? "default"})`));
      }, timeoutMs);

      this.emitter.once(key, (value) => {
        clearTimeout(timeout);
        this.results.delete(key);
        resolve(value);
      });

      // 👇 二次检查（防止 race condition）
      const existing = this.results.get(key);
      if (existing) {
        this.emitter.emit(key, existing.value);
      }
    });
  }

  /**
   * 清理过期结果
   */
  private sweep() {
    const now = Date.now();
    for (const [key, stored] of this.results.entries()) {
      if (stored.expireAt <= now) {
        this.results.delete(key);
      }
    }
  }

  /**
   * 停止清理定时器
   */
  stop() {
    clearInterval(this.cleanupInterval);
  }
}

/**
 * 🔑 全局单例，防止在多个模块或 Worker 中重复实例化
 */
declare global {
  // eslint-disable-next-line no-var
  var __uiResultBridge: UIResultBridge | undefined;
}

export const uiResultBridge =
  global.__uiResultBridge ?? (global.__uiResultBridge = new UIResultBridge());
