import { describe, expect, it, vi } from 'vitest';

import { BrowserManager } from './BrowserManager.js';

// Mock playwright module
vi.mock('playwright', () => {
  const mockPage = { url: (): string => 'about:blank' };
  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    chromium: {
      launch: vi.fn().mockResolvedValue(mockBrowser),
    },
    _mockBrowser: mockBrowser,
    _mockContext: mockContext,
    _mockPage: mockPage,
  };
});

describe('BrowserManager', () => {
  it('reports isLaunched as false initially', () => {
    const manager = new BrowserManager();
    expect(manager.isLaunched).toBe(false);
  });

  it('throws when accessing page before launch', () => {
    const manager = new BrowserManager();
    expect(() => manager.page).toThrow('Browser not launched');
  });

  it('launches browser and returns page', async () => {
    const manager = new BrowserManager();
    const page = await manager.launch();
    expect(page).toBeDefined();
    expect(manager.isLaunched).toBe(true);
  });

  it('returns same page on subsequent launch calls', async () => {
    const manager = new BrowserManager();
    const page1 = await manager.launch();
    const page2 = await manager.launch();
    expect(page1).toBe(page2);
  });

  it('closes browser cleanly', async () => {
    const manager = new BrowserManager();
    await manager.launch();
    await manager.close();
    expect(manager.isLaunched).toBe(false);
  });

  it('close is safe when not launched', async () => {
    const manager = new BrowserManager();
    await expect(manager.close()).resolves.toBeUndefined();
  });

  it('accepts custom options', () => {
    const manager = new BrowserManager({
      headless: false,
      slowMo: 100,
      viewport: { width: 1920, height: 1080 },
    });
    expect(manager.isLaunched).toBe(false);
  });
});
