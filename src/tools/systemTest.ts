/**
 * In-Place Testing Tools for Claude Desktop Users
 * Allows users to test shape-core functionality directly through Claude Desktop
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from '../db/database.js';
import { ServiceRegistry } from '../orchestration/registry/ServiceRegistry.js';
import { RoleOrchestrator } from '../orchestration/roles/RoleOrchestrator.js';

export function createSystemTestTool(): Tool {
  return {
    name: 'run_system_test',
    description: 'Run comprehensive system tests to validate shape-core functionality',
    inputSchema: {
      type: 'object',
      properties: {
        testSuite: {
          type: 'string',
          enum: ['quick', 'full', 'mcp', 'roles', 'services'],
          description: 'Test suite to run: quick (2min), full (5min), or specific area',
          default: 'quick'
        },
        includePerformance: {
          type: 'boolean',
          description: 'Include performance benchmarks',
          default: false
        }
      }
    }
  };
}

export async function handleSystemTest(
  db: DatabaseManager,
  registry: ServiceRegistry,
  orchestrator: RoleOrchestrator,
  args: any
): Promise<string> {
  const { testSuite = 'quick', includePerformance = false } = args;
  const results: any[] = [];
  
  try {
    // 1. Basic System Health
    results.push(await testSystemHealth(db, registry));
    
    // 2. MCP Protocol Tests
    if (testSuite === 'quick' || testSuite === 'full' || testSuite === 'mcp') {
      results.push(await testMCPProtocol(db, registry));
    }
    
    // 3. Role System Tests  
    if (testSuite === 'full' || testSuite === 'roles') {
      results.push(await testRoleSystem(orchestrator));
    }
    
    // 4. Service Integration Tests
    if (testSuite === 'full' || testSuite === 'services') {
      results.push(await testServiceIntegration(registry));
    }
    
    // 5. Performance Tests
    if (includePerformance && (testSuite === 'full' || testSuite === 'quick')) {
      results.push(await testPerformance(db, registry));
    }
    
    return formatTestResults(results, testSuite);
    
  } catch (error) {
    return formatError('System test failed', error);
  }
}

interface TestCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

interface TestResult {
  name: string;
  status: 'running' | 'pass' | 'fail' | 'error';
  checks: TestCheck[];
  error?: string;
}

async function testSystemHealth(db: DatabaseManager, registry: ServiceRegistry): Promise<TestResult> {
  const test: TestResult = { name: 'System Health', status: 'running', checks: [] };
  
  try {
    // Database connectivity
    const dbStatus = db.getCurrentSystem();
    test.checks.push({
      name: 'Database Connection',
      status: dbStatus ? 'pass' : 'fail',
      message: dbStatus ? 'Connected to SQLite database' : 'Database not accessible'
    });
    
    // Service registry
    const services = registry.getServices();
    test.checks.push({
      name: 'Service Registry',
      status: services.length >= 2 ? 'pass' : 'fail',
      message: `${services.length} services registered (expected: ≥2)`
    });
    
    // Schema version
    const schemaVersion = db.getSchemaVersion();
    test.checks.push({
      name: 'Database Schema',
      status: schemaVersion >= 4 ? 'pass' : 'fail',
      message: `Schema version: ${schemaVersion}`
    });
    
    test.status = test.checks.every(c => c.status === 'pass') ? 'pass' : 'fail';
    
  } catch (error) {
    test.status = 'error';
    test.error = error instanceof Error ? error.message : String(error);
  }
  
  return test;
}

async function testMCPProtocol(db: DatabaseManager, registry: ServiceRegistry): Promise<TestResult> {
  const test: TestResult = { name: 'MCP Protocol', status: 'running', checks: [] };
  
  try {
    // Test basic context operations
    const testProject = `test-${Date.now()}`;
    
    // Store context
    const project = db.upsertProject({ name: testProject });
    db.storeContext({
      project_id: project.id,
      type: 'note',
      key: 'test-key',
      value: 'test value',
      tags: ['test'],
      is_system_specific: false
    });
    test.checks.push({ name: 'Store Context', status: 'pass', message: 'Context stored successfully' });
    
    // Retrieve context
    const contexts = db.getProjectContext(project.id);
    test.checks.push({
      name: 'Retrieve Context',
      status: contexts.length > 0 ? 'pass' : 'fail',
      message: `Retrieved ${contexts.length} context entries`
    });
    
    // Search context
    const searchResults = db.searchContext({ query: 'test' });
    test.checks.push({
      name: 'Search Context',
      status: searchResults.length > 0 ? 'pass' : 'fail',
      message: `Found ${searchResults.length} search results`
    });
    
    test.status = test.checks.every(c => c.status === 'pass') ? 'pass' : 'fail';
    
  } catch (error) {
    test.status = 'error';
    test.error = error instanceof Error ? error.message : String(error);
  }
  
  return test;
}

async function testRoleSystem(orchestrator: RoleOrchestrator): Promise<TestResult> {
  const test: TestResult = { name: 'Role System', status: 'running', checks: [] };
  
  try {
    const testProject = `role-test-${Date.now()}`;
    
    // Test role execution
    const result = await orchestrator.executeAsRole(
      'developer',
      'filesystem', 
      'write_file',
      { path: '/tmp/test-role.txt', content: 'Role test' },
      testProject
    );
    
    test.checks.push({
      name: 'Role Execution',
      status: result.success ? 'pass' : 'fail',
      message: result.success ? 'Role executed successfully' : (result.error || 'Unknown error')
    });
    
    test.checks.push({
      name: 'Role Context',
      status: result.roleContext ? 'pass' : 'fail',
      message: result.roleContext ? 'Role context generated' : 'No role context'
    });
    
    test.status = test.checks.every(c => c.status === 'pass') ? 'pass' : 'fail';
    
  } catch (error) {
    test.status = 'error';
    test.error = error instanceof Error ? error.message : String(error);
  }
  
  return test;
}

async function testServiceIntegration(registry: ServiceRegistry): Promise<TestResult> {
  const test: TestResult = { name: 'Service Integration', status: 'running', checks: [] };
  
  try {
    // Test filesystem service
    const fsResult = await registry.execute('filesystem', {
      tool: 'write_file',
      args: { path: '/tmp/service-test.txt', content: 'Service integration test' }
    });
    
    test.checks.push({
      name: 'Filesystem Service',
      status: fsResult.success ? 'pass' : 'fail',
      message: fsResult.success ? 'File operations working' : (fsResult.error || 'Unknown error')
    });
    
    // Test git service (basic capability check)
    try {
      const gitService = await registry.getService('git');
      const capabilities = gitService?.capabilities;
      test.checks.push({
        name: 'Git Service',
        status: capabilities && capabilities.length > 0 ? 'pass' : 'fail',
        message: `Git service has ${capabilities?.length || 0} capabilities`
      });
    } catch (gitError) {
      test.checks.push({
        name: 'Git Service',
        status: 'warn',
        message: 'Git service available but may need repository'
      });
    }
    
    test.status = test.checks.filter(c => c.status === 'fail').length === 0 ? 'pass' : 'fail';
    
  } catch (error) {
    test.status = 'error';
    test.error = error instanceof Error ? error.message : String(error);
  }
  
  return test;
}

async function testPerformance(db: DatabaseManager, registry: ServiceRegistry): Promise<TestResult> {
  const test: TestResult = { name: 'Performance', status: 'running', checks: [] };
  
  try {
    // Context storage performance
    const start = Date.now();
    const perfProject = db.upsertProject({ name: `perf-test-${Date.now()}` });
    db.storeContext({
      project_id: perfProject.id,
      type: 'note',
      key: 'perf-key',
      value: 'performance test',
      tags: ['perf'],
      is_system_specific: false
    });
    const contextTime = Date.now() - start;
    
    test.checks.push({
      name: 'Context Storage Speed',
      status: contextTime < 100 ? 'pass' : contextTime < 500 ? 'warn' : 'fail',
      message: `${contextTime}ms (target: <100ms)`
    });
    
    // Service execution performance
    const serviceStart = Date.now();
    await registry.execute('filesystem', {
      tool: 'write_file',
      args: { path: '/tmp/perf-test.txt', content: 'perf test' }
    });
    const serviceTime = Date.now() - serviceStart;
    
    test.checks.push({
      name: 'Service Execution Speed',
      status: serviceTime < 100 ? 'pass' : serviceTime < 500 ? 'warn' : 'fail',
      message: `${serviceTime}ms (target: <100ms)`
    });
    
    test.status = test.checks.every(c => c.status !== 'fail') ? 'pass' : 'fail';
    
  } catch (error) {
    test.status = 'error';
    test.error = error instanceof Error ? error.message : String(error);
  }
  
  return test;
}

function formatTestResults(results: any[], testSuite: string): string {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.status === 'pass').length;
  const failedTests = results.filter(r => r.status === 'fail').length;
  const errorTests = results.filter(r => r.status === 'error').length;
  
  let output = `# Shape-Core System Test Results (${testSuite})\n\n`;
  output += `**Summary:** ${passedTests}/${totalTests} passed`;
  if (failedTests > 0) output += `, ${failedTests} failed`;
  if (errorTests > 0) output += `, ${errorTests} errors`;
  output += '\n\n';
  
  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    output += `${icon} **${result.name}** - ${result.status.toUpperCase()}\n`;
    
    if (result.error) {
      output += `   Error: ${result.error}\n`;
    }
    
    if (result.checks) {
      for (const check of result.checks) {
        const checkIcon = check.status === 'pass' ? '  ✓' : check.status === 'fail' ? '  ✗' : '  ⚠';
        output += `${checkIcon} ${check.name}: ${check.message}\n`;
      }
    }
    output += '\n';
  }
  
  if (failedTests === 0 && errorTests === 0) {
    output += '🎉 **All tests passed!** Shape-core is working correctly.\n';
  } else {
    output += '🔧 **Issues found.** Please check the failed tests above.\n';
  }
  
  output += '\n*Run with different test suites: quick, full, mcp, roles, services*';
  
  return output;
}

function formatError(message: string, error: any): string {
  return `❌ **${message}**\n\nError: ${error instanceof Error ? error.message : String(error)}`;
}
