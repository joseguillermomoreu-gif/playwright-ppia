import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { parse, stringify } from 'yaml';

import type { AuthFlow, LoginSelectors } from './ProjectConfig.js';

// ── Raw YAML structure (snake_case) ───────────────────────────────────

interface RawEnvironment {
  name: string;
  base_url: string;
  cookies?: string;
}

interface RawLoginSelectors {
  email: string;
  password: string;
  submit: string;
}

interface RawUser {
  name: string;
  email?: string;
  password?: string;
  role?: string;
  auth_flow: string;
  login_selectors?: RawLoginSelectors;
}

interface RawCombination {
  environment: string;
  users: string[];
}

interface RawYamlConfig {
  project?: { name?: string; description?: string };
  ai_service?: Record<string, unknown>;
  environments?: RawEnvironment[];
  users?: RawUser[];
  setup_combinations?: RawCombination[];
  output?: Record<string, unknown>;
}

// ── Public types ──────────────────────────────────────────────────────

export interface AddUserOptions {
  email?: string;
  password?: string;
  role?: string;
  authFlow: AuthFlow;
  loginSelectors?: LoginSelectors;
}

// ── ConfigWriter ──────────────────────────────────────────────────────

export class ConfigWriter {
  constructor(private readonly filePath: string) {}

  async read(): Promise<RawYamlConfig> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      const parsed = parse(content) as RawYamlConfig | null;
      return parsed ?? {};
    } catch {
      return {};
    }
  }

  private async write(config: RawYamlConfig): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const content = stringify(config, { lineWidth: 120 });
    await writeFile(this.filePath, content, 'utf-8');
  }

  async ensureProjectName(name: string): Promise<void> {
    const config = await this.read();
    if (!config.project) {
      config.project = {};
    }
    if (!config.project.name) {
      config.project.name = name;
    }
    await this.write(config);
  }

  async addEnvironment(name: string, baseUrl: string, cookies?: string): Promise<void> {
    const config = await this.read();
    if (!config.environments) {
      config.environments = [];
    }

    const existing = config.environments.find((e) => e.name === name);
    if (existing) {
      existing.base_url = baseUrl;
      if (cookies) {
        existing.cookies = cookies;
      }
    } else {
      const entry: RawEnvironment = { name, base_url: baseUrl };
      if (cookies) {
        entry.cookies = cookies;
      }
      config.environments.push(entry);
    }

    await this.write(config);
  }

  async addUser(name: string, options: AddUserOptions): Promise<void> {
    const config = await this.read();
    if (!config.users) {
      config.users = [];
    }

    const entry: RawUser = {
      name,
      auth_flow: options.authFlow,
    };
    if (options.email) {
      entry.email = options.email;
    }
    if (options.password) {
      entry.password = options.password;
    }
    if (options.role) {
      entry.role = options.role;
    }
    if (options.loginSelectors) {
      entry.login_selectors = {
        email: options.loginSelectors.email,
        password: options.loginSelectors.password,
        submit: options.loginSelectors.submit,
      };
    }

    const existingIndex = config.users.findIndex((u) => u.name === name);
    if (existingIndex !== -1) {
      config.users[existingIndex] = entry;
    } else {
      config.users.push(entry);
    }

    await this.write(config);
  }

  async addSetupCombination(envName: string, userName: string): Promise<void> {
    const config = await this.read();
    if (!config.setup_combinations) {
      config.setup_combinations = [];
    }

    const existing = config.setup_combinations.find((c) => c.environment === envName);
    if (existing) {
      if (!existing.users.includes(userName)) {
        existing.users.push(userName);
      }
    } else {
      config.setup_combinations.push({
        environment: envName,
        users: [userName],
      });
    }

    await this.write(config);
  }

  async removeSetup(envName: string, userName: string): Promise<boolean> {
    const config = await this.read();
    if (!config.setup_combinations) {
      return false;
    }

    const combo = config.setup_combinations.find((c) => c.environment === envName);
    if (!combo) {
      return false;
    }

    const userIndex = combo.users.indexOf(userName);
    if (userIndex === -1) {
      return false;
    }

    combo.users.splice(userIndex, 1);

    if (combo.users.length === 0) {
      config.setup_combinations = config.setup_combinations.filter(
        (c) => c.environment !== envName,
      );
    }

    // Also remove the user definition if not used in any other combination
    const userStillUsed = config.setup_combinations.some(
      (c) => c.users.includes(userName),
    );
    if (!userStillUsed && config.users) {
      config.users = config.users.filter((u) => u.name !== userName);
    }

    // Also remove the environment if no combinations reference it
    const envStillUsed = config.setup_combinations.some(
      (c) => c.environment === envName,
    );
    if (!envStillUsed && config.environments) {
      config.environments = config.environments.filter((e) => e.name !== envName);
    }

    await this.write(config);
    return true;
  }

  async hasEnvironment(name: string): Promise<boolean> {
    const config = await this.read();
    return config.environments?.some((e) => e.name === name) ?? false;
  }

  async hasUser(name: string): Promise<boolean> {
    const config = await this.read();
    return config.users?.some((u) => u.name === name) ?? false;
  }
}
