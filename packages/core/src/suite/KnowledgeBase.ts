import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { join } from 'node:path';

import type { KnowledgeEntry, ResetOptions } from './KnowledgeEntry.js';

export class KnowledgeBase {
  private readonly filePath: string;

  constructor(baseDir: string) {
    this.filePath = join(baseDir, '.ppia', 'knowledge.json');
  }

  async getByUrl(url: string): Promise<KnowledgeEntry[]> {
    const all = await this.readAll();
    return all.filter((e) => e.url === url);
  }

  async update(url: string, entries: KnowledgeEntry[]): Promise<void> {
    const all = await this.readAll();

    for (const incoming of entries) {
      const idx = all.findIndex(
        (e) => e.url === incoming.url && e.elementDescription === incoming.elementDescription,
      );
      if (idx >= 0) {
        all[idx] = incoming;
      } else {
        all.push(incoming);
      }
    }

    await this.writeAll(all);
  }

  async reset(options?: ResetOptions): Promise<number> {
    if (!options?.url && !options?.path) {
      const all = await this.readAll();
      const count = all.length;
      await this.writeAll([]);
      return count;
    }

    const all = await this.readAll();
    const before = all.length;

    let filtered: KnowledgeEntry[];

    if (options.url) {
      filtered = all.filter((e) => e.url !== options.url);
    } else if (options.path) {
      const targetPath = options.path;
      filtered = all.filter((e) => !matchesPath(e.url, targetPath, options.deep ?? false));
    } else {
      filtered = all;
    }

    await this.writeAll(filtered);
    return before - filtered.length;
  }

  async getAll(): Promise<KnowledgeEntry[]> {
    return this.readAll();
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async readAll(): Promise<KnowledgeEntry[]> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      return JSON.parse(raw) as KnowledgeEntry[];
    } catch {
      return [];
    }
  }

  private async writeAll(entries: KnowledgeEntry[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(entries, null, 2), 'utf-8');
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function matchesPath(entryUrl: string, path: string, deep: boolean): boolean {
  let urlPath: string;
  try {
    urlPath = new URL(entryUrl).pathname;
  } catch {
    return false;
  }

  // Normalize: remove trailing slash for comparison (unless root "/")
  const normalizedUrlPath = urlPath.length > 1 ? urlPath.replace(/\/$/, '') : urlPath;
  const normalizedTarget = path.length > 1 ? path.replace(/\/$/, '') : path;

  if (deep) {
    return normalizedUrlPath === normalizedTarget || normalizedUrlPath.startsWith(`${normalizedTarget}/`);
  }

  return normalizedUrlPath === normalizedTarget;
}
