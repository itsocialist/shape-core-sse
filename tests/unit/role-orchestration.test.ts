/**
 * Tests for Role Orchestration Framework
 * TDD approach - write failing tests first
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import Database from 'better-sqlite3';
import { DatabaseManager } from '../../src/db/database.js';
import { RoleProvider } from '../../src/orchestration/roles/RoleProvider.js';
import { RoleOrchestrator } from '../../src/orchestration/roles/RoleOrchestrator.js';
import { ServiceRegistry } from '../../src/orchestration/registry/ServiceRegistry.js';
import { DEFAULT_ROLE_IDS } from '../../src/types/roles.js';

describe('Role Orchestration Framework', () => {
  let db: DatabaseManager;
  let registry: ServiceRegistry;
  let roleProvider: RoleProvider;
  let orchestrator: RoleOrchestrator;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = await DatabaseManager.create(':memory:');

    // Setup dependencies
    registry = new ServiceRegistry(db);
    roleProvider = new RoleProvider(db);
    orchestrator = new RoleOrchestrator(db, registry, roleProvider);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('RoleProvider Interface', () => {
    it('should provide default role definitions', async () => {
      const roles = await roleProvider.getAvailableRoles();
      
      expect(roles).toHaveLength(5);
      expect(roles.map(r => r.id)).toContain(DEFAULT_ROLE_IDS.ARCHITECT);
      expect(roles.map(r => r.id)).toContain(DEFAULT_ROLE_IDS.DEVELOPER);
    });

    it('should get role-specific intelligence', async () => {
      const intelligence = await roleProvider.getRoleIntelligence(DEFAULT_ROLE_IDS.ARCHITECT);
      
      expect(intelligence).toHaveProperty('systemPrompt');
      expect(intelligence).toHaveProperty('knowledgeBase');
      expect(intelligence).toHaveProperty('focusAreas');
      expect(intelligence.focusAreas).toContain('architecture');
    });

    it('should get role-specific prompt enhancements', async () => {
      const enhancement = await roleProvider.enhancePrompt(
        'Design a database schema',
        DEFAULT_ROLE_IDS.ARCHITECT,
        { projectName: 'test-project' }
      );
      
      expect(enhancement).toContain('database schema');
      expect(enhancement).toContain('architecture');
      // Should inject role-specific knowledge
    });

    it('should validate role exists', async () => {
      await expect(
        roleProvider.getRoleIntelligence('invalid-role')
      ).rejects.toThrow('Role not found: invalid-role');
    });
  });

  describe('Role Orchestration', () => {
    it('should execute task as specific role', async () => {
      // Register a mock service first
      const mockService = {
        getName: () => 'git',
        getDescription: () => 'Mock git service',
        initialize: async () => {},
        getCapabilities: async () => [
          { name: 'status', description: 'Get git status' }
        ],
        execute: async () => ({ success: true, data: 'mock git result' }),
        shutdown: async () => {}
      };

      await registry.register(mockService);

      const result = await orchestrator.executeAsRole(
        DEFAULT_ROLE_IDS.DEVELOPER,
        'git',
        'status',
        {},
        'test-project'
      );
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('roleContext');
      expect(result.roleContext?.roleId).toBe(DEFAULT_ROLE_IDS.DEVELOPER);
    });

    it('should inject role context into service commands', async () => {
      const mockService = {
        getName: () => 'mock',
        getDescription: () => 'Mock service',
        initialize: async () => {},
        getCapabilities: async () => [],
        execute: jest.fn().mockResolvedValue({ success: true, data: 'mock result' }),
        shutdown: async () => {}
      };

      await registry.register(mockService);

      await orchestrator.executeAsRole(
        DEFAULT_ROLE_IDS.ARCHITECT,
        'mock',
        'test',
        { input: 'test' },
        'test-project'
      );

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          roleId: DEFAULT_ROLE_IDS.ARCHITECT,
          tool: 'test',
          args: { input: 'test' },
          projectName: 'test-project'
        })
      );
    });

    it('should store role-specific context after execution', async () => {
      // Mock a simple git service for testing
      const mockGitAdapter = {
        getName: () => 'git',
        getDescription: () => 'Mock git service',
        initialize: async () => {},
        getCapabilities: async () => [
          { name: 'status', description: 'Get git status' }
        ],
        execute: jest.fn().mockResolvedValue({ 
          success: true, 
          data: 'mock git status output' 
        }),
        shutdown: async () => {}
      };

      await registry.register(mockGitAdapter);

      const result = await orchestrator.executeAsRole(
        DEFAULT_ROLE_IDS.DEVELOPER,
        'git',
        'status',
        {},
        'test-project'
      );
      
      expect(result.success).toBe(true);
      expect(result.roleContext?.contextStored).toBe(true);
      
      // Note: In MVP, context storage is simplified
      // Full role-aware context storage will be implemented later
    });
  });

  describe('Role Intelligence', () => {
    it('should provide different perspectives for same task', async () => {
      const architectPrompt = await roleProvider.enhancePrompt(
        'Review this API design',
        DEFAULT_ROLE_IDS.ARCHITECT,
        {}
      );

      const developerPrompt = await roleProvider.enhancePrompt(
        'Review this API design',
        DEFAULT_ROLE_IDS.DEVELOPER,
        {}
      );

      // Should have different focus areas
      expect(architectPrompt).not.toBe(developerPrompt);
      expect(architectPrompt).toContain('scalability');
      expect(developerPrompt).toContain('implementation');
    });

    it('should integrate project context into role perspective', async () => {
      // For MVP, we test that project name is included in enhanced prompt
      // Full project context integration will be implemented later
      const enhancement = await roleProvider.enhancePrompt(
        'Write a service',
        DEFAULT_ROLE_IDS.DEVELOPER,
        { projectName: 'test-project' }
      );

      expect(enhancement).toContain('test-project');
      expect(enhancement).toContain('implementation'); // Developer focus area
    });
  });

  describe('Git Orchestration Through Roles', () => {
    beforeEach(async () => {
      // Register a mock git service
      const mockGitAdapter = {
        getName: () => 'git',
        getDescription: () => 'Mock git service for testing',
        initialize: async () => {},
        getCapabilities: async () => [
          { name: 'status', description: 'Get git status' },
          { name: 'log', description: 'Get git log' },
          { name: 'branch', description: 'Git branch operations' }
        ],
        execute: jest.fn().mockImplementation(async (command) => {
          // Mock different responses based on the tool
          if (command.tool === 'status') {
            return { success: true, data: 'On branch main\nWorking tree clean' };
          }
          if (command.tool === 'log') {
            return { success: true, data: 'commit abc123\nAuthor: Test\nDate: Today\n\nTest commit' };
          }
          if (command.tool === 'branch') {
            return { success: true, data: '* main\n  feature/test' };
          }
          return { success: true, data: 'mock git response' };
        }),
        shutdown: async () => {}
      };

      await registry.register(mockGitAdapter);
    });

    it('should handle git status with developer perspective', async () => {
      const result = await orchestrator.executeAsRole(
        DEFAULT_ROLE_IDS.DEVELOPER,
        'git',
        'status',
        {},
        'test-project'
      );

      expect(result.success).toBe(true);
      expect(result.data).toContain('main');
      expect(result.roleContext?.analysis).toContain('Development perspective');
    });

    it('should handle git log with different role perspectives', async () => {
      const devResult = await orchestrator.executeAsRole(
        DEFAULT_ROLE_IDS.DEVELOPER,
        'git',
        'log',
        { limit: 5 },
        'test-project'
      );

      const qaResult = await orchestrator.executeAsRole(
        DEFAULT_ROLE_IDS.QA,
        'git',
        'log',
        { limit: 5 },
        'test-project'
      );

      // Different roles should provide different insights
      expect(devResult.roleContext?.analysis).toContain('code changes');
      expect(qaResult.roleContext?.analysis).toContain('testing');
    });

    it('should suggest role-appropriate git workflows', async () => {
      const architectResult = await orchestrator.executeAsRole(
        DEFAULT_ROLE_IDS.ARCHITECT,
        'git',
        'branch',
        { list: true },
        'test-project'
      );

      expect(architectResult.roleContext?.suggestions?.[0]).toContain('feature branch');
    });
  });

  describe('Role Extension API Foundation', () => {
    it('should support custom role registration', async () => {
      const customRole = {
        id: 'security-engineer',
        name: 'Security Engineer',
        description: 'Focuses on security and compliance',
        isCustom: true,
        templateConfig: {
          focusAreas: ['security', 'compliance', 'threats'],
          defaultTags: ['security'],
          contextTypes: ['issue', 'decision', 'standard']
        }
      };

      await roleProvider.registerCustomRole(customRole);
      
      const roles = await roleProvider.getAvailableRoles();
      expect(roles.find(r => r.id === 'security-engineer')).toBeDefined();
    });

    it('should load role packages from configuration', async () => {
      const rolePackage = {
        metadata: {
          id: 'stripe-expert',
          name: 'Stripe Payment Expert',
          version: '1.0.0'
        },
        intelligence: {
          systemPrompt: 'You are a Stripe payments expert...',
          knowledgeBase: ['Stripe API docs', 'Payment flows'],
          focusAreas: ['payments', 'subscriptions']
        }
      };

      await roleProvider.loadRolePackage(rolePackage);
      
      const intelligence = await roleProvider.getRoleIntelligence('stripe-expert');
      expect(intelligence.focusAreas).toContain('payments');
    });

    it('should validate role package structure', async () => {
      const invalidPackage = {
        metadata: {
          id: 'invalid'
          // Missing required fields
        }
      };

      await expect(
        roleProvider.loadRolePackage(invalidPackage)
      ).rejects.toThrow('Invalid role package');
    });
  });
});
