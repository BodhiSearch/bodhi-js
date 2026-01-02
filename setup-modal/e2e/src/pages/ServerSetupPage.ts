/**
 * ServerSetupPage - Page object for Server Setup step
 * Extends BaseModalPage with server setup specific methods
 */

import { type Page } from '@playwright/test';
import { BaseModalPage } from './BaseModalPage.js';

export class ServerSetupPage extends BaseModalPage {
  constructor(page: Page, iframeSelector?: string) {
    super(page, iframeSelector);
  }

  /**
   * Wait for server setup page to load
   * Waits for loading to complete and step to be visible
   */
  async waitForPageLoad(): Promise<void> {
    await this.waitForLoadingComplete();
    await this.waitForStepVisible('server-setup-step');
  }

  /**
   * Check if the page contains specific text
   * @param text - The text to search for
   * @returns true if text is found on the page
   * @deprecated Use expectServerInstallCheckboxVisible or other domain-specific expect methods instead
   */
  async hasText(text: string): Promise<boolean> {
    const serverSetupStep = this.getByTestId('server-setup-step');
    const textLocator = serverSetupStep.getByText(text, { exact: false });
    return await textLocator.isVisible().catch(() => false);
  }

  /**
   * Expect server install confirmation checkbox to be visible
   */
  async expectServerInstallCheckboxVisible(): Promise<void> {
    await this.expectTextInStep('server-setup-step', 'I have installed the Bodhi App Server');
  }

  /**
   * Expect server setup step to be displayed
   */
  async expectToBeDisplayed(): Promise<void> {
    await this.waitForStepVisible('server-setup-step');
    await this.expectStepIndicatorCount(5);
  }

  /**
   * Click server install confirmation checkbox
   */
  async clickConfirmCheckbox(): Promise<void> {
    await this.getByTestId('server-confirm-checkbox').click();
  }

  /**
   * Expect server confirm checkbox to be checked
   */
  async expectConfirmCheckboxChecked(): Promise<void> {
    const isChecked = await this.getByTestId('server-confirm-checkbox').isChecked();
    if (!isChecked) throw new Error('Expected checkbox to be checked');
  }

  /**
   * Expect server confirm checkbox to be unchecked
   */
  async expectConfirmCheckboxUnchecked(): Promise<void> {
    const isChecked = await this.getByTestId('server-confirm-checkbox').isChecked();
    if (isChecked) throw new Error('Expected checkbox to not be checked');
  }

  /**
   * Expect server setup step to be visible
   */
  async expectServerSetupVisible(): Promise<void> {
    await this.waitForStepVisible('server-setup-step');
  }

  /**
   * Expect OS dropdown contains specific OS name
   * @param osName - Expected OS name to be found in dropdown
   */
  async expectOsDropdownContains(osName: string): Promise<void> {
    const osDropdown = this.getByTestId('os-dropdown');
    await osDropdown.waitFor({ state: 'visible' });
    await osDropdown.getByText(osName, { exact: false }).waitFor({ state: 'visible' });
  }

  /**
   * Expect download button to be visible
   */
  async expectDownloadButtonVisible(): Promise<void> {
    const downloadButton = this.iframe.locator('button:has-text("Download Bodhi App Server")');
    await downloadButton.waitFor({ state: 'visible' });
  }
}
