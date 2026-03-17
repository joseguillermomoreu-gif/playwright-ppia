import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface ModelPricing {
  modelId: string;
  inputUsdPerToken: number;
  outputUsdPerToken: number;
}

export interface PricingResult {
  prices: ModelPricing[];
  cached: boolean;
}

interface CacheSchema {
  fetched_at: string;
  models: Record<string, ModelPricing>;
}

interface OpenRouterModel {
  id: string;
  pricing: { prompt: string; completion: string };
  context_length: number;
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeId(openRouterId: string): string {
  const slashIndex = openRouterId.indexOf('/');
  return slashIndex >= 0 ? openRouterId.slice(slashIndex + 1) : openRouterId;
}

export class PricingFetcher {
  private readonly cachePath: string;

  constructor(private readonly projectRoot: string) {
    this.cachePath = join(projectRoot, '.ppia', 'llm-pricing.json');
  }

  async fetchPrices(modelIds: string[]): Promise<PricingResult> {
    try {
      return await this.doFetch(modelIds);
    } catch {
      return { prices: [], cached: false };
    }
  }

  private async doFetch(modelIds: string[]): Promise<PricingResult> {
    // Try cache first
    const cache = await this.readCache();
    if (cache !== null && cache.fetched_at === todayUTC()) {
      const prices = modelIds
        .map((id) => cache.models[id])
        .filter((p): p is ModelPricing => p !== undefined);
      return { prices, cached: true };
    }

    // Fetch from network
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, 2000);

    let response: Response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/models', {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const body = (await response.json()) as OpenRouterResponse;

    // Build models map
    const models: Record<string, ModelPricing> = {};
    for (const model of body.data) {
      const normalId = normalizeId(model.id);
      models[normalId] = {
        modelId: normalId,
        inputUsdPerToken: Number(model.pricing.prompt),
        outputUsdPerToken: Number(model.pricing.completion),
      };
    }

    // Atomic write
    const newCache: CacheSchema = { fetched_at: todayUTC(), models };
    const dir = dirname(this.cachePath);
    await mkdir(dir, { recursive: true });
    const tmpPath = `${this.cachePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(newCache), 'utf-8');
    await rename(tmpPath, this.cachePath);

    const prices = modelIds
      .map((id) => models[id])
      .filter((p): p is ModelPricing => p !== undefined);
    return { prices, cached: false };
  }

  private async readCache(): Promise<CacheSchema | null> {
    try {
      const raw = await readFile(this.cachePath, 'utf-8');
      return JSON.parse(raw) as CacheSchema;
    } catch {
      return null;
    }
  }
}
