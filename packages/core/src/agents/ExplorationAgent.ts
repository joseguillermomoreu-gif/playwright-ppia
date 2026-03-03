import type { AiServiceClient } from '../ai/AiServiceClient.js';
import type { ActionExecutor } from '../browser/ActionExecutor.js';
import type { HtmlExtractor } from '../browser/HtmlExtractor.js';
import type { AgentContext } from '../domain/AgentContext.js';
import type {
  ExplorationReport,
  ExplorationRound,
  LearnedSelector,
} from '../domain/ExplorationReport.js';
import type { Page } from 'playwright';

export type ExplorationProgressCallback = (round: ExplorationRound) => void;

export class ExplorationAgent {
  constructor(
    private readonly aiClient: AiServiceClient,
    private readonly htmlExtractor: HtmlExtractor,
    private readonly actionExecutor: ActionExecutor,
    private readonly page: Page,
  ) {}

  async run(
    context: AgentContext,
    onProgress?: ExplorationProgressCallback,
  ): Promise<ExplorationReport> {
    const { sessionId } = await this.aiClient.createSession();
    const rounds: ExplorationRound[] = [];
    let completed = false;
    let totalTokensUsed = 0;
    let lastActionError: string | undefined;

    try {
      for (let i = 0; i < context.maxIterations; i++) {
        const html = await this.htmlExtractor.extract(this.page);

        const exploreContext: Record<string, string> = {
          objective: context.objective,
          url: context.url,
          currentUrl: this.page.url(),
        };

        if (lastActionError) {
          exploreContext.lastActionError = lastActionError;
        }

        const response = await this.aiClient.explore(sessionId, {
          html,
          context: exploreContext,
          model: context.modelFast,
        });

        totalTokensUsed += response.tokensUsed;

        const round: ExplorationRound = {
          round: i + 1,
          action: response.action,
          target: response.target,
          value: response.value,
          analysisSummary: response.analysisSummary,
          tokensUsed: response.tokensUsed,
        };

        if (response.completed) {
          completed = true;
          rounds.push(round);
          onProgress?.(round);
          break;
        }

        // Execute action and capture errors for the next round.
        lastActionError = undefined;
        try {
          await this.actionExecutor.execute({
            action: response.action as 'click' | 'fill' | 'navigate' | 'wait' | 'scroll',
            target: response.target,
            value: response.value,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          lastActionError = message;
          round.actionError = message;
        }

        rounds.push(round);
        onProgress?.(round);
      }

      if (!completed) {
        throw new Error(
          `Exploration did not complete within ${String(context.maxIterations)} iterations. ` +
          `Completed ${String(rounds.length)} rounds. Last action: "${rounds[rounds.length - 1]?.action ?? 'none'}"`,
        );
      }

      const learnedSelectors = ExplorationAgent.extractLearnedSelectors(rounds);

      return {
        sessionId,
        rounds,
        learnedSelectors,
        completed,
        totalTokensUsed,
        totalRounds: rounds.length,
      };
    } finally {
      await this.aiClient.closeSession(sessionId).catch(() => {
        // Best effort — don't mask the original error.
      });
    }
  }

  private static extractLearnedSelectors(rounds: ExplorationRound[]): LearnedSelector[] {
    const selectors: LearnedSelector[] = [];
    const seen = new Set<string>();

    for (const round of rounds) {
      if (!round.actionError && round.target && !seen.has(round.target)) {
        seen.add(round.target);
        selectors.push({
          description: round.analysisSummary,
          selector: round.target,
          action: round.action,
        });
      }
    }

    return selectors;
  }
}
