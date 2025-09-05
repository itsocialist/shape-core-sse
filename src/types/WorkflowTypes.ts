/**
 * Workflow Types
 * Defines interfaces for workflow orchestration
 */

export interface WorkflowStep {
  id: string;
  service: string;
  action: string;
  args: any;
  dependencies: string[];
}

export interface WorkflowStepResult {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  executedAt: Date;
  duration: number;
}

export interface WorkflowResult {
  success: boolean;
  steps: WorkflowStepResult[];
  totalDuration: number;
  error?: string;
}

export interface WorkflowContext {
  projectPath?: string;
  variables?: Record<string, any>;
  stepResults?: Record<string, any>;
}
