import { execFile as execFileCb } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface ExecutionResult {
  passed: boolean;
  errorMessage?: string;
  durationMs: number;
  filePath: string;
}

export class TestExecutor {
  constructor(private readonly outputDir: string) {}

  async execute(code: string, testName: string): Promise<ExecutionResult> {
    const filePath = join(this.outputDir, `${testName}.spec.ts`);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, code, 'utf-8');

    const start = Date.now();

    try {
      await this.runPlaywright(filePath);
      return { passed: true, durationMs: Date.now() - start, filePath };
    } catch (error: unknown) {
      const durationMs = Date.now() - start;
      const execError = error as { stderr?: string; stdout?: string; message: string };
      const output = [execError.stderr, execError.stdout]
        .filter(Boolean)
        .join('\n')
        .trim();
      return {
        passed: false,
        errorMessage: output || execError.message,
        durationMs,
        filePath,
      };
    }
  }

  private runPlaywright(filePath: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFileCb(
        'npx',
        ['playwright', 'test', filePath, '--reporter=line'],
        { timeout: 120_000 },
        (error, stdout, stderr) => {
          if (error) {
            Object.assign(error, { stdout, stderr });
            reject(error as Error);
          } else {
            resolve({ stdout, stderr });
          }
        },
      );
    });
  }
}
