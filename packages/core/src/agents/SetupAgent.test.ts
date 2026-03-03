import { describe, expect, it, vi } from 'vitest';

import { createAgentContext } from '../domain/AgentContext.js';
import { SetupAgent } from './SetupAgent.js';

function createContext(overrides: Partial<ReturnType<typeof createAgentContext>> = {}): ReturnType<typeof createAgentContext> {
  return createAgentContext({
    rawInput: 'Login to dashboard con usuario admin',
    url: 'https://example.com',
    objective: 'Validate dashboard',
    testName: 'dashboard_test',
    ...overrides,
  });
}

function createMockSetupManager(options: {
  users?: Array<{ name: string; email?: string; password?: string; role?: string; authFlow: string }>;
  defaultEnv?: string;
} = {}): Record<string, unknown> {
  const users = options.users ?? [
    { name: 'admin', email: 'admin@test.com', password: 'pass', role: 'admin', authFlow: 'login_form' },
  ];

  return {
    findUser: vi.fn().mockImplementation((name: string) =>
      users.find((u) => u.name === name),
    ),
    loadSetup: vi.fn().mockImplementation((envName: string, userName: string) => ({
      environment: { name: envName, baseUrl: `https://${envName}.example.com` },
      user: users.find((u) => u.name === userName),
    })),
    authenticate: vi.fn().mockResolvedValue(undefined),
    findEnvironmentForUser: vi.fn().mockReturnValue(options.defaultEnv ?? 'staging'),
  };
}

describe('SetupAgent', () => {
  it('returns context unchanged when no user is detected', async () => {
    const manager = createMockSetupManager();
    const agent = new SetupAgent(manager as never);
    const context = createContext();

    const result = await agent.run(context);

    expect(result.authenticated).toBe(false);
    expect(result.context).toBe(context);
    expect(manager.authenticate).not.toHaveBeenCalled();
  });

  it('returns context unchanged when detected user is not in config', async () => {
    const manager = createMockSetupManager();
    const agent = new SetupAgent(manager as never);
    const context = createContext();

    const result = await agent.run(context, 'ghost');

    expect(result.authenticated).toBe(false);
    expect(result.context).toBe(context);
  });

  it('authenticates and updates context when user is found', async () => {
    const manager = createMockSetupManager();
    const agent = new SetupAgent(manager as never);
    const context = createContext();

    const result = await agent.run(context, 'admin');

    expect(result.authenticated).toBe(true);
    expect(manager.loadSetup).toHaveBeenCalledWith('staging', 'admin');
    expect(manager.authenticate).toHaveBeenCalled();
  });

  it('cleans user reference from rawInput (Spanish "con usuario")', async () => {
    const manager = createMockSetupManager();
    const agent = new SetupAgent(manager as never);
    const context = createContext({ rawInput: 'Login to dashboard con usuario admin' });

    const result = await agent.run(context, 'admin');

    expect(result.context.rawInput).toBe('Login to dashboard');
  });

  it('cleans user reference from rawInput (Spanish "como")', async () => {
    const manager = createMockSetupManager();
    const agent = new SetupAgent(manager as never);
    const context = createContext({ rawInput: 'Navegar al panel como admin' });

    const result = await agent.run(context, 'admin');

    expect(result.context.rawInput).toBe('Navegar al panel');
  });

  it('cleans user reference from rawInput (English "as")', async () => {
    const manager = createMockSetupManager();
    const agent = new SetupAgent(manager as never);
    const context = createContext({ rawInput: 'Navigate to dashboard as admin' });

    const result = await agent.run(context, 'admin');

    expect(result.context.rawInput).toBe('Navigate to dashboard');
  });

  it('cleans user reference from rawInput (English "with user")', async () => {
    const manager = createMockSetupManager();
    const agent = new SetupAgent(manager as never);
    const context = createContext({ rawInput: 'Check settings with user admin' });

    const result = await agent.run(context, 'admin');

    expect(result.context.rawInput).toBe('Check settings');
  });

  it('populates setup field in context with environment and user', async () => {
    const manager = createMockSetupManager();
    const agent = new SetupAgent(manager as never);
    const context = createContext();

    const result = await agent.run(context, 'admin');

    expect(result.context.setup).toBeDefined();
    expect(result.context.setup?.environment.name).toBe('staging');
    expect(result.context.setup?.user.name).toBe('admin');
  });

  it('uses explicit environment when provided', async () => {
    const manager = createMockSetupManager();
    const agent = new SetupAgent(manager as never);
    const context = createContext();

    await agent.run(context, 'admin', 'production');

    expect(manager.loadSetup).toHaveBeenCalledWith('production', 'admin');
    expect(manager.findEnvironmentForUser).not.toHaveBeenCalled();
  });

  it('uses default environment from setupManager when not provided', async () => {
    const manager = createMockSetupManager({ defaultEnv: 'dev' });
    const agent = new SetupAgent(manager as never);
    const context = createContext();

    await agent.run(context, 'admin');

    expect(manager.findEnvironmentForUser).toHaveBeenCalledWith('admin');
    expect(manager.loadSetup).toHaveBeenCalledWith('dev', 'admin');
  });

  it('returns unauthenticated when no environment can be resolved', async () => {
    const manager = createMockSetupManager();
    (manager.findEnvironmentForUser as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const agent = new SetupAgent(manager as never);
    const context = createContext();

    const result = await agent.run(context, 'admin');

    expect(result.authenticated).toBe(false);
    expect(result.context).toBe(context);
  });
});

describe('SetupAgent.removeUserReference', () => {
  it('removes "con usuario X" pattern', () => {
    expect(SetupAgent.removeUserReference('Haz login con usuario admin', 'admin')).toBe('Haz login');
  });

  it('removes "como X" pattern', () => {
    expect(SetupAgent.removeUserReference('Accede como viewer', 'viewer')).toBe('Accede');
  });

  it('removes "as X" pattern', () => {
    expect(SetupAgent.removeUserReference('Login as admin', 'admin')).toBe('Login');
  });

  it('removes "with user X" pattern', () => {
    expect(SetupAgent.removeUserReference('Check page with user admin', 'admin')).toBe('Check page');
  });

  it('removes "using user X" pattern', () => {
    expect(SetupAgent.removeUserReference('Test using user admin', 'admin')).toBe('Test');
  });

  it('returns input unchanged when no pattern matches', () => {
    expect(SetupAgent.removeUserReference('Navigate to settings', 'admin')).toBe('Navigate to settings');
  });

  it('is case insensitive', () => {
    expect(SetupAgent.removeUserReference('Login AS Admin', 'admin')).toBe('Login');
  });
});
