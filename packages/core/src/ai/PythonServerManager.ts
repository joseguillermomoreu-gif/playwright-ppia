import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';

import { AiServiceError } from './AiServiceError.js';

export interface PythonServerOptions {
  port?: number;
  host?: string;
  startupTimeoutMs?: number;
  pollIntervalMs?: number;
  pythonPath?: string;
}

const DEFAULTS = {
  port: 8765,
  host: '127.0.0.1',
  startupTimeoutMs: 30_000,
  pollIntervalMs: 500,
  pythonPath: 'python3',
} as const;

export class PythonServerManager {
  private process: ChildProcess | null = null;
  private readonly port: number;
  private readonly host: string;
  private readonly startupTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly pythonPath: string;

  constructor(options: PythonServerOptions = {}) {
    this.port = options.port ?? DEFAULTS.port;
    this.host = options.host ?? DEFAULTS.host;
    this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULTS.startupTimeoutMs;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULTS.pollIntervalMs;
    this.pythonPath = options.pythonPath ?? DEFAULTS.pythonPath;
  }

  get baseUrl(): string {
    return `http://${this.host}:${String(this.port)}`;
  }

  get isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    const pythonDir = resolve(__dirname, '../../python');

    this.process = spawn(
      this.pythonPath,
      [
        '-m', 'uvicorn',
        'src.server:app',
        '--host', this.host,
        '--port', String(this.port),
        '--no-access-log',
      ],
      {
        cwd: pythonDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      },
    );

    this.process.on('error', (err) => {
      this.process = null;
      throw new AiServiceError(
        `Failed to start Python AI Service: ${err.message}. ` +
        `Ensure Python 3.11+ is installed and available as '${this.pythonPath}'.`,
      );
    });

    this.process.on('exit', (_code) => {
      this.process = null;
    });

    await this.waitForReady();
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    const proc = this.process;
    this.process = null;

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve();
      }, 5_000);

      proc.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      proc.kill('SIGTERM');
    });
  }

  private async waitForReady(): Promise<void> {
    const deadline = Date.now() + this.startupTimeoutMs;

    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${this.baseUrl}/ping`);
        if (response.ok) {
          return;
        }
      } catch {
        // Server not ready yet — keep polling.
      }

      await this.sleep(this.pollIntervalMs);
    }

    await this.stop();
    throw new AiServiceError(
      `Python AI Service did not respond within ${String(this.startupTimeoutMs)}ms. ` +
      'Check that Python 3.11+ is installed, dependencies are available, ' +
      `and port ${String(this.port)} is free.`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
