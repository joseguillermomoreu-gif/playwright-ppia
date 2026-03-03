import type { GeneratedArtifacts, GeneratedTest } from './AgentContext.js';

export interface GenerationResult {
  generatedTest: GeneratedTest;
  generatedArtifacts: GeneratedArtifacts;
  totalTokensUsed: number;
  attempts: number;
}
