/**
 * Test suite for version and release management
 * Covers: semantic versioning, release planning, deployment tracking
 */

import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { EnhancedDatabaseManager } from '../../src/db/enhanced-database-manager.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';

describe('Version and Release Management', () => {
  let db: EnhancedDatabaseManager;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `test-version-release-${Date.now()}.db`);
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

  describe('Version Management', () => {
    test('should create and validate semantic versions', async () => {
      const projectId = await db.createTestProject('version-test-project');
      
      const versionData = {
        project_id: projectId,
        version: '1.2.3',
        type: 'minor',
        status: 'planning',
        target_date: '2025-08-15',
        changelog_summary: 'Enhanced authentication and performance improvements',
        breaking_changes: false
      };

      const result = await db.createVersion(versionData);
      expect(result.success).toBe(true);
      expect(result.version_id).toBeDefined();

      // Should validate semantic version format
      await expect(db.createVersion({
        ...versionData,
        version: 'invalid-version'
      })).rejects.toThrow('Invalid semantic version format');
    });

    test('should prevent duplicate versions in same project', async () => {
      const projectId = await db.createTestProject('duplicate-version-test');
      
      await db.createVersion({
        project_id: projectId,
        version: '1.0.0',
        type: 'major'
      });

      // Should prevent duplicate version
      await expect(db.createVersion({
        project_id: projectId,
        version: '1.0.0',
        type: 'patch'
      })).rejects.toThrow('Version 1.0.0 already exists for this project');
    });

    test('should track version progression and dependencies', async () => {
      const projectId = await db.createTestProject('progression-test-project');
      
      // Create sequential versions
      const v100 = await db.createVersion({
        project_id: projectId,
        version: '1.0.0',
        type: 'major',
        status: 'released'
      });

      const v110 = await db.createVersion({
        project_id: projectId,
        version: '1.1.0', 
        type: 'minor',
        status: 'in_development',
        previous_version_id: v100.version_id
      });

      const progression = await db.getVersionProgression(projectId);
      expect(progression.versions).toHaveLength(2);
      expect(progression.current_version).toBe('1.1.0');
      expect(progression.latest_release).toBe('1.0.0');
    });

    test('should associate epics and stories with target versions', async () => {
      const projectId = await db.createTestProject('version-epic-test');
      const versionId = await db.createTestVersion(projectId, '2.0.0');
      const epicId = await db.createTestEpic(projectId, 'Version 2.0 Epic');
      
      // Should associate epic with version
      await db.associateEpicWithVersion(epicId, versionId);
      
      const versionEpics = await db.getVersionEpics(versionId);
      expect(versionEpics).toHaveLength(1);
      expect(versionEpics[0].epic_id).toBe(epicId);

      const epicVersion = await db.getEpicVersion(epicId);
      expect(epicVersion.version_id).toBe(versionId);
      expect(epicVersion.version).toBe('2.0.0');
    });
  });

  describe('Release Management', () => {
    test('should create releases with deployment tracking', async () => {
      const projectId = await db.createTestProject('release-test-project');
      const versionId = await db.createTestVersion(projectId, '1.0.0');
      
      const releaseData = {
        version_id: versionId,
        release_name: 'Phoenix Release',
        release_date: '2025-07-25T14:00:00Z',
        environment: 'production',
        deployment_method: 'automated',
        rollback_plan: 'Automated rollback to v0.9.8 if critical issues detected',
        deployment_notes: 'First major release with complete authentication system',
        approval_required: true,
        approved_by_role: 'devops-lead'
      };

      const result = await db.createRelease(releaseData);
      expect(result.success).toBe(true);
      expect(result.release_id).toBeDefined();

      const release = await db.getRelease(result.release_id);
      expect(release.release_name).toBe('Phoenix Release');
      expect(release.environment).toBe('production');
      expect(release.deployment_method).toBe('automated');
    });

    test('should track multi-environment deployment progression', async () => {
      const projectId = await db.createTestProject('multi-env-test');
      const versionId = await db.createTestVersion(projectId, '1.1.0');
      
      // Create releases for different environments
      const devRelease = await db.createRelease({
        version_id: versionId,
        release_name: 'v1.1.0-dev',
        environment: 'development',
        release_date: '2025-07-20T10:00:00Z',
        status: 'completed'
      });

      const stagingRelease = await db.createRelease({
        version_id: versionId,
        release_name: 'v1.1.0-staging',
        environment: 'staging', 
        release_date: '2025-07-22T10:00:00Z',
        status: 'completed',
        previous_release_id: devRelease.release_id
      });

      const prodRelease = await db.createRelease({
        version_id: versionId,
        release_name: 'v1.1.0-prod',
        environment: 'production',
        release_date: '2025-07-25T14:00:00Z',
        status: 'planned',
        previous_release_id: stagingRelease.release_id
      });

      const deployment = await db.getDeploymentProgression(versionId);
      expect(deployment.environments).toHaveLength(3);
      expect(deployment.current_environment).toBe('staging');
      expect(deployment.next_environment).toBe('production');
      expect(deployment.ready_for_production).toBe(true);
    });

    test('should validate release readiness and prerequisites', async () => {
      const projectId = await db.createTestProject('readiness-test');
      const versionId = await db.createTestVersion(projectId, '1.0.0');
      
      // Add epics and stories to version
      const epicId = await db.createTestEpic(projectId, 'Release Epic');
      await db.associateEpicWithVersion(epicId, versionId);
      
      const storyId = await db.createTestStory(projectId, 'Incomplete Story', epicId);
      await db.updateStoryStatus(storyId, 'in_progress');

      // Should identify blocking issues for release
      const readiness = await db.checkReleaseReadiness(versionId);
      expect(readiness.ready_for_release).toBe(false);
      expect(readiness.blocking_issues).toContain('Incomplete stories in version');
      expect(readiness.incomplete_stories).toHaveLength(1);
    });

    test('should track release metrics and rollback scenarios', async () => {
      const projectId = await db.createTestProject('metrics-test');
      const versionId = await db.createTestVersion(projectId, '1.0.0');
      const releaseId = await db.createTestRelease(versionId, 'production');
      
      // Record deployment metrics
      await db.recordDeploymentMetrics(releaseId, {
        deployment_duration_minutes: 12,
        downtime_minutes: 2,
        performance_impact_percentage: -5, // 5% improvement
        error_rate_change_percentage: -50, // 50% reduction in errors
        user_satisfaction_score: 4.2
      });

      // Simulate rollback scenario
      await db.recordRollback(releaseId, {
        rollback_reason: 'Critical authentication bug discovered',
        rollback_duration_minutes: 8,
        rollback_initiated_by_role: 'devops-engineer',
        rollback_to_version: '0.9.8'
      });

      const metrics = await db.getReleaseMetrics(releaseId);
      expect(metrics.deployment_success).toBe(false);
      expect(metrics.rollback_occurred).toBe(true);
      expect(metrics.rollback_reason).toContain('authentication bug');
    });
  });

  describe('Version Analytics', () => {
    test('should calculate development velocity across versions', async () => {
      const projectId = await db.createTestProject('velocity-analytics-test');
      
      // Create multiple versions with associated work
      const v100 = await db.createTestVersionWithWork(projectId, '1.0.0', {
        epics: 2,
        stories: 8,
        story_points: 40,
        development_days: 30
      });

      const v110 = await db.createTestVersionWithWork(projectId, '1.1.0', {
        epics: 1,
        stories: 5,
        story_points: 25,
        development_days: 14
      });

      const analytics = await db.getVersionAnalytics(projectId);
      expect(analytics.average_velocity_per_day).toBeCloseTo(1.75); // (40+25)/(30+14)
      expect(analytics.version_count).toBe(2);
      expect(analytics.total_story_points).toBe(65);
      expect(analytics.velocity_trend).toBe('improving'); // Faster delivery in v1.1.0
    });
  });
});
