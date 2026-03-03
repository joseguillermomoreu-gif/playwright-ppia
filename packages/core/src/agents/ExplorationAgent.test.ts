import { describe, expect, it, vi } from 'vitest';

import { ExplorationAgent } from './ExplorationAgent.js';
import { createAgentContext } from '../domain/AgentContext.js';

function createMockAiClient(responses: Array<{
  action: string;
  target: string;
  value: string | null;
  completed: boolean;
  analysisSummary: string;
  tokensUsed: number;
}>): Record<string, unknown> {
  let callIndex = 0;
  return {
    createSession: vi.fn().mockResolvedValue({ sessionId: 'sess-test-001' }),
    closeSession: vi.fn().mockResolvedValue({ closed: true }),
    explore: vi.fn().mockImplementation(() => {
      const response = responses[callIndex];
      if (!response) {
        throw new Error('No more mock responses');
      }
      callIndex++;
      return Promise.resolve(response);
    }),
  };
}

function createMockHtmlExtractor(): Record<string, unknown> {
  return {
    extract: vi.fn().mockResolvedValue('<div>Mock HTML</div>'),
  };
}

function createMockActionExecutor(): Record<string, unknown> {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockPage(): Record<string, unknown> {
  return {
    url: vi.fn().mockReturnValue('https://example.com'),
  };
}

function createContext(overrides: Partial<ReturnType<typeof createAgentContext>> = {}): ReturnType<typeof createAgentContext> {
  return createAgentContext({
    rawInput: 'Login as admin',
    url: 'https://example.com',
    objective: 'Validate login',
    testName: 'login_test',
    maxIterations: 10,
    ...overrides,
  });
}

describe('ExplorationAgent', () => {
  it('completes when AI returns completed=true', async () => {
    const aiClient = createMockAiClient([
      { action: 'navigate', target: 'https://example.com', value: null, completed: false, analysisSummary: 'Navigate to page', tokensUsed: 100 },
      { action: 'click', target: 'getByRole("button", { name: "Login" })', value: null, completed: true, analysisSummary: 'Login complete', tokensUsed: 120 },
    ]);
    const extractor = createMockHtmlExtractor();
    const executor = createMockActionExecutor();
    const page = createMockPage();

    const agent = new ExplorationAgent(
      aiClient as never,
      extractor as never,
      executor as never,
      page as never,
    );

    const report = await agent.run(createContext());

    expect(report.completed).toBe(true);
    expect(report.totalRounds).toBe(2);
    expect(report.sessionId).toBe('sess-test-001');
    expect(report.totalTokensUsed).toBe(220);
  });

  it('executes actions from AI responses', async () => {
    const aiClient = createMockAiClient([
      { action: 'fill', target: 'getByLabel("Email")', value: 'admin@test.com', completed: false, analysisSummary: 'Fill email', tokensUsed: 100 },
      { action: 'click', target: 'getByRole("button", { name: "Submit" })', value: null, completed: true, analysisSummary: 'Submit form', tokensUsed: 100 },
    ]);
    const extractor = createMockHtmlExtractor();
    const executor = createMockActionExecutor();
    const page = createMockPage();

    const agent = new ExplorationAgent(aiClient as never, extractor as never, executor as never, page as never);
    await agent.run(createContext());

    expect(executor.execute).toHaveBeenCalledWith({
      action: 'fill',
      target: 'getByLabel("Email")',
      value: 'admin@test.com',
    });
  });

  it('does not execute action on completed round', async () => {
    const aiClient = createMockAiClient([
      { action: 'click', target: '#done', value: null, completed: true, analysisSummary: 'Done', tokensUsed: 50 },
    ]);
    const extractor = createMockHtmlExtractor();
    const executor = createMockActionExecutor();
    const page = createMockPage();

    const agent = new ExplorationAgent(aiClient as never, extractor as never, executor as never, page as never);
    await agent.run(createContext());

    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('throws when maxIterations reached without completing', async () => {
    const responses = Array.from({ length: 3 }, (_, i) => ({
      action: 'click',
      target: `#btn-${String(i)}`,
      value: null,
      completed: false,
      analysisSummary: `Round ${String(i)}`,
      tokensUsed: 50,
    }));
    const aiClient = createMockAiClient(responses);
    const extractor = createMockHtmlExtractor();
    const executor = createMockActionExecutor();
    const page = createMockPage();

    const agent = new ExplorationAgent(aiClient as never, extractor as never, executor as never, page as never);

    await expect(agent.run(createContext({ maxIterations: 3 }))).rejects.toThrow(
      'Exploration did not complete within 3 iterations',
    );
  });

  it('always closes session even on error', async () => {
    const aiClient = createMockAiClient([]);
    (aiClient.explore as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('AI exploded'));
    const extractor = createMockHtmlExtractor();
    const executor = createMockActionExecutor();
    const page = createMockPage();

    const agent = new ExplorationAgent(aiClient as never, extractor as never, executor as never, page as never);

    await expect(agent.run(createContext())).rejects.toThrow('AI exploded');
    expect(aiClient.closeSession).toHaveBeenCalledWith('sess-test-001');
  });

  it('captures action errors and sends as context in next round', async () => {
    const aiClient = createMockAiClient([
      { action: 'click', target: '#missing', value: null, completed: false, analysisSummary: 'Try click', tokensUsed: 80 },
      { action: 'click', target: '#found', value: null, completed: true, analysisSummary: 'Fixed', tokensUsed: 90 },
    ]);
    const extractor = createMockHtmlExtractor();
    const executor = createMockActionExecutor();
    // First call fails, second succeeds.
    (executor.execute as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Element not found'))
      .mockResolvedValueOnce(undefined);
    const page = createMockPage();

    const agent = new ExplorationAgent(aiClient as never, extractor as never, executor as never, page as never);
    const report = await agent.run(createContext());

    expect(report.rounds[0]?.actionError).toBe('Element not found');
    expect(report.rounds[1]?.actionError).toBeUndefined();

    // Check that the second explore call received the error context.
    const secondCall = (aiClient.explore as ReturnType<typeof vi.fn>).mock.calls[1] as [string, { context: Record<string, string> }];
    expect(secondCall[1].context.lastActionError).toBe('Element not found');
  });

  it('collects learned selectors from successful rounds', async () => {
    const aiClient = createMockAiClient([
      { action: 'click', target: 'getByRole("button", { name: "Login" })', value: null, completed: false, analysisSummary: 'Click login', tokensUsed: 100 },
      { action: 'fill', target: 'getByLabel("Email")', value: 'test@test.com', completed: false, analysisSummary: 'Fill email', tokensUsed: 100 },
      { action: 'click', target: 'getByRole("button", { name: "Submit" })', value: null, completed: true, analysisSummary: 'Submit', tokensUsed: 100 },
    ]);
    const extractor = createMockHtmlExtractor();
    const executor = createMockActionExecutor();
    const page = createMockPage();

    const agent = new ExplorationAgent(aiClient as never, extractor as never, executor as never, page as never);
    const report = await agent.run(createContext());

    expect(report.learnedSelectors).toHaveLength(3);
    expect(report.learnedSelectors[0]?.selector).toBe('getByRole("button", { name: "Login" })');
    expect(report.learnedSelectors[1]?.selector).toBe('getByLabel("Email")');
  });

  it('excludes failed selectors from learned selectors', async () => {
    const aiClient = createMockAiClient([
      { action: 'click', target: '#broken', value: null, completed: false, analysisSummary: 'Try broken', tokensUsed: 50 },
      { action: 'click', target: '#working', value: null, completed: true, analysisSummary: 'Works', tokensUsed: 50 },
    ]);
    const extractor = createMockHtmlExtractor();
    const executor = createMockActionExecutor();
    (executor.execute as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Not found'))
      .mockResolvedValueOnce(undefined);
    const page = createMockPage();

    const agent = new ExplorationAgent(aiClient as never, extractor as never, executor as never, page as never);
    const report = await agent.run(createContext());

    expect(report.learnedSelectors).toHaveLength(1);
    expect(report.learnedSelectors[0]?.selector).toBe('#working');
  });

  it('passes model from context to AI explore calls', async () => {
    const aiClient = createMockAiClient([
      { action: 'click', target: '#btn', value: null, completed: true, analysisSummary: 'Done', tokensUsed: 50 },
    ]);
    const extractor = createMockHtmlExtractor();
    const executor = createMockActionExecutor();
    const page = createMockPage();

    const agent = new ExplorationAgent(aiClient as never, extractor as never, executor as never, page as never);
    await agent.run(createContext({ modelFast: 'claude-haiku-4-5' }));

    const call = (aiClient.explore as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { model: string }];
    expect(call[1].model).toBe('claude-haiku-4-5');
  });
});
