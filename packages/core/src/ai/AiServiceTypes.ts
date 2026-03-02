// DTOs aligned 1:1 with Python Pydantic models (snake_case → camelCase).

export interface PingResponse {
  status: string;
  version: string;
}

// --- Session 0: Prepare Input ---

export interface PrepareInputRequest {
  rawInput: string;
  model?: string;
}

export interface PrepareInputResponse {
  url: string;
  objective: string;
  testName: string;
  parameters: Record<string, string>;
  tokensUsed: number;
}

// --- Session management ---

export interface CreateSessionResponse {
  sessionId: string;
}

export interface CloseSessionResponse {
  closed: boolean;
}

// --- Session A: Exploration ---

export interface ExploreRequest {
  html: string;
  context?: Record<string, string>;
  model?: string;
}

export interface ExploreResponse {
  action: string;
  target: string;
  value: string | null;
  completed: boolean;
  analysisSummary: string;
  tokensUsed: number;
}

// --- Session B: Generation ---

export interface GenerateTestRequest {
  explorationReport: Record<string, unknown>;
  failureReport?: Record<string, unknown> | null;
  model?: string;
}

export interface GenerateTestResponse {
  code: string;
  tokensUsed: number;
}

export interface GenerateArtifactsRequest {
  model?: string;
}

export interface GenerateArtifactsResponse {
  pomMd: string;
  gherkinMd: string;
  cucumberMd: string;
  tokensUsed: number;
}
