import type { Browser, BrowserContext, Page } from 'playwright';

export interface BrowserManagerOptions {
  headless?: boolean;
  slowMo?: number;
  viewport?: { width: number; height: number };
}

const DEFAULTS = {
  headless: true,
  slowMo: 0,
  viewport: { width: 1280, height: 720 },
} as const;

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private activePage: Page | null = null;
  private readonly options: Required<BrowserManagerOptions>;

  constructor(options: BrowserManagerOptions = {}) {
    this.options = {
      headless: options.headless ?? DEFAULTS.headless,
      slowMo: options.slowMo ?? DEFAULTS.slowMo,
      viewport: options.viewport ?? { ...DEFAULTS.viewport },
    };
  }

  get page(): Page {
    if (!this.activePage) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    return this.activePage;
  }

  get isLaunched(): boolean {
    return this.browser !== null;
  }

  async launch(): Promise<Page> {
    if (this.activePage) {
      return this.activePage;
    }

    const { chromium } = await import('playwright');

    this.browser = await chromium.launch({
      headless: this.options.headless,
      slowMo: this.options.slowMo,
    });

    this.context = await this.browser.newContext({
      viewport: this.options.viewport,
    });

    this.activePage = await this.context.newPage();
    return this.activePage;
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.activePage = null;
  }
}
