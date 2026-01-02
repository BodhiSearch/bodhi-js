/**
 * SetupModalPage - Composed page object for entire setup modal
 * Composes all step pages as readonly properties following component composition pattern
 */

import { type Page } from '@playwright/test';
import { ServerSetupPage } from './ServerSetupPage.js';
import { ExtensionSetupPage } from './ExtensionSetupPage.js';
import { LnaSetupPage } from './LnaSetupPage.js';
import { PlatformCheckPage } from './PlatformCheckPage.js';
import { SuccessStatePage } from './SuccessStatePage.js';
import { IframeHelper } from '../utils/IframeHelper.js';

/**
 * SetupModalPage provides access to all modal step pages through composition.
 * All step pages share the same Page and iframe context.
 */
export class SetupModalPage {
  readonly serverSetup: ServerSetupPage;
  readonly extensionSetup: ExtensionSetupPage;
  readonly lnaSetup: LnaSetupPage;
  readonly platformCheck: PlatformCheckPage;
  readonly successState: SuccessStatePage;

  constructor(
    private readonly page: Page,
    private readonly iframeSelector?: string
  ) {
    // Initialize all step pages with same iframe context
    this.serverSetup = new ServerSetupPage(page, iframeSelector);
    this.extensionSetup = new ExtensionSetupPage(page, iframeSelector);
    this.lnaSetup = new LnaSetupPage(page, iframeSelector);
    this.platformCheck = new PlatformCheckPage(page, iframeSelector);
    this.successState = new SuccessStatePage(page, iframeSelector);
  }

  /**
   * Wait for modal iframe to be ready
   * Delegates to IframeHelper
   */
  async waitForModalReady(): Promise<void> {
    await IframeHelper.waitForModalReady(this.page, this.iframeSelector);
  }
}
