import { resolve } from 'node:path';

import { Command } from 'commander';

import { KnowledgeBase } from '../../suite/KnowledgeBase.js';
import * as ui from '../ui/ProgressDisplay.js';

function createKb(): KnowledgeBase {
  return new KnowledgeBase(resolve(process.cwd()));
}

async function knowledgeListAction(): Promise<void> {
  const kb = createKb();
  const entries = await kb.getAll();

  if (entries.length === 0) {
    ui.info('No knowledge entries yet. Run "ppia generate" to start learning.');
    return;
  }

  const byUrl = new Map<string, number>();
  for (const entry of entries) {
    byUrl.set(entry.url, (byUrl.get(entry.url) ?? 0) + 1);
  }

  ui.header('Knowledge Base');
  for (const [url, count] of byUrl) {
    ui.listItem(url, `${String(count)} selector${count > 1 ? 's' : ''}`);
  }
  ui.blank();
}

async function knowledgeShowAction(opts: Record<string, unknown>): Promise<void> {
  const url = typeof opts.url === 'string' ? opts.url : undefined;
  if (!url) {
    ui.error('--url is required. Usage: ppia knowledge show --url <url>');
    process.exitCode = 1;
    return;
  }

  const kb = createKb();
  const entries = await kb.getByUrl(url);

  if (entries.length === 0) {
    ui.info(`No selectors known for "${url}".`);
    return;
  }

  ui.header(`Selectors for ${url}`);
  for (const entry of entries) {
    ui.subheader(entry.elementDescription);
    ui.listItem('Reliable', entry.reliableSelector);
    if (entry.problematicSelectors.length > 0) {
      ui.listItem('Problematic', entry.problematicSelectors.join(', '));
    }
    ui.listItem('Learned from', `${entry.learnedFrom} (${entry.learnedAt})`);
  }
  ui.blank();
}

async function knowledgeResetAction(opts: Record<string, unknown>): Promise<void> {
  const kb = createKb();
  const url = typeof opts.url === 'string' ? opts.url : undefined;
  const path = typeof opts.path === 'string' ? opts.path : undefined;
  const deep = opts.deep === true;

  const count = await kb.reset(
    url ?? path ? { url, path, deep } : undefined,
  );

  if (count === 0) {
    ui.info('Nothing to reset.');
  } else {
    ui.success(`Removed ${String(count)} knowledge entr${count > 1 ? 'ies' : 'y'}.`);
  }
}

export function createKnowledgeCommand(): Command {
  const knowledge = new Command('knowledge')
    .description('View and manage the learned selectors knowledge base');

  knowledge
    .command('list')
    .description('List known URLs with selector count')
    .action(knowledgeListAction);

  knowledge
    .command('show')
    .description('Show validated selectors for a URL')
    .option('--url <url>', 'URL to show selectors for')
    .action(async (opts: Record<string, unknown>) => {
      await knowledgeShowAction(opts);
    });

  knowledge
    .command('reset')
    .description('Reset knowledge entries')
    .option('--url <url>', 'Exact URL to reset')
    .option('--path <path>', 'Path to reset')
    .option('--deep', 'Include sub-paths when using --path')
    .action(async (opts: Record<string, unknown>) => {
      await knowledgeResetAction(opts);
    });

  return knowledge;
}
