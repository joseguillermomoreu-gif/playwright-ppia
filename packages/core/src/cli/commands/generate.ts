import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type { Command } from 'commander';

import { AiServiceClient } from '../../ai/AiServiceClient.js';
import { PythonServerManager } from '../../ai/PythonServerManager.js';
import { ExplorationAgent } from '../../agents/ExplorationAgent.js';
import { GenerationAgent } from '../../agents/GenerationAgent.js';
import { SetupAgent } from '../../agents/SetupAgent.js';
import { ActionExecutor } from '../../browser/ActionExecutor.js';
import { BrowserManager } from '../../browser/BrowserManager.js';
import { HtmlExtractor } from '../../browser/HtmlExtractor.js';
import { DEFAULT_AI_CONFIG, loadProjectConfig } from '../../config/ProjectConfig.js';
import { SetupManager } from '../../config/SetupManager.js';
import { createAgentContext } from '../../domain/AgentContext.js';
import { TestExecutor } from '../../executor/TestExecutor.js';
import { SuiteManager } from '../../suite/SuiteManager.js';
import { StartupChecker } from '../StartupChecker.js';
import * as ui from '../ui/ProgressDisplay.js';

// ── Types ─────────────────────────────────────────────────────────────

interface GenerateOptions {
  setup?: string;
  user?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

async function writeArtifacts(
  testFilePath: string,
  testName: string,
  artifacts: { pomMd: string; gherkinMd: string; cucumberMd: string },
): Promise<void> {
  const dir = dirname(testFilePath);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${testName}.pom.md`), artifacts.pomMd, 'utf-8');
  await writeFile(join(dir, `${testName}.gherkin.md`), artifacts.gherkinMd, 'utf-8');
  await writeFile(join(dir, `${testName}.cucumber.md`), artifacts.cucumberMd, 'utf-8');
}


// ── Main action ───────────────────────────────────────────────────────

async function generateAction(description: string, options: GenerateOptions): Promise<void> {
  const outputDir = resolve(process.cwd(), 'output');
  const configPath = resolve(process.cwd(), 'ppia.yaml');

  // ── Load AI config from ppia.yaml (fallback to defaults) ──────────
  let modelFast = DEFAULT_AI_CONFIG.exploration.model;
  let modelStrong = DEFAULT_AI_CONFIG.generation.model;
  try {
    const config = await loadProjectConfig(configPath);
    modelFast = config.ai.exploration.model;
    modelStrong = config.ai.generation.model;
  } catch {
    // No config or invalid — use defaults
  }

  const pythonServer = new PythonServerManager();
  const browser = new BrowserManager({ headless: false });
  let totalTokens = 0;
  let totalCost = 0;

  try {
    // ── 1. Start AI Service ───────────────────────────────────────────
    ui.header('ppia generate');
    ui.info('Starting AI Service...');
    await pythonServer.start();
    const aiClient = new AiServiceClient(pythonServer.baseUrl);
    ui.success('AI Service ready');

    // ── 1b. Startup check (cost estimate) ─────────────────────────────
    const startupChecker = new StartupChecker(process.cwd(), aiClient);
    const startupResult = await startupChecker.run(10);
    ui.renderStartupPanel(startupResult);
    if (!startupResult.skipped) {
      const { LastStartupStore } = await import('../LastStartupStore.js');
      const lastStartupStore = new LastStartupStore(process.cwd());
      await lastStartupStore.markRan();
    }

    // ── 2. Session 0: parse input ─────────────────────────────────────
    const prepared = await aiClient.prepareInput({ rawInput: description });
    totalTokens += prepared.tokensUsed;
    totalCost += ui.estimateCost(modelFast, prepared.tokensUsed);
    ui.phaseRow('Session 0', 'input analysis', modelFast, prepared.tokensUsed);

    // ── 3. Build context ──────────────────────────────────────────────
    let context = createAgentContext({
      rawInput: description,
      url: prepared.url,
      objective: prepared.objective,
      testName: prepared.testName,
      parameters: prepared.parameters,
      modelFast,
      modelStrong,
    });

    // ── 4. Launch browser ─────────────────────────────────────────────
    ui.info('Launching browser...');
    const page = await browser.launch();
    const actionExecutor = new ActionExecutor(page);
    const htmlExtractor = new HtmlExtractor();

    // ── 5. Setup (optional) ───────────────────────────────────────────
    const detectedUser = prepared.detectedUser ?? options.user;
    if (detectedUser) {
      try {
        const config = await loadProjectConfig(configPath);
        const setupManager = new SetupManager(config, actionExecutor, page);
        const setupAgent = new SetupAgent(setupManager);
        const setupResult = await setupAgent.run(context, detectedUser, options.setup);
        if (setupResult.authenticated) {
          context = setupResult.context;
          ui.success(`Authenticated as "${detectedUser}"`);
        } else {
          ui.warn(`User "${detectedUser}" not found in config, continuing without setup`);
        }
      } catch {
        ui.warn('Setup config not available, continuing without authentication');
      }
    }

    // ── 6. Exploration (Session A) ────────────────────────────────────
    ui.blank();
    const explorationAgent = new ExplorationAgent(aiClient, htmlExtractor, actionExecutor, page);

    const explorationReport = await explorationAgent.run(context, (round) => {
      totalTokens += round.tokensUsed;
      totalCost += ui.estimateCost(modelFast, round.tokensUsed);
      const detail = round.actionError
        ? `round ${String(round.round)} (err)`
        : `round ${String(round.round)}`;
      ui.phaseRow('Exploration', detail, modelFast, round.tokensUsed);
    });

    ui.success(`Exploration completed in ${String(explorationReport.totalRounds)} rounds`);

    // ── 7. Generation (Session B) ─────────────────────────────────────
    ui.blank();
    const genContext = { ...context, explorationReport };
    const testExecutor = new TestExecutor(outputDir);
    const generationAgent = new GenerationAgent(aiClient, testExecutor);

    const genResult = await generationAgent.run(genContext, (event) => {
      totalTokens += event.tokensUsed;
      totalCost += ui.estimateCost(modelStrong, event.tokensUsed);

      switch (event.phase) {
        case 'test_generated':
          ui.phaseRow('Generation', `attempt ${String(event.attempt)}`, modelStrong, event.tokensUsed);
          break;
        case 'test_failed':
          ui.warn(`Test attempt ${String(event.attempt)} failed, retrying...`);
          break;
        case 'test_passed':
          ui.success(`Test passed on attempt ${String(event.attempt)}`);
          break;
        case 'artifacts_generated':
          ui.phaseRow('Artifacts', 'POM+Gherkin', modelStrong, event.tokensUsed);
          break;
      }
    });

    // ── 8. Write artifacts ────────────────────────────────────────────
    const testPath = genResult.generatedTest.filePath ?? join(outputDir, `${prepared.testName}.spec.ts`);
    await writeArtifacts(testPath, prepared.testName, genResult.generatedArtifacts);

    // ── 9. Save to suite ──────────────────────────────────────────────
    const suiteManager = new SuiteManager(process.cwd());
    await suiteManager.save({
      id: randomUUID(),
      testName: prepared.testName,
      description: prepared.objective,
      url: prepared.url,
      testCode: genResult.generatedTest.code,
      testFilePath: testPath,
      artifacts: genResult.generatedArtifacts,
      metrics: {
        totalTokensUsed: totalTokens,
        totalCost,
        modelFast,
        modelStrong,
        explorationRounds: explorationReport.totalRounds,
        generationAttempts: genResult.attempts,
        timestamp: new Date().toISOString(),
      },
      version: 1,
      createdAt: new Date().toISOString(),
    });

    // ── 10. Summary ───────────────────────────────────────────────────
    ui.separator();
    ui.generateSummary({
      totalTokens,
      totalCost,
      explorationRounds: explorationReport.totalRounds,
      generationAttempts: genResult.attempts,
      testPath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ui.error(message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await pythonServer.stop();
  }
}

// ── Command registration ──────────────────────────────────────────────

export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .description('Generate an E2E test from a natural language description')
    .argument('<description>', 'Test description in natural language')
    .option('-s, --setup <env>', 'Environment name for authentication setup')
    .option('-u, --user <user>', 'User name for authentication')
    .action(async (description: string, opts: Record<string, unknown>) => {
      await generateAction(description, {
        setup: typeof opts.setup === 'string' ? opts.setup : undefined,
        user: typeof opts.user === 'string' ? opts.user : undefined,
      });
    });
}
