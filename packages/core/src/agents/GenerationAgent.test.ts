import { describe, expect, it, vi } from 'vitest';

import { GenerationAgent } from './GenerationAgent.js';
import { createAgentContext } from '../domain/AgentContext.js';
import type { ExplorationReport } from '../domain/ExplorationReport.js';

function createMockExplorationReport(): ExplorationReport {
  return {
    sessionId: 'sess-exploration-001',
    rounds: [
      {
        round: 1,
        action: 'click',
        target: 'getByRole("button", { name: "Login" })',
        value: null,
        analysisSummary: 'Click login button',
        tokensUsed: 100,
      },
    ],
    learnedSelectors: [
      {
        description: 'Click login button',
        selector: 'getByRole("button", { name: "Login" })',
        action: 'click',
      },
    ],
    completed: true,
    totalTokensUsed: 100,
    totalRounds: 1,
  };
}

function createMockAiClient(options: {
  generateTestResponses: Array<{ code: string; tokensUsed: number }>;
  generateArtifactsResponse?: {
    pomMd: string;
    gherkinMd: string;
    cucumberMd: string;
    tokensUsed: number;
  };
}): Record<string, unknown> {
  let sessionCounter = 0;
  let generateTestIndex = 0;

  return {
    createSession: vi.fn().mockImplementation(() => {
      sessionCounter++;
      return Promise.resolve({ sessionId: `sess-gen-${String(sessionCounter).padStart(3, '0')}` });
    }),
    closeSession: vi.fn().mockResolvedValue({ closed: true }),
    generateTest: vi.fn().mockImplementation(() => {
      const response = options.generateTestResponses[generateTestIndex];
      if (!response) {
        throw new Error('No more mock generateTest responses');
      }
      generateTestIndex++;
      return Promise.resolve(response);
    }),
    generateArtifacts: vi.fn().mockResolvedValue(
      options.generateArtifactsResponse ?? {
        pomMd: '# POM',
        gherkinMd: '# Gherkin',
        cucumberMd: '# Cucumber',
        tokensUsed: 200,
      },
    ),
  };
}

function createMockTestExecutor(
  results: Array<{ passed: boolean; errorMessage?: string }>,
): Record<string, unknown> {
  let callIndex = 0;

  return {
    execute: vi.fn().mockImplementation((_code: string, testName: string) => {
      const result = results[callIndex];
      if (!result) {
        throw new Error('No more mock executor results');
      }
      callIndex++;
      return Promise.resolve({
        ...result,
        durationMs: 1000,
        filePath: `/tmp/generated/${testName}.spec.ts`,
      });
    }),
  };
}

function createContext(
  overrides: Partial<ReturnType<typeof createAgentContext>> = {},
): ReturnType<typeof createAgentContext> {
  return createAgentContext({
    rawInput: 'Login as admin',
    url: 'https://example.com',
    objective: 'Validate login',
    testName: 'login_test',
    explorationReport: createMockExplorationReport(),
    ...overrides,
  });
}

describe('GenerationAgent', () => {
  it('generates test and artifacts on first attempt', async () => {
    const aiClient = createMockAiClient({
      generateTestResponses: [{ code: 'test("login")', tokensUsed: 150 }],
    });
    const executor = createMockTestExecutor([{ passed: true }]);

    const agent = new GenerationAgent(aiClient as never, executor as never);
    const result = await agent.run(createContext());

    expect(result.generatedTest.code).toBe('test("login")');
    expect(result.generatedArtifacts.pomMd).toBe('# POM');
    expect(result.attempts).toBe(1);
    expect(result.totalTokensUsed).toBe(350);
  });

  it('retries when test fails and succeeds on second attempt', async () => {
    const aiClient = createMockAiClient({
      generateTestResponses: [
        { code: 'test("bad")', tokensUsed: 100 },
        { code: 'test("good")', tokensUsed: 120 },
      ],
    });
    const executor = createMockTestExecutor([
      { passed: false, errorMessage: 'Element not found' },
      { passed: true },
    ]);

    const agent = new GenerationAgent(aiClient as never, executor as never);
    const result = await agent.run(createContext());

    expect(result.generatedTest.code).toBe('test("good")');
    expect(result.attempts).toBe(2);
    expect(result.totalTokensUsed).toBe(420);
  });

  it('sends failure report on retry attempts', async () => {
    const aiClient = createMockAiClient({
      generateTestResponses: [
        { code: 'test("v1")', tokensUsed: 100 },
        { code: 'test("v2")', tokensUsed: 100 },
      ],
    });
    const executor = createMockTestExecutor([
      { passed: false, errorMessage: 'Locator timeout' },
      { passed: true },
    ]);

    const agent = new GenerationAgent(aiClient as never, executor as never);
    await agent.run(createContext());

    // First call should have no failureReport.
    const firstCall = (aiClient.generateTest as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { failureReport?: unknown },
    ];
    expect(firstCall[1].failureReport).toBeUndefined();

    // Second call should include the failure context.
    const secondCall = (aiClient.generateTest as ReturnType<typeof vi.fn>).mock.calls[1] as [
      string,
      { failureReport: { failedTest: string; errorMessage: string } },
    ];
    expect(secondCall[1].failureReport).toEqual({
      failedTest: 'test("v1")',
      errorMessage: 'Locator timeout',
    });
  });

  it('throws after maxGenerationAttempts exhausted', async () => {
    const aiClient = createMockAiClient({
      generateTestResponses: [
        { code: 'test("v1")', tokensUsed: 50 },
        { code: 'test("v2")', tokensUsed: 50 },
      ],
    });
    const executor = createMockTestExecutor([
      { passed: false, errorMessage: 'Error 1' },
      { passed: false, errorMessage: 'Error 2' },
    ]);

    const agent = new GenerationAgent(aiClient as never, executor as never);

    await expect(agent.run(createContext({ maxGenerationAttempts: 2 }))).rejects.toThrow(
      'Test generation failed after 2 attempts. Last error: Error 2',
    );
  });

  it('always closes sessions even on error', async () => {
    const aiClient = createMockAiClient({
      generateTestResponses: [{ code: 'test("x")', tokensUsed: 50 }],
    });
    (aiClient.generateTest as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('AI exploded'),
    );
    const executor = createMockTestExecutor([]);

    const agent = new GenerationAgent(aiClient as never, executor as never);

    await expect(agent.run(createContext())).rejects.toThrow('AI exploded');
    expect(aiClient.closeSession).toHaveBeenCalledWith('sess-gen-001');
  });

  it('creates fresh session for each retry attempt', async () => {
    const aiClient = createMockAiClient({
      generateTestResponses: [
        { code: 'test("v1")', tokensUsed: 50 },
        { code: 'test("v2")', tokensUsed: 50 },
      ],
    });
    const executor = createMockTestExecutor([
      { passed: false, errorMessage: 'Failed' },
      { passed: true },
    ]);

    const agent = new GenerationAgent(aiClient as never, executor as never);
    await agent.run(createContext());

    expect(aiClient.createSession).toHaveBeenCalledTimes(2);
    expect(aiClient.closeSession).toHaveBeenCalledTimes(2);
    expect(aiClient.closeSession).toHaveBeenCalledWith('sess-gen-001');
    expect(aiClient.closeSession).toHaveBeenCalledWith('sess-gen-002');
  });

  it('generates artifacts in the same session as successful test', async () => {
    const aiClient = createMockAiClient({
      generateTestResponses: [{ code: 'test("ok")', tokensUsed: 100 }],
    });
    const executor = createMockTestExecutor([{ passed: true }]);

    const agent = new GenerationAgent(aiClient as never, executor as never);
    await agent.run(createContext());

    const testCall = (aiClient.generateTest as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      unknown,
    ];
    const artifactsCall = (aiClient.generateArtifacts as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, unknown];
    expect(testCall[0]).toBe('sess-gen-001');
    expect(artifactsCall[0]).toBe('sess-gen-001');
  });

  it('throws when explorationReport is missing from context', async () => {
    const aiClient = createMockAiClient({ generateTestResponses: [] });
    const executor = createMockTestExecutor([]);

    const agent = new GenerationAgent(aiClient as never, executor as never);

    await expect(
      agent.run(createContext({ explorationReport: undefined })),
    ).rejects.toThrow('GenerationAgent requires an explorationReport in context');
  });

  it('passes modelStrong to AI client calls', async () => {
    const aiClient = createMockAiClient({
      generateTestResponses: [{ code: 'test("ok")', tokensUsed: 100 }],
    });
    const executor = createMockTestExecutor([{ passed: true }]);

    const agent = new GenerationAgent(aiClient as never, executor as never);
    await agent.run(createContext({ modelStrong: 'claude-sonnet-4-5' }));

    const testCall = (aiClient.generateTest as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { model: string },
    ];
    expect(testCall[1].model).toBe('claude-sonnet-4-5');

    const artifactsCall = (aiClient.generateArtifacts as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, { model: string }];
    expect(artifactsCall[1].model).toBe('claude-sonnet-4-5');
  });

  it('includes filePath in generated test result', async () => {
    const aiClient = createMockAiClient({
      generateTestResponses: [{ code: 'test("ok")', tokensUsed: 100 }],
    });
    const executor = createMockTestExecutor([{ passed: true }]);

    const agent = new GenerationAgent(aiClient as never, executor as never);
    const result = await agent.run(createContext());

    expect(result.generatedTest.filePath).toBe('/tmp/generated/login_test.spec.ts');
  });
});
