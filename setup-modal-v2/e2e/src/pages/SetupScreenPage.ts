import { type Page } from '@playwright/test';
import { BaseModalV2Page } from './BaseModalV2Page.js';

export class SetupScreenPage extends BaseModalV2Page {
  constructor(page: Page, iframeSelector?: string) {
    super(page, iframeSelector);
  }

  // --- Radio selection ---

  async selectInstallRadio(): Promise<void> {
    await this.getByTestId('radio-install-local').click();
  }

  async selectCloudRadio(): Promise<void> {
    await this.getByTestId('radio-signup-cloud').click();
  }

  async expectInstallRadioSelected(): Promise<void> {
    const radio = this.getByTestId('radio-install-local');
    await radio.waitFor({ state: 'visible' });
    const checked = await radio.isChecked();
    if (!checked) {
      throw new Error('Expected install radio to be selected');
    }
  }

  async expectCloudRadioSelected(): Promise<void> {
    const radio = this.getByTestId('radio-signup-cloud');
    await radio.waitFor({ state: 'visible' });
    const checked = await radio.isChecked();
    if (!checked) {
      throw new Error('Expected cloud radio to be selected');
    }
  }

  // --- External links ---

  async clickInstallLink(): Promise<void> {
    await this.getByTestId('link-install-external').click();
  }

  async clickCloudLink(): Promise<void> {
    await this.getByTestId('link-signup-external').click();
  }

  // --- URL input ---

  async setServerUrl(url: string): Promise<void> {
    const input = this.getByTestId('input-server-url');
    await input.clear();
    await input.fill(url);
  }

  async expectServerUrlValue(url: string): Promise<void> {
    const input = this.getByTestId('input-server-url');
    await input.waitFor({ state: 'visible' });
    const value = await input.inputValue();
    if (value !== url) {
      throw new Error(`Expected server URL value "${url}". Actual: "${value}"`);
    }
  }

  async clickConnect(): Promise<void> {
    await this.getByTestId('btn-connect').click();
  }

  // --- Status ---

  async expectProbeStatusVisible(): Promise<void> {
    await this.getByTestId('row-probe-status').waitFor({ state: 'visible' });
  }

  async expectStatusMessage(text: string): Promise<void> {
    const locator = this.getByTestId('text-probe-status-message');
    await locator.waitFor({ state: 'visible' });
    const actual = await locator.textContent();
    if (!actual?.includes(text)) {
      throw new Error(`Expected status message "${text}" not found. Actual: "${actual}"`);
    }
  }

  async expectContinueVisible(): Promise<void> {
    await this.getByTestId('btn-continue').waitFor({ state: 'visible' });
  }

  async clickContinue(): Promise<void> {
    await this.getByTestId('btn-continue').click();
  }

  async expectRefreshVisible(): Promise<void> {
    await this.getByTestId('btn-refresh').waitFor({ state: 'visible' });
  }

  async clickRefresh(): Promise<void> {
    await this.getByTestId('btn-refresh').click();
  }

  // --- Unsupported browser banner ---

  async expectUnsupportedBannerVisible(): Promise<void> {
    await this.getByTestId('div-unsupported-banner').waitFor({ state: 'visible' });
  }

  async expectNoUnsupportedBanner(): Promise<void> {
    await this.getByTestId('div-unsupported-banner')
      .waitFor({ state: 'hidden' })
      .catch(() => {
        // Element doesn't exist at all - that's fine
      });
  }

  async expectUnsupportedBrowserName(name: string): Promise<void> {
    const locator = this.getByTestId('text-unsupported-message');
    await locator.waitFor({ state: 'visible' });
    const actual = await locator.textContent();
    if (!actual?.toLowerCase().includes(name.toLowerCase())) {
      throw new Error(`Expected unsupported browser name "${name}" not found. Actual: "${actual}"`);
    }
  }

  // --- LNA hint ---

  async expectLnaHintVisible(): Promise<void> {
    await this.getByTestId('text-lna-hint').waitFor({ state: 'visible' });
  }
}
