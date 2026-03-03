import type { Page } from 'playwright';

export type ActionType = 'click' | 'fill' | 'navigate' | 'wait' | 'scroll';

export interface ExploreAction {
  action: ActionType;
  target: string;
  value: string | null;
}

export class ActionExecutor {
  constructor(private readonly page: Page) {}

  async execute(action: ExploreAction): Promise<void> {
    try {
      switch (action.action) {
        case 'click':
          await this.click(action.target);
          break;
        case 'fill':
          await this.fill(action.target, action.value ?? '');
          break;
        case 'navigate':
          await this.navigate(action.target);
          break;
        case 'wait':
          await this.wait(action.target);
          break;
        case 'scroll':
          await this.scroll(action.target);
          break;
        default:
          throw new Error(`Unknown action type: ${String(action.action)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Action "${action.action}" failed on "${action.target}": ${message}`,
      );
    }
  }

  private async click(selector: string): Promise<void> {
    const locator = this.resolveLocator(selector);
    await locator.click();
  }

  private async fill(selector: string, value: string): Promise<void> {
    const locator = this.resolveLocator(selector);
    await locator.fill(value);
  }

  private async navigate(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  private async wait(selector: string): Promise<void> {
    const locator = this.resolveLocator(selector);
    await locator.waitFor({ state: 'visible' });
  }

  private async scroll(selector: string): Promise<void> {
    const locator = this.resolveLocator(selector);
    await locator.scrollIntoViewIfNeeded();
  }

  /**
   * Resolves a selector string to a Playwright Locator.
   *
   * Supports Playwright's getBy* methods when the selector starts
   * with a recognized prefix, otherwise falls back to CSS/XPath.
   */
  private resolveLocator(selector: string): ReturnType<Page['locator']> {
    // getByRole("button", { name: "Submit" })
    const roleMatch = /^getByRole\("([^"]+)"(?:,\s*\{\s*name:\s*"([^"]+)"\s*\})?\)$/.exec(selector);
    if (roleMatch) {
      const role = roleMatch[1] as Parameters<Page['getByRole']>[0];
      const name = roleMatch[2];
      return name ? this.page.getByRole(role, { name }) : this.page.getByRole(role);
    }

    // getByLabel("Email")
    const labelMatch = /^getByLabel\("([^"]+)"\)$/.exec(selector);
    if (labelMatch?.[1]) {
      return this.page.getByLabel(labelMatch[1]);
    }

    // getByTestId("submit-btn")
    const testIdMatch = /^getByTestId\("([^"]+)"\)$/.exec(selector);
    if (testIdMatch?.[1]) {
      return this.page.getByTestId(testIdMatch[1]);
    }

    // getByText("Welcome")
    const textMatch = /^getByText\("([^"]+)"\)$/.exec(selector);
    if (textMatch?.[1]) {
      return this.page.getByText(textMatch[1]);
    }

    // CSS or XPath fallback
    return this.page.locator(selector);
  }
}
