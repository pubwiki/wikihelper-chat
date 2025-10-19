/**
 * Client-side UI Result Manager
 * 
 * This replaces the backend uiResultBridge for managing UI confirmations
 * in a pure frontend environment. It uses EventEmitter pattern to coordinate
 * between the tool execution and user interaction.
 */

class ClientUIResultManager {
  private pendingResults = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  /**
   * Generate a unique key for each result request
   */
  private key(chatId: string, taskName?: string): string {
    return taskName ? `${chatId}:${taskName}` : chatId;
  }

  /**
   * Set the result from user interaction
   * This is called when the user clicks confirm/reject in the UI
   */
  setResult(chatId: string, result: any, taskName?: string): void {
    const key = this.key(chatId, taskName);
    const pending = this.pendingResults.get(key);
    
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(result);
      this.pendingResults.delete(key);
    } else {
      console.warn(`No pending result found for key: ${key}`);
    }
  }

  /**
   * Wait for user interaction result
   * This is called by the tool to wait for user confirmation
   */
  async getResult(chatId: string, taskName?: string, timeoutMs: number = 300000): Promise<any> {
    const key = this.key(chatId, taskName);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResults.delete(key);
        reject(new Error(`Timeout waiting for UI result (task: ${taskName ?? "default"})`));
      }, timeoutMs);

      this.pendingResults.set(key, { resolve, reject, timeout });
    });
  }

  /**
   * Cancel a pending result request
   */
  cancel(chatId: string, taskName?: string): void {
    const key = this.key(chatId, taskName);
    const pending = this.pendingResults.get(key);
    
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Result request cancelled'));
      this.pendingResults.delete(key);
    }
  }

  /**
   * Clear all pending results
   */
  clearAll(): void {
    for (const [, pending] of this.pendingResults) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('All results cleared'));
    }
    this.pendingResults.clear();
  }
}

/**
 * Global singleton instance for client-side UI result management
 */
export const clientUIResultManager = new ClientUIResultManager();
