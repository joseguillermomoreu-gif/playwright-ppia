import { readFile } from 'node:fs/promises';

import { parse } from 'yaml';

// ── Types ──────────────────────────────────────────────────────────────

export interface EnvironmentConfig {
  name: string;
  baseUrl: string;
  cookies?: string;
}

export type AuthFlow = 'login_form' | 'cookie_injection';

export interface LoginSelectors {
  email: string;
  password: string;
  submit: string;
}

export interface UserConfig {
  name: string;
  email?: string;
  password?: string;
  role?: string;
  authFlow: AuthFlow;
  loginSelectors?: LoginSelectors;
}

export interface SetupCombination {
  environment: string;
  users: string[];
}

export interface ProjectConfig {
  projectName: string;
  environments: EnvironmentConfig[];
  users: UserConfig[];
  setupCombinations: SetupCombination[];
}

export class ProjectConfigError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ProjectConfigError';
  }
}

// ── Raw YAML shapes ────────────────────────────────────────────────────

interface RawEnvironment {
  name?: unknown;
  base_url?: unknown;
  cookies?: unknown;
}

interface RawUser {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
  auth_flow?: unknown;
  login_selectors?: unknown;
}

interface RawCombination {
  environment?: unknown;
  users?: unknown;
}

interface RawConfig {
  project?: { name?: unknown };
  environments?: unknown[];
  users?: unknown[];
  setup_combinations?: unknown[];
}

// ── Helpers ────────────────────────────────────────────────────────────

const VALID_AUTH_FLOWS: readonly AuthFlow[] = ['login_form', 'cookie_injection'];

export function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, varName: string) => {
    const resolved = process.env[varName];
    if (resolved === undefined) {
      throw new ProjectConfigError(
        `Environment variable "${varName}" is not defined (referenced in "${match}")`,
      );
    }
    return resolved;
  });
}

function resolveOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? resolveEnvVars(value) : undefined;
}

function parseEnvironment(raw: RawEnvironment, index: number): EnvironmentConfig {
  if (typeof raw.name !== 'string' || raw.name.length === 0) {
    throw new ProjectConfigError(
      `environments[${String(index)}].name is required and must be a non-empty string`,
      `environments[${String(index)}].name`,
    );
  }
  if (typeof raw.base_url !== 'string' || raw.base_url.length === 0) {
    throw new ProjectConfigError(
      `environments[${String(index)}].base_url is required and must be a non-empty string`,
      `environments[${String(index)}].base_url`,
    );
  }
  return {
    name: raw.name,
    baseUrl: resolveEnvVars(raw.base_url),
    cookies: resolveOptionalString(raw.cookies),
  };
}

function parseLoginSelectors(raw: unknown): LoginSelectors | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.email !== 'string' || typeof obj.password !== 'string' || typeof obj.submit !== 'string') {
    return undefined;
  }
  return { email: obj.email, password: obj.password, submit: obj.submit };
}

function parseUser(raw: RawUser, index: number): UserConfig {
  if (typeof raw.name !== 'string' || raw.name.length === 0) {
    throw new ProjectConfigError(
      `users[${String(index)}].name is required and must be a non-empty string`,
      `users[${String(index)}].name`,
    );
  }
  if (typeof raw.auth_flow !== 'string' || !VALID_AUTH_FLOWS.includes(raw.auth_flow as AuthFlow)) {
    throw new ProjectConfigError(
      `users[${String(index)}].auth_flow must be one of: ${VALID_AUTH_FLOWS.join(', ')}. Got: "${String(raw.auth_flow)}"`,
      `users[${String(index)}].auth_flow`,
    );
  }
  const user: UserConfig = {
    name: raw.name,
    email: resolveOptionalString(raw.email),
    password: resolveOptionalString(raw.password),
    role: typeof raw.role === 'string' ? raw.role : undefined,
    authFlow: raw.auth_flow as AuthFlow,
  };
  const loginSelectors = parseLoginSelectors(raw.login_selectors);
  if (loginSelectors) {
    user.loginSelectors = loginSelectors;
  }
  return user;
}

function parseCombination(
  raw: RawCombination,
  index: number,
  environmentNames: Set<string>,
  userNames: Set<string>,
): SetupCombination {
  if (typeof raw.environment !== 'string' || !environmentNames.has(raw.environment)) {
    throw new ProjectConfigError(
      `setup_combinations[${String(index)}].environment "${String(raw.environment)}" does not reference a defined environment`,
      `setup_combinations[${String(index)}].environment`,
    );
  }
  if (!Array.isArray(raw.users) || raw.users.length === 0) {
    throw new ProjectConfigError(
      `setup_combinations[${String(index)}].users must be a non-empty array`,
      `setup_combinations[${String(index)}].users`,
    );
  }
  for (const userName of raw.users) {
    if (typeof userName !== 'string' || !userNames.has(userName)) {
      throw new ProjectConfigError(
        `setup_combinations[${String(index)}].users contains unknown user "${String(userName)}"`,
        `setup_combinations[${String(index)}].users`,
      );
    }
  }
  return {
    environment: raw.environment,
    users: raw.users as string[],
  };
}

// ── Main ───────────────────────────────────────────────────────────────

export async function loadProjectConfig(filePath: string): Promise<ProjectConfig> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    throw new ProjectConfigError(`Config file not found: ${filePath}`, 'file');
  }

  let raw: unknown;
  try {
    raw = parse(content);
  } catch {
    throw new ProjectConfigError('Invalid YAML syntax', 'file');
  }

  const config = raw as RawConfig | null;

  if (!config || typeof config !== 'object') {
    throw new ProjectConfigError('Config file is empty or not an object', 'file');
  }

  const projectName = config.project?.name;
  if (typeof projectName !== 'string' || projectName.length === 0) {
    throw new ProjectConfigError(
      'project.name is required and must be a non-empty string',
      'project.name',
    );
  }

  const rawEnvironments = Array.isArray(config.environments) ? config.environments : [];
  const rawUsers = Array.isArray(config.users) ? config.users : [];
  const rawCombinations = Array.isArray(config.setup_combinations) ? config.setup_combinations : [];

  const environments = rawEnvironments.map(
    (env, i) => parseEnvironment(env as RawEnvironment, i),
  );
  const users = rawUsers.map(
    (user, i) => parseUser(user as RawUser, i),
  );

  const environmentNames = new Set(environments.map((e) => e.name));
  const userNames = new Set(users.map((u) => u.name));

  const setupCombinations = rawCombinations.map(
    (combo, i) => parseCombination(combo as RawCombination, i, environmentNames, userNames),
  );

  return {
    projectName,
    environments,
    users,
    setupCombinations,
  };
}
