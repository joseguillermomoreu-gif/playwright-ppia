import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { TestExecutor } from './TestExecutor.js';

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
const mockWriteFile = writeFile as unknown as ReturnType<typeof vi.fn>;
const mockMkdir = mkdir as unknown as ReturnType<typeof vi.fn>;

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

function mockExecSuccess(stdout = 'Tests passed'): void {
  mockExecFile.mockImplementation(
    (_file: string, _args: string[], _opts: unknown, callback: ExecFileCallback) => {
      callback(null, stdout, '');
    },
  );
}

function mockExecFailure(stderr: string, stdout = ''): void {
  mockExecFile.mockImplementation(
    (_file: string, _args: string[], _opts: unknown, callback: ExecFileCallback) => {
      const error = new Error('Process exited with code 1');
      callback(error, stdout, stderr);
    },
  );
}

describe('TestExecutor', () => {
  let executor: TestExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new TestExecutor('/tmp/test-output');
  });

  it('creates output directory before writing', async () => {
    mockExecSuccess();
    await executor.execute('test code', 'my_test');

    expect(mockMkdir).toHaveBeenCalledWith('/tmp/test-output', { recursive: true });
  });

  it('writes test code to the correct file path', async () => {
    mockExecSuccess();
    await executor.execute('test("hello")', 'login_test');

    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/test-output/login_test.spec.ts',
      'test("hello")',
      'utf-8',
    );
  });

  it('returns passed=true when playwright exits successfully', async () => {
    mockExecSuccess();
    const result = await executor.execute('test code', 'my_test');

    expect(result.passed).toBe(true);
    expect(result.errorMessage).toBeUndefined();
    expect(result.filePath).toBe('/tmp/test-output/my_test.spec.ts');
  });

  it('returns passed=false with error when playwright fails', async () => {
    mockExecFailure('Error: locator.click: Target closed');
    const result = await executor.execute('test code', 'my_test');

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toBe('Error: locator.click: Target closed');
    expect(result.filePath).toBe('/tmp/test-output/my_test.spec.ts');
  });

  it('combines stderr and stdout in error message', async () => {
    mockExecFailure('stderr output', 'stdout output');
    const result = await executor.execute('test code', 'my_test');

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toBe('stderr output\nstdout output');
  });

  it('uses error.message as fallback when no output', async () => {
    mockExecFile.mockImplementation(
      (_file: string, _args: string[], _opts: unknown, callback: ExecFileCallback) => {
        const error = new Error('spawn ENOENT');
        callback(error, '', '');
      },
    );
    const result = await executor.execute('test code', 'my_test');

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toBe('spawn ENOENT');
  });

  it('measures execution duration', async () => {
    mockExecSuccess();
    const result = await executor.execute('test code', 'my_test');

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('calls npx playwright test with correct arguments', async () => {
    mockExecSuccess();
    await executor.execute('test code', 'my_test');

    expect(mockExecFile).toHaveBeenCalledWith(
      'npx',
      ['playwright', 'test', '/tmp/test-output/my_test.spec.ts', '--reporter=line'],
      { timeout: 120_000 },
      expect.any(Function),
    );
  });
});
