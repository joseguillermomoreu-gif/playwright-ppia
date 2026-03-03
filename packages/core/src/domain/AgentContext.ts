import type { ExplorationReport } from './ExplorationReport.js';

export interface GeneratedTest {
  code: string;
  filePath?: string;
  tokensUsed: number;
}

export interface GeneratedArtifacts {
  pomMd: string;
  gherkinMd: string;
  cucumberMd: string;
  tokensUsed: number;
}

export interface AgentMetrics {
  totalTokensUsed: number;
  totalTimeMs: number;
  explorationRounds: number;
  generationAttempts: number;
}

export interface AgentContext {
  rawInput: string;
  url: string;
  objective: string;
  testName: string;
  parameters: Record<string, string>;
  modelFast: string;
  modelStrong: string;
  maxIterations: number;
  maxGenerationAttempts: number;
  explorationReport?: ExplorationReport;
  generatedTest?: GeneratedTest;
  generatedArtifacts?: GeneratedArtifacts;
  generationAttempts: number;
  metrics: AgentMetrics;
}

export function createAgentContext(partial: Partial<AgentContext> & {
  rawInput: string;
  url: string;
  objective: string;
  testName: string;
}): AgentContext {
  return {
    parameters: {},
    modelFast: 'gpt-4o-mini',
    modelStrong: 'gpt-4o',
    maxIterations: 25,
    maxGenerationAttempts: 3,
    generationAttempts: 0,
    metrics: {
      totalTokensUsed: 0,
      totalTimeMs: 0,
      explorationRounds: 0,
      generationAttempts: 0,
    },
    ...partial,
  };
}
