import type { ModelPricing } from '../ai/PricingFetcher.js';

const AVG_TOKENS_PER_ACTION = 2_500;
const AVG_TOKENS_GENERATION = 8_000;

export interface CostEstimate {
  exploration: number;
  generation: number;
  total: number;
}

export function estimateStartupCost(
  estimatedActions: number,
  prices: { fast: ModelPricing | undefined; strong: ModelPricing | undefined },
): CostEstimate {
  const exploration = prices.fast
    ? estimatedActions * AVG_TOKENS_PER_ACTION * prices.fast.inputUsdPerToken
    : 0;

  const generation = prices.strong
    ? AVG_TOKENS_GENERATION * prices.strong.inputUsdPerToken
    : 0;

  return {
    exploration,
    generation,
    total: exploration + generation,
  };
}
