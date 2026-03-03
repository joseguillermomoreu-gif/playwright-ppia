import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import type { SuiteEntry } from './SuiteEntry.js';
import { SuiteManager } from './SuiteManager.js';

const mockMkdir = mkdir as unknown as ReturnType<typeof vi.fn>;
const mockReaddir = readdir as unknown as ReturnType<typeof vi.fn>;
const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>;
const mockWriteFile = writeFile as unknown as ReturnType<typeof vi.fn>;

function createEntry(overrides: Partial<SuiteEntry> = {}): SuiteEntry {
  return {
    id: 'test-id-1',
    testName: 'login-test',
    description: 'Test login flow',
    url: 'https://example.com/login',
    testCode: 'test("login", async () => {});',
    artifacts: { pomMd: '# POM', gherkinMd: '# Gherkin', cucumberMd: '# Cucumber' },
    metrics: {
      totalTokensUsed: 1000,
      totalCost: 0.005,
      modelFast: 'gpt-4o-mini',
      modelStrong: 'gpt-4o',
      explorationRounds: 5,
      generationAttempts: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
    },
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('SuiteManager', () => {
  const baseDir = '/project';
  let manager: SuiteManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new SuiteManager(baseDir);
  });

  describe('save', () => {
    it('creates directory and writes latest + history for a new entry', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
      const entry = createEntry();

      await manager.save(entry);

      const testDir = join(baseDir, '.ppia', 'suite', 'login-test');
      expect(mockMkdir).toHaveBeenCalledWith(testDir, { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith(
        join(testDir, 'latest.json'),
        JSON.stringify(entry, null, 2),
        'utf-8',
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        join(testDir, 'history.json'),
        JSON.stringify([entry], null, 2),
        'utf-8',
      );
    });

    it('appends to existing history', async () => {
      const v1 = createEntry({ id: 'v1', version: 1 });
      const v2 = createEntry({ id: 'v2', version: 2 });
      mockReadFile.mockResolvedValueOnce(JSON.stringify([v1]));

      await manager.save(v2);

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('history.json'),
        JSON.stringify([v1, v2], null, 2),
        'utf-8',
      );
    });
  });

  describe('list', () => {
    it('returns empty array when suite directory does not exist', async () => {
      mockReaddir.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await manager.list();

      expect(result).toEqual([]);
    });

    it('returns latest entries for all tests', async () => {
      const entry1 = createEntry({ testName: 'test-a' });
      const entry2 = createEntry({ testName: 'test-b' });
      mockReaddir.mockResolvedValueOnce(['test-a', 'test-b']);
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify(entry1))
        .mockResolvedValueOnce(JSON.stringify(entry2));

      const result = await manager.list();

      expect(result).toHaveLength(2);
      expect(result[0]?.testName).toBe('test-a');
      expect(result[1]?.testName).toBe('test-b');
    });

    it('skips entries that fail to read', async () => {
      const entry1 = createEntry({ testName: 'test-a' });
      mockReaddir.mockResolvedValueOnce(['test-a', 'broken']);
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify(entry1))
        .mockRejectedValueOnce(new Error('corrupt'));

      const result = await manager.list();

      expect(result).toHaveLength(1);
      expect(result[0]?.testName).toBe('test-a');
    });
  });

  describe('getById', () => {
    it('returns the latest entry for a test name', async () => {
      const entry = createEntry();
      mockReadFile.mockResolvedValueOnce(JSON.stringify(entry));

      const result = await manager.getById('login-test');

      expect(result).toEqual(entry);
    });

    it('returns undefined when test does not exist', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await manager.getById('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('getVersions', () => {
    it('returns full history for a test', async () => {
      const v1 = createEntry({ id: 'v1', version: 1 });
      const v2 = createEntry({ id: 'v2', version: 2 });
      mockReadFile.mockResolvedValueOnce(JSON.stringify([v1, v2]));

      const result = await manager.getVersions('login-test');

      expect(result).toHaveLength(2);
      expect(result[0]?.version).toBe(1);
      expect(result[1]?.version).toBe(2);
    });

    it('returns empty array when no history exists', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await manager.getVersions('nonexistent');

      expect(result).toEqual([]);
    });
  });
});
