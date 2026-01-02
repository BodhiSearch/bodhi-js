/**
 * LnaSetupPage - Page object for LNA Setup step
 * Extends BaseModalPage with LNA setup specific methods
 */

import { type Page, type Locator } from '@playwright/test';
import { BaseModalPage } from './BaseModalPage.js';

export class LnaSetupPage extends BaseModalPage {
  constructor(page: Page, iframeSelector?: string) {
    super(page, iframeSelector);
  }

  /**
   * Wait for LNA setup page to load
   * Waits for loading to complete and step to be visible
   */
  async waitForPageLoad(): Promise<void> {
    await this.waitForLoadingComplete();
    await this.waitForStepVisible('lna-setup-step');
  }

  /**
   * Check if the page contains specific text
   * @param text - The text to search for
   * @returns true if text is found on the page
   * @deprecated Use domain-specific expect methods instead
   */
  async hasText(text: string): Promise<boolean> {
    const lnaSetupStep = this.getByTestId('lna-setup-step');
    const textContent = await lnaSetupStep.textContent();
    return textContent?.includes(text) ?? false;
  }

  /**
   * Expect direct connection option visible
   */
  async expectDirectConnectionOption(): Promise<void> {
    await this.expectTextInStep('lna-setup-step', 'Direct Connection');
  }

  /**
   * Expect LNA connected status
   */
  async expectLnaConnected(): Promise<void> {
    await this.expectTextInStep('lna-setup-step', 'Direct');
  }

  /**
   * Expect LNA setup to be displayed
   */
  async expectToBeDisplayed(): Promise<void> {
    await this.waitForStepVisible('lna-setup-step');
    await this.expectStepIndicatorCount(5);
  }

  // ========== A. Wait Methods ==========

  /**
   * Wait for LNA setup step to be visible
   */
  async waitForStepToBeVisible(): Promise<void> {
    await this.getByTestId('lna-setup-step').waitFor();
  }

  // ========== B. URL Input Methods ==========

  /**
   * Get URL input value
   * @returns Current value in the URL input field
   */
  async getUrlInputValue(): Promise<string> {
    return await this.getByTestId('lna-url-input').inputValue();
  }

  /**
   * Set URL input value
   * @param url - URL to set in the input field
   */
  async setUrlInput(url: string): Promise<void> {
    await this.getByTestId('lna-url-input').fill(url);
  }

  /**
   * Expect URL input to have specific value
   * @param expectedValue - Expected value in the URL input
   */
  async expectUrlInputValue(expectedValue: string): Promise<void> {
    const value = await this.getByTestId('lna-url-input').inputValue();
    if (value !== expectedValue) throw new Error(`Expected value ${expectedValue} but got ${value}`);
  }

  /**
   * Expect URL input to be visible
   */
  async expectUrlInputVisible(): Promise<void> {
    await this.getByTestId('lna-url-input').waitFor({ state: 'visible' });
  }

  // ========== C. Connect Button Methods ==========

  /**
   * Click Connect button
   */
  async clickConnectButton(): Promise<void> {
    await this.getByTestId('lna-connect-button').click();
  }

  /**
   * Expect Connect button to be visible
   */
  async expectConnectButtonVisible(): Promise<void> {
    await this.getByTestId('lna-connect-button').waitFor({ state: 'visible' });
  }

  /**
   * Expect Connect button to contain specific text
   * @param text - Expected button text ('Connect', 'Reconnect', or 'Try Again')
   */
  async expectConnectButtonText(text: 'Connect' | 'Reconnect' | 'Try Again'): Promise<void> {
    await this.getByTestId('lna-connect-button').getByText(text, { exact: false }).waitFor({ state: 'visible' });
  }

  // ========== D. Skip Button Methods ==========

  /**
   * Click Skip button
   */
  async clickSkipButton(): Promise<void> {
    await this.getByTestId('lna-skip-button').click();
  }

  /**
   * Expect Skip button to be visible
   */
  async expectSkipButtonVisible(): Promise<void> {
    await this.getByTestId('lna-skip-button').waitFor({ state: 'visible' });
  }

  /**
   * Expect Skip button to not be visible
   */
  async expectSkipButtonNotVisible(): Promise<void> {
    const isVisible = await this.getByTestId('lna-skip-button').isVisible();
    if (isVisible) throw new Error('Expected lna-skip-button to not be visible');
  }

  // ========== E. Accordion Methods ==========

  /**
   * Click accordion header
   */
  async clickAccordionHeader(): Promise<void> {
    await this.getByTestId('lna-accordion-header').click();
  }

  /**
   * Expect accordion header to contain specific text
   * @param text - Expected header text
   */
  async expectAccordionHeaderText(text: string): Promise<void> {
    await this.getByTestId('lna-accordion-header').getByText(text, { exact: false }).waitFor({ state: 'visible' });
  }

  // ========== F. Connection State Methods ==========

  /**
   * Expect "Connection Failed" message
   */
  async expectConnectionFailed(): Promise<void> {
    await this.expectTextInStep('lna-setup-step', 'Connection Failed');
  }

  /**
   * Expect "Could not connect to server" error message
   */
  async expectConnectionErrorMessage(): Promise<void> {
    await this.expectTextInStep('lna-setup-step', 'Could not connect to server');
  }

  /**
   * Expect "Permission Denied" message
   */
  async expectPermissionDenied(): Promise<void> {
    await this.expectTextInStep('lna-setup-step', 'Permission Denied');
  }

  /**
   * Expect "Local network access permission denied" message
   */
  async expectPermissionDeniedMessage(): Promise<void> {
    await this.expectTextInStep('lna-setup-step', 'Local network access permission denied');
  }

  /**
   * Expect "Direct connection skipped" message
   */
  async expectDirectConnectionSkipped(): Promise<void> {
    await this.expectTextInStep('lna-setup-step', 'Direct connection skipped');
  }

  /**
   * Expect URL to appear in connected message
   * @param url - URL expected in the message
   */
  async expectUrlInConnectedMessage(url: string): Promise<void> {
    await this.expectTextInStep('lna-setup-step', url);
  }

  // ========== G. Server Status Methods ==========

  /**
   * Expect server status indicator to be visible
   */
  async expectServerStatusVisible(): Promise<void> {
    await this.getByTestId('lna-server-status').waitFor({ state: 'visible' });
  }

  /**
   * Expect "Checking server" status message
   */
  async expectServerStatusChecking(): Promise<void> {
    await this.getByTestId('lna-server-status').getByText('Checking server', { exact: false }).waitFor({ state: 'visible' });
  }

  /**
   * Expect "Server requires initial setup" status message
   */
  async expectServerStatusSetupRequired(): Promise<void> {
    await this.getByTestId('lna-server-status').getByText('Server requires initial setup', { exact: false }).waitFor({ state: 'visible' });
  }

  /**
   * Expect "Server connection error" status message
   */
  async expectServerStatusError(): Promise<void> {
    await this.getByTestId('lna-server-status').getByText('Server connection error', { exact: false }).first().waitFor({ state: 'visible' });
  }

  /**
   * Expect "Server requires resource configuration" status message
   */
  async expectServerStatusResourceConfig(): Promise<void> {
    await this.getByTestId('lna-server-status').getByText('Server requires resource configuration', { exact: false }).waitFor({ state: 'visible' });
  }

  // ========== H. Server Link Methods ==========

  /**
   * Get setup link locator (private helper for DRY)
   * @private
   */
  private getSetupLink(): Locator {
    return this.getByTestId('lna-server-setup-link');
  }

  /**
   * Get admin link locator (private helper for DRY)
   * @private
   */
  private getAdminLink(): Locator {
    return this.getByTestId('lna-server-admin-link');
  }

  /**
   * Click server setup link
   */
  async clickSetupLink(): Promise<void> {
    await this.getSetupLink().click();
  }

  /**
   * Expect setup link to be visible
   */
  async expectSetupLinkVisible(): Promise<void> {
    await this.getSetupLink().waitFor({ state: 'visible' });
  }

  /**
   * Expect setup link to contain specific text
   * @param text - Expected link text
   */
  async expectSetupLinkText(text: string): Promise<void> {
    await this.getSetupLink().getByText(text, { exact: false }).waitFor({ state: 'visible' });
  }

  /**
   * Click server admin link
   */
  async clickAdminLink(): Promise<void> {
    await this.getAdminLink().click();
  }

  /**
   * Expect admin link to be visible
   */
  async expectAdminLinkVisible(): Promise<void> {
    await this.getAdminLink().waitFor({ state: 'visible' });
  }

  /**
   * Expect admin link to contain specific text
   * @param text - Expected link text
   */
  async expectAdminLinkText(text: string): Promise<void> {
    await this.getAdminLink().getByText(text, { exact: false }).waitFor({ state: 'visible' });
  }
}
