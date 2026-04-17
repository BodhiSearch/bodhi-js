import { type Page, type Locator, type FrameLocator } from '@playwright/test';
import { IframeHelperV2 } from '../utils/IframeHelper.js';
import { WaitStrategiesV2 } from '../utils/WaitStrategies.js';

export class BaseModalV2Page {
  protected readonly page: Page;
  protected readonly iframe: FrameLocator;

  constructor(page: Page, iframeSelector?: string) {
    this.page = page;
    this.iframe = IframeHelperV2.getFrameLocator(page, iframeSelector);
  }

  protected getByTestId(testId: string): Locator {
    return this.iframe.getByTestId(testId);
  }

  async waitForProbeStatus(status: string): Promise<void> {
    await WaitStrategiesV2.waitForProbeStatus(this.iframe, status);
  }

  async clickCloseButton(): Promise<void> {
    await this.getByTestId('btn-close').click();
  }
}
