import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiServiceClient } from '../ai/AiServiceClient.js';
import type { PricingResult } from '../ai/PricingFetcher.js';
import { StartupChecker } from './StartupChecker.js';

// Mock LastStartupStore
const mockHasRanToday = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
const mockMarkRan = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
vi.mock('./LastStartupStore.js', () => ({
  LastStartupStore: vi.fn().mockImplementation(() => ({
    hasRanToday: mockHasRanToday,
    markRan: mockMarkRan,
  })),
}));

// Mock PricingFetcher
const mockFetchPrices = vi.fn<(ids: string[]) => Promise<PricingResult>>();
vi.mock('../ai/PricingFetcher.js', () => ({
  PricingFetcher: vi.fn().mockImplementation(() => ({
    fetchPrices: mockFetchPrices,
  })),
}));

function buildMockClient(overrides: Partial<AiServiceClient> = {}): AiServiceClient {
  return {
    waitForReady: vi.fn().mockResolvedValue(undefined),
    getStartupInfo: vi.fn().mockResolvedValue({
      version: '0.1.0',
      modelFast: 'gpt-4o-mini',
      modelStrong: 'claude-haiku-4-5',
    }),
    ...overrides,
  } as unknown as AiServiceClient;
}

describe('StartupChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasRanToday.mockResolvedValue(false);
    mockFetchPrices.mockResolvedValue({
      prices: [
        { modelId: 'gpt-4o-mini', inputUsdPerToken: 0.00000015, outputUsdPerToken: 0.0000006 },
        { modelId: 'claude-haiku-4-5', inputUsdPerToken: 0.000001, outputUsdPerToken: 0.000005 },
      ],
      cached: false,
    });
  });

  it('skips startup when hasRanToday returns true', async () => {
    mockHasRanToday.mockResolvedValueOnce(true);
    const mockClient = buildMockClient();

    const checker = new StartupChecker('/fake', mockClient);
    const result = await checker.run(10);

    expect(result.skipped).toBe(true);
    expect(mockClient.waitForReady).not.toHaveBeenCalled();
  });

  it('does not call fetchPrices when skipped', async () => {
    mockHasRanToday.mockResolvedValueOnce(true);
    const mockClient = buildMockClient();

    const checker = new StartupChecker('/fake', mockClient);
    await checker.run(10);

    expect(mockFetchPrices).not.toHaveBeenCalled();
  });

  it('returns full result when first run today', async () => {
    const mockClient = buildMockClient();
    const checker = new StartupChecker('/fake', mockClient);
    const result = await checker.run(12);

    expect(result.skipped).toBe(false);
    expect(result.version).toBe('0.1.0');
    expect(result.modelFast).toBe('gpt-4o-mini');
    expect(result.modelStrong).toBe('claude-haiku-4-5');
    expect(result.prices).toHaveLength(2);
    expect(result.costEstimate.total).toBeGreaterThan(0);
  });

  it('reports pricesCached when PricingFetcher returns cached', async () => {
    mockFetchPrices.mockResolvedValueOnce({
      prices: [
        { modelId: 'gpt-4o-mini', inputUsdPerToken: 0.00000015, outputUsdPerToken: 0.0000006 },
      ],
      cached: true,
    });

    const mockClient = buildMockClient();
    const checker = new StartupChecker('/fake', mockClient);
    const result = await checker.run(10);

    expect(result.pricesCached).toBe(true);
  });
});
