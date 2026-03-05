import { describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'node:fs/promises';

import { DEFAULT_AI_CONFIG } from './ProjectConfig.js';
import type { ProjectConfig } from './ProjectConfig.js';
import { SetupManager } from './SetupManager.js';

const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>;

function createConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    projectName: 'test-app',
    ai: DEFAULT_AI_CONFIG,
    environments: [
      { name: 'staging', baseUrl: 'https://staging.example.com' },
      { name: 'production', baseUrl: 'https://prod.example.com', cookies: '/path/to/cookies.json' },
    ],
    users: [
      { name: 'admin', email: 'admin@test.com', password: 'pass123', role: 'admin', authFlow: 'login_form' },
      { name: 'viewer', authFlow: 'cookie_injection' },
    ],
    setupCombinations: [
      { environment: 'staging', users: ['admin', 'viewer'] },
    ],
    ...overrides,
  };
}

function createMockActionExecutor(): Record<string, unknown> {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockPage(): Record<string, unknown> {
  const addCookies = vi.fn().mockResolvedValue(undefined);
  return {
    context: vi.fn().mockReturnValue({ addCookies }),
    goto: vi.fn().mockResolvedValue(undefined),
  };
}

describe('SetupManager', () => {
  describe('findUser', () => {
    it('returns user when found', () => {
      const manager = new SetupManager(
        createConfig(),
        createMockActionExecutor() as never,
        createMockPage() as never,
      );

      const user = manager.findUser('admin');

      expect(user).toBeDefined();
      expect(user?.name).toBe('admin');
      expect(user?.email).toBe('admin@test.com');
    });

    it('returns undefined when user not found', () => {
      const manager = new SetupManager(
        createConfig(),
        createMockActionExecutor() as never,
        createMockPage() as never,
      );

      expect(manager.findUser('ghost')).toBeUndefined();
    });
  });

  describe('loadSetup', () => {
    it('resolves a valid environment + user combination', () => {
      const manager = new SetupManager(
        createConfig(),
        createMockActionExecutor() as never,
        createMockPage() as never,
      );

      const setup = manager.loadSetup('staging', 'admin');

      expect(setup.environment.name).toBe('staging');
      expect(setup.environment.baseUrl).toBe('https://staging.example.com');
      expect(setup.user.name).toBe('admin');
    });

    it('throws when environment is not found', () => {
      const manager = new SetupManager(
        createConfig(),
        createMockActionExecutor() as never,
        createMockPage() as never,
      );

      expect(() => manager.loadSetup('unknown', 'admin')).toThrow(
        'Environment "unknown" not found in project config',
      );
    });

    it('throws when user is not found', () => {
      const manager = new SetupManager(
        createConfig(),
        createMockActionExecutor() as never,
        createMockPage() as never,
      );

      expect(() => manager.loadSetup('staging', 'ghost')).toThrow(
        'User "ghost" not found in project config',
      );
    });
  });

  describe('authenticate', () => {
    it('executes login_form sequence: navigate → fill email → fill password → click submit', async () => {
      const executor = createMockActionExecutor();
      const page = createMockPage();
      const manager = new SetupManager(createConfig(), executor as never, page as never);
      const setup = manager.loadSetup('staging', 'admin');

      await manager.authenticate(setup);

      const calls = (executor.execute as ReturnType<typeof vi.fn>).mock.calls as Array<[{ action: string; target: string; value: string | null }]>;
      expect(calls).toHaveLength(4);
      expect(calls[0]?.[0]).toEqual({ action: 'navigate', target: 'https://staging.example.com', value: null });
      expect(calls[1]?.[0]).toEqual({ action: 'fill', target: 'getByLabel("Email")', value: 'admin@test.com' });
      expect(calls[2]?.[0]).toEqual({ action: 'fill', target: 'getByLabel("Password")', value: 'pass123' });
      expect(calls[3]?.[0]).toEqual({ action: 'click', target: 'getByRole("button", { name: "Submit" })', value: null });
    });

    it('executes cookie_injection: reads cookies file → addCookies → navigate', async () => {
      const executor = createMockActionExecutor();
      const page = createMockPage();
      const manager = new SetupManager(createConfig(), executor as never, page as never);

      const setup = manager.loadSetup('production', 'viewer');

      const mockCookies = [{ name: 'session', value: 'abc123', domain: '.example.com', path: '/' }];

      mockReadFile.mockResolvedValue(JSON.stringify(mockCookies));

      await manager.authenticate(setup);

      const context = (page.context as ReturnType<typeof vi.fn>)() as { addCookies: ReturnType<typeof vi.fn> };
      expect(context.addCookies).toHaveBeenCalledWith(mockCookies);

      const executorCalls = (executor.execute as ReturnType<typeof vi.fn>).mock.calls as Array<[{ action: string; target: string }]>;
      expect(executorCalls).toHaveLength(1);
      expect(executorCalls[0]?.[0]?.action).toBe('navigate');
      expect(executorCalls[0]?.[0]?.target).toBe('https://prod.example.com');
    });

    it('throws when cookie_injection has no cookies path', async () => {
      const config = createConfig({
        environments: [
          { name: 'no-cookies', baseUrl: 'https://example.com' },
        ],
        users: [
          { name: 'viewer', authFlow: 'cookie_injection' },
        ],
      });
      const executor = createMockActionExecutor();
      const page = createMockPage();
      const manager = new SetupManager(config, executor as never, page as never);

      const setup = manager.loadSetup('no-cookies', 'viewer');

      await expect(manager.authenticate(setup)).rejects.toThrow(
        'cookie_injection requires "cookies" path in environment "no-cookies"',
      );
    });
  });
});
