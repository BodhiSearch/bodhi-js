/**
 * PlatformCheckPage - Page object for Platform Check step
 * Extends BaseModalPage with platform check specific methods
 */

import { type Page } from '@playwright/test';
import { BaseModalPage } from './BaseModalPage.js';

export class PlatformCheckPage extends BaseModalPage {
  constructor(page: Page, iframeSelector?: string) {
    super(page, iframeSelector);
  }

  /**
   * Wait for platform check page to load
   * Waits for loading to complete and step to be visible
   */
  async waitForPageLoad(): Promise<void> {
    await this.waitForLoadingComplete();
    await this.waitForStepVisible('platform-check-step');
  }

  /**
   * Check if the page contains specific text
   * @param text - The text to search for
   * @returns true if text is found on the page
   * @deprecated Use expectPlatformCompatibilityCheck or other domain-specific expect methods instead
   */
  async hasText(text: string): Promise<boolean> {
    const platformCheckStep = this.getByTestId('platform-check-step');
    const textContent = await platformCheckStep.textContent();
    return textContent?.includes(text) ?? false;
  }

  /**
   * Expect platform compatibility check heading
   */
  async expectPlatformCompatibilityCheck(): Promise<void> {
    await this.expectTextInStep('platform-check-step', 'Platform Compatibility Check');
  }

  /**
   * Expect platform check to be displayed
   */
  async expectToBeDisplayed(): Promise<void> {
    await this.waitForStepVisible('platform-check-step');
    await this.expectStepIndicatorCount(5);
  }
}
