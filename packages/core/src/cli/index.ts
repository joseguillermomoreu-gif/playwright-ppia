#!/usr/bin/env node

import { Command } from 'commander';

import { createConfigCommand } from './commands/config-cmd.js';
import { registerGenerateCommand } from './commands/generate.js';
import { registerInitCommand } from './commands/init.js';
import { createKnowledgeCommand } from './commands/knowledge.js';
import { createSetupCommand } from './commands/setup.js';
import { createSuiteCommand } from './commands/suite-cmd.js';

const program = new Command();

program
  .name('ppia')
  .description('AI-powered test generation for Playwright')
  .version('0.1.0');

registerInitCommand(program);
registerGenerateCommand(program);
program.addCommand(createSetupCommand());
program.addCommand(createKnowledgeCommand());
program.addCommand(createSuiteCommand());
program.addCommand(createConfigCommand());

program.parseAsync().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
