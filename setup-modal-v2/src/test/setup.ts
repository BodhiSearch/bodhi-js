import '@testing-library/jest-dom';

// Mock window.parent.postMessage so MessageChannelV2 doesn't throw in tests
Object.defineProperty(window, 'parent', {
  value: {
    postMessage: vi.fn(),
  },
  writable: true,
});

globalThis.MessageEvent = MessageEvent;

const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning: An update to') && args[0].includes('was not wrapped in act')) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
