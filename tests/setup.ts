/**
 * Test setup file for MPCM-Pro
 * Configures test environment and global utilities
 */

import { jest, beforeAll, afterAll } from '@jest/globals';
import { setTestDatabase } from '../src/db/helpers.js';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JEST_WORKER_ID = '1'; // Prevent database conflicts

// Global test utilities
declare global {
  namespace NodeJS {
    interface Global {
      // Add global test helpers if needed
    }
  }
}

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock console.error to reduce noise in tests but preserve errors
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  // Filter out common test noise
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    if (
      message.includes('Cannot log after tests are done') ||
      message.includes('ExperimentalWarning') ||
      message.includes('Service') && message.includes('registered') ||
      message.includes('✅ Registered service:') ||
      message.includes('🔧 Git adapter initialized') ||
      message.includes('✅ All services initialized') ||
      message.includes('🎯 MPCM-Pro Server') ||
      message.includes('database storage pending')
    ) {
      return; // Suppress known test noise
    }
    originalError(...args);
  };

  console.warn = (...args: any[]) => {
    const message = args.join(' ');
    if (message.includes('ExperimentalWarning')) {
      return; // Suppress experimental warnings
    }
    originalWarn(...args);
  };
});

afterAll(async () => {
  // Restore console
  console.error = originalError;
  console.warn = originalWarn;
  
  // Clear test database
  setTestDatabase(null);
  
  // Force cleanup of any remaining handles
  await new Promise(resolve => setTimeout(resolve, 100));
});
