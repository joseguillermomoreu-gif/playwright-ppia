import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StartupResult } from '../StartupChecker.js';
import { renderStartupPanel } from './ProgressDisplay.js';

// Capture console output
let consoleOutput: string[];
const originalLog = console.log;
const originalError = console.error;

beforeEach(() => {
  consoleOutput = [];
  console.log = (...args: unknown[]): void => {
    consoleOutput.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]): void => {
    consoleOutput.push(args.map(String).join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
  vi.unstubAllEnvs();
});

function buildResult(overrides: Partial<StartupResult> = {}): StartupResult {
  return {
    version: '0.1.0',
    modelFast: 'gpt-4o-mini',
    modelStrong: 'claude-haiku-4-5',
    prices: [
      { modelId: 'gpt-4o-mini', inputUsdPerToken: 0.00000015, outputUsdPerToken: 0.0000006 },
      { modelId: 'claude-haiku-4-5', inputUsdPerToken: 0.000001, outputUsdPerToken: 0.000005 },
    ],
    pricesCached: false,
    costEstimate: { exploration: 0.01, generation: 0.08, total: 0.09 },
    skipped: false,
    ...overrides,
  };
}

describe('renderStartupPanel', () => {
  it('renders nothing when result is skipped', () => {
    renderStartupPanel(buildResult({ skipped: true }));
    expect(consoleOutput).toHaveLength(0);
  });

  it('renders version in header', () => {
    renderStartupPanel(buildResult());
    const joined = consoleOutput.join('\n');
    expect(joined).toContain('0.1.0');
  });

  it('renders model prices', () => {
    renderStartupPanel(buildResult());
    const joined = consoleOutput.join('\n');
    expect(joined).toContain('gpt-4o-mini');
    expect(joined).toContain('claude-haiku-4-5');
  });

  it('renders cost estimate with total', () => {
    renderStartupPanel(buildResult());
    const joined = consoleOutput.join('\n');
    expect(joined).toContain('Exploration');
    expect(joined).toContain('Generation');
    expect(joined).toContain('Total estimated');
  });

  it('shows (cached) suffix when pricesCached is true', () => {
    renderStartupPanel(buildResult({ pricesCached: true }));
    const joined = consoleOutput.join('\n');
    expect(joined).toContain('cached');
  });

  it('does not show (cached) suffix when pricesCached is false', () => {
    renderStartupPanel(buildResult({ pricesCached: false }));
    const joined = consoleOutput.join('\n');
    // The word "cached" should not appear (excluding any other context)
    expect(joined).not.toContain('cached');
  });

  it('never renders API key values', () => {
    const dummyKey = 'sk-SUPERSECRETKEY12345';
    vi.stubEnv('OPENAI_API_KEY', dummyKey);
    vi.stubEnv('ANTHROPIC_API_KEY', dummyKey);

    renderStartupPanel(buildResult());
    const joined = consoleOutput.join('\n');
    expect(joined).not.toContain(dummyKey);
    expect(joined).toContain('configured');
  });

  it('shows not set when API keys are missing', () => {
    delete process.env['OPENAI_API_KEY'];
    delete process.env['ANTHROPIC_API_KEY'];

    renderStartupPanel(buildResult());
    const joined = consoleOutput.join('\n');
    expect(joined).toContain('not set');
  });

  it('shows prices unavailable when prices array is empty', () => {
    renderStartupPanel(buildResult({ prices: [] }));
    const joined = consoleOutput.join('\n');
    expect(joined).toContain('prices unavailable');
  });
});
