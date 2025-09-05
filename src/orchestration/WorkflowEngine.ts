/**
 * WorkflowEngine - Minimal Workflow Orchestration
 * 
 * Orchestrates multi-step workflows across different services
 * Handles dependencies and sequential execution
 */

import { ServiceRegistry } from './registry/ServiceRegistry.js';
import { DatabaseManager } from '../db/database.js';

// Inline type definitions to resolve import issues
interface ServiceCommand {
  tool: string;
  action: string;
  args: any;
  context?: Record<string, any>;
}

interface WorkflowStep {
  id: string;
  service: string;
  action: string;
  args: any;
  dependencies?: string[];
  condition?: (context: WorkflowContext) => boolean;
  retries?: number;
  timeout?: number;
}

interface WorkflowStepResult {
  stepId: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  timestamp: string;
}

interface WorkflowResult {
  success: boolean;
  steps: WorkflowStepResult[];
  totalDuration: number;
  error?: string;
  context: WorkflowContext;
}

interface WorkflowContext {
  workflowId: string;
  variables: Record<string, any>;
  stepResults: Map<string, WorkflowStepResult>;
  metadata: Record<string, any>;
}

export class WorkflowEngine {
  private serviceRegistry: ServiceRegistry;

  constructor(serviceRegistry?: ServiceRegistry) {
    if (serviceRegistry) {
      this.serviceRegistry = serviceRegistry;
    } else {
      // Create a default registry - database will be created lazily
      // For now, just throw an error if no registry provided
      throw new Error('ServiceRegistry is required');
    }
  }

  async execute(workflow: WorkflowStep[], context?: WorkflowContext): Promise<WorkflowResult> {
    const startTime = Date.now();
    const stepResults: WorkflowStepResult[] = [];
    const completedSteps = new Set<string>();
    const stepData: Record<string, any> = {};
    
    // Initialize workflow context
    const workflowContext: WorkflowContext = context || {
      workflowId: 'workflow-' + Date.now(),
      variables: {},
      stepResults: new Map(),
      metadata: {}
    };

    try {
      // Execute steps in dependency order
      while (completedSteps.size < workflow.length) {
        const readySteps = workflow.filter(step => 
          !completedSteps.has(step.id) && 
          (step.dependencies || []).every((dep: string) => completedSteps.has(dep))
        );

        if (readySteps.length === 0) {
          // Deadlock or circular dependency
          const remainingSteps = workflow.filter(step => !completedSteps.has(step.id));
          throw new Error(`Workflow deadlock detected. Remaining steps: ${remainingSteps.map(s => s.id).join(', ')}`);
        }

        // Execute ready steps (could be parallel in future)
        for (const step of readySteps) {
          const stepResult = await this.executeStep(step, stepData, context);
          stepResults.push(stepResult);
          
          if (stepResult.success) {
            completedSteps.add(step.id);
            stepData[step.id] = stepResult.data;
          } else {
            // Step failed - stop workflow execution
            workflowContext.variables = stepData;
            workflowContext.stepResults = new Map(stepResults.map(r => [r.stepId, r]));
            
            return {
              success: false,
              steps: stepResults,
              totalDuration: Date.now() - startTime,
              error: `Step '${step.id}' failed: ${stepResult.error}`,
              context: workflowContext
            };
          }
        }
      }

      workflowContext.variables = stepData;
      workflowContext.stepResults = new Map(stepResults.map(r => [r.stepId, r]));

      return {
        success: true,
        steps: stepResults,
        totalDuration: Date.now() - startTime,
        context: workflowContext
      };

    } catch (error) {
      workflowContext.variables = stepData;
      workflowContext.stepResults = new Map(stepResults.map(r => [r.stepId, r]));
      
      return {
        success: false,
        steps: stepResults,
        totalDuration: Date.now() - startTime,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error),
        context: workflowContext
      };
    }
  }

  private async executeStep(
    step: WorkflowStep, 
    stepData: Record<string, any>,
    context?: WorkflowContext
  ): Promise<WorkflowStepResult> {
    const startTime = Date.now();

    try {
      // Resolve any step data references in args
      const resolvedArgs = this.resolveStepArgs(step.args, stepData);

      const command: ServiceCommand = {
        tool: step.action,
        action: step.action,
        args: resolvedArgs
      };

      const result = await this.serviceRegistry.execute(step.service, command);

      return {
        stepId: step.id,
        success: result.success,
        data: result.data,
        error: result.error,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error),
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  private resolveStepArgs(args: any, stepData: Record<string, any>): any {
    if (typeof args === 'string' && args.startsWith('${') && args.endsWith('}')) {
      // Simple variable reference like ${step-id.field}
      const ref = args.slice(2, -1);
      const [stepId, field] = ref.split('.');
      
      if (stepData[stepId] && field) {
        return stepData[stepId][field];
      } else if (stepData[stepId]) {
        return stepData[stepId];
      }
      
      return args; // Return as-is if cannot resolve
    }

    if (Array.isArray(args)) {
      return args.map(item => this.resolveStepArgs(item, stepData));
    }

    if (typeof args === 'object' && args !== null) {
      const resolved: any = {};
      for (const [key, value] of Object.entries(args)) {
        resolved[key] = this.resolveStepArgs(value, stepData);
      }
      return resolved;
    }

    return args;
  }
}
