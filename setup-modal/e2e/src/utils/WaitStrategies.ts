/**
 * WaitStrategies - Static waiting patterns for modal interactions
 */

import { type FrameLocator } from '@playwright/test';

export class WaitStrategies {
  /**
   * Wait for loading indicator to disappear
   * @param iframe - FrameLocator for the modal iframe
   */
  static async waitForLoadingComplete(iframe: FrameLocator): Promise<void> {
    const loadingIndicator = iframe.getByTestId('loading-indicator');
    await loadingIndicator.waitFor({ state: 'hidden' });
  }

  /**
   * Wait for a specific step to become visible
   * @param iframe - FrameLocator for the modal iframe
   * @param stepTestId - Test ID of the step to wait for
   */
  static async waitForStepVisible(iframe: FrameLocator, stepTestId: string): Promise<void> {
    const stepElement = iframe.getByTestId(stepTestId);
    await stepElement.waitFor({ state: 'visible' });
  }
}
