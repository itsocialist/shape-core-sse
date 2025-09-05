/**
 * FilesystemAdapter - Wrapper for FilesystemServiceProvider
 * Adapts the ServiceProvider interface to BaseAdapter interface
 */

import { BaseAdapter, ServiceCapability, ServiceCommand, ServiceResult } from './base/types.js';
import { FilesystemServiceProvider } from './FilesystemServiceProvider.js';

export class FilesystemAdapter implements BaseAdapter {
  private provider: FilesystemServiceProvider;

  constructor() {
    this.provider = new FilesystemServiceProvider();
  }

  getName(): string {
    return this.provider.getName();
  }

  getDescription(): string {
    return 'Filesystem operations for project management';
  }

  async initialize(): Promise<void> {
    // FilesystemServiceProvider doesn't need initialization
    console.error(`🔧 Filesystem adapter initialized`);
  }

  async getCapabilities(): Promise<ServiceCapability[]> {
    const capabilities = this.provider.getCapabilities();
    
    return capabilities.map(cap => ({
      name: cap,
      description: this.getCapabilityDescription(cap)
    }));
  }

  async execute(command: ServiceCommand): Promise<ServiceResult> {
    // Adapt ServiceCommand to the provider's expected format
    const providerCommand = {
      action: command.tool,
      args: command.args,
      context: command.context
    };

    return await this.provider.execute(providerCommand);
  }

  async shutdown(): Promise<void> {
    if (this.provider.cleanup) {
      await this.provider.cleanup();
    }
  }

  private getCapabilityDescription(capability: string): string {
    const descriptions: Record<string, string> = {
      'create_directory': 'Create a new directory',
      'write_file': 'Write content to a file',
      'read_file': 'Read content from a file',
      'list_directory': 'List contents of a directory',
      'delete_file': 'Delete a file'
    };

    return descriptions[capability] || capability;
  }
}
