/**
 * ExtensionSetupPage - Page object for Extension Setup step
 * Extends BaseModalPage with extension setup specific methods
 */

import { type Page } from '@playwright/test';
import { BaseModalPage } from './BaseModalPage.js';

export class ExtensionSetupPage extends BaseModalPage {
  constructor(page: Page, iframeSelector?: string) {
    super(page, iframeSelector);
  }

  /**
   * Wait for extension setup page to load
   * Waits for loading to complete and step to be visible
   */
  async waitForPageLoad(): Promise<void> {
    await this.waitForLoadingComplete();
    await this.waitForStepVisible('extension-setup-step');
  }

  /**
   * Check if the page contains specific text
   * @param text - The text to search for
   * @returns true if text is found on the page
   * @deprecated Use domain-specific expect methods instead
   */
  async hasText(text: string): Promise<boolean> {
    const extensionSetupStep = this.getByTestId('extension-setup-step');
    const textLocator = extensionSetupStep.getByText(text, { exact: false });
    return await textLocator.isVisible().catch(() => false);
  }

  /**
   * Check if extension accordion is visible
   * @returns true if extension accordion is visible
   */
  async isExtensionAccordionVisible(): Promise<boolean> {
    const accordion = this.getByTestId('extension-accordion-header');
    return await accordion.isVisible();
  }

  /**
   * Check if server accordion is visible
   * @returns true if server accordion is visible
   */
  async isServerAccordionVisible(): Promise<boolean> {
    const accordion = this.getByTestId('server-accordion-header');
    return await accordion.isVisible();
  }

  /**
   * Expect extension not installed status
   */
  async expectExtensionNotInstalled(): Promise<void> {
    await this.expectTextInStep('extension-setup-step', 'Extension is not installed');
  }

  /**
   * Expect extension unreachable status
   */
  async expectExtensionUnreachable(): Promise<void> {
    await this.expectTextInStep('extension-setup-step', 'Could not connect to extension');
  }

  /**
   * Expect server status accordion visible
   */
  async expectServerStatusAccordion(): Promise<void> {
    await this.expectTextInStep('extension-setup-step', 'Server Status');
  }

  /**
   * Expect extension setup to be displayed
   */
  async expectToBeDisplayed(): Promise<void> {
    await this.waitForStepVisible('extension-setup-step');
    await this.expectStepIndicatorCount(5);
  }

  /**
   * Expect extension setup to be displayed with accordions
   */
  async expectToBeDisplayedWithAccordions(): Promise<void> {
    await this.waitForStepVisible('extension-setup-step');
    const extensionAccordion = this.getByTestId('extension-accordion-header');
    await extensionAccordion.waitFor({ state: 'visible' });
    const serverAccordion = this.getByTestId('server-accordion-header');
    await serverAccordion.waitFor({ state: 'visible' });
    await this.expectStepIndicatorCount(5);
  }

  /**
   * Wait for extension setup step to be visible
   */
  async waitForStepToBeVisible(): Promise<void> {
    await this.getByTestId('extension-setup-step').waitFor();
  }

  /**
   * Expect extension setup step to be visible
   */
  async expectExtensionSetupVisible(): Promise<void> {
    await this.getByTestId('extension-setup-step').waitFor({ state: 'visible' });
  }

  /**
   * Wait for server accordion content to be visible
   */
  async waitForServerAccordionContent(): Promise<void> {
    const serverContent = this.getByTestId('server-accordion-content');
    await serverContent.waitFor({ state: 'visible' });
  }

  /**
   * Expect server accordion content visible
   */
  async expectServerAccordionContentVisible(): Promise<void> {
    const serverContent = this.getByTestId('server-accordion-content');
    await serverContent.waitFor({ state: 'visible' });
  }

  /**
   * Expect specific server error message
   * Uses reliable data-testid selector following best practices
   * @param message - Expected error message text
   */
  async expectServerErrorMessage(message: string): Promise<void> {
    const errorMessage = this.getByTestId('p-server-error-message');
    await errorMessage.waitFor({ state: 'visible' });
    await errorMessage.waitFor({ state: 'visible' });
    const text = await errorMessage.textContent();
    if (text !== message) throw new Error(`Expected text ${message} but got ${text}`);
  }

  /**
   * Expect specific server error code
   * Uses reliable data-testid selector following best practices
   * @param code - Expected error code (partial match with contains)
   */
  async expectServerErrorCode(code: string): Promise<void> {
    const errorCode = this.getByTestId('p-server-error-code');
    await errorCode.waitFor({ state: 'visible' });
    await errorCode.getByText(code, { exact: false }).waitFor({ state: 'visible' });
  }

  /**
   * Expect specific extension error message
   * Uses reliable data-testid selector following best practices
   * @param message - Expected error message text
   */
  async expectExtensionErrorMessage(message: string): Promise<void> {
    const errorMessage = this.getByTestId('p-ext-error-message');
    await errorMessage.waitFor({ state: 'visible' });
    await errorMessage.waitFor({ state: 'visible' });
    const text = await errorMessage.textContent();
    if (text !== message) throw new Error(`Expected text ${message} but got ${text}`);
  }

  /**
   * Expect specific extension error code
   * Uses reliable data-testid selector following best practices
   * @param code - Expected error code (partial match with contains)
   */
  async expectExtensionErrorCode(code: string): Promise<void> {
    const errorCode = this.getByTestId('p-ext-error-code');
    await errorCode.waitFor({ state: 'visible' });
    await errorCode.getByText(code, { exact: false }).waitFor({ state: 'visible' });
  }

  /**
   * Expect server state error for a specific app status
   * Encapsulates domain knowledge about expected error messages for different server states
   * @param appStatus - The app status ('setup' | 'resource-admin')
   */
  async expectServerStateError(appStatus: 'setup' | 'resource-admin'): Promise<void> {
    const expectedMessages = {
      setup: {
        message: 'Bodhi server requires initial setup',
        code: 'server-in-setup-status',
      },
      'resource-admin': {
        message: 'Bodhi server is in admin mode for resource management',
        code: 'server-in-admin-status',
      },
    };

    const expected = expectedMessages[appStatus];

    // Wait for content to be visible after click
    const serverContent = this.getByTestId('server-accordion-content');
    await serverContent.waitFor({ state: 'visible' });

    // Verify error message and code
    const errorMessage = this.getByTestId('p-server-error-message');
    await errorMessage.waitFor({ state: 'visible' });
    await errorMessage.waitFor({ state: 'visible' });
    const text = await errorMessage.textContent();
    if (text !== expected.message) throw new Error(`Expected text ${expected.message} but got ${text}`);

    const errorCode = this.getByTestId('p-server-error-code');
    await errorCode.waitFor({ state: 'visible' });
    await errorCode.getByText(expected.code, { exact: false }).waitFor({ state: 'visible' });
  }

  /**
   * Expect browser dropdown contains specific browser name
   * @param browserName - Expected browser name to be found in dropdown
   */
  async expectBrowserDropdownContains(browserName: string): Promise<void> {
    const browserDropdown = this.getByTestId('browser-dropdown');
    await browserDropdown.waitFor({ state: 'visible' });
    await browserDropdown.getByText(browserName, { exact: false }).waitFor({ state: 'visible' });
  }
}
