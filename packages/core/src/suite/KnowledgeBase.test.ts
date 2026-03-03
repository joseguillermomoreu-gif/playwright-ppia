import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import type { KnowledgeEntry } from './KnowledgeEntry.js';
import { KnowledgeBase } from './KnowledgeBase.js';

const mockMkdir = mkdir as unknown as ReturnType<typeof vi.fn>;
const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>;
const mockWriteFile = writeFile as unknown as ReturnType<typeof vi.fn>;

function getWrittenData(): KnowledgeEntry[] {
  const call = mockWriteFile.mock.calls[0] as string[];
  return JSON.parse(call[1] as string) as KnowledgeEntry[];
}

function createKnowledgeEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    url: 'https://example.com/login',
    elementDescription: 'email input',
    reliableSelector: 'getByLabel("Email")',
    problematicSelectors: ['#email-input'],
    learnedFrom: 'login-test',
    learnedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('KnowledgeBase', () => {
  const baseDir = '/project';
  let kb: KnowledgeBase;

  beforeEach(() => {
    vi.clearAllMocks();
    kb = new KnowledgeBase(baseDir);
  });

  describe('getByUrl', () => {
    it('returns entries matching the given URL', async () => {
      const entry1 = createKnowledgeEntry();
      const entry2 = createKnowledgeEntry({
        url: 'https://example.com/login',
        elementDescription: 'password input',
        reliableSelector: 'getByLabel("Password")',
      });
      const entry3 = createKnowledgeEntry({ url: 'https://example.com/dashboard' });
      mockReadFile.mockResolvedValueOnce(JSON.stringify([entry1, entry2, entry3]));

      const result = await kb.getByUrl('https://example.com/login');

      expect(result).toHaveLength(2);
      expect(result[0]?.elementDescription).toBe('email input');
      expect(result[1]?.elementDescription).toBe('password input');
    });

    it('returns empty array when no entries exist', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await kb.getByUrl('https://example.com/login');

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('adds new entries without removing existing ones', async () => {
      const existing = createKnowledgeEntry();
      const newEntry = createKnowledgeEntry({
        url: 'https://example.com/dashboard',
        elementDescription: 'nav menu',
        reliableSelector: 'getByRole("navigation")',
      });
      mockReadFile.mockResolvedValueOnce(JSON.stringify([existing]));

      await kb.update('https://example.com/dashboard', [newEntry]);

      const written = getWrittenData();
      expect(written).toHaveLength(2);
      expect(written[0]).toEqual(existing);
      expect(written[1]).toEqual(newEntry);
    });

    it('updates existing entries with matching url + elementDescription', async () => {
      const existing = createKnowledgeEntry({ reliableSelector: 'old-selector' });
      const updated = createKnowledgeEntry({ reliableSelector: 'new-selector' });
      mockReadFile.mockResolvedValueOnce(JSON.stringify([existing]));

      await kb.update('https://example.com/login', [updated]);

      const written = getWrittenData();
      expect(written).toHaveLength(1);
      expect(written[0]?.reliableSelector).toBe('new-selector');
    });

    it('creates the file when it does not exist', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
      const entry = createKnowledgeEntry();

      await kb.update('https://example.com/login', [entry]);

      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
      const written = getWrittenData();
      expect(written).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('clears all entries when called without options', async () => {
      const entries = [createKnowledgeEntry(), createKnowledgeEntry({ url: 'https://other.com' })];
      mockReadFile.mockResolvedValueOnce(JSON.stringify(entries));

      const count = await kb.reset();

      expect(count).toBe(2);
      const written = getWrittenData();
      expect(written).toEqual([]);
    });

    it('removes entries for an exact URL', async () => {
      const keep = createKnowledgeEntry({ url: 'https://other.com' });
      const remove = createKnowledgeEntry({ url: 'https://example.com/login' });
      mockReadFile.mockResolvedValueOnce(JSON.stringify([keep, remove]));

      const count = await kb.reset({ url: 'https://example.com/login' });

      expect(count).toBe(1);
      const written = getWrittenData();
      expect(written).toHaveLength(1);
      expect(written[0]?.url).toBe('https://other.com');
    });

    it('removes entries matching an exact path', async () => {
      const keep = createKnowledgeEntry({ url: 'https://example.com/dashboard' });
      const remove = createKnowledgeEntry({ url: 'https://example.com/admin' });
      mockReadFile.mockResolvedValueOnce(JSON.stringify([keep, remove]));

      const count = await kb.reset({ path: '/admin' });

      expect(count).toBe(1);
      const written = getWrittenData();
      expect(written).toHaveLength(1);
      expect(written[0]?.url).toBe('https://example.com/dashboard');
    });

    it('removes entries matching path and sub-paths with deep option', async () => {
      const keep = createKnowledgeEntry({ url: 'https://example.com/dashboard' });
      const remove1 = createKnowledgeEntry({ url: 'https://example.com/admin' });
      const remove2 = createKnowledgeEntry({ url: 'https://example.com/admin/users' });
      const remove3 = createKnowledgeEntry({ url: 'https://example.com/admin/settings' });
      mockReadFile.mockResolvedValueOnce(JSON.stringify([keep, remove1, remove2, remove3]));

      const count = await kb.reset({ path: '/admin', deep: true });

      expect(count).toBe(3);
      const written = getWrittenData();
      expect(written).toHaveLength(1);
      expect(written[0]?.url).toBe('https://example.com/dashboard');
    });

    it('does not remove sub-paths when deep is false', async () => {
      const keep1 = createKnowledgeEntry({ url: 'https://example.com/admin/users' });
      const remove = createKnowledgeEntry({ url: 'https://example.com/admin' });
      mockReadFile.mockResolvedValueOnce(JSON.stringify([keep1, remove]));

      const count = await kb.reset({ path: '/admin' });

      expect(count).toBe(1);
      const written = getWrittenData();
      expect(written).toHaveLength(1);
      expect(written[0]?.url).toBe('https://example.com/admin/users');
    });

    it('returns 0 when there are no entries to clear', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

      const count = await kb.reset();

      expect(count).toBe(0);
    });
  });

  describe('getAll', () => {
    it('returns all entries', async () => {
      const entries = [createKnowledgeEntry(), createKnowledgeEntry({ url: 'https://other.com' })];
      mockReadFile.mockResolvedValueOnce(JSON.stringify(entries));

      const result = await kb.getAll();

      expect(result).toHaveLength(2);
    });
  });
});
