/**
 * Service Provider Types for MPCM-Pro
 * 
 * Defines interfaces for service providers in the orchestration system
 */

// Service command structure
export interface ServiceCommand {
  action: string;
  args: any;
  context?: Record<string, any>;
}

// Service result structure
export interface ServiceResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// Service provider interface
export interface ServiceProvider {
  getName(): string;
  getCapabilities(): string[];
  execute(command: ServiceCommand): Promise<ServiceResult>;
  cleanup?(): Promise<void>;
}

// Service registry interface
export interface ServiceRegistry {
  register(service: ServiceProvider): void;
  unregister(serviceName: string): void;
  getService(serviceName: string): ServiceProvider | undefined;
  listServices(): string[];
  execute(serviceName: string, command: ServiceCommand): Promise<ServiceResult>;
}

// Service metadata
export interface ServiceMetadata {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  dependencies?: string[];
  configuration?: Record<string, any>;
}

// Service configuration
export interface ServiceConfig {
  enabled: boolean;
  priority: number;
  timeout?: number;
  retries?: number;
  metadata?: Record<string, any>;
}

// Service status
export interface ServiceStatus {
  name: string;
  status: 'initializing' | 'ready' | 'busy' | 'error' | 'stopped';
  lastActivity?: string;
  errorCount: number;
  metadata?: Record<string, any>;
}

// Workflow types (inline to avoid circular dependency)
export interface WorkflowStep {
  id: string;
  service: string;
  action: string;
  args: any;
  dependencies?: string[];
  condition?: (context: WorkflowContext) => boolean;
  retries?: number;
  timeout?: number;
}

export interface WorkflowStepResult {
  stepId: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  timestamp: string;
}

export interface WorkflowResult {
  success: boolean;
  steps: WorkflowStepResult[];
  totalDuration: number;
  error?: string;
  context: WorkflowContext;
}

export interface WorkflowContext {
  workflowId: string;
  variables: Record<string, any>;
  stepResults: Map<string, WorkflowStepResult>;
  metadata: Record<string, any>;
}
