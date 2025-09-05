/**
 * Test suite for enhanced project management data taxonomy
 * Covers: sprints, stories, epics, issues, and enhanced metadata
 */

import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { EnhancedDatabaseManager } from '../../src/db/enhanced-database-manager.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';

describe('Enhanced Project Management Data Taxonomy', () => {
  let db: EnhancedDatabaseManager;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `test-enhanced-taxonomy-${Date.now()}.db`);
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

  describe('Enhanced Project Metadata', () => {
    test('should enforce required project metadata fields', async () => {
      const projectData = {
        name: 'test-project',
        description: 'Test project for enhanced metadata',
        project_directory: '/Users/briandawson/workspace/test-project',
        system_id: 1,
        source_control_url: 'https://github.com/test/test-project.git',
        workflow_type: 'agile-scrum',
        team: {
          architect: 'alice@example.com',
          developer: 'bob@example.com',
          devops: 'charlie@example.com',
          qa: 'diana@example.com'
        }
      };

      // Should successfully create project with all required metadata
      const result = await db.storeEnhancedProject(projectData);
      expect(result.success).toBe(true);
      expect(result.project_id).toBeDefined();

      // Should retrieve project with all metadata intact
      const project = await db.getProjectWithMetadata('test-project');
      expect(project.project_directory).toBe(projectData.project_directory);
      expect(project.source_control_url).toBe(projectData.source_control_url);
      expect(project.workflow_type).toBe(projectData.workflow_type);
      expect(project.team).toEqual(projectData.team);
    });

    test('should validate project directory exists and is accessible', async () => {
      const projectData = {
        name: 'invalid-project',
        project_directory: '/nonexistent/path',
        system_id: 1
      };

      // Should validate project directory accessibility
      await expect(db.storeEnhancedProject(projectData))
        .rejects.toThrow('Project directory does not exist or is not accessible');
    });

    test('should prevent creation of projects with duplicate directories', async () => {
      const sharedDirectory = '/Users/briandawson/workspace/shared';
      
      await db.storeEnhancedProject({
        name: 'project-1',
        project_directory: sharedDirectory,
        system_id: 1
      });

      // Should prevent second project with same directory
      await expect(db.storeEnhancedProject({
        name: 'project-2', 
        project_directory: sharedDirectory,
        system_id: 1
      })).rejects.toThrow('Project directory already in use by another project');
    });
  });

  describe('Epic Management', () => {
    test('should create and manage epics with proper hierarchy', async () => {
      const projectId = await db.createTestProject('epic-test-project');
      
      const epicData = {
        project_id: projectId,
        title: 'User Authentication System',
        description: 'Complete user authentication and authorization system',
        status: 'planning',
        priority: 'high',
        business_value: 'Enables user management and security',
        acceptance_criteria: [
          'Users can register with email',
          'Users can login securely',
          'Role-based access control implemented'
        ],
        estimated_story_points: 21,
        target_version: '1.0.0'
      };

      const result = await db.createEpic(epicData);
      expect(result.success).toBe(true);
      expect(result.epic_id).toBeDefined();

      // Should retrieve epic with all details
      const epic = await db.getEpic(result.epic_id);
      expect(epic.title).toBe(epicData.title);
      expect(epic.status).toBe('planning');
      expect(epic.estimated_story_points).toBe(21);
      expect(epic.acceptance_criteria).toEqual(epicData.acceptance_criteria);
    });

    test('should track epic progress based on associated stories', async () => {
      const projectId = await db.createTestProject('epic-progress-test');
      const epicId = await db.createTestEpic(projectId, 'Progress Test Epic');
      
      // Create stories associated with epic
      await db.createStory({
        epic_id: epicId,
        title: 'Story 1',
        status: 'completed',
        story_points: 3
      });
      
      await db.createStory({
        epic_id: epicId,
        title: 'Story 2', 
        status: 'in_progress',
        story_points: 5
      });

      const progress = await db.getEpicProgress(epicId);
      expect(progress.total_stories).toBe(2);
      expect(progress.completed_stories).toBe(1);
      expect(progress.total_points).toBe(8);
      expect(progress.completed_points).toBe(3);
      expect(progress.progress_percentage).toBe(37.5);
    });
  });

  describe('Sprint Management', () => {
    test('should create sprints with proper timing and capacity', async () => {
      const projectId = await db.createTestProject('sprint-test-project');
      
      const sprintData = {
        project_id: projectId,
        name: 'Sprint 1',
        start_date: '2025-07-20',
        end_date: '2025-08-03',
        capacity_story_points: 30,
        sprint_goal: 'Establish core authentication framework',
        status: 'planning'
      };

      const result = await db.createSprint(sprintData);
      expect(result.success).toBe(true);
      expect(result.sprint_id).toBeDefined();

      // Should validate sprint dates
      const sprint = await db.getSprint(result.sprint_id);
      expect(sprint.start_date).toBe('2025-07-20');
      expect(sprint.end_date).toBe('2025-08-03');
      expect(sprint.duration_days).toBe(14);
    });

    test('should prevent overlapping sprints in same project', async () => {
      const projectId = await db.createTestProject('overlap-test-project');
      
      await db.createSprint({
        project_id: projectId,
        name: 'Sprint 1',
        start_date: '2025-07-20',
        end_date: '2025-08-03'
      });

      // Should prevent overlapping sprint
      await expect(db.createSprint({
        project_id: projectId,
        name: 'Sprint 2',
        start_date: '2025-07-25',
        end_date: '2025-08-08'
      })).rejects.toThrow('Sprint dates overlap with existing sprint');
    });

    test('should track sprint capacity and velocity', async () => {
      const projectId = await db.createTestProject('velocity-test-project');
      const sprintId = await db.createTestSprint(projectId, 'Velocity Test Sprint');
      
      // Add stories to sprint
      await db.addStoryToSprint(sprintId, {
        title: 'Story A',
        story_points: 8,
        status: 'completed'
      });
      
      await db.addStoryToSprint(sprintId, {
        title: 'Story B', 
        story_points: 5,
        status: 'completed'
      });

      const velocity = await db.getSprintVelocity(sprintId);
      expect(velocity.planned_points).toBe(13);
      expect(velocity.completed_points).toBe(13);
      expect(velocity.velocity_percentage).toBe(100);
    });
  });

  describe('Story Management', () => {
    test('should create stories with proper acceptance criteria', async () => {
      const projectId = await db.createTestProject('story-test-project');
      const epicId = await db.createTestEpic(projectId, 'Test Epic');
      
      const storyData = {
        epic_id: epicId,
        title: 'User Registration API',
        description: 'As a user, I want to register with email so I can access the system',
        acceptance_criteria: [
          'Given valid email and password, user account is created',
          'Given invalid email format, registration fails with clear error',
          'Given existing email, registration fails with appropriate message'
        ],
        story_points: 5,
        priority: 'high',
        status: 'ready_for_development',
        assignee_role: 'backend-developer'
      };

      const result = await db.createStory(storyData);
      expect(result.success).toBe(true);
      expect(result.story_id).toBeDefined();

      const story = await db.getStory(result.story_id);
      expect(story.title).toBe(storyData.title);
      expect(story.acceptance_criteria).toEqual(storyData.acceptance_criteria);
      expect(story.assignee_role).toBe('backend-developer');
    });

    test('should track story lifecycle and role assignments', async () => {
      const projectId = await db.createTestProject('lifecycle-test-project');
      const storyId = await db.createTestStory(projectId, 'Lifecycle Test Story');
      
      // Should track status transitions
      await db.updateStoryStatus(storyId, 'in_progress', 'backend-developer');
      await db.updateStoryStatus(storyId, 'code_review', 'senior-developer');
      await db.updateStoryStatus(storyId, 'testing', 'qa-engineer');
      await db.updateStoryStatus(storyId, 'completed', 'qa-engineer');

      const lifecycle = await db.getStoryLifecycle(storyId);
      expect(lifecycle.transitions).toHaveLength(4);
      expect(lifecycle.transitions[0].status).toBe('in_progress');
      expect(lifecycle.transitions[0].role).toBe('backend-developer');
      expect(lifecycle.current_status).toBe('completed');
    });
  });

  describe('Issue Tracking', () => {
    test('should create and categorize issues with proper metadata', async () => {
      const projectId = await db.createTestProject('issue-test-project');
      
      const issueData = {
        project_id: projectId,
        title: 'Authentication token expires too quickly',
        description: 'JWT tokens expire after 15 minutes causing frequent re-authentication',
        type: 'bug',
        severity: 'medium',
        priority: 'high',
        status: 'open',
        reporter_role: 'qa-engineer',
        assignee_role: 'backend-developer',
        tags: ['authentication', 'jwt', 'ux'],
        reproduction_steps: [
          'Login to application',
          'Wait 16 minutes without activity',
          'Attempt to make API call',
          'Observe authentication error'
        ]
      };

      const result = await db.createIssue(issueData);
      expect(result.success).toBe(true);
      expect(result.issue_id).toBeDefined();

      const issue = await db.getIssue(result.issue_id);
      expect(issue.title).toBe(issueData.title);
      expect(issue.type).toBe('bug');
      expect(issue.severity).toBe('medium');
      expect(issue.reproduction_steps).toEqual(issueData.reproduction_steps);
    });

    test('should link issues to stories and epics', async () => {
      const projectId = await db.createTestProject('link-test-project');
      const epicId = await db.createTestEpic(projectId, 'Test Epic');
      const storyId = await db.createTestStory(projectId, 'Test Story', epicId);
      const issueId = await db.createTestIssue(projectId, 'Test Issue');

      // Should link issue to story
      await db.linkIssueToStory(issueId, storyId);
      
      // Should retrieve linked relationships
      const storyIssues = await db.getStoryIssues(storyId);
      expect(storyIssues).toHaveLength(1);
      expect(storyIssues[0].issue_id).toBe(issueId);

      const issueStories = await db.getIssueStories(issueId);
      expect(issueStories).toHaveLength(1);
      expect(issueStories[0].story_id).toBe(storyId);
    });
  });
});
