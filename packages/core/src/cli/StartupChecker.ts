import type { AiServiceClient } from '../ai/AiServiceClient.js';
import { PricingFetcher } from '../ai/PricingFetcher.js';
import type { ModelPricing } from '../ai/PricingFetcher.js';
import { estimateStartupCost } from '../domain/CostEstimator.js';
import type { CostEstimate } from '../domain/CostEstimator.js';
import { LastStartupStore } from './LastStartupStore.js';

export interface StartupResult {
  version: string;
  modelFast: string;
  modelStrong: string;
  prices: ModelPricing[];
  pricesCached: boolean;
  costEstimate: CostEstimate;
  skipped: boolean;
}

const EMPTY_COST: CostEstimate = { exploration: 0, generation: 0, total: 0 };

export class StartupChecker {
  constructor(
    private readonly projectRoot: string,
    private readonly aiClient: AiServiceClient,
  ) {}

  async run(estimatedActions: number): Promise<StartupResult> {
    const store = new LastStartupStore(this.projectRoot);

    if (await store.hasRanToday()) {
      return {
        version: '',
        modelFast: '',
        modelStrong: '',
        prices: [],
        pricesCached: false,
        costEstimate: EMPTY_COST,
        skipped: true,
      };
    }

    await this.aiClient.waitForReady(3000);

    const info = await this.aiClient.getStartupInfo();

    const fetcher = new PricingFetcher(this.projectRoot);
    const pricingResult = await fetcher.fetchPrices([info.modelFast, info.modelStrong]);

    const fastPrice = pricingResult.prices.find((p) => p.modelId === info.modelFast);
    const strongPrice = pricingResult.prices.find((p) => p.modelId === info.modelStrong);

    const costEstimate = estimateStartupCost(estimatedActions, {
      fast: fastPrice,
      strong: strongPrice,
    });

    return {
      version: info.version,
      modelFast: info.modelFast,
      modelStrong: info.modelStrong,
      prices: pricingResult.prices,
      pricesCached: pricingResult.cached,
      costEstimate,
      skipped: false,
    };
  }
}
