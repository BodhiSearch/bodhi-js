/**
 * IframeHelper - Static utilities for iframe handling
 */

import { type Page, type FrameLocator } from '@playwright/test';

export class IframeHelper {
  private static readonly DEFAULT_IFRAME_SELECTOR = 'iframe#wizard-iframe';

  /**
   * Get FrameLocator for the setup modal iframe
   * @param page - Playwright Page object
   * @param selector - Optional iframe selector, defaults to data-testid="setup-modal-iframe"
   * @returns FrameLocator for the iframe
   */
  static getFrameLocator(page: Page, selector?: string): FrameLocator {
    const iframeSelector = selector ?? this.DEFAULT_IFRAME_SELECTOR;
    return page.frameLocator(iframeSelector);
  }

  /**
   * Wait for modal iframe to be ready
   * Waits for iframe to be attached and for modal content to have data-test-state="ready"
   * @param page - Playwright Page object
   * @param selector - Optional iframe selector
   */
  static async waitForModalReady(page: Page, selector?: string): Promise<void> {
    const iframeSelector = selector ?? this.DEFAULT_IFRAME_SELECTOR;
    await page.waitForSelector(iframeSelector, { state: 'attached' });

    // Wait for modal content to be ready (attached with data-test-state="ready")
    const frame = this.getFrameLocator(page, selector);
    await frame.locator('[data-testid="div-setup-modal"][data-test-state="ready"]').waitFor({ state: 'attached' });
  }
}
