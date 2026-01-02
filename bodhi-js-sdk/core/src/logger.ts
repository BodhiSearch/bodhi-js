/**
 * Centralized logger with configurable log levels
 */

import type { LogLevel } from './types/config';

const LOG_LEVELS: Record<LogLevel | 'silent', number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export class Logger {
  constructor(
    private prefix: string,
    private level: LogLevel | 'silent' = 'warn'
  ) {}

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private ts(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const millis = now.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${millis}`;
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(`[${this.prefix}] ${this.ts()}`, ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log(`[${this.prefix}] ${this.ts()}`, ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[${this.prefix}] ${this.ts()}`, ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(`[${this.prefix}] ${this.ts()}`, ...args);
    }
  }
}
