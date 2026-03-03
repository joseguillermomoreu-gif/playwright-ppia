import type { Page } from 'playwright';

import type { ActionExecutor } from '../browser/ActionExecutor.js';

import type { EnvironmentConfig, ProjectConfig, UserConfig } from './ProjectConfig.js';

export interface ResolvedSetup {
  environment: EnvironmentConfig;
  user: UserConfig;
}

export class SetupManager {
  constructor(
    private readonly config: ProjectConfig,
    private readonly actionExecutor: ActionExecutor,
    private readonly page: Page,
  ) {}

  findUser(name: string): UserConfig | undefined {
    return this.config.users.find((u) => u.name === name);
  }

  findEnvironmentForUser(userName: string): string | undefined {
    const combination = this.config.setupCombinations.find(
      (combo) => combo.users.includes(userName),
    );
    if (combination) {
      return combination.environment;
    }
    return this.config.environments[0]?.name;
  }

  loadSetup(envName: string, userName: string): ResolvedSetup {
    const environment = this.config.environments.find((e) => e.name === envName);
    if (!environment) {
      throw new Error(`Environment "${envName}" not found in project config`);
    }

    const user = this.findUser(userName);
    if (!user) {
      throw new Error(`User "${userName}" not found in project config`);
    }

    return { environment, user };
  }

  async authenticate(setup: ResolvedSetup): Promise<void> {
    switch (setup.user.authFlow) {
      case 'login_form':
        await this.authenticateViaLoginForm(setup);
        break;
      case 'cookie_injection':
        await this.authenticateViaCookieInjection(setup);
        break;
      default:
        throw new Error(`Unknown auth flow: ${String(setup.user.authFlow)}`);
    }
  }

  private async authenticateViaLoginForm(setup: ResolvedSetup): Promise<void> {
    const selectors = setup.user.loginSelectors ?? {
      email: 'getByLabel("Email")',
      password: 'getByLabel("Password")',
      submit: 'getByRole("button", { name: "Submit" })',
    };

    await this.actionExecutor.execute({
      action: 'navigate',
      target: setup.environment.baseUrl,
      value: null,
    });
    await this.actionExecutor.execute({
      action: 'fill',
      target: selectors.email,
      value: setup.user.email ?? '',
    });
    await this.actionExecutor.execute({
      action: 'fill',
      target: selectors.password,
      value: setup.user.password ?? '',
    });
    await this.actionExecutor.execute({
      action: 'click',
      target: selectors.submit,
      value: null,
    });
  }

  private async authenticateViaCookieInjection(setup: ResolvedSetup): Promise<void> {
    const cookiesPath = setup.environment.cookies;
    if (!cookiesPath) {
      throw new Error(
        `cookie_injection requires "cookies" path in environment "${setup.environment.name}"`,
      );
    }

    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(cookiesPath, 'utf-8');
    const cookies = JSON.parse(raw) as Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
    }>;

    await this.page.context().addCookies(cookies);
    await this.actionExecutor.execute({
      action: 'navigate',
      target: setup.environment.baseUrl,
      value: null,
    });
  }
}
