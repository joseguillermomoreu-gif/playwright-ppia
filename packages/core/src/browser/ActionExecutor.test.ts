import { describe, expect, it, vi } from 'vitest';

import { ActionExecutor } from './ActionExecutor.js';
import type { ExploreAction } from './ActionExecutor.js';

function createMockPage(): Record<string, unknown> {
  const mockLocator = {
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
  };

  return {
    locator: vi.fn().mockReturnValue(mockLocator),
    getByRole: vi.fn().mockReturnValue(mockLocator),
    getByLabel: vi.fn().mockReturnValue(mockLocator),
    getByTestId: vi.fn().mockReturnValue(mockLocator),
    getByText: vi.fn().mockReturnValue(mockLocator),
    goto: vi.fn().mockResolvedValue(undefined),
    _mockLocator: mockLocator,
  };
}

describe('ActionExecutor', () => {
  it('executes click with CSS selector', async () => {
    const page = createMockPage();
    const executor = new ActionExecutor(page as never);

    await executor.execute({ action: 'click', target: '#submit', value: null });

    expect(page.locator).toHaveBeenCalledWith('#submit');
    expect((page._mockLocator as Record<string, unknown>).click).toHaveBeenCalled();
  });

  it('executes click with getByRole selector', async () => {
    const page = createMockPage();
    const executor = new ActionExecutor(page as never);

    await executor.execute({
      action: 'click',
      target: 'getByRole("button", { name: "Submit" })',
      value: null,
    });

    expect(page.getByRole).toHaveBeenCalledWith('button', { name: 'Submit' });
  });

  it('executes click with getByRole without name', async () => {
    const page = createMockPage();
    const executor = new ActionExecutor(page as never);

    await executor.execute({
      action: 'click',
      target: 'getByRole("navigation")',
      value: null,
    });

    expect(page.getByRole).toHaveBeenCalledWith('navigation');
  });

  it('executes click with getByLabel selector', async () => {
    const page = createMockPage();
    const executor = new ActionExecutor(page as never);

    await executor.execute({
      action: 'click',
      target: 'getByLabel("Email")',
      value: null,
    });

    expect(page.getByLabel).toHaveBeenCalledWith('Email');
  });

  it('executes click with getByTestId selector', async () => {
    const page = createMockPage();
    const executor = new ActionExecutor(page as never);

    await executor.execute({
      action: 'click',
      target: 'getByTestId("submit-btn")',
      value: null,
    });

    expect(page.getByTestId).toHaveBeenCalledWith('submit-btn');
  });

  it('executes click with getByText selector', async () => {
    const page = createMockPage();
    const executor = new ActionExecutor(page as never);

    await executor.execute({
      action: 'click',
      target: 'getByText("Welcome")',
      value: null,
    });

    expect(page.getByText).toHaveBeenCalledWith('Welcome');
  });

  it('executes fill action', async () => {
    const page = createMockPage();
    const executor = new ActionExecutor(page as never);

    await executor.execute({
      action: 'fill',
      target: 'getByLabel("Username")',
      value: 'admin',
    });

    expect(page.getByLabel).toHaveBeenCalledWith('Username');
    expect((page._mockLocator as Record<string, unknown>).fill).toHaveBeenCalledWith('admin');
  });

  it('executes fill with empty string when value is null', async () => {
    const page = createMockPage();
    const executor = new ActionExecutor(page as never);

    await executor.execute({
      action: 'fill',
      target: '#input',
      value: null,
    });

    expect((page._mockLocator as Record<string, unknown>).fill).toHaveBeenCalledWith('');
  });

  it('executes navigate action', async () => {
    const page = createMockPage();
    const executor = new ActionExecutor(page as never);

    await executor.execute({
      action: 'navigate',
      target: 'https://example.com/login',
      value: null,
    });

    expect(page.goto).toHaveBeenCalledWith('https://example.com/login', {
      waitUntil: 'domcontentloaded',
    });
  });

  it('executes wait action', async () => {
    const page = createMockPage();
    const executor = new ActionExecutor(page as never);

    await executor.execute({
      action: 'wait',
      target: 'getByTestId("loading")',
      value: null,
    });

    expect(page.getByTestId).toHaveBeenCalledWith('loading');
    expect((page._mockLocator as Record<string, unknown>).waitFor).toHaveBeenCalledWith({
      state: 'visible',
    });
  });

  it('executes scroll action', async () => {
    const page = createMockPage();
    const executor = new ActionExecutor(page as never);

    await executor.execute({
      action: 'scroll',
      target: '#footer',
      value: null,
    });

    expect(page.locator).toHaveBeenCalledWith('#footer');
    expect((page._mockLocator as Record<string, unknown>).scrollIntoViewIfNeeded).toHaveBeenCalled();
  });

  it('throws descriptive error when action fails', async () => {
    const mockLocator = {
      click: vi.fn().mockRejectedValue(new Error('Element not found')),
    };
    const page = {
      locator: vi.fn().mockReturnValue(mockLocator),
    };
    const executor = new ActionExecutor(page as never);

    const action: ExploreAction = { action: 'click', target: '#missing', value: null };

    await expect(executor.execute(action)).rejects.toThrow(
      'Action "click" failed on "#missing": Element not found',
    );
  });
});
