import type { Locator } from '@playwright/test';

/**
 * Dispatch a synthetic click on an element via `dispatchEvent` instead of
 * Playwright's mouse-event simulation.
 *
 * Background: when the modal is rendered inside a same-origin iframe served
 * from a `chrome-extension://` URL and Chrome is running in new headless mode
 * (`channel: 'chromium'` + `headless: true`), Playwright's `.click()` silently
 * drops mouse events on certain controls — no `mousedown`/`mouseup`/`click`
 * fires on the target at all. Triggering the click via `dispatchEvent` bypasses
 * the broken input simulation and reaches React's event delegation normally.
 *
 * Use only on iframe-internal controls that exhibit this issue. For top-level
 * page elements or buttons, prefer the regular `.click()`.
 */
export async function clickViaDispatch(locator: Locator): Promise<void> {
  await locator.evaluate(el => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}
