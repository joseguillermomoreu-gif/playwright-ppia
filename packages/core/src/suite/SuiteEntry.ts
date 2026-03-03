export interface SuiteEntryMetrics {
  totalTokensUsed: number;
  totalCost: number;
  modelFast: string;
  modelStrong: string;
  explorationRounds: number;
  generationAttempts: number;
  timestamp: string;
}

export interface SuiteEntryArtifacts {
  pomMd: string;
  gherkinMd: string;
  cucumberMd: string;
}

export interface SuiteEntry {
  id: string;
  testName: string;
  description: string;
  url: string;
  testCode: string;
  testFilePath?: string;
  artifacts: SuiteEntryArtifacts;
  metrics: SuiteEntryMetrics;
  version: number;
  createdAt: string;
}
