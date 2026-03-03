import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SuiteEntry } from './SuiteEntry.js';

export class SuiteManager {
  private readonly suiteDir: string;

  constructor(private readonly baseDir: string) {
    this.suiteDir = join(baseDir, '.ppia', 'suite');
  }

  async save(entry: SuiteEntry): Promise<void> {
    const testDir = join(this.suiteDir, entry.testName);
    await mkdir(testDir, { recursive: true });

    const latestPath = join(testDir, 'latest.json');
    const historyPath = join(testDir, 'history.json');

    // Write latest
    await writeFile(latestPath, JSON.stringify(entry, null, 2), 'utf-8');

    // Append to history
    const history = await this.readHistory(historyPath);
    history.push(entry);
    await writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
  }

  async list(): Promise<SuiteEntry[]> {
    const entries: SuiteEntry[] = [];

    let dirNames: string[];
    try {
      dirNames = await readdir(this.suiteDir);
    } catch {
      return entries;
    }

    for (const name of dirNames) {
      const entry = await this.readLatest(name);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  async getById(testName: string): Promise<SuiteEntry | undefined> {
    return this.readLatest(testName);
  }

  async getVersions(testName: string): Promise<SuiteEntry[]> {
    const historyPath = join(this.suiteDir, testName, 'history.json');
    return this.readHistory(historyPath);
  }

  async clean(olderThanDays: number): Promise<number> {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let removed = 0;

    let dirNames: string[];
    try {
      dirNames = await readdir(this.suiteDir);
    } catch {
      return 0;
    }

    for (const name of dirNames) {
      const latest = await this.readLatest(name);
      if (!latest) {
        continue;
      }

      const createdMs = new Date(latest.createdAt).getTime();
      if (createdMs < cutoff) {
        await rm(join(this.suiteDir, name), { recursive: true, force: true });
        removed++;
      }
    }

    return removed;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async readLatest(testName: string): Promise<SuiteEntry | undefined> {
    const latestPath = join(this.suiteDir, testName, 'latest.json');
    try {
      const raw = await readFile(latestPath, 'utf-8');
      return JSON.parse(raw) as SuiteEntry;
    } catch {
      return undefined;
    }
  }

  private async readHistory(historyPath: string): Promise<SuiteEntry[]> {
    try {
      const raw = await readFile(historyPath, 'utf-8');
      return JSON.parse(raw) as SuiteEntry[];
    } catch {
      return [];
    }
  }
}
