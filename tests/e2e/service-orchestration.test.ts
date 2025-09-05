/**
 * Service Orchestration Tests
 * Tests cross-service coordination and role-based workflows
 */

import { MCPMProServer } from '../../src/index.js';
import { DatabaseManager } from '../../src/db/database.js';
import { RoleOrchestrator } from '../../src/orchestration/roles/RoleOrchestrator.js';
import { ServiceRegistry } from '../../src/orchestration/registry/ServiceRegistry.js';

describe('Service Orchestration', () => {
  let server: MCPMProServer;
  let db: DatabaseManager;
  let orchestrator: RoleOrchestrator;
  let registry: ServiceRegistry;

  beforeEach(async () => {
    db = new DatabaseManager(':memory:');
    await db.initialize();
    
    server = new MCPMProServer({
      mode: 'pro',
      database: db
    });
    await server.initialize();
    
    orchestrator = (server as any).orchestrator;
    registry = (server as any).registry;
  });

  afterEach(async () => {
    await server?.close();
    await db?.close();
  });

  describe('Role-Based Workflow Execution', () => {
    test('Developer role can create and commit code', async () => {
      const testProject = 'orchestration-test';
      
      // 1. Create project context
      const project = await server.callTool('store_project_context', {
        project_name: testProject,
        description: 'Test orchestration workflow'
      });
      expect(project.isError).toBeFalsy();

      // 2. Generate code as developer role
      const codeResult = await server.callTool('execute_as_role', {
        roleId: 'developer',
        serviceName: 'filesystem',
        tool: 'write_file',
        args: {
          path: '/tmp/test-app.js',
          content: 'console.log("Hello from orchestrated workflow");'
        },
        projectName: testProject
      });

      expect(codeResult.isError).toBeFalsy();
      const codeData = JSON.parse(codeResult.content[0].text);
      expect(codeData.roleContext.roleId).toBe('developer');
      expect(codeData.roleContext.contextStored).toBe(true);

      // 3. Commit as developer role
      const gitResult = await server.callTool('execute_as_role', {
        roleId: 'developer', 
        serviceName: 'git',
        tool: 'add',
        args: { files: ['/tmp/test-app.js'] },
        projectName: testProject
      });

      expect(gitResult.isError).toBeFalsy();
      const gitData = JSON.parse(gitResult.content[0].text);
      expect(gitData.roleContext.roleId).toBe('developer');
    });

    test('Context flows between role executions', async () => {
      const testProject = 'context-flow-test';

      // Setup project
      await server.callTool('store_project_context', {
        project_name: testProject,
        description: 'Testing context flow between roles'
      });

      // Architect makes design decision
      const architectResult = await server.callTool('execute_as_role', {
        roleId: 'architect',
        serviceName: 'filesystem',
        tool: 'write_file',
        args: {
          path: '/tmp/architecture.md',
          content: '# Architecture Decision: Use React + TypeScript'
        },
        projectName: testProject
      });

      // Developer can access architect's context
      const devResult = await server.callTool('execute_as_role', {
        roleId: 'developer',
        serviceName: 'filesystem', 
        tool: 'read_file',
        args: { path: '/tmp/architecture.md' },
        projectName: testProject
      });

      expect(architectResult.isError).toBeFalsy();
      expect(devResult.isError).toBeFalsy();

      const devData = JSON.parse(devResult.content[0].text);
      expect(devData.roleContext.analysis).toBeDefined();
    });

    test('QA role can validate developer output', async () => {
      const testProject = 'qa-validation-test';

      await server.callTool('store_project_context', {
        project_name: testProject,
        description: 'QA validation workflow test'
      });

      // Developer creates code
      const devCode = await server.callTool('execute_as_role', {
        roleId: 'developer',
        serviceName: 'filesystem',
        tool: 'write_file',
        args: {
          path: '/tmp/feature.js',
          content: 'function add(a, b) { return a + b; }'
        },
        projectName: testProject
      });

      // QA reviews the code
      const qaReview = await server.callTool('execute_as_role', {
        roleId: 'qa',
        serviceName: 'filesystem',
        tool: 'read_file', 
        args: { path: '/tmp/feature.js' },
        projectName: testProject
      });

      expect(devCode.isError).toBeFalsy();
      expect(qaReview.isError).toBeFalsy();

      const qaData = JSON.parse(qaReview.content[0].text);
      expect(qaData.roleContext.roleId).toBe('qa');
      expect(qaData.roleContext.analysis).toContain('quality');
    });
  });

  describe('Cross-Service Coordination', () => {
    test('Git operations store context automatically', async () => {
      const testProject = 'git-context-test';

      await server.callTool('store_project_context', {
        project_name: testProject,
        description: 'Git context storage test'
      });

      const gitStatus = await server.callTool('git_operation', {
        action: 'status',
        projectName: testProject,
        storeResult: true
      });

      expect(gitStatus.isError).toBeFalsy();
      
      // Verify context was stored
      const contexts = await server.callTool('search_context', {
        project_name: testProject,
        tags: ['git']
      });

      expect(contexts.isError).toBeFalsy();
      const contextData = JSON.parse(contexts.content[0].text);
      expect(contextData.results.length).toBeGreaterThan(0);
    });

    test('Service failures are handled gracefully', async () => {
      // Test with invalid git repository
      const result = await server.callTool('execute_as_role', {
        roleId: 'developer',
        serviceName: 'git',
        tool: 'status',
        args: { repositoryPath: '/nonexistent/repo' },
        projectName: 'failure-test'
      });

      expect(result.isError).toBeFalsy(); // Should not crash
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('Service Registry Coordination', () => {
    test('Services are registered and discoverable', async () => {
      const services = await registry.listServices();
      
      expect(services.length).toBeGreaterThanOrEqual(2); // filesystem + git
      expect(services.find(s => s.name === 'filesystem')).toBeDefined();
      expect(services.find(s => s.name === 'git')).toBeDefined();
    });

    test('Service capabilities are properly exposed', async () => {
      const fsService = await registry.getService('filesystem');
      const gitService = await registry.getService('git');

      expect(fsService?.getCapabilities()).resolves.toBeDefined();
      expect(gitService?.getCapabilities()).resolves.toBeDefined();
    });

    test('Service execution through registry', async () => {
      const result = await registry.execute('filesystem', {
        tool: 'write_file',
        args: {
          path: '/tmp/registry-test.txt',
          content: 'Service registry test'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Context Memory Integration', () => {
    test('Role executions create searchable context', async () => {
      const testProject = 'memory-integration-test';

      await server.callTool('store_project_context', {
        project_name: testProject,
        description: 'Memory integration test'
      });

      // Execute multiple role actions
      await server.callTool('execute_as_role', {
        roleId: 'architect',
        serviceName: 'filesystem',
        tool: 'write_file',
        args: {
          path: '/tmp/design.md',
          content: 'Design document for integration test'
        },
        projectName: testProject
      });

      // Search for stored context
      const search = await server.callTool('search_context', {
        project_name: testProject,
        query: 'design'
      });

      expect(search.isError).toBeFalsy();
      const searchData = JSON.parse(search.content[0].text);
      expect(searchData.results.length).toBeGreaterThan(0);
    });
  });
});
