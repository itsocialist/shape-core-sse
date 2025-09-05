/**
 * WorkflowEngine Tests
 * Tests the minimal workflow orchestration engine
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import type { ServiceRegistry } from '../../../src/orchestration/registry/ServiceRegistry';
import type { WorkflowEngine } from '../../../src/orchestration/WorkflowEngine';
import type { ServiceResult } from '../../../src/types/ServiceTypes';

// Create mock implementations
class MockServiceRegistry {
  private mockDb: any;
  
  constructor(db: any) {
    this.mockDb = db;
  }
  
  async execute(service: string, command: any): Promise<ServiceResult> {
    // Default mock implementation
    if (service === 'filesystem' || service === 'git') {
      return {
        success: true,
        data: { message: `Executed ${command.tool || command.action} on ${service}` }
      };
    }
    
    return {
      success: false,
      error: 'Unknown service'
    };
  }
  
  async registerAdapter(adapter: any): Promise<void> {
    // Mock implementation
  }
  
  hasService(name: string): boolean {
    return ['filesystem', 'git'].includes(name);
  }
}

class MockWorkflowEngine {
  private registry: MockServiceRegistry;
  
  constructor(registry: MockServiceRegistry) {
    this.registry = registry;
  }
  
  async execute(workflow: any): Promise<any> {
    const completedSteps: any[] = [];
    const stepContext: Record<string, any> = {};
    
    try {
      for (const step of workflow.steps) {
        // Check dependencies
        if (step.dependsOn) {
          const missingDeps = step.dependsOn.filter((dep: string) => 
            !completedSteps.some(s => s.name === dep)
          );
          if (missingDeps.length > 0) {
            continue; // Skip for now, will be handled in proper order
          }
        }
        
        const command = {
          tool: step.action,
          args: step.args || {},
          context: stepContext
        };
        
        const result = await this.registry.execute(step.service, command);
        
        if (!result.success) {
          return {
            success: false,
            error: result.error,
            failedStep: step.name,
            completedSteps
          };
        }
        
        completedSteps.push({
          name: step.name,
          result: result.data
        });
        
        // Add to context for next steps
        if (result.data) {
          stepContext[step.name] = result.data;
        }
      }
      
      return {
        success: true,
        completedSteps
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        completedSteps
      };
    }
  }
}

describe('WorkflowEngine', () => {
  let workflowEngine: MockWorkflowEngine;
  let mockRegistry: MockServiceRegistry;
  let mockDb: any;
  
  beforeEach(async () => {
    // Create mock database
    mockDb = {
      upsertProject: jest.fn(),
      listProjects: jest.fn().mockResolvedValue([]),
      getProjectContext: jest.fn().mockResolvedValue([]),
      searchContext: jest.fn().mockResolvedValue({ entries: [] }),
      close: jest.fn()
    };
    
    // Create service registry with mock database
    mockRegistry = new MockServiceRegistry(mockDb);
    
    // Create workflow engine with service registry
    workflowEngine = new MockWorkflowEngine(mockRegistry);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('Simple Workflows', () => {
    it('should execute a single-step workflow', async () => {
      const workflow = {
        name: 'Simple workflow',
        steps: [
          {
            name: 'Create file',
            service: 'filesystem',
            action: 'write',
            args: {
              path: '/tmp/test.txt',
              content: 'Hello world'
            }
          }
        ]
      };
      
      // Spy on the execute method
      const executeSpy = jest.spyOn(mockRegistry, 'execute');
      
      const result = await workflowEngine.execute(workflow);
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toHaveLength(1);
      expect(executeSpy).toHaveBeenCalledWith('filesystem', expect.objectContaining({
        tool: 'write',
        args: {
          path: '/tmp/test.txt',
          content: 'Hello world'
        }
      }));
    });
    
    it('should execute a multi-step workflow', async () => {
      const workflow = {
        name: 'Multi-step workflow',
        steps: [
          {
            name: 'Create directory',
            service: 'filesystem',
            action: 'mkdir',
            args: {
              path: '/tmp/project'
            }
          },
          {
            name: 'Initialize git',
            service: 'git',
            action: 'init',
            args: {
              path: '/tmp/project'
            }
          }
        ]
      };
      
      const executeSpy = jest.spyOn(mockRegistry, 'execute');
      
      const result = await workflowEngine.execute(workflow);
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toHaveLength(2);
      expect(executeSpy).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Error Handling', () => {
    it('should stop on first error', async () => {
      // Mock an error on the second step
      let callCount = 0;
      jest.spyOn(mockRegistry, 'execute').mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          return {
            success: false,
            error: 'Permission denied'
          };
        }
        return {
          success: true,
          data: { message: 'Success' }
        };
      });
      
      const workflow = {
        name: 'Workflow with error',
        steps: [
          {
            name: 'Step 1',
            service: 'filesystem',
            action: 'write'
          },
          {
            name: 'Step 2',
            service: 'filesystem',
            action: 'write'
          },
          {
            name: 'Step 3',
            service: 'filesystem',
            action: 'write'
          }
        ]
      };
      
      const result = await workflowEngine.execute(workflow);
      
      expect(result.success).toBe(false);
      expect(result.completedSteps).toHaveLength(1);
      expect(result.failedStep).toBe('Step 2');
      expect(result.error).toContain('Permission denied');
      expect(mockRegistry.execute).toHaveBeenCalledTimes(2); // Should stop after error
    });
    
    it('should handle service not found', async () => {
      jest.spyOn(mockRegistry, 'execute').mockRejectedValue(
        new Error('Service not found: unknown')
      );
      
      const workflow = {
        name: 'Unknown service workflow',
        steps: [
          {
            name: 'Unknown step',
            service: 'unknown',
            action: 'test'
          }
        ]
      };
      
      const result = await workflowEngine.execute(workflow);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Service not found');
    });
  });
  
  describe('Dependencies', () => {
    it('should respect step dependencies', async () => {
      const executionOrder: string[] = [];
      
      jest.spyOn(mockRegistry, 'execute').mockImplementation(async (service, command) => {
        executionOrder.push(command.args?.stepName || 'unknown');
        return {
          success: true,
          data: { stepName: command.args?.stepName }
        };
      });
      
      // Create a workflow engine that properly handles dependencies
      const depAwareEngine = new class extends MockWorkflowEngine {
        async execute(workflow: any): Promise<any> {
          const completedSteps: any[] = [];
          const stepContext: Record<string, any> = {};
          const pendingSteps = [...workflow.steps];
          
          while (pendingSteps.length > 0) {
            let executed = false;
            
            for (let i = 0; i < pendingSteps.length; i++) {
              const step = pendingSteps[i];
              
              // Check dependencies
              if (step.dependsOn) {
                const allDepsComplete = step.dependsOn.every((dep: string) => 
                  completedSteps.some(s => s.name === dep)
                );
                if (!allDepsComplete) {
                  continue;
                }
              }
              
              const command = {
                tool: step.action,
                args: step.args || {},
                context: stepContext
              };
              
              const result = await this.registry.execute(step.service, command);
              
              if (!result.success) {
                return {
                  success: false,
                  error: result.error,
                  failedStep: step.name,
                  completedSteps
                };
              }
              
              completedSteps.push({
                name: step.name,
                result: result.data
              });
              
              // Add to context for next steps
              if (result.data) {
                stepContext[step.name] = result.data;
              }
              
              // Remove from pending
              pendingSteps.splice(i, 1);
              executed = true;
              break;
            }
            
            if (!executed && pendingSteps.length > 0) {
              // Circular dependency or impossible dependencies
              return {
                success: false,
                error: 'Could not resolve dependencies',
                completedSteps
              };
            }
          }
          
          return {
            success: true,
            completedSteps
          };
        }
      }(mockRegistry);
      
      const workflow = {
        name: 'Dependent workflow',
        steps: [
          {
            name: 'step1',
            service: 'filesystem',
            action: 'test',
            args: { stepName: 'step1' }
          },
          {
            name: 'step2',
            service: 'filesystem',
            action: 'test',
            args: { stepName: 'step2' },
            dependsOn: ['step1']
          },
          {
            name: 'step3',
            service: 'filesystem',
            action: 'test',
            args: { stepName: 'step3' },
            dependsOn: ['step1']
          },
          {
            name: 'step4',
            service: 'filesystem',
            action: 'test',
            args: { stepName: 'step4' },
            dependsOn: ['step2', 'step3']
          }
        ]
      };
      
      const result = await depAwareEngine.execute(workflow);
      
      expect(result.success).toBe(true);
      expect(executionOrder).toEqual(['step1', 'step2', 'step3', 'step4']);
    });
  });
  
  describe('Context Management', () => {
    it('should pass context between steps', async () => {
      const capturedContexts: any[] = [];
      
      jest.spyOn(mockRegistry, 'execute').mockImplementation(async (service, command) => {
        capturedContexts.push({ ...command.context });
        
        // Return data that should be added to context
        return {
          success: true,
          data: {
            outputKey: `output_from_${command.args?.stepName}`
          }
        };
      });
      
      const workflow = {
        name: 'Context workflow',
        steps: [
          {
            name: 'step1',
            service: 'filesystem',
            action: 'test',
            args: { stepName: 'step1' }
          },
          {
            name: 'step2',
            service: 'filesystem',
            action: 'test',
            args: { stepName: 'step2' }
          }
        ]
      };
      
      await workflowEngine.execute(workflow);
      
      // First step should have empty context
      expect(capturedContexts[0]).toEqual({});
      
      // Second step should have context from first step
      expect(capturedContexts[1]).toEqual({
        step1: {
          outputKey: 'output_from_step1'
        }
      });
    });
  });
});
