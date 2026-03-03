import { resolve } from 'node:path';

import { confirm, input, password, select } from '@inquirer/prompts';

import { AiServiceClient } from '../../ai/AiServiceClient.js';
import { PythonServerManager } from '../../ai/PythonServerManager.js';
import { ActionExecutor } from '../../browser/ActionExecutor.js';
import { BrowserManager } from '../../browser/BrowserManager.js';
import { HtmlExtractor } from '../../browser/HtmlExtractor.js';
import { ConfigWriter } from '../../config/ConfigWriter.js';
import type { AuthFlow, LoginSelectors } from '../../config/ProjectConfig.js';
import { ExplorationAgent } from '../../agents/ExplorationAgent.js';
import { createAgentContext } from '../../domain/AgentContext.js';
import type { LearnedSelector } from '../../domain/ExplorationReport.js';
import * as ui from '../ui/ProgressDisplay.js';

// ── Login selector extraction ─────────────────────────────────────────

function extractLoginSelectors(learnedSelectors: LearnedSelector[]): LoginSelectors | undefined {
  let emailSelector: string | undefined;
  let passwordSelector: string | undefined;
  let submitSelector: string | undefined;

  for (const sel of learnedSelectors) {
    const desc = sel.description.toLowerCase();
    const action = sel.action.toLowerCase();

    if (action === 'fill' && !emailSelector && (desc.includes('email') || desc.includes('user'))) {
      emailSelector = sel.selector;
    } else if (action === 'fill' && !passwordSelector && desc.includes('password')) {
      passwordSelector = sel.selector;
    } else if (action === 'click' && !submitSelector && (desc.includes('submit') || desc.includes('login') || desc.includes('sign'))) {
      submitSelector = sel.selector;
    }
  }

  if (emailSelector && passwordSelector && submitSelector) {
    return { email: emailSelector, password: passwordSelector, submit: submitSelector };
  }
  return undefined;
}

// ── Mini Session A: explore login form ────────────────────────────────

async function exploreLoginForm(
  baseUrl: string,
  email: string,
  passwordValue: string,
): Promise<LoginSelectors | undefined> {
  const pythonServer = new PythonServerManager();
  const browser = new BrowserManager({ headless: false, slowMo: 150 });

  try {
    ui.info('Starting AI Service...');
    await pythonServer.start();

    ui.info('Launching browser...');
    const page = await browser.launch();
    const aiClient = new AiServiceClient(pythonServer.baseUrl);
    const htmlExtractor = new HtmlExtractor();
    const actionExecutor = new ActionExecutor(page);
    const explorationAgent = new ExplorationAgent(aiClient, htmlExtractor, actionExecutor, page);

    const objective =
      `Navigate to ${baseUrl}, find the login form, ` +
      `fill the email/username field with "${email}" ` +
      `and the password field with the password, ` +
      `then click the submit/login button.`;

    const context = createAgentContext({
      rawInput: `Login to ${baseUrl} as ${email}`,
      url: baseUrl,
      objective,
      testName: 'setup-login-verification',
      parameters: { password: passwordValue },
      maxIterations: 10,
    });

    ui.info('Exploring login form...');
    const report = await explorationAgent.run(context);

    if (report.completed) {
      ui.success(`Login exploration completed in ${String(report.totalRounds)} rounds`);
      const selectors = extractLoginSelectors(report.learnedSelectors);
      if (selectors) {
        ui.success('Login selectors discovered');
        ui.listItem('Email', selectors.email);
        ui.listItem('Password', selectors.password);
        ui.listItem('Submit', selectors.submit);
      }
      return selectors;
    }

    ui.warn('Login exploration did not complete — selectors not discovered');
    return undefined;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ui.warn(`AI exploration failed: ${message}`);
    return undefined;
  } finally {
    await browser.close();
    await pythonServer.stop();
  }
}

// ── Main action ───────────────────────────────────────────────────────

export async function setupAddAction(): Promise<void> {
  ui.header('ppia setup — Add new setup');

  // 1. Collect environment data
  const envName = await input({ message: 'Environment name:' });
  const baseUrl = await input({ message: 'Base URL:' });

  // 2. Collect user data
  const userName = await input({ message: 'Username:' });
  const userEmail = await input({ message: 'Email (optional):' });

  const authFlow = await select<AuthFlow>({
    message: 'Auth flow:',
    choices: [
      { name: 'Login form', value: 'login_form' as const },
      { name: 'Cookie injection', value: 'cookie_injection' as const },
    ],
  });

  const userRole = await input({ message: 'Role (optional):' });

  // 3. Password handling
  let passwordForYaml = '';
  let resolvedPassword = '';

  if (authFlow === 'login_form') {
    const storageMode = await select({
      message: 'How to store the password?',
      choices: [
        { name: 'Environment variable (recommended)', value: 'env_var' as const },
        { name: 'Direct value', value: 'direct' as const },
      ],
    });

    if (storageMode === 'env_var') {
      const envVarName = await input({
        message: 'Environment variable name:',
        default: `${userName.toUpperCase()}_PASSWORD`,
      });
      passwordForYaml = `\${${envVarName}}`;

      const envValue = process.env[envVarName];
      if (envValue) {
        resolvedPassword = envValue;
        ui.info(`Using value from $${envVarName}`);
      } else {
        resolvedPassword = await password({
          message: `Value for ${envVarName} (for verification, not stored):`,
        });
      }
    } else {
      resolvedPassword = await password({ message: 'Password:' });
      passwordForYaml = resolvedPassword;
    }
  }

  // 4. Optional: explore login form with AI
  let loginSelectors: LoginSelectors | undefined;

  if (authFlow === 'login_form') {
    const shouldExplore = await confirm({
      message: 'Explore login form with AI? (discovers selectors, requires Python AI Service)',
      default: false,
    });

    if (shouldExplore && userEmail) {
      loginSelectors = await exploreLoginForm(baseUrl, userEmail, resolvedPassword);
    } else if (shouldExplore && !userEmail) {
      ui.warn('Email is required for login exploration — skipping');
    }
  }

  // 5. Write to ppia.yaml
  const configPath = resolve(process.cwd(), 'ppia.yaml');
  const writer = new ConfigWriter(configPath);

  await writer.ensureProjectName(envName);
  await writer.addEnvironment(envName, baseUrl);
  await writer.addUser(userName, {
    email: userEmail || undefined,
    password: passwordForYaml || undefined,
    role: userRole || undefined,
    authFlow,
    loginSelectors,
  });
  await writer.addSetupCombination(envName, userName);

  // 6. Summary
  ui.blank();
  ui.success(`Setup written to ${configPath}`);
  ui.listItem('Environment', `${envName} → ${baseUrl}`);
  ui.listItem('User', `${userName} (${authFlow})`);
  if (loginSelectors) {
    ui.listItem('Selectors', 'custom (AI-discovered)');
  } else {
    ui.listItem('Selectors', 'default (verify with "ppia setup test")');
  }
  ui.blank();
}
