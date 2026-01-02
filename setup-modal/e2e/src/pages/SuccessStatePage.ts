/**
 * SuccessStatePage - Page object for Success State (Complete) step
 * Extends BaseModalPage with success state specific methods
 */

import { type Page } from '@playwright/test';
import { BaseModalPage } from './BaseModalPage.js';

export class SuccessStatePage extends BaseModalPage {
  constructor(page: Page, iframeSelector?: string) {
    super(page, iframeSelector);
  }

  /**
   * Wait for success state page to load
   * Waits for loading to complete and step to be visible
   */
  async waitForPageLoad(): Promise<void> {
    await this.waitForLoadingComplete();
    await this.waitForStepVisible('success-state-step');
  }

  /**
   * Check if the page contains specific text
   * @param text - The text to search for
   * @returns true if text is found on the page
   * @deprecated Use expectToBeComplete or other domain-specific expect methods instead
   */
  async hasText(text: string): Promise<boolean> {
    const successStateStep = this.getByTestId('success-state-step');
    const textContent = await successStateStep.textContent();
    return textContent?.includes(text) ?? false;
  }

  /**
   * Expect success state with "All Systems Ready!" message
   */
  async expectToBeComplete(): Promise<void> {
    await this.expectTextInStep('success-state-step', 'All Systems Ready!');
  }

  /**
   * Expect success state to be displayed
   */
  async expectToBeDisplayed(): Promise<void> {
    await this.waitForStepVisible('success-state-step');
    await this.expectStepIndicatorCount(5);
  }

  /**
   * Wait for success state step to be visible
   */
  async waitForStepToBeVisible(): Promise<void> {
    await this.getByTestId('success-state-step').waitFor();
  }

  /**
   * Wait for "All Systems Ready!" message to appear
   */
  async waitForAllSystemsReady(): Promise<void> {
    await this.iframe.getByText('All Systems Ready!').waitFor();
  }

  /**
   * Expect success state step contains "All Systems Ready!" message
   */
  async expectSuccessStateVisible(): Promise<void> {
    await this.getByTestId('success-state-step').getByText('All Systems Ready!', { exact: false }).waitFor({ state: 'visible' });
  }

  /**
   * Click Continue button
   */
  async clickContinueButton(): Promise<void> {
    await this.getByTestId('continue-button').click();
  }

  /**
   * Expect LNA status row contains specific status text
   * @param status - Expected status text
   */
  async expectLnaStatusRow(status: string): Promise<void> {
    await this.getByTestId('lna-status-row').getByText(status, { exact: false }).waitFor({ state: 'visible' });
  }

  /**
   * Expect Extension status row contains specific status text
   * @param status - Expected status text
   */
  async expectExtensionStatusRow(status: string): Promise<void> {
    await this.getByTestId('extension-status-row').getByText(status, { exact: false }).waitFor({ state: 'visible' });
  }

  /**
   * Expect LNA server status text to match specific value
   * @param text - Expected exact text
   */
  async expectLnaServerStatusText(text: string): Promise<void> {
    const statusText = this.getByTestId('lna-server-status-text');
    await statusText.waitFor({ state: 'visible' });
    const actualText = await statusText.textContent();
    if (actualText !== text) throw new Error(`Expected text ${text} but got ${actualText}`);
  }

  /**
   * Expect platform status text to match specific value
   * @param text - Expected exact text
   */
  async expectPlatformStatusText(text: string): Promise<void> {
    const statusText = this.getByTestId('platform-status-text');
    await statusText.waitFor({ state: 'visible' });
    const actualText = await statusText.textContent();
    if (actualText !== text) throw new Error(`Expected text ${text} but got ${actualText}`);
  }

  /**
   * Expect extension status text to match specific value
   * @param text - Expected exact text
   */
  async expectExtensionStatusText(text: string): Promise<void> {
    const statusText = this.getByTestId('extension-status-text');
    await statusText.waitFor({ state: 'visible' });
    const actualText = await statusText.textContent();
    if (actualText !== text) throw new Error(`Expected text ${text} but got ${actualText}`);
  }

  /**
   * Expect server status text to match specific value
   * @param text - Expected exact text
   */
  async expectServerStatusText(text: string): Promise<void> {
    const statusText = this.getByTestId('server-status-text');
    await statusText.waitFor({ state: 'visible' });
    const actualText = await statusText.textContent();
    if (actualText !== text) throw new Error(`Expected text ${text} but got ${actualText}`);
  }

  // Connection Selection Methods

  /**
   * Get the LNA connection radio button
   */
  getLnaRadio() {
    return this.getByTestId('connection-lna');
  }

  /**
   * Get the Extension connection radio button
   */
  getExtensionRadio() {
    return this.getByTestId('connection-extension');
  }

  /**
   * Get the LNA connection hint (shown when LNA path is not complete)
   */
  getLnaHint() {
    return this.getByTestId('connection-lna-hint');
  }

  /**
   * Get the Extension connection hint (shown when extension path is not complete)
   */
  getExtensionHint() {
    return this.getByTestId('connection-extension-hint');
  }

  /**
   * Click LNA connection radio to select LNA path
   */
  async selectLnaConnection(): Promise<void> {
    await this.getLnaRadio().click();
  }

  /**
   * Click Extension connection radio to select Extension path
   */
  async selectExtensionConnection(): Promise<void> {
    await this.getExtensionRadio().click();
  }

  /**
   * Expect LNA radio to be selected (aria-checked="true")
   */
  async expectLnaRadioSelected(): Promise<void> {
    const lnaRadio = this.getLnaRadio();
    await lnaRadio.waitFor({ state: 'visible' });
    const ariaChecked = await lnaRadio.getAttribute('aria-checked');
    if (ariaChecked !== 'true') throw new Error(`Expected LNA radio to be selected but aria-checked="${ariaChecked}"`);
  }

  /**
   * Expect Extension radio to be selected (aria-checked="true")
   */
  async expectExtensionRadioSelected(): Promise<void> {
    const extRadio = this.getExtensionRadio();
    await extRadio.waitFor({ state: 'visible' });
    const ariaChecked = await extRadio.getAttribute('aria-checked');
    if (ariaChecked !== 'true') throw new Error(`Expected Extension radio to be selected but aria-checked="${ariaChecked}"`);
  }

  /**
   * Expect LNA radio to be unselected (aria-checked="false")
   */
  async expectLnaRadioNotSelected(): Promise<void> {
    const lnaRadio = this.getLnaRadio();
    await lnaRadio.waitFor({ state: 'visible' });
    const ariaChecked = await lnaRadio.getAttribute('aria-checked');
    if (ariaChecked !== 'false') throw new Error(`Expected LNA radio to be unselected but aria-checked="${ariaChecked}"`);
  }

  /**
   * Expect Extension radio to be unselected (aria-checked="false")
   */
  async expectExtensionRadioNotSelected(): Promise<void> {
    const extRadio = this.getExtensionRadio();
    await extRadio.waitFor({ state: 'visible' });
    const ariaChecked = await extRadio.getAttribute('aria-checked');
    if (ariaChecked !== 'false') throw new Error(`Expected Extension radio to be unselected but aria-checked="${ariaChecked}"`);
  }

  /**
   * Expect LNA hint to be visible with specific text
   */
  async expectLnaHintText(text: string): Promise<void> {
    const hint = this.getLnaHint();
    await hint.waitFor({ state: 'visible' });
    const actualText = await hint.textContent();
    if (actualText !== text) throw new Error(`Expected LNA hint "${text}" but got "${actualText}"`);
  }

  /**
   * Expect Extension hint to be visible with specific text
   */
  async expectExtensionHintText(text: string): Promise<void> {
    const hint = this.getExtensionHint();
    await hint.waitFor({ state: 'visible' });
    const actualText = await hint.textContent();
    if (actualText !== text) throw new Error(`Expected Extension hint "${text}" but got "${actualText}"`);
  }
}
