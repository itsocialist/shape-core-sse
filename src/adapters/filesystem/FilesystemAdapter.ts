/**
 * Filesystem Adapter for MPCM-Pro
 * Wraps filesystem operations with context awareness
 */

import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { BaseAdapter, ServiceCapability, ServiceCommand, ServiceResult } from '../base/types.js';

export class FilesystemAdapter implements BaseAdapter {
  private basePath: string;
  private capabilities: ServiceCapability[] = [
    {
      name: 'read_file',
      description: 'Read contents of a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' }
        },
        required: ['path']
      }
    },
    {
      name: 'write_file',
      description: 'Write content to a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Content to write' }
        },
        required: ['path', 'content']
      }
    }
  ];

  // Implementation continues...
  constructor(basePath: string = process.env.HOME || '/') {
    this.basePath = basePath;
  }

  getName(): string {
    return 'filesystem';
  }

  getDescription(): string {
    return 'File system operations with context awareness';
  }

  async initialize(): Promise<void> {
    // Verify base path exists
    try {
      await fs.access(this.basePath);
    } catch (error) {
      throw new Error(`Base path ${this.basePath} is not accessible`);
    }
  }

  async getCapabilities(): Promise<ServiceCapability[]> {
    return this.capabilities;
  }

  async execute(command: ServiceCommand): Promise<ServiceResult> {
    try {
      switch (command.tool) {
        case 'read_file':
          return await this.readFile(command.args);
        
        case 'write_file':
          return await this.writeFile(command.args);
        
        default:
          return {
            success: false,
            error: `Unknown tool: ${command.tool}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error'
      };
    }
  }
  async shutdown(): Promise<void> {
    // No cleanup needed for filesystem adapter
  }

  private async readFile(args: any): Promise<ServiceResult> {
    const fullPath = this.resolvePath(args.path);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    return {
      success: true,
      data: {
        path: args.path,
        content,
        size: content.length
      }
    };
  }

  private async writeFile(args: any): Promise<ServiceResult> {
    const fullPath = this.resolvePath(args.path);
    
    // Ensure directory exists
    await fs.mkdir(dirname(fullPath), { recursive: true });
    
    // Write file
    await fs.writeFile(fullPath, args.content, 'utf-8');
    
    return {
      success: true,
      data: {
        path: args.path,
        size: args.content.length
      }
    };
  }

  private resolvePath(path: string): string {
    // If absolute path, use as-is
    if (path.startsWith('/')) {
      return path;
    }
    
    // Otherwise, resolve relative to base path
    return join(this.basePath, path);
  }
}