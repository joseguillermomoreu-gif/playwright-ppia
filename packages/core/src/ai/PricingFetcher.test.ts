import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PricingFetcher } from './PricingFetcher.js';

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Get mocked references
const fsMock = await import('node:fs/promises');
const readFileMock = vi.mocked(fsMock.readFile);

// Store original fetch
const originalFetch = globalThis.fetch;

describe('PricingFetcher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('returns cached prices when cache is fresh today', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const cacheData = {
      fetched_at: today,
      models: {
        'gpt-4o-mini': {
          modelId: 'gpt-4o-mini',
          inputUsdPerToken: 0.00000015,
          outputUsdPerToken: 0.0000006,
        },
        'gpt-4o': {
          modelId: 'gpt-4o',
          inputUsdPerToken: 0.000005,
          outputUsdPerToken: 0.000015,
        },
      },
    };

    readFileMock.mockResolvedValueOnce(JSON.stringify(cacheData));

    const fetcher = new PricingFetcher('/fake/project');
    const result = await fetcher.fetchPrices(['gpt-4o-mini', 'gpt-4o']);

    expect(result.cached).toBe(true);
    expect(result.prices).toHaveLength(2);
    expect(result.prices[0]?.modelId).toBe('gpt-4o-mini');
    expect(result.prices[1]?.modelId).toBe('gpt-4o');
  });

  it('fetches from network when cache is missing', async () => {
    // Cache miss
    readFileMock.mockRejectedValueOnce(new Error('ENOENT'));

    const openRouterResponse = {
      data: [
        {
          id: 'openai/gpt-4o-mini',
          pricing: { prompt: '0.00000015', completion: '0.0000006' },
          context_length: 128000,
        },
        {
          id: 'openai/gpt-4o',
          pricing: { prompt: '0.000005', completion: '0.000015' },
          context_length: 128000,
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      json: () => Promise.resolve(openRouterResponse),
    } as unknown as Response);

    const fetcher = new PricingFetcher('/fake/project');
    const result = await fetcher.fetchPrices(['gpt-4o-mini', 'gpt-4o']);

    expect(result.cached).toBe(false);
    expect(result.prices).toHaveLength(2);
    expect(result.prices[0]?.modelId).toBe('gpt-4o-mini');
    expect(result.prices[0]?.inputUsdPerToken).toBe(0.00000015);
    expect(result.prices[1]?.modelId).toBe('gpt-4o');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models',
      expect.objectContaining({ signal: expect.anything() as AbortSignal }),
    );
  });

  it('returns empty prices on network error', async () => {
    // Cache miss
    readFileMock.mockRejectedValueOnce(new Error('ENOENT'));

    // Network error
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network failure'));

    const fetcher = new PricingFetcher('/fake/project');
    const result = await fetcher.fetchPrices(['gpt-4o-mini']);

    expect(result.cached).toBe(false);
    expect(result.prices).toHaveLength(0);
  });
});
