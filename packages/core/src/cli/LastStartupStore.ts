import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

interface LastStartupData {
  ran_at: string;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export class LastStartupStore {
  private readonly filePath: string;

  constructor(projectRoot: string) {
    this.filePath = join(projectRoot, '.ppia', 'last-startup.json');
  }

  async hasRanToday(): Promise<boolean> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const data = JSON.parse(raw) as LastStartupData;
      return data.ran_at === todayUTC();
    } catch {
      return false;
    }
  }

  async markRan(): Promise<void> {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    const payload: LastStartupData = { ran_at: todayUTC() };
    await writeFile(this.filePath, JSON.stringify(payload), 'utf-8');
  }
}
