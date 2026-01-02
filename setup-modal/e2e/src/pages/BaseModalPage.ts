/**
 * BaseModalPage - Base class for all modal page objects
 * Provides iframe abstraction and common modal interactions
 */

import { type Page, type Locator, type FrameLocator } from '@playwright/test';
import { IframeHelper } from '../utils/IframeHelper.js';
import { WaitStrategies } from '../utils/WaitStrategies.js';

export class BaseModalPage {
  protected readonly page: Page;
  protected readonly iframe: FrameLocator;

  constructor(page: Page, iframeSelector?: string) {
    this.page = page;
    this.iframe = IframeHelper.getFrameLocator(page, iframeSelector);
  }

  /**
   * Get element by data-testid within iframe context
   * @param testId - The data-testid value
   * @returns Locator for the element within iframe
   */
  protected getByTestId(testId: string): Locator {
    return this.iframe.getByTestId(testId);
  }

  /**
   * Wait for loading indicator to disappear
   */
  async waitForLoadingComplete(): Promise<void> {
    await WaitStrategies.waitForLoadingComplete(this.iframe);
  }

  /**
   * Wait for a specific step to become visible
   * @param stepTestId - Test ID of the step to wait for
   */
  async waitForStepVisible(stepTestId: string): Promise<void> {
    await WaitStrategies.waitForStepVisible(this.iframe, stepTestId);
  }

  /**
   * Get count of step indicators
   * @returns Number of step indicators
   */
  async getStepIndicatorCount(): Promise<number> {
    const stepIndicators = this.iframe.locator('[data-testid^="step-"]');
    return await stepIndicators.count();
  }

  /**
   * Check if a specific step indicator is visible
   * @param stepId - The step identifier (e.g., 'platform-check', 'server-setup')
   * @returns true if step indicator is visible
   */
  async isStepIndicatorVisible(stepId: string): Promise<boolean> {
    const stepIndicator = this.getByTestId(`step-${stepId}`);
    return await stepIndicator.isVisible();
  }

  /**
   * Wait for specific text to be visible within step
   * Note: This is a wait operation, not an assertion
   * @param stepTestId - Step test ID to search within
   * @param text - Text to wait for
   */
  async expectTextInStep(stepTestId: string, text: string): Promise<void> {
    const step = this.getByTestId(stepTestId);
    await step.waitFor({ state: 'visible' });

    const actualText = await step.textContent();
    if (!actualText?.includes(text)) {
      throw new Error(`Expected text "${text}" not found in step "${stepTestId}". Actual: "${actualText}"`);
    }
  }

  /**
   * Wait for step indicator count to match
   * Note: This waits and throws if count doesn't match
   * @param count - Expected number of step indicators
   */
  async expectStepIndicatorCount(count: number): Promise<void> {
    const stepIndicators = this.iframe.locator('[data-testid^="step-"]');
    await stepIndicators.first().waitFor(); // Wait for at least one
    const actualCount = await stepIndicators.count();
    if (actualCount !== count) {
      throw new Error(`Expected ${count} step indicators but found ${actualCount}`);
    }
  }

  /**
   * Wait for specific step indicator to be visible
   * @param stepId - Step identifier
   */
  async expectStepIndicatorVisible(stepId: string): Promise<void> {
    const stepIndicator = this.getByTestId(`step-${stepId}`);
    await stepIndicator.waitFor({ state: 'visible' });
  }

  /**
   * Click close button to dismiss modal
   */
  async clickCloseButton(): Promise<void> {
    await this.getByTestId('close-button').click();
  }

  async clickRefreshButton(): Promise<void> {
    await this.getByTestId('refresh-button').click();
  }

  /**
   * Wait for text to appear anywhere in iframe
   * @param text - Text to wait for
   */
  async waitForText(text: string): Promise<void> {
    await this.iframe.getByText(text).waitFor();
  }

  /**
   * Click step indicator for navigation
   * @param stepId - Step identifier (e.g., 'platform-check', 'server-setup')
   */
  async clickStepIndicator(stepId: string): Promise<void> {
    await this.getByTestId(`step-${stepId}`).click();
  }
}
