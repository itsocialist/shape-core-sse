/**
 * Export all adapters for Shape Core
 */

export { FilesystemServiceProvider } from './FilesystemServiceProvider.js';
export { FilesystemAdapter } from './FilesystemAdapter.js';
export { GitAdapter } from './GitAdapter.js';
export { TerminalAdapter } from './TerminalAdapter.js';
export { ShapeAdapter } from './shape-adapter/index.js';

// Re-export base types
export * from './base/types.js';
