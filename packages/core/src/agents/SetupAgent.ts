import type { AgentContext } from '../domain/AgentContext.js';
import type { SetupManager } from '../config/SetupManager.js';

export interface SetupResult {
  context: AgentContext;
  authenticated: boolean;
}

export class SetupAgent {
  constructor(private readonly setupManager: SetupManager) {}

  async run(
    context: AgentContext,
    detectedUser?: string,
    environmentName?: string,
  ): Promise<SetupResult> {
    if (!detectedUser) {
      return { context, authenticated: false };
    }

    const user = this.setupManager.findUser(detectedUser);
    if (!user) {
      return { context, authenticated: false };
    }

    const envName = environmentName ?? this.setupManager.findEnvironmentForUser(detectedUser);
    if (!envName) {
      return { context, authenticated: false };
    }

    const setup = this.setupManager.loadSetup(envName, detectedUser);
    await this.setupManager.authenticate(setup);

    const cleanedInput = SetupAgent.removeUserReference(context.rawInput, detectedUser);

    const updatedContext: AgentContext = {
      ...context,
      rawInput: cleanedInput,
      setup: {
        environment: setup.environment,
        user: setup.user,
      },
    };

    return { context: updatedContext, authenticated: true };
  }

  static removeUserReference(rawInput: string, userName: string): string {
    const patterns = [
      new RegExp(`\\s+con usuario\\s+${userName}`, 'gi'),
      new RegExp(`\\s+como\\s+${userName}`, 'gi'),
      new RegExp(`\\s+as\\s+${userName}`, 'gi'),
      new RegExp(`\\s+with user\\s+${userName}`, 'gi'),
      new RegExp(`\\s+using user\\s+${userName}`, 'gi'),
    ];

    let result = rawInput;
    for (const pattern of patterns) {
      result = result.replace(pattern, '');
    }
    return result.trim();
  }

}
