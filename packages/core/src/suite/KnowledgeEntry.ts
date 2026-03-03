export interface KnowledgeEntry {
  url: string;
  elementDescription: string;
  reliableSelector: string;
  problematicSelectors: string[];
  learnedFrom: string;
  learnedAt: string;
}

export interface ResetOptions {
  url?: string;
  path?: string;
  deep?: boolean;
}
