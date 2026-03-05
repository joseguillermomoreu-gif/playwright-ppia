import { resolve } from 'node:path';

import { Command } from 'commander';

import {
  loadProjectConfig,
  ProjectConfigError,
  resolveEnvVars,
} from '../../config/ProjectConfig.js';
import * as ui from '../ui/ProgressDisplay.js';

async function configValidateAction(): Promise<void> {
  const configPath = resolve(process.cwd(), 'ppia.yaml');

  try {
    const config = await loadProjectConfig(configPath);
    ui.success(`Config valid: ${config.projectName}`);
    ui.listItem('Environments', String(config.environments.length));
    ui.listItem('Users', String(config.users.length));
    ui.listItem('Combinations', String(config.setupCombinations.length));
    ui.blank();
  } catch (err) {
    if (err instanceof ProjectConfigError) {
      ui.error(`Validation failed: ${err.message}`);
      if (err.field) {
        ui.listItem('Field', err.field);
      }
    } else {
      throw err;
    }
    process.exitCode = 1;
  }
}

async function configSetupsAction(): Promise<void> {
  const configPath = resolve(process.cwd(), 'ppia.yaml');

  try {
    const config = await loadProjectConfig(configPath);

    if (config.setupCombinations.length === 0) {
      ui.info('No setup combinations defined. Run "ppia setup add" to create one.');
      return;
    }

    ui.header(`${config.projectName} — Setup Status`);

    for (const combo of config.setupCombinations) {
      const env = config.environments.find((e) => e.name === combo.environment);
      if (!env) {
        ui.listItem(combo.environment, 'environment not found');
        continue;
      }

      for (const userName of combo.users) {
        const user = config.users.find((u) => u.name === userName);
        if (!user) {
          ui.listItem(`${combo.environment}/${userName}`, 'user not found');
          continue;
        }

        const issues: string[] = [];
        checkEnvVar(user.email, issues);
        checkEnvVar(user.password, issues);

        const status = issues.length === 0 ? 'ok' : issues.join(', ');
        const icon = issues.length === 0 ? 'ok' : `missing: ${status}`;
        ui.listItem(`${combo.environment}/${userName}`, icon);
      }
    }

    ui.blank();
  } catch (err) {
    if (err instanceof ProjectConfigError) {
      ui.error(err.message);
    } else {
      throw err;
    }
    process.exitCode = 1;
  }
}

function checkEnvVar(value: string | undefined, issues: string[]): void {
  if (!value) {
    return;
  }
  const envVarPattern = /\$\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = envVarPattern.exec(value)) !== null) {
    const varName = match[1];
    if (varName) {
      try {
        resolveEnvVars(`\${${varName}}`);
      } catch {
        issues.push(`$\{${varName}}`);
      }
    }
  }
}

export function createConfigCommand(): Command {
  const config = new Command('config')
    .description('Validate and inspect project configuration');

  config
    .command('validate')
    .description('Validate ppia.yaml schema, env vars and setup references')
    .action(configValidateAction);

  config
    .command('setups')
    .description('List defined setups with environment variable status')
    .action(configSetupsAction);

  return config;
}
