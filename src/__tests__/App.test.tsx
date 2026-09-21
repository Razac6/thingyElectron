import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import App from '../renderer/App';

// Mock Lottie since it relies on canvas APIs jsdom doesn't implement
jest.mock(
  'lottie-react',
  () =>
    function () {
      return <div data-testid="lottie-mock" />;
    },
);

// App mounts every context provider (Settings, Timer, Gamification, ...), each of which calls
// some window.electron.database.* method on mount. Rather than enumerate every method (and have
// this drift as those providers change), stub any accessed method to resolve to undefined.
const mockDatabase: Record<string, jest.Mock> = new Proxy(
  {},
  {
    get: (target, prop) => {
      if (!(prop in target)) {
        (target as any)[prop] = jest.fn().mockResolvedValue(undefined);
      }
      return (target as any)[prop];
    },
  },
);

Object.defineProperty(window, 'electron', {
  writable: true,
  configurable: true,
  value: {
    ipcRenderer: {
      on: jest.fn(),
      send: jest.fn(),
      removeListener: jest.fn(),
      invoke: jest.fn().mockResolvedValue(undefined),
    },
    database: mockDatabase,
    shell: { openExternal: jest.fn() },
  },
});

describe('App', () => {
  it('should render', () => {
    expect(render(<App />)).toBeTruthy();
  });
});
