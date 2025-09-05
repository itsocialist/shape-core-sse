/**
 * Test suite for team practices and role memory systems
 * Covers: team knowledge, role-specific memory, cross-project patterns
 */

import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { EnhancedDatabaseManager } from '../../src/db/enhanced-database-manager.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';

describe('Team Practices and Role Memory', () => {
  let db: EnhancedDatabaseManager;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `test-team-memory-${Date.now()}.db`);
    db = await EnhancedDatabaseManager.getInstance(testDbPath);
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('Team Practices Memory', () => {
    test('should store and retrieve team practices across projects', async () => {
      const practiceData = {
        practice_name: 'API Design Standards',
        category: 'development',
        description: 'RESTful API design principles and naming conventions',
        implementation_details: {
          endpoint_naming: 'Use plural nouns for collections (/users, /orders)',
          http_methods: 'GET for retrieval, POST for creation, PUT for updates',
          status_codes: 'Use appropriate HTTP status codes (200, 201, 400, 404, 500)',
          versioning: 'Include version in URL path (/v1/users)'
        },
        success_criteria: [
          'Consistent naming across all endpoints',
          'Proper HTTP method usage',
          'Clear error messages with appropriate status codes'
        ],
        created_by_role: 'architect',
        applicable_roles: ['backend-developer', 'frontend-developer', 'architect'],
        tags: ['api', 'rest', 'standards', 'development']
      };

      const result = await db.storeTeamPractice(practiceData);
      expect(result.success).toBe(true);
      expect(result.practice_id).toBeDefined();

      // Should retrieve practice by role
      const backendPractices = await db.getTeamPracticesByRole('backend-developer');
      expect(backendPractices).toHaveLength(1);
      expect(backendPractices[0].practice_name).toBe('API Design Standards');
    });

    test('should track practice adoption and effectiveness across projects', async () => {
      const practiceId = await db.createTestTeamPractice('Code Review Process');
      const project1Id = await db.createTestProject('project-1');
      const project2Id = await db.createTestProject('project-2');

      // Record practice adoption in projects
      await db.adoptTeamPractice(project1Id, practiceId, {
        adopted_by_role: 'developer',
        adoption_date: '2025-07-01',
        customizations: ['Added automated linting check'],
        success_metrics: { bugs_reduced: 40, review_time_reduced: 25 }
      });

      await db.adoptTeamPractice(project2Id, practiceId, {
        adopted_by_role: 'senior-developer',
        adoption_date: '2025-07-10',
        success_metrics: { bugs_reduced: 35, review_time_reduced: 30 }
      });

      // Should calculate practice effectiveness
      const effectiveness = await db.getTeamPracticeEffectiveness(practiceId);
      expect(effectiveness.adoption_count).toBe(2);
      expect(effectiveness.average_bug_reduction).toBe(37.5);
      expect(effectiveness.average_time_savings).toBe(27.5);
      expect(effectiveness.effectiveness_score).toBeGreaterThan(0.7);
    });

    test('should suggest relevant practices for new projects', async () => {
      // Create practices for different types of projects
      await db.createTestTeamPractice('React Component Standards', {
        tags: ['react', 'frontend', 'components'],
        applicable_roles: ['frontend-developer']
      });

      await db.createTestTeamPractice('Database Migration Process', {
        tags: ['database', 'backend', 'migrations'],
        applicable_roles: ['backend-developer', 'devops']
      });

      await db.createTestTeamPractice('Security Review Checklist', {
        tags: ['security', 'review', 'standards'],
        applicable_roles: ['architect', 'security-engineer']
      });

      // Should suggest relevant practices for frontend project
      const projectMetadata = {
        technologies: ['react', 'typescript', 'tailwind'],
        project_type: 'frontend-spa',
        team_roles: ['frontend-developer', 'designer']
      };

      const suggestions = await db.suggestTeamPractices(projectMetadata);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].practice_name).toBe('React Component Standards');
      expect(suggestions[0].relevance_score).toBeGreaterThan(0.8);
    });
  });

  describe('Role Project Memory', () => {
    test('should store project-specific role context and decisions', async () => {
      const projectId = await db.createTestProject('role-context-test');
      
      const roleContextData = {
        project_id: projectId,
        role: 'backend-developer',
        context_type: 'architectural_decisions',
        context_data: {
          database_choice: 'PostgreSQL',
          reasoning: 'Better JSON support and ACID compliance needed',
          alternatives_considered: ['MongoDB', 'MySQL'],
          trade_offs: {
            pros: ['Strong consistency', 'JSON support', 'Mature ecosystem'],
            cons: ['More complex setup', 'Learning curve for team']
          },
          decision_date: '2025-07-15',
          review_date: '2025-10-15'
        },
        tags: ['database', 'architecture', 'postgresql'],
        access_level: 'project_team' // project_team, role_specific, public
      };

      const result = await db.storeRoleProjectMemory(roleContextData);
      expect(result.success).toBe(true);
      expect(result.memory_id).toBeDefined();

      // Should retrieve role-specific project context
      const backendContext = await db.getRoleProjectMemory(projectId, 'backend-developer');
      expect(backendContext).toHaveLength(1);
      expect(backendContext[0].context_data.database_choice).toBe('PostgreSQL');
    });

    test('should track role decision evolution over project lifecycle', async () => {
      const projectId = await db.createTestProject('decision-evolution-test');
      const roleMemoryId = await db.createTestRoleProjectMemory(projectId, 'architect');

      // Record decision evolution
      await db.updateRoleProjectMemory(roleMemoryId, {
        context_data: {
          original_decision: 'Monolithic architecture',
          updated_decision: 'Microservices architecture',
          change_reason: 'Scalability requirements increased',
          impact_assessment: 'Moderate complexity increase but better scalability'
        },
        change_type: 'architectural_revision',
        changed_by_role: 'architect',
        change_date: '2025-07-20'
      });

      const evolution = await db.getRoleDecisionEvolution(projectId, 'architect');
      expect(evolution.decisions).toHaveLength(1);
      expect(evolution.decisions[0].change_type).toBe('architectural_revision');
      expect(evolution.decisions[0].change_reason).toBe('Scalability requirements increased');
    });

    test('should provide role handoff context when switching team members', async () => {
      const projectId = await db.createTestProject('handoff-test');
      
      // Store comprehensive role context
      await db.storeRoleProjectMemory({
        project_id: projectId,
        role: 'frontend-developer',
        context_type: 'current_work',
        context_data: {
          active_features: ['User Dashboard', 'Settings Panel'],
          pending_reviews: ['PR #123: Authentication UI'],
          known_issues: ['IE11 compatibility bug in date picker'],
          next_priorities: ['Mobile responsive design', 'Performance optimization'],
          code_patterns: {
            state_management: 'Using Redux with async thunks',
            styling: 'Tailwind CSS with custom components',
            testing: 'Jest + React Testing Library'
          }
        }
      });

      // Should generate handoff summary
      const handoffContext = await db.generateRoleHandoffContext(projectId, 'frontend-developer');
      expect(handoffContext.active_work_items).toHaveLength(2);
      expect(handoffContext.pending_items).toHaveLength(1);
      expect(handoffContext.priority_items).toHaveLength(2);
      expect(handoffContext.code_patterns).toBeDefined();
    });
  });

  describe('Cross-Project Role Memory', () => {
    test('should identify and store reusable role patterns across projects', async () => {
      const project1Id = await db.createTestProject('pattern-project-1');
      const project2Id = await db.createTestProject('pattern-project-2');
      
      // Store similar patterns in different projects
      await db.storeRoleProjectMemory({
        project_id: project1Id,
        role: 'devops',
        context_type: 'deployment_pattern',
        context_data: {
          pattern_name: 'Blue-Green Deployment',
          implementation: 'Using AWS ELB and Auto Scaling Groups',
          success_metrics: { downtime_reduction: 95, rollback_speed: '2 minutes' }
        }
      });

      await db.storeRoleProjectMemory({
        project_id: project2Id,
        role: 'devops',
        context_type: 'deployment_pattern',
        context_data: {
          pattern_name: 'Blue-Green Deployment',
          implementation: 'Using Kubernetes with service switching',
          success_metrics: { downtime_reduction: 98, rollback_speed: '30 seconds' }
        }
      });

      // Should identify pattern as reusable
      const patterns = await db.identifyReusableRolePatterns('devops');
      expect(patterns).toHaveLength(1);
      expect(patterns[0].pattern_name).toBe('Blue-Green Deployment');
      expect(patterns[0].usage_count).toBe(2);
      expect(patterns[0].average_success_metrics.downtime_reduction).toBe(96.5);
    });

    test('should provide role-specific recommendations based on cross-project experience', async () => {
      // Create multiple projects with successful patterns
      for (let i = 1; i <= 3; i++) {
        const projectId = await db.createTestProject(`recommendation-project-${i}`);
        await db.storeRoleProjectMemory({
          project_id: projectId,
          role: 'qa-engineer',
          context_type: 'testing_strategy',
          context_data: {
            strategy_name: 'Risk-Based Testing',
            success_rating: 4.5,
            time_savings: 30,
            bug_detection_improvement: 25
          }
        });
      }

      const newProjectId = await db.createTestProject('new-recommendation-project');
      
      // Should recommend successful patterns from other projects
      const recommendations = await db.getRolePatterRecommendations(newProjectId, 'qa-engineer');
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].pattern_name).toBe('Risk-Based Testing');
      expect(recommendations[0].confidence_score).toBeGreaterThan(0.8);
      expect(recommendations[0].success_evidence.usage_count).toBe(3);
    });

    test('should track role skill development across projects', async () => {
      const role = 'backend-developer';
      
      // Simulate role progression across multiple projects
      const skillProgressions = [
        {
          project: 'beginner-project',
          skills: ['basic-api-design', 'simple-database-queries'],
          complexity_level: 'beginner',
          success_rating: 3.5
        },
        {
          project: 'intermediate-project', 
          skills: ['api-design', 'database-optimization', 'caching'],
          complexity_level: 'intermediate',
          success_rating: 4.2
        },
        {
          project: 'advanced-project',
          skills: ['microservices', 'distributed-systems', 'performance-tuning'],
          complexity_level: 'advanced',
          success_rating: 4.8
        }
      ];

      for (const progression of skillProgressions) {
        const projectId = await db.createTestProject(progression.project);
        await db.recordRoleSkillProgression(projectId, role, {
          skills_demonstrated: progression.skills,
          complexity_level: progression.complexity_level,
          success_rating: progression.success_rating,
          learning_outcomes: [`Improved ${progression.skills.join(', ')}`]
        });
      }

      // Should track skill development trajectory
      const skillDevelopment = await db.getRoleSkillDevelopment(role);
      expect(skillDevelopment.skill_progression.length).toBe(3);
      expect(skillDevelopment.complexity_trend).toBe('improving');
      expect(skillDevelopment.current_skill_level).toBe('advanced');
      expect(skillDevelopment.success_trend).toBe('improving');
    });
  });

  describe('Enhanced Context Retrieval', () => {
    test('should provide blazing fast context retrieval with proper indexing', async () => {
      const projectId = await db.createTestProject('performance-test-project');
      
      // Create large dataset for performance testing
      const contextPromises = [];
      for (let i = 0; i < 1000; i++) {
        contextPromises.push(db.storeRoleProjectMemory({
          project_id: projectId,
          role: i % 5 === 0 ? 'architect' : 'developer',
          context_type: 'performance_test',
          context_data: { test_data: `Performance test entry ${i}` },
          tags: [`tag-${i % 10}`, `category-${i % 5}`]
        }));
      }
      
      await Promise.all(contextPromises);

      // Should retrieve architect contexts quickly
      const startTime = Date.now();
      const architectContexts = await db.getRoleProjectMemory(projectId, 'architect');
      const retrievalTime = Date.now() - startTime;
      
      expect(architectContexts.length).toBeGreaterThan(180); // ~200 architect entries
      expect(retrievalTime).toBeLessThan(50); // Should be under 50ms
    });

    test('should support complex multi-dimensional context queries', async () => {
      const projectId = await db.createTestProject('complex-query-test');
      
      // Create diverse context entries
      await db.storeRoleProjectMemory({
        project_id: projectId,
        role: 'architect',
        context_type: 'architectural_decisions',
        context_data: { decision: 'Database choice: PostgreSQL' },
        tags: ['database', 'postgresql', 'architecture'],
        access_level: 'project_team'
      });

      await db.storeRoleProjectMemory({
        project_id: projectId,
        role: 'developer',
        context_type: 'implementation_notes',
        context_data: { notes: 'PostgreSQL connection pooling implemented' },
        tags: ['database', 'postgresql', 'implementation'],
        access_level: 'role_specific'
      });

      // Should support complex filtering
      const complexQuery = {
        project_id: projectId,
        tags: ['postgresql'],
        roles: ['architect', 'developer'],
        context_types: ['architectural_decisions', 'implementation_notes'],
        date_range: { start: '2025-07-01', end: '2025-07-31' },
        access_levels: ['project_team', 'role_specific']
      };

      const results = await db.complexContextQuery(complexQuery);
      expect(results.total_count).toBe(2);
      expect(results.entries).toHaveLength(2);
      expect(results.facets.roles).toEqual(['architect', 'developer']);
      expect(results.facets.context_types).toEqual(['architectural_decisions', 'implementation_notes']);
    });
  });
});
