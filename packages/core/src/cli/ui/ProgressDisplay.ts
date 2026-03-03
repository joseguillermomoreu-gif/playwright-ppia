import chalk from 'chalk';

// ── Basic UI ──────────────────────────────────────────────────────────

export function header(title: string): void {
  console.log();
  console.log(chalk.bold(`\u2726 ${title}`));
  console.log(chalk.dim(`  ${'─'.repeat(50)}`));
}

export function subheader(title: string): void {
  console.log();
  console.log(chalk.bold(`  ${title}`));
}

export function info(message: string): void {
  console.log(`  ${chalk.cyan('ℹ')} ${message}`);
}

export function success(message: string): void {
  console.log(`  ${chalk.green('✓')} ${message}`);
}

export function error(message: string): void {
  console.error(`  ${chalk.red('✗')} ${message}`);
}

export function warn(message: string): void {
  console.log(`  ${chalk.yellow('!')} ${message}`);
}

export function listItem(label: string, value: string): void {
  console.log(`    ${chalk.cyan(label)}  ${chalk.dim(value)}`);
}

export function blank(): void {
  console.log();
}

// ── Cost estimation ───────────────────────────────────────────────────

// Blended rate per token (approximate input/output average) in USD.
const MODEL_RATES: Record<string, number> = {
  'gpt-4o-mini': 0.3e-6,
  'gpt-4o': 5.0e-6,
  'claude-haiku-4-5': 2.0e-6,
  'claude-sonnet-4-5': 6.0e-6,
  'claude-sonnet-4-6': 6.0e-6,
  'claude-opus-4-6': 30.0e-6,
};

const DEFAULT_RATE = 3.0e-6;

export function estimateCost(model: string, tokens: number): number {
  const rate = MODEL_RATES[model] ?? DEFAULT_RATE;
  return tokens * rate;
}

export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `~$${cost.toFixed(5)}`;
  }
  return `~$${cost.toFixed(3)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k tok`;
  }
  return `${String(tokens)} tok`;
}

// ── Generate progress ─────────────────────────────────────────────────

export function phaseRow(phase: string, detail: string, model: string, tokens: number): void {
  const cost = estimateCost(model, tokens);
  console.log(
    `  ${chalk.cyan('◉')} ` +
    `${phase.padEnd(15)} ` +
    `${detail.padEnd(16)} ` +
    `${chalk.dim(model.padEnd(18))} ` +
    `${formatTokens(tokens).padStart(10)}   ` +
    chalk.dim(formatCost(cost)),
  );
}

export function separator(): void {
  console.log(chalk.dim(`  ${'─'.repeat(50)}`));
}

export interface GenerateSummary {
  totalTokens: number;
  totalCost: number;
  explorationRounds: number;
  generationAttempts: number;
  testPath: string;
}

export function generateSummary(summary: GenerateSummary): void {
  blank();
  success(
    `Test generated  |  ${formatTokens(summary.totalTokens)}  |  ${formatCost(summary.totalCost)}`,
  );
  listItem('Exploration', `${String(summary.explorationRounds)} rounds`);
  listItem('Generation', `${String(summary.generationAttempts)} attempt${summary.generationAttempts > 1 ? 's' : ''}`);
  if (summary.testPath) {
    listItem('Output', summary.testPath);
  }
  blank();
}
