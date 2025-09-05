/**
 * RoleOrchestrator - Coordinates role-based task execution
 * Bridges roles and services with intelligent context
 */

import { DatabaseManager } from '../../db/database.js';
import { ServiceRegistry } from '../registry/ServiceRegistry.js';
import { RoleProvider, RoleIntelligence } from './RoleProvider.js';
import { ServiceCommand, ServiceResult } from '../../adapters/base/types.js';

export interface RoleExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  roleContext?: RoleExecutionContext;
}

export interface RoleExecutionContext {
  roleId: string;
  intelligence: RoleIntelligence;
  analysis?: string;
  suggestions?: string[];
  contextStored?: boolean;
}

export class RoleOrchestrator {
  private db: DatabaseManager;
  private registry: ServiceRegistry;
  private roleProvider: RoleProvider;

  constructor(
    db: DatabaseManager,
    registry: ServiceRegistry,
    roleProvider: RoleProvider
  ) {
    this.db = db;
    this.registry = registry;
    this.roleProvider = roleProvider;
  }

  /**
   * Execute a task as a specific role
   */
  async executeAsRole(
    roleId: string,
    serviceName: string,
    tool: string,
    args: any,
    projectName?: string
  ): Promise<RoleExecutionResult> {
    try {
      // Get role intelligence
      const intelligence = await this.roleProvider.getRoleIntelligence(roleId);
      
      // Create role-enhanced command
      const command: ServiceCommand = {
        tool,
        args,
        projectName,
        roleId,
        context: {
          roleIntelligence: intelligence
        },
        storeResult: true
      };

      // Execute through service
      const serviceResult = await this.registry.execute(serviceName, command);
      
      if (!serviceResult.success) {
        return {
          success: false,
          error: serviceResult.error,
          roleContext: {
            roleId,
            intelligence
          }
        };
      }

      // Add role-specific analysis
      const analysis = this.generateRoleAnalysis(
        roleId,
        serviceName,
        tool,
        args,
        serviceResult.data,
        intelligence
      );

      // Generate role-specific suggestions
      const suggestions = this.generateRoleSuggestions(
        roleId,
        serviceName,
        tool,
        serviceResult.data,
        intelligence
      );

      // Store role context if project specified
      let contextStored = false;
      if (projectName) {
        await this.storeRoleContext(
          projectName,
          roleId,
          serviceName,
          tool,
          args,
          serviceResult.data,
          analysis
        );
        contextStored = true;
      }

      return {
        success: true,
        data: serviceResult.data,
        roleContext: {
          roleId,
          intelligence,
          analysis,
          suggestions,
          contextStored
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error',
        roleContext: {
          roleId,
          intelligence: await this.roleProvider.getRoleIntelligence(roleId).catch(() => ({} as any))
        }
      };
    }
  }

  /**
   * Generate role-specific analysis of execution result
   */
  private generateRoleAnalysis(
    roleId: string,
    serviceName: string,
    tool: string,
    args: any,
    data: any,
    intelligence: RoleIntelligence
  ): string {
    // Role-specific analysis based on focus areas
    const focusAreas = intelligence.focusAreas;
    
    if (serviceName === 'git') {
      if (focusAreas.includes('development') || focusAreas.includes('implementation')) {
        return `Development perspective: Analyzed ${tool} results focusing on code changes, implementation status, and development workflow implications.`;
      }
      
      if (focusAreas.includes('testing') || focusAreas.includes('quality-assurance')) {
        return `QA perspective: Reviewed ${tool} results for testing implications, quality checkpoints, and potential quality risks.`;
      }
      
      if (focusAreas.includes('architecture') || focusAreas.includes('design-patterns')) {
        return `Architecture perspective: Evaluated ${tool} results for architectural consistency, design pattern adherence, and system impact.`;
      }
      
      if (focusAreas.includes('deployment') || focusAreas.includes('infrastructure')) {
        return `DevOps perspective: Assessed ${tool} results for deployment readiness, infrastructure impact, and operational considerations.`;
      }
    }

    return `${roleId} perspective: Analyzed ${serviceName}:${tool} execution with focus on ${focusAreas.join(', ')}.`;
  }

  /**
   * Generate role-specific suggestions based on execution
   */
  private generateRoleSuggestions(
    roleId: string,
    serviceName: string,
    tool: string,
    data: any,
    intelligence: RoleIntelligence
  ): string[] {
    const suggestions: string[] = [];
    const focusAreas = intelligence.focusAreas;

    if (serviceName === 'git' && tool === 'status') {
      if (focusAreas.includes('development')) {
        suggestions.push('Review uncommitted changes for code quality');
        suggestions.push('Consider creating feature branch for new work');
      }
      
      if (focusAreas.includes('testing')) {
        suggestions.push('Run tests before committing changes');
        suggestions.push('Verify test coverage for modified files');
      }
      
      if (focusAreas.includes('architecture')) {
        suggestions.push('Ensure changes align with architectural decisions');
        suggestions.push('Review impact on system design');
      }
    }

    if (serviceName === 'git' && tool === 'log') {
      if (focusAreas.includes('quality-assurance')) {
        suggestions.push('Analyze commit patterns for quality indicators');
        suggestions.push('Look for testing-related commits');
      }
      
      if (focusAreas.includes('deployment')) {
        suggestions.push('Check for deployment-related commits');
        suggestions.push('Verify release readiness');
      }
    }

    if (serviceName === 'git' && tool === 'branch') {
      if (focusAreas.includes('architecture')) {
        suggestions.push('Consider feature branch strategy for major architectural changes');
        suggestions.push('Plan integration approach for multiple feature branches');
      }
    }

    return suggestions;
  }

  /**
   * Store role-specific context after execution
   */
  private async storeRoleContext(
    projectName: string,
    roleId: string,
    serviceName: string,
    tool: string,
    args: any,
    result: any,
    analysis: string
  ): Promise<void> {
    // For MVP, use basic context storage without role-specific fields
    // TODO: Use role-aware context storage
    try {
      // Convert project name to project ID
      let projectId: number | null = null;
      if (projectName) {
        const project = this.db.getProject(projectName);
        if (project) {
          projectId = project.id;
        }
      }

      await this.db.storeContext({
        project_id: projectId,
        type: 'status' as any,
        key: `${serviceName}-${tool}-execution`,
        value: `Executed ${serviceName}:${tool} as ${roleId}\n\nArgs: ${JSON.stringify(args, null, 2)}\n\nResult: ${JSON.stringify(result, null, 2)}\n\nAnalysis: ${analysis}`,
        tags: [serviceName, tool, roleId, 'execution']
      });
    } catch (error) {
      // Don't fail the execution if context storage fails
      console.warn('Failed to store role context:', error);
    }
  }
}
