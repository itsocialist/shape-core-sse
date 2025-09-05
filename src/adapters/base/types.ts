/**
 * Base types for MPCM-Pro adapters
 */

export interface ServiceCapability {
  name: string;
  description: string;
  inputSchema?: any;
  outputSchema?: any;
}

export interface ServiceCommand {
  tool: string;
  args: any;
  projectName?: string;
  roleId?: string;
  context?: Record<string, any>;
  storeResult?: boolean;
}

export interface ServiceResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface BaseAdapter {
  getName(): string;
  getDescription(): string;
  initialize(): Promise<void>;
  getCapabilities(): Promise<ServiceCapability[]>;
  execute(command: ServiceCommand): Promise<ServiceResult>;
  shutdown(): Promise<void>;
}
