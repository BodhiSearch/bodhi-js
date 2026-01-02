import '@testing-library/jest-dom';

// Mock window.parent.postMessage for testing
Object.defineProperty(window, 'parent', {
  value: {
    postMessage: vi.fn(),
  },
  writable: true,
});

// Mock MessageEvent constructor if needed
globalThis.MessageEvent = MessageEvent;

// Suppress React act() warnings for userEvent interactions
// These warnings are expected when testing user interactions that trigger state updates
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning: An update to') && args[0].includes('was not wrapped in act')) {
      return; // Suppress act() warnings for user interactions
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
