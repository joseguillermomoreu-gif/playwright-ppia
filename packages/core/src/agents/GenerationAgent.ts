import type { AiServiceClient } from '../ai/AiServiceClient.js';
import type { GenerateTestRequest } from '../ai/AiServiceTypes.js';
import type { AgentContext } from '../domain/AgentContext.js';
import type { GenerationResult } from '../domain/GenerationResult.js';
import type { TestExecutor } from '../executor/TestExecutor.js';

export class GenerationAgent {
  constructor(
    private readonly aiClient: AiServiceClient,
    private readonly testExecutor: TestExecutor,
  ) {}

  async run(context: AgentContext): Promise<GenerationResult> {
    if (!context.explorationReport) {
      throw new Error('GenerationAgent requires an explorationReport in context');
    }

    let totalTokensUsed = 0;
    let lastFailedCode: string | undefined;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= context.maxGenerationAttempts; attempt++) {
      const { sessionId } = await this.aiClient.createSession();

      try {
        const request: GenerateTestRequest = {
          explorationReport: context.explorationReport as unknown as Record<string, unknown>,
          model: context.modelStrong,
        };

        if (lastFailedCode && lastError) {
          request.failureReport = {
            failedTest: lastFailedCode,
            errorMessage: lastError,
          };
        }

        const testResponse = await this.aiClient.generateTest(sessionId, request);
        totalTokensUsed += testResponse.tokensUsed;

        const result = await this.testExecutor.execute(testResponse.code, context.testName);

        if (result.passed) {
          const artifactsResponse = await this.aiClient.generateArtifacts(sessionId, {
            model: context.modelStrong,
          });
          totalTokensUsed += artifactsResponse.tokensUsed;

          return {
            generatedTest: {
              code: testResponse.code,
              filePath: result.filePath,
              tokensUsed: testResponse.tokensUsed,
            },
            generatedArtifacts: {
              pomMd: artifactsResponse.pomMd,
              gherkinMd: artifactsResponse.gherkinMd,
              cucumberMd: artifactsResponse.cucumberMd,
              tokensUsed: artifactsResponse.tokensUsed,
            },
            totalTokensUsed,
            attempts: attempt,
          };
        }

        lastFailedCode = testResponse.code;
        lastError = result.errorMessage ?? 'Test failed with unknown error';
      } finally {
        await this.aiClient.closeSession(sessionId).catch(() => {
          // Best effort — don't mask the original error.
        });
      }
    }

    throw new Error(
      `Test generation failed after ${String(context.maxGenerationAttempts)} attempts. ` +
      `Last error: ${lastError ?? 'unknown'}`,
    );
  }
}
