import { Command } from 'commander';

import { setupAddAction } from './setup-add.js';
import { setupListAction } from './setup-list.js';
import { setupRemoveAction } from './setup-remove.js';
import { setupTestAction } from './setup-test.js';

export function createSetupCommand(): Command {
  const setup = new Command('setup')
    .description('Manage authentication setups in ppia.yaml');

  setup
    .command('add')
    .description('Add a new setup interactively')
    .action(setupAddAction);

  setup
    .command('list')
    .description('List available setups from ppia.yaml')
    .action(setupListAction);

  setup
    .command('test')
    .description('Test a setup with a real browser')
    .argument('<env>', 'Environment name')
    .argument('<user>', 'User name')
    .action(setupTestAction);

  setup
    .command('remove')
    .description('Remove a setup from ppia.yaml')
    .argument('<env>', 'Environment name')
    .argument('<user>', 'User name')
    .action(setupRemoveAction);

  return setup;
}
