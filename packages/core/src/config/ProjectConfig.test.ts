import { describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'node:fs/promises';

import {
  loadProjectConfig,
  ProjectConfigError,
  resolveEnvVars,
} from './ProjectConfig.js';

const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>;

const VALID_YAML = `
project:
  name: my-app

environments:
  - name: staging
    base_url: https://staging.example.com
  - name: production
    base_url: https://prod.example.com
    cookies: /path/to/cookies.json

users:
  - name: admin
    email: admin@test.com
    password: secret123
    role: administrator
    auth_flow: login_form
  - name: viewer
    auth_flow: cookie_injection

setup_combinations:
  - environment: staging
    users: [admin, viewer]
`;

const MINIMAL_YAML = `
project:
  name: minimal-app
`;

describe('loadProjectConfig', () => {
  it('parses a valid YAML config', async () => {
    mockReadFile.mockResolvedValue(VALID_YAML);

    const config = await loadProjectConfig('/fake/ppia.yaml');

    expect(config.projectName).toBe('my-app');
    expect(config.environments).toHaveLength(2);
    expect(config.environments[0]).toEqual({
      name: 'staging',
      baseUrl: 'https://staging.example.com',
      cookies: undefined,
    });
    expect(config.environments[1]).toEqual({
      name: 'production',
      baseUrl: 'https://prod.example.com',
      cookies: '/path/to/cookies.json',
    });
    expect(config.users).toHaveLength(2);
    expect(config.users[0]).toEqual({
      name: 'admin',
      email: 'admin@test.com',
      password: 'secret123',
      role: 'administrator',
      authFlow: 'login_form',
    });
    expect(config.users[1]).toEqual({
      name: 'viewer',
      email: undefined,
      password: undefined,
      role: undefined,
      authFlow: 'cookie_injection',
    });
    expect(config.setupCombinations).toHaveLength(1);
    expect(config.setupCombinations[0]).toEqual({
      environment: 'staging',
      users: ['admin', 'viewer'],
    });
  });

  it('parses a minimal YAML with only project.name', async () => {
    mockReadFile.mockResolvedValue(MINIMAL_YAML);

    const config = await loadProjectConfig('/fake/ppia.yaml');

    expect(config.projectName).toBe('minimal-app');
    expect(config.environments).toEqual([]);
    expect(config.users).toEqual([]);
    expect(config.setupCombinations).toEqual([]);
  });

  it('resolves environment variables in values', async () => {
    process.env.TEST_BASE_URL = 'https://env.example.com';
    process.env.TEST_PASSWORD = 'env-pass';

    const yaml = `
project:
  name: env-app
environments:
  - name: test
    base_url: \${TEST_BASE_URL}
users:
  - name: admin
    password: \${TEST_PASSWORD}
    auth_flow: login_form
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadProjectConfig('/fake/ppia.yaml');

    expect(config.environments[0]?.baseUrl).toBe('https://env.example.com');
    expect(config.users[0]?.password).toBe('env-pass');

    delete process.env.TEST_BASE_URL;
    delete process.env.TEST_PASSWORD;
  });

  it('throws when an env var is missing', async () => {
    const yaml = `
project:
  name: missing-env
environments:
  - name: test
    base_url: \${NONEXISTENT_VAR}
`;
    mockReadFile.mockResolvedValue(yaml);

    await expect(loadProjectConfig('/fake/ppia.yaml')).rejects.toThrow(
      'Environment variable "NONEXISTENT_VAR" is not defined',
    );
  });

  it('throws on invalid YAML syntax', async () => {
    mockReadFile.mockResolvedValue('{ invalid yaml: [}');

    await expect(loadProjectConfig('/fake/ppia.yaml')).rejects.toThrow('Invalid YAML syntax');
  });

  it('throws when file is not found', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    await expect(loadProjectConfig('/missing/ppia.yaml')).rejects.toThrow(
      'Config file not found: /missing/ppia.yaml',
    );
    await expect(loadProjectConfig('/missing/ppia.yaml')).rejects.toBeInstanceOf(
      ProjectConfigError,
    );
  });

  it('throws when project.name is missing', async () => {
    mockReadFile.mockResolvedValue('project:\n  version: 1');

    await expect(loadProjectConfig('/fake/ppia.yaml')).rejects.toThrow(
      'project.name is required',
    );
  });

  it('throws on invalid auth_flow', async () => {
    const yaml = `
project:
  name: bad-auth
users:
  - name: admin
    auth_flow: magic_link
`;
    mockReadFile.mockResolvedValue(yaml);

    await expect(loadProjectConfig('/fake/ppia.yaml')).rejects.toThrow(
      'users[0].auth_flow must be one of: login_form, cookie_injection. Got: "magic_link"',
    );
  });

  it('throws when setup_combination references unknown environment', async () => {
    const yaml = `
project:
  name: bad-combo
environments:
  - name: staging
    base_url: https://staging.example.com
users:
  - name: admin
    auth_flow: login_form
setup_combinations:
  - environment: production
    users: [admin]
`;
    mockReadFile.mockResolvedValue(yaml);

    await expect(loadProjectConfig('/fake/ppia.yaml')).rejects.toThrow(
      'setup_combinations[0].environment "production" does not reference a defined environment',
    );
  });

  it('throws when setup_combination references unknown user', async () => {
    const yaml = `
project:
  name: bad-combo
environments:
  - name: staging
    base_url: https://staging.example.com
users:
  - name: admin
    auth_flow: login_form
setup_combinations:
  - environment: staging
    users: [admin, ghost]
`;
    mockReadFile.mockResolvedValue(yaml);

    await expect(loadProjectConfig('/fake/ppia.yaml')).rejects.toThrow(
      'setup_combinations[0].users contains unknown user "ghost"',
    );
  });
});

describe('resolveEnvVars', () => {
  it('replaces ${VAR} with process.env value', () => {
    process.env.RESOLVE_TEST = 'hello';
    expect(resolveEnvVars('prefix-${RESOLVE_TEST}-suffix')).toBe('prefix-hello-suffix');
    delete process.env.RESOLVE_TEST;
  });

  it('replaces multiple vars in one string', () => {
    process.env.A_VAR = 'a';
    process.env.B_VAR = 'b';
    expect(resolveEnvVars('${A_VAR}/${B_VAR}')).toBe('a/b');
    delete process.env.A_VAR;
    delete process.env.B_VAR;
  });

  it('returns string unchanged when no vars present', () => {
    expect(resolveEnvVars('no-vars-here')).toBe('no-vars-here');
  });

  it('throws for undefined env var', () => {
    expect(() => resolveEnvVars('${DEFINITELY_MISSING}')).toThrow(
      'Environment variable "DEFINITELY_MISSING" is not defined',
    );
  });
});
