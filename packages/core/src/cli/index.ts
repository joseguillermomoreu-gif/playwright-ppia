#!/usr/bin/env node

import { Command } from 'commander';

import { createSetupCommand } from './commands/setup.js';

const program = new Command();

program
  .name('ppia')
  .description('AI-powered test generation for Playwright')
  .version('0.1.0');

program.addCommand(createSetupCommand());

program.parseAsync().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
