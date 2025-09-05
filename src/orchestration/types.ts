/**
 * Orchestration types for MPCM-Pro
 * Core interfaces for service orchestration
 */

export interface ServiceCommand {
  action: string;
  params?: Record<string, any>;
}

export interface ServiceResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ServiceCapability {
  name: string;
  description: string;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
}

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface ServiceProvider {
  getName(): string;
  getDescription(): string;
  getCapabilities(): ServiceCapability[];
  initialize(): Promise<void>;
  execute(command: ServiceCommand): Promise<ServiceResult>;
  shutdown(): Promise<void>;
}
