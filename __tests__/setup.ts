import { beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// Clear localStorage before each test to ensure isolation
beforeEach(() => {
  localStorage.clear();
});

// Mock crypto.randomUUID with a deterministic counter
let uuidCounter = 0;

beforeEach(() => {
  uuidCounter = 0;
});

Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => `test-uuid-${++uuidCounter}`,
  },
  writable: true,
  configurable: true,
});
