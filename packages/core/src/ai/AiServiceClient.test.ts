import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { AiServiceClient } from './AiServiceClient.js';
import { AiServiceError } from './AiServiceError.js';

// Minimal HTTP server that mimics the Python AI Service responses.
function createMockServer(): http.Server {
  return http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');

      const url = req.url ?? '';

      if (url === '/ping' && req.method === 'GET') {
        res.end(JSON.stringify({ status: 'ok', version: '0.1.0' }));
        return;
      }

      if (url === '/prepare-input' && req.method === 'POST') {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        if (!parsed.raw_input) {
          res.statusCode = 422;
          res.end(JSON.stringify({ detail: 'raw_input required' }));
          return;
        }
        res.end(JSON.stringify({
          url: 'https://example.com',
          objective: 'Login test',
          test_name: 'login_test',
          parameters: { user: 'admin' },
          tokens_used: 150,
        }));
        return;
      }

      if (url === '/session' && req.method === 'POST') {
        res.end(JSON.stringify({ session_id: 'sess-abc-123' }));
        return;
      }

      if (url.startsWith('/session/') && req.method === 'DELETE') {
        res.end(JSON.stringify({ closed: true }));
        return;
      }

      if (url.endsWith('/explore') && req.method === 'POST') {
        res.end(JSON.stringify({
          action: 'click',
          target: 'getByRole("button", { name: "Submit" })',
          value: null,
          completed: false,
          analysis_summary: 'Found submit button',
          tokens_used: 200,
        }));
        return;
      }

      if (url.endsWith('/generate-test') && req.method === 'POST') {
        res.end(JSON.stringify({
          code: 'import { test } from "@playwright/test";',
          tokens_used: 500,
        }));
        return;
      }

      if (url.endsWith('/generate-artifacts') && req.method === 'POST') {
        res.end(JSON.stringify({
          pom_md: '# POM',
          gherkin_md: '# Gherkin',
          cucumber_md: '# Cucumber',
          tokens_used: 300,
        }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ detail: 'Not found' }));
    });
  });
}

describe('AiServiceClient', () => {
  let server: http.Server;
  let client: AiServiceClient;

  beforeAll(async () => {
    server = createMockServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => { resolve(); });
    });
    const addr = server.address() as AddressInfo;
    client = new AiServiceClient(`http://127.0.0.1:${String(addr.port)}`);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => { resolve(); });
    });
  });

  it('ping returns status and version', async () => {
    const result = await client.ping();
    expect(result.status).toBe('ok');
    expect(result.version).toBe('0.1.0');
  });

  it('prepareInput sends camelCase and receives camelCase', async () => {
    const result = await client.prepareInput({ rawInput: 'Login as admin' });
    expect(result.url).toBe('https://example.com');
    expect(result.testName).toBe('login_test');
    expect(result.tokensUsed).toBe(150);
    expect(result.parameters).toEqual({ user: 'admin' });
  });

  it('createSession returns sessionId', async () => {
    const result = await client.createSession();
    expect(result.sessionId).toBe('sess-abc-123');
  });

  it('closeSession returns closed flag', async () => {
    const result = await client.closeSession('sess-abc-123');
    expect(result.closed).toBe(true);
  });

  it('explore returns action with camelCase keys', async () => {
    const result = await client.explore('sess-abc-123', {
      html: '<button>Submit</button>',
    });
    expect(result.action).toBe('click');
    expect(result.analysisSummary).toBe('Found submit button');
    expect(result.completed).toBe(false);
    expect(result.tokensUsed).toBe(200);
  });

  it('generateTest returns code', async () => {
    const result = await client.generateTest('sess-abc-123', {
      explorationReport: { steps: [] },
    });
    expect(result.code).toContain('@playwright/test');
    expect(result.tokensUsed).toBe(500);
  });

  it('generateArtifacts returns all three artifacts with camelCase', async () => {
    const result = await client.generateArtifacts('sess-abc-123', {});
    expect(result.pomMd).toBe('# POM');
    expect(result.gherkinMd).toBe('# Gherkin');
    expect(result.cucumberMd).toBe('# Cucumber');
    expect(result.tokensUsed).toBe(300);
  });

  it('throws AiServiceError on connection failure', async () => {
    const badClient = new AiServiceClient('http://127.0.0.1:1');
    await expect(badClient.ping()).rejects.toThrow(AiServiceError);
  });

  it('throws AiServiceError on non-OK response', async () => {
    await expect(
      client.prepareInput({ rawInput: '' }),
    ).rejects.toThrow(AiServiceError);
  });
});

describe('key conversion', () => {
  let server: http.Server;
  let client: AiServiceClient;

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        nested_object: { deep_key: 'value' },
        array_field: [{ item_name: 'a' }],
      }));
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => { resolve(); });
    });
    const addr = server.address() as AddressInfo;
    client = new AiServiceClient(`http://127.0.0.1:${String(addr.port)}`);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => { resolve(); });
    });
  });

  it('deeply converts snake_case response keys to camelCase', async () => {
    const result = await client.ping() as unknown as Record<string, unknown>;
    expect(result).toHaveProperty('nestedObject');
    expect(result).toHaveProperty('arrayField');
    const nested = result.nestedObject as Record<string, unknown>;
    expect(nested).toHaveProperty('deepKey', 'value');
    const arr = result.arrayField as Array<Record<string, unknown>>;
    expect(arr[0]).toHaveProperty('itemName', 'a');
  });
});

describe('request body conversion', () => {
  let server: http.Server;
  let client: AiServiceClient;
  let lastRequestBody: Record<string, unknown> | null = null;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        lastRequestBody = JSON.parse(body) as Record<string, unknown>;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ session_id: 'test' }));
      });
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => { resolve(); });
    });
    const addr = server.address() as AddressInfo;
    client = new AiServiceClient(`http://127.0.0.1:${String(addr.port)}`);
  });

  afterEach(() => {
    lastRequestBody = null;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => { resolve(); });
    });
  });

  it('converts camelCase request body to snake_case', async () => {
    await client.prepareInput({ rawInput: 'test input', model: 'gpt-4o' });
    expect(lastRequestBody).toHaveProperty('raw_input', 'test input');
    expect(lastRequestBody).toHaveProperty('model', 'gpt-4o');
  });
});

describe('PythonServerManager', () => {
  it('computes baseUrl correctly', async () => {
    const { PythonServerManager } = await import('./PythonServerManager.js');
    const manager = new PythonServerManager({ port: 9999, host: '0.0.0.0' });
    expect(manager.baseUrl).toBe('http://0.0.0.0:9999');
  });

  it('reports isRunning as false initially', async () => {
    const { PythonServerManager } = await import('./PythonServerManager.js');
    const manager = new PythonServerManager();
    expect(manager.isRunning).toBe(false);
  });

  it('stop resolves immediately when no process', async () => {
    const { PythonServerManager } = await import('./PythonServerManager.js');
    const manager = new PythonServerManager();
    await expect(manager.stop()).resolves.toBeUndefined();
  });
});
