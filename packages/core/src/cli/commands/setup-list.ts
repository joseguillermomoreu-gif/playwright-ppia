import { resolve } from 'node:path';

import { loadProjectConfig, ProjectConfigError } from '../../config/ProjectConfig.js';
import * as ui from '../ui/ProgressDisplay.js';

export async function setupListAction(): Promise<void> {
  const configPath = resolve(process.cwd(), 'ppia.yaml');

  try {
    const config = await loadProjectConfig(configPath);

    ui.header(`${config.projectName} — Setups`);

    if (config.environments.length === 0 && config.users.length === 0) {
      ui.warn('No setups configured. Run "ppia setup add" to create one.');
      return;
    }

    if (config.environments.length > 0) {
      ui.subheader('Environments');
      for (const env of config.environments) {
        const extra = env.cookies ? ` (cookies: ${env.cookies})` : '';
        ui.listItem(env.name, `${env.baseUrl}${extra}`);
      }
    }

    if (config.users.length > 0) {
      ui.subheader('Users');
      for (const user of config.users) {
        const details: string[] = [user.authFlow];
        if (user.role) {
          details.push(user.role);
        }
        if (user.email) {
          details.push(user.email);
        }
        if (user.loginSelectors) {
          details.push('selectors: custom');
        }
        ui.listItem(user.name, details.join(' | '));
      }
    }

    if (config.setupCombinations.length > 0) {
      ui.subheader('Combinations');
      for (const combo of config.setupCombinations) {
        ui.listItem(combo.environment, combo.users.join(', '));
      }
    }

    ui.blank();
  } catch (err) {
    if (err instanceof ProjectConfigError) {
      ui.error(err.message);
    } else {
      throw err;
    }
  }
}
