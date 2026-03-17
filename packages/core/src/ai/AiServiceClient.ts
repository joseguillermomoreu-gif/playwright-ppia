import { AiServiceError } from './AiServiceError.js';
import type {
  CloseSessionResponse,
  CreateSessionResponse,
  ExploreRequest,
  ExploreResponse,
  GenerateArtifactsRequest,
  GenerateArtifactsResponse,
  GenerateTestRequest,
  GenerateTestResponse,
  PingResponse,
  PrepareInputRequest,
  PrepareInputResponse,
  StartupInfoResponse,
} from './AiServiceTypes.js';

/**
 * Converts a camelCase key to snake_case.
 */
function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

/**
 * Converts a snake_case key to camelCase.
 */
function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

/**
 * Deep-converts all object keys using a transform function.
 */
function convertKeys(obj: unknown, transform: (key: string) => string): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeys(item, transform));
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[transform(key)] = convertKeys(value, transform);
    }
    return result;
  }
  return obj;
}

export class AiServiceClient {
  constructor(private readonly baseUrl: string) {}

  async ping(): Promise<PingResponse> {
    return this.get<PingResponse>('/ping');
  }

  async prepareInput(request: PrepareInputRequest): Promise<PrepareInputResponse> {
    return this.post<PrepareInputResponse>('/prepare-input', request);
  }

  async createSession(): Promise<CreateSessionResponse> {
    return this.post<CreateSessionResponse>('/session', {});
  }

  async closeSession(sessionId: string): Promise<CloseSessionResponse> {
    return this.delete<CloseSessionResponse>(`/session/${sessionId}`);
  }

  async explore(sessionId: string, request: ExploreRequest): Promise<ExploreResponse> {
    return this.post<ExploreResponse>(`/session/${sessionId}/explore`, request);
  }

  async generateTest(
    sessionId: string,
    request: GenerateTestRequest,
  ): Promise<GenerateTestResponse> {
    return this.post<GenerateTestResponse>(
      `/session/${sessionId}/generate-test`,
      request,
    );
  }

  async generateArtifacts(
    sessionId: string,
    request: GenerateArtifactsRequest,
  ): Promise<GenerateArtifactsResponse> {
    return this.post<GenerateArtifactsResponse>(
      `/session/${sessionId}/generate-artifacts`,
      request,
    );
  }

  async getStartupInfo(): Promise<StartupInfoResponse> {
    return this.get<StartupInfoResponse>('/startup-info');
  }

  async waitForReady(timeoutMs: number): Promise<void> {
    const maxAttempts = 10;
    const interval = 300;
    const deadline = Date.now() + timeoutMs;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (Date.now() > deadline) {
        break;
      }
      try {
        await this.ping();
        return;
      } catch {
        // Not ready yet
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, interval);
      });
    }

    throw new AiServiceError(
      `AI Service did not become ready within ${String(timeoutMs)}ms`,
      undefined,
      '/ping',
    );
  }

  private async get<T>(endpoint: string): Promise<T> {
    const response = await this.fetch(endpoint, { method: 'GET' });
    return this.handleResponse<T>(response, endpoint);
  }

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    const snakeBody = convertKeys(body, toSnakeCase);
    const response = await this.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snakeBody),
    });
    return this.handleResponse<T>(response, endpoint);
  }

  private async delete<T>(endpoint: string): Promise<T> {
    const response = await this.fetch(endpoint, { method: 'DELETE' });
    return this.handleResponse<T>(response, endpoint);
  }

  private async fetch(endpoint: string, init: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      return await fetch(url, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AiServiceError(
        `Failed to connect to AI Service at ${url}: ${message}`,
        undefined,
        endpoint,
      );
    }
  }

  private async handleResponse<T>(response: Response, endpoint: string): Promise<T> {
    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      throw new AiServiceError(
        `AI Service responded with ${String(response.status)}: ${text}`,
        response.status,
        endpoint,
      );
    }

    const json: unknown = await response.json();
    return convertKeys(json, toCamelCase) as T;
  }
}
