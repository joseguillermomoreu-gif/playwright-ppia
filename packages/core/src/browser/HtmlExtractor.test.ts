import { describe, expect, it, vi } from 'vitest';

import { HtmlExtractor } from './HtmlExtractor.js';

describe('HtmlExtractor.clean', () => {
  it('removes script tags and content', () => {
    const html = '<div>Hello</div><script>alert("x")</script><p>World</p>';
    expect(HtmlExtractor.clean(html)).toBe('<div>Hello</div><p>World</p>');
  });

  it('removes style tags and content', () => {
    const html = '<style>.foo { color: red; }</style><div>Content</div>';
    expect(HtmlExtractor.clean(html)).toBe('<div>Content</div>');
  });

  it('removes HTML comments', () => {
    const html = '<div><!-- hidden comment -->Visible</div>';
    expect(HtmlExtractor.clean(html)).toBe('<div>Visible</div>');
  });

  it('removes inline style attributes (double quotes)', () => {
    const html = '<div style="color: red; font-size: 14px">Text</div>';
    expect(HtmlExtractor.clean(html)).toBe('<div>Text</div>');
  });

  it('removes inline style attributes (single quotes)', () => {
    const html = "<div style='color: red'>Text</div>";
    expect(HtmlExtractor.clean(html)).toBe('<div>Text</div>');
  });

  it('collapses multiple whitespace', () => {
    const html = '<div>   Hello   \n\n   World   </div>';
    expect(HtmlExtractor.clean(html)).toBe('<div> Hello World </div>');
  });

  it('handles multiline scripts', () => {
    const html = `<div>Before</div>
<script type="text/javascript">
  const x = 1;
  console.log(x);
</script>
<div>After</div>`;
    const result = HtmlExtractor.clean(html);
    expect(result).not.toContain('console');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });

  it('preserves data-testid and role attributes', () => {
    const html = '<button data-testid="submit" role="button">Submit</button>';
    expect(HtmlExtractor.clean(html)).toBe(html);
  });
});

describe('HtmlExtractor.extract', () => {
  it('extracts and cleans HTML from page', async () => {
    const mockPage = {
      content: vi.fn().mockResolvedValue('<div>Hello</div><script>evil()</script>'),
    };

    const extractor = new HtmlExtractor();
    const result = await extractor.extract(mockPage as never);
    expect(result).toBe('<div>Hello</div>');
    expect(mockPage.content).toHaveBeenCalledOnce();
  });

  it('truncates HTML that exceeds maxLength', async () => {
    const longHtml = '<div>' + 'x'.repeat(20_000) + '</div>';
    const mockPage = {
      content: vi.fn().mockResolvedValue(longHtml),
    };

    const extractor = new HtmlExtractor(100);
    const result = await extractor.extract(mockPage as never);
    expect(result.length).toBe(100);
  });
});
