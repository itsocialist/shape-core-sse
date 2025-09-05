/**
 * Simple Filesystem Service Provider
 * Basic filesystem operations for the WorkflowEngine MVP
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';

// Inline type definitions to resolve import issues
interface ServiceCommand {
  action: string;
  args: any;
  context?: Record<string, any>;
}

interface ServiceResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

interface ServiceProvider {
  getName(): string;
  getCapabilities(): string[];
  execute(command: ServiceCommand): Promise<ServiceResult>;
  cleanup?(): Promise<void>;
}

export class FilesystemServiceProvider implements ServiceProvider {
  getName(): string {
    return 'filesystem';
  }

  getCapabilities(): string[] {
    return [
      'create_directory',
      'write_file',
      'read_file',
      'list_directory',
      'delete_file'
    ];
  }

  async execute(command: ServiceCommand): Promise<ServiceResult> {
    try {
      switch (command.action) {
        case 'create_directory':
          return await this.createDirectory(command.args);
        case 'write_file':
          return await this.writeFile(command.args);
        case 'read_file':
          return await this.readFile(command.args);
        case 'list_directory':
          return await this.listDirectory(command.args);
        case 'delete_file':
          return await this.deleteFile(command.args);
        default:
          return {
            success: false,
            error: `Unknown filesystem action: ${command.action}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Filesystem operation failed: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`
      };
    }
  }

  private async createDirectory(args: any): Promise<ServiceResult> {
    const path = args?.path;
    
    if (!path) {
      return {
        success: false,
        error: 'Path is required for create_directory'
      };
    }

    try {
      await fs.mkdir(path, { recursive: true });
      
      return {
        success: true,
        data: {
          path,
          message: `Directory created: ${path}`
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create directory: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`
      };
    }
  }

  private async writeFile(args: any): Promise<ServiceResult> {
    const { path, content } = args || {};
    
    if (!path || content === undefined) {
      return {
        success: false,
        error: 'Path and content are required for write_file'
      };
    }

    try {
      // Ensure directory exists
      await fs.mkdir(dirname(path), { recursive: true });
      
      // Write file
      await fs.writeFile(path, content, 'utf8');
      
      return {
        success: true,
        data: {
          path,
          size: content.length,
          message: `File written: ${path}`
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write file: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`
      };
    }
  }

  private async readFile(args: any): Promise<ServiceResult> {
    const path = args?.path;
    
    if (!path) {
      return {
        success: false,
        error: 'Path is required for read_file'
      };
    }

    try {
      const content = await fs.readFile(path, 'utf8');
      
      return {
        success: true,
        data: {
          path,
          content,
          size: content.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`
      };
    }
  }

  private async listDirectory(args: any): Promise<ServiceResult> {
    const path = args?.path || '.';
    
    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      
      const files = entries
        .filter(entry => entry.isFile())
        .map(entry => entry.name);
        
      const directories = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
      
      return {
        success: true,
        data: {
          path,
          files,
          directories,
          total: entries.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list directory: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`
      };
    }
  }

  private async deleteFile(args: any): Promise<ServiceResult> {
    const path = args?.path;
    
    if (!path) {
      return {
        success: false,
        error: 'Path is required for delete_file'
      };
    }

    try {
      await fs.unlink(path);
      
      return {
        success: true,
        data: {
          path,
          message: `File deleted: ${path}`
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete file: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`
      };
    }
  }

  async cleanup(): Promise<void> {
    // No resources to clean up for filesystem provider
  }
}
