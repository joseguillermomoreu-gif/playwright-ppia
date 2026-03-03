export interface ExplorationRound {
  round: number;
  action: string;
  target: string;
  value: string | null;
  analysisSummary: string;
  tokensUsed: number;
  actionError?: string;
}

export interface LearnedSelector {
  description: string;
  selector: string;
  action: string;
}

export interface ExplorationReport {
  sessionId: string;
  rounds: ExplorationRound[];
  learnedSelectors: LearnedSelector[];
  completed: boolean;
  totalTokensUsed: number;
  totalRounds: number;
}
