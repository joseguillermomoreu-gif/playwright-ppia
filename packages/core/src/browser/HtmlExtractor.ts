import type { Page } from 'playwright';

export class HtmlExtractor {
  private readonly maxLength: number;

  constructor(maxLength = 15_000) {
    this.maxLength = maxLength;
  }

  async extract(page: Page): Promise<string> {
    const rawHtml = await page.content();
    const cleaned = HtmlExtractor.clean(rawHtml);

    if (cleaned.length > this.maxLength) {
      return cleaned.slice(0, this.maxLength);
    }
    return cleaned;
  }

  /**
   * Removes scripts, styles, comments and inline style attributes
   * to reduce token count before sending to the LLM.
   */
  static clean(html: string): string {
    let result = html;

    // Remove <script> tags and content
    result = result.replace(/<script[\s\S]*?<\/script>/gi, '');

    // Remove <style> tags and content
    result = result.replace(/<style[\s\S]*?<\/style>/gi, '');

    // Remove HTML comments
    result = result.replace(/<!--[\s\S]*?-->/g, '');

    // Remove inline style attributes
    result = result.replace(/\s+style="[^"]*"/gi, '');
    result = result.replace(/\s+style='[^']*'/gi, '');

    // Collapse multiple whitespace/newlines into single space
    result = result.replace(/\s{2,}/g, ' ');

    return result.trim();
  }
}
