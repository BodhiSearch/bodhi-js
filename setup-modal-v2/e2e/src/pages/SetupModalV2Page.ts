import { type Page } from '@playwright/test';
import { SetupScreenPage } from './SetupScreenPage.js';
import { IframeHelperV2 } from '../utils/IframeHelper.js';

export class SetupModalV2Page {
  readonly screen: SetupScreenPage;

  constructor(
    private readonly page: Page,
    private readonly iframeSelector?: string
  ) {
    this.screen = new SetupScreenPage(page, iframeSelector);
  }

  async waitForModalReady(): Promise<void> {
    await IframeHelperV2.waitForModalReady(this.page, this.iframeSelector);
  }

  async clickClose(): Promise<void> {
    const iframe = IframeHelperV2.getFrameLocator(this.page, this.iframeSelector);
    await iframe.getByTestId('btn-close').click();
  }
}
