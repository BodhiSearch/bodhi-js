import { type Page, type FrameLocator } from '@playwright/test';

export class IframeHelperV2 {
  private static readonly DEFAULT_IFRAME_SELECTOR = '[data-testid="iframe-setup-v2"]';

  static getFrameLocator(page: Page, selector?: string): FrameLocator {
    const iframeSelector = selector ?? this.DEFAULT_IFRAME_SELECTOR;
    return page.frameLocator(iframeSelector);
  }

  static async waitForModalReady(page: Page, selector?: string): Promise<void> {
    const iframeSelector = selector ?? this.DEFAULT_IFRAME_SELECTOR;
    await page.waitForSelector(iframeSelector, { state: 'attached' });

    const frame = this.getFrameLocator(page, selector);
    await frame.locator('[data-testid="div-setup-modal-v2"][data-test-state="ready"]').waitFor({ state: 'attached' });
  }
}
