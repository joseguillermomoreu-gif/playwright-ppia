import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Command } from 'commander';
import { confirm, input, select } from '@inquirer/prompts';

import type { AiProvider } from '../../config/ProjectConfig.js';
import * as ui from '../ui/ProgressDisplay.js';

// ── Constants ────────────────────────────────────────────────────────

const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'] as const;
const ANTHROPIC_MODELS = ['claude-haiku-4-20250414', 'claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022'] as const;

interface ModelChoice {
  provider: AiProvider;
  model: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectProjectName(cwd: string): Promise<string> {
  try {
    const raw = await readFile(resolve(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as { name?: string };
    return typeof pkg.name === 'string' ? pkg.name : 'my-project';
  } catch {
    return 'my-project';
  }
}

async function detectBaseUrl(cwd: string): Promise<string | undefined> {
  try {
    const content = await readFile(resolve(cwd, 'playwright.config.ts'), 'utf-8');
    const match = /baseURL:\s*['"]([^'"]+)['"]/.exec(content);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

function buildModelChoices(): Array<{ name: string; value: ModelChoice }> {
  const choices: Array<{ name: string; value: ModelChoice }> = [];
  for (const model of OPENAI_MODELS) {
    choices.push({ name: `OpenAI — ${model}`, value: { provider: 'openai', model } });
  }
  for (const model of ANTHROPIC_MODELS) {
    choices.push({ name: `Anthropic — ${model}`, value: { provider: 'anthropic', model } });
  }
  return choices;
}

function generateYaml(
  projectName: string,
  exploration: ModelChoice,
  generation: ModelChoice,
  baseUrl?: string,
): string {
  let yaml = `project:\n  name: ${projectName}\n\n`;
  yaml += `ai:\n`;
  yaml += `  exploration:\n    provider: ${exploration.provider}\n    model: ${exploration.model}\n`;
  yaml += `  generation:\n    provider: ${generation.provider}\n    model: ${generation.model}\n`;

  if (baseUrl) {
    yaml += `\nenvironments:\n  - name: default\n    base_url: ${baseUrl}\n`;
  }

  return yaml;
}

function generateEnv(keys: { openai?: string; anthropic?: string }): string {
  const lines: string[] = ['# ppia — AI Service configuration'];
  if (keys.openai) {
    lines.push(`OPENAI_API_KEY=${keys.openai}`);
  }
  if (keys.anthropic) {
    lines.push(`ANTHROPIC_API_KEY=${keys.anthropic}`);
  }
  return lines.join('\n') + '\n';
}

// ── Main action ─────────────────────────────────────────────────────

async function initAction(): Promise<void> {
  const cwd = process.cwd();

  ui.header('ppia init');

  // Check existing config
  const configPath = resolve(cwd, 'ppia.yaml');
  if (await fileExists(configPath)) {
    const overwrite = await confirm({
      message: 'ppia.yaml already exists. Overwrite?',
      default: false,
    });
    if (!overwrite) {
      ui.info('Init cancelled.');
      return;
    }
  }

  // Project name
  const detectedName = await detectProjectName(cwd);
  const projectName = await input({
    message: 'Project name:',
    default: detectedName,
  });

  // Model choices
  const modelChoices = buildModelChoices();

  ui.blank();
  ui.info('Select the AI model for each phase. You can mix providers freely.');
  ui.blank();

  const exploration = await select<ModelChoice>({
    message: 'Model for exploration (fast, many calls):',
    choices: modelChoices,
    default: { provider: 'openai' as const, model: 'gpt-4o-mini' },
  });

  const generation = await select<ModelChoice>({
    message: 'Model for generation (strong, fewer calls):',
    choices: modelChoices,
    default: { provider: 'openai' as const, model: 'gpt-4o' },
  });

  // Determine which API keys we need
  const needsOpenai = exploration.provider === 'openai' || generation.provider === 'openai';
  const needsAnthropic = exploration.provider === 'anthropic' || generation.provider === 'anthropic';

  ui.blank();
  const apiKeys: { openai?: string; anthropic?: string } = {};

  if (needsOpenai) {
    const existingKey = process.env['OPENAI_API_KEY'];
    if (existingKey) {
      ui.info(`OpenAI API key detected in environment (${existingKey.slice(0, 12)}...)`);
      const useExisting = await confirm({
        message: 'Use this key?',
        default: true,
      });
      apiKeys.openai = useExisting
        ? existingKey
        : await input({ message: 'OpenAI API Key:' });
    } else {
      apiKeys.openai = await input({ message: 'OpenAI API Key:' });
    }
  }

  if (needsAnthropic) {
    const existingKey = process.env['ANTHROPIC_API_KEY'];
    if (existingKey) {
      ui.info(`Anthropic API key detected in environment (${existingKey.slice(0, 12)}...)`);
      const useExisting = await confirm({
        message: 'Use this key?',
        default: true,
      });
      apiKeys.anthropic = useExisting
        ? existingKey
        : await input({ message: 'Anthropic API Key:' });
    } else {
      apiKeys.anthropic = await input({ message: 'Anthropic API Key:' });
    }
  }

  // Detect baseURL
  const baseUrl = await detectBaseUrl(cwd);
  if (baseUrl) {
    ui.info(`Detected baseURL from playwright.config.ts: ${baseUrl}`);
  }

  // Write files
  const yamlContent = generateYaml(projectName, exploration, generation, baseUrl);
  await writeFile(configPath, yamlContent, 'utf-8');
  ui.success('Created ppia.yaml');

  const envPath = resolve(cwd, '.env');
  if (await fileExists(envPath)) {
    const existingEnv = await readFile(envPath, 'utf-8');
    const newKeys: string[] = [];
    if (apiKeys.openai && !existingEnv.includes('OPENAI_API_KEY=')) {
      newKeys.push(`OPENAI_API_KEY=${apiKeys.openai}`);
    }
    if (apiKeys.anthropic && !existingEnv.includes('ANTHROPIC_API_KEY=')) {
      newKeys.push(`ANTHROPIC_API_KEY=${apiKeys.anthropic}`);
    }
    if (newKeys.length > 0) {
      const appendContent = '\n# ppia — AI Service configuration\n' + newKeys.join('\n') + '\n';
      await writeFile(envPath, existingEnv + appendContent, 'utf-8');
      ui.success('Updated .env (appended API keys)');
    } else {
      ui.info('.env already contains the required API keys');
    }
  } else {
    await writeFile(envPath, generateEnv(apiKeys), 'utf-8');
    ui.success('Created .env');
  }

  ui.blank();
  ui.success('Project initialized. Run `ppia generate "test description"` to start.');
}

// ── Command registration ────────────────────────────────────────────

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize ppia in a Playwright project (interactive setup)')
    .action(async () => {
      await initAction();
    });
}
