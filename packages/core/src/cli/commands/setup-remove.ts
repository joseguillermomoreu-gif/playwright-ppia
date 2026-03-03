import { resolve } from 'node:path';

import { ConfigWriter } from '../../config/ConfigWriter.js';
import * as ui from '../ui/ProgressDisplay.js';

export async function setupRemoveAction(envName: string, userName: string): Promise<void> {
  const configPath = resolve(process.cwd(), 'ppia.yaml');
  const writer = new ConfigWriter(configPath);

  ui.header('ppia setup — Remove');

  const removed = await writer.removeSetup(envName, userName);

  if (removed) {
    ui.success(`Setup removed: ${envName} / ${userName}`);
  } else {
    ui.warn(`Setup not found: ${envName} / ${userName}`);
  }
}
