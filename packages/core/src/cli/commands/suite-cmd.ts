import { resolve } from 'node:path';

import { Command } from 'commander';

import { SuiteManager } from '../../suite/SuiteManager.js';
import * as ui from '../ui/ProgressDisplay.js';

function createManager(): SuiteManager {
  return new SuiteManager(resolve(process.cwd()));
}

function parseDuration(value: string): number | undefined {
  const match = /^(\d+)d$/.exec(value);
  if (!match?.[1]) {
    return undefined;
  }
  return parseInt(match[1], 10);
}

async function suiteListAction(): Promise<void> {
  const manager = createManager();
  const entries = await manager.list();

  if (entries.length === 0) {
    ui.info('No tests generated yet. Run "ppia generate" to create your first test.');
    return;
  }

  ui.header('Generated Tests');
  for (const entry of entries) {
    const date = entry.createdAt.split('T')[0] ?? entry.createdAt;
    ui.listItem(
      entry.testName,
      `v${String(entry.version)} | ${date} | ${entry.metrics.modelStrong} | ${ui.formatTokens(entry.metrics.totalTokensUsed)}`,
    );
  }
  ui.blank();
}

async function suiteShowAction(testName: string): Promise<void> {
  const manager = createManager();
  const entry = await manager.getById(testName);

  if (!entry) {
    ui.error(`Test "${testName}" not found in suite.`);
    process.exitCode = 1;
    return;
  }

  ui.header(`Test: ${entry.testName}`);
  ui.listItem('Description', entry.description);
  ui.listItem('URL', entry.url);
  ui.listItem('Version', String(entry.version));
  ui.listItem('Created', entry.createdAt);
  if (entry.testFilePath) {
    ui.listItem('File', entry.testFilePath);
  }

  ui.subheader('Metrics');
  ui.listItem('Tokens', ui.formatTokens(entry.metrics.totalTokensUsed));
  ui.listItem('Cost', ui.formatCost(entry.metrics.totalCost));
  ui.listItem('Models', `${entry.metrics.modelFast} / ${entry.metrics.modelStrong}`);
  ui.listItem('Exploration', `${String(entry.metrics.explorationRounds)} rounds`);
  ui.listItem('Generation', `${String(entry.metrics.generationAttempts)} attempt${entry.metrics.generationAttempts > 1 ? 's' : ''}`);

  ui.subheader('Test Code');
  console.log(entry.testCode);

  ui.blank();
}

async function suiteVersionsAction(testName: string): Promise<void> {
  const manager = createManager();
  const versions = await manager.getVersions(testName);

  if (versions.length === 0) {
    ui.error(`No versions found for "${testName}".`);
    process.exitCode = 1;
    return;
  }

  ui.header(`Versions: ${testName}`);
  for (const entry of versions) {
    const date = entry.createdAt.split('T')[0] ?? entry.createdAt;
    ui.listItem(
      `v${String(entry.version)}`,
      `${date} | ${ui.formatTokens(entry.metrics.totalTokensUsed)} | ${ui.formatCost(entry.metrics.totalCost)}`,
    );
  }
  ui.blank();
}

async function suiteCleanAction(opts: Record<string, unknown>): Promise<void> {
  const olderThan = typeof opts.olderThan === 'string' ? opts.olderThan : undefined;
  if (!olderThan) {
    ui.error('--older-than is required. Usage: ppia suite clean --older-than 30d');
    process.exitCode = 1;
    return;
  }

  const days = parseDuration(olderThan);
  if (days === undefined) {
    ui.error(`Invalid duration "${olderThan}". Use format: <number>d (e.g., 30d)`);
    process.exitCode = 1;
    return;
  }

  const manager = createManager();
  const removed = await manager.clean(days);

  if (removed === 0) {
    ui.info('No tests older than the specified threshold.');
  } else {
    ui.success(`Removed ${String(removed)} test${removed > 1 ? 's' : ''}.`);
  }
}

export function createSuiteCommand(): Command {
  const suite = new Command('suite')
    .description('View and manage generated test history');

  suite
    .command('list')
    .description('List all generated tests')
    .action(suiteListAction);

  suite
    .command('show')
    .description('Show details of a generated test')
    .argument('<testName>', 'Name of the test to show')
    .action(suiteShowAction);

  suite
    .command('versions')
    .description('Show version history of a test')
    .argument('<testName>', 'Name of the test')
    .action(suiteVersionsAction);

  suite
    .command('clean')
    .description('Remove old tests from the suite')
    .option('--older-than <duration>', 'Remove tests older than duration (e.g., 30d)')
    .action(async (opts: Record<string, unknown>) => {
      await suiteCleanAction(opts);
    });

  return suite;
}
