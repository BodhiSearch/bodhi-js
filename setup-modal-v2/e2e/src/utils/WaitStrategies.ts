import { type FrameLocator } from '@playwright/test';

export class WaitStrategiesV2 {
  static async waitForProbeStatus(iframe: FrameLocator, status: string): Promise<void> {
    await iframe.locator(`[data-test-probe-status="${status}"]`).waitFor({ state: 'attached' });
  }
}
