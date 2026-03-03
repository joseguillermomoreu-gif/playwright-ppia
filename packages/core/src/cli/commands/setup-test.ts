import { resolve } from 'node:path';

import { ActionExecutor } from '../../browser/ActionExecutor.js';
import { BrowserManager } from '../../browser/BrowserManager.js';
import { loadProjectConfig, ProjectConfigError } from '../../config/ProjectConfig.js';
import { SetupManager } from '../../config/SetupManager.js';
import * as ui from '../ui/ProgressDisplay.js';

export async function setupTestAction(envName: string, userName: string): Promise<void> {
  const configPath = resolve(process.cwd(), 'ppia.yaml');

  ui.header('ppia setup — Test');
  ui.info(`Testing setup: ${envName} / ${userName}`);

  let config;
  try {
    config = await loadProjectConfig(configPath);
  } catch (err) {
    if (err instanceof ProjectConfigError) {
      ui.error(err.message);
      return;
    }
    throw err;
  }

  const browser = new BrowserManager({ headless: false, slowMo: 100 });

  try {
    ui.info('Launching browser...');
    const page = await browser.launch();
    const actionExecutor = new ActionExecutor(page);
    const setupManager = new SetupManager(config, actionExecutor, page);

    const setup = setupManager.loadSetup(envName, userName);
    ui.info(`Authenticating as "${userName}" on "${envName}" (${setup.environment.baseUrl})...`);

    await setupManager.authenticate(setup);

    ui.success('Authentication completed successfully');
    ui.info(`Final URL: ${page.url()}`);
    ui.blank();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ui.error(`Authentication failed: ${message}`);
  } finally {
    await browser.close();
  }
}
