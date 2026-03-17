import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LastStartupStore } from './LastStartupStore.js';

describe('LastStartupStore (mocked fs)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('hasRanToday returns false when file missing', async () => {
    const store = new LastStartupStore('/nonexistent/project');
    const result = await store.hasRanToday();
    expect(result).toBe(false);
  });

  it('hasRanToday returns false for yesterday', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'ppia-test-'));
    try {
      const store = new LastStartupStore(tmp);
      // Write a date that is yesterday
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const { mkdir, writeFile } = await import('node:fs/promises');
      await mkdir(join(tmp, '.ppia'), { recursive: true });
      await writeFile(
        join(tmp, '.ppia', 'last-startup.json'),
        JSON.stringify({ ran_at: yesterdayStr }),
        'utf-8',
      );

      const result = await store.hasRanToday();
      expect(result).toBe(false);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

describe('LastStartupStore (real tmpdir)', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'ppia-test-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('markRan writes today date', async () => {
    const store = new LastStartupStore(tmp);
    await store.markRan();

    const raw = await readFile(join(tmp, '.ppia', 'last-startup.json'), 'utf-8');
    const data = JSON.parse(raw) as { ran_at: string };
    const today = new Date().toISOString().slice(0, 10);
    expect(data.ran_at).toBe(today);
  });

  it('hasRanToday returns true after markRan', async () => {
    const store = new LastStartupStore(tmp);
    await store.markRan();
    const result = await store.hasRanToday();
    expect(result).toBe(true);
  });
});
