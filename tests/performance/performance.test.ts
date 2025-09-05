/**
 * Performance Testing Framework for MPCM-Pro
 * Establishes baselines and monitors for regressions
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { performance } from 'perf_hooks';
import { DatabaseManager } from '../../src/db/database.js';
import { MCPMProServer } from '../../src/index.js';
import { existsSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

// Performance thresholds (milliseconds)
const PERFORMANCE_THRESHOLDS = {
  serverStartup: 500,
  toolListRequest: 50,
  simpleToolCall: 100,
  complexToolCall: 500,
  databaseWrite: 50,
  databaseRead: 20,
  serviceRegistration: 100,
  roleSwitch: 50,
  contextSearch: 100,
  memoryPerOperation: 10 * 1024 * 1024, // 10MB
};

// Performance results storage
interface PerformanceResult {
  metric: string;
  duration: number;
  memory: number;
  timestamp: Date;
  passed: boolean;
}

class PerformanceMonitor {
  private results: PerformanceResult[] = [];
  private startTime: number = 0;
  private startMemory: number = 0;

  start(): void {
    this.startTime = performance.now();
    this.startMemory = process.memoryUsage().heapUsed;
  }

  end(metric: string, threshold: number): PerformanceResult {
    const duration = performance.now() - this.startTime;
    const memory = process.memoryUsage().heapUsed - this.startMemory;
    
    const result: PerformanceResult = {
      metric,
      duration,
      memory,
      timestamp: new Date(),
      passed: duration <= threshold
    };
    
    this.results.push(result);
    return result;
  }

  getResults(): PerformanceResult[] {
    return this.results;
  }

  generateReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB'
      },
      results: this.results,
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        avgDuration: this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length,
        maxMemory: Math.max(...this.results.map(r => r.memory))
      }
    };
    
    return JSON.stringify(report, null, 2);
  }
}

describe.skip('MPCM-Pro Performance Tests', () => {
  const TEST_DB = join(process.cwd(), 'test-performance.db');
  const RESULTS_DIR = join(process.cwd(), 'performance-results');
  let db: DatabaseManager;
  let server: MCPMProServer;
  let monitor: PerformanceMonitor;

  beforeAll(async () => {
    // Clean up any existing test database
    if (existsSync(TEST_DB)) {
      rmSync(TEST_DB);
    }
    
    // Create results directory
    if (!existsSync(RESULTS_DIR)) {
      mkdirSync(RESULTS_DIR, { recursive: true });
    }
    
    monitor = new PerformanceMonitor();
  });

  afterAll(() => {
    // Save performance report
    const reportPath = join(RESULTS_DIR, `performance-${Date.now()}.json`);
    writeFileSync(reportPath, monitor.generateReport());
    console.log(`\n📊 Performance report saved to: ${reportPath}`);
    
    // Clean up
    if (db) db.close();
    if (existsSync(TEST_DB)) {
      rmSync(TEST_DB);
    }
  });

  describe('Startup Performance', () => {
    test('Database initialization should be fast', async () => {
      monitor.start();
      db = await DatabaseManager.create(TEST_DB);
      const result = monitor.end('Database Initialization', PERFORMANCE_THRESHOLDS.serverStartup);
      
      expect(result.passed).toBe(true);
      expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.serverStartup);
      console.log(`✓ Database init: ${result.duration.toFixed(2)}ms`);
    });

    test('Server initialization should be fast', async () => {
      monitor.start();
      server = new MCPMProServer(db, true); // Pro mode
      const result = monitor.end('Server Initialization', PERFORMANCE_THRESHOLDS.serverStartup);
      
      expect(result.passed).toBe(true);
      expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.serverStartup);
      console.log(`✓ Server init: ${result.duration.toFixed(2)}ms`);
    });
  });

  describe('Tool Operations Performance', () => {
    test('Listing tools should be fast', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };
      
      monitor.start();
      const response = await server.handleRequest(request);
      const result = monitor.end('List Tools', PERFORMANCE_THRESHOLDS.toolListRequest);
      
      expect(result.passed).toBe(true);
      expect(response.result.tools).toBeDefined();
      console.log(`✓ List tools: ${result.duration.toFixed(2)}ms`);
    });

    test('Simple tool call (store_context) should be fast', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'store_context',
          arguments: {
            project_name: 'test-project',
            type: 'note',
            key: 'test-key',
            value: 'test-value',
            tags: ['performance', 'test']
          }
        }
      };
      
      monitor.start();
      const response = await server.handleRequest(request);
      const result = monitor.end('Simple Tool Call', PERFORMANCE_THRESHOLDS.simpleToolCall);
      
      expect(result.passed).toBe(true);
      expect(response.result.content).toBeDefined();
      console.log(`✓ Simple tool call: ${result.duration.toFixed(2)}ms`);
    });
  });

  describe('Database Performance', () => {
    test('Writing context should be fast', async () => {
      const project = db.upsertProject({
        name: 'perf-test-project',
        description: 'Performance testing project'
      });
      
      monitor.start();
      for (let i = 0; i < 10; i++) {
        db.storeContext({
          project_id: project.id,
          type: 'note',
          key: `perf-test-${i}`,
          value: `Performance test value ${i}`,
          tags: ['performance', 'test', `batch-${i}`]
        });
      }
      const result = monitor.end('Database Write (10 ops)', PERFORMANCE_THRESHOLDS.databaseWrite * 10);
      
      expect(result.passed).toBe(true);
      console.log(`✓ Database writes: ${result.duration.toFixed(2)}ms for 10 operations`);
    });

    test('Reading context should be fast', async () => {
      // First ensure we have a project with contexts
      const project = db.getProject('perf-test-project') || db.upsertProject({
        name: 'perf-test-project',
        description: 'Performance testing project'
      });
      
      monitor.start();
      const contexts = db.getProjectContext(project.name);
      const result = monitor.end('Database Read', PERFORMANCE_THRESHOLDS.databaseRead);
      
      expect(result.passed).toBe(true);
      expect(contexts.length).toBeGreaterThan(0);
      console.log(`✓ Database read: ${result.duration.toFixed(2)}ms`);
    });

    test('Searching context should be fast', async () => {
      monitor.start();
      const results = db.searchContext({
        query: 'performance',
        limit: 20
      });
      const result = monitor.end('Context Search', PERFORMANCE_THRESHOLDS.contextSearch);
      
      expect(result.passed).toBe(true);
      console.log(`✓ Context search: ${result.duration.toFixed(2)}ms`);
    });
  });

  describe('Role Operations Performance', () => {
    test('Role switching should be fast', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'switch_role',
          arguments: {
            project_name: 'perf-test-project',
            role_id: 'developer'
          }
        }
      };
      
      monitor.start();
      const response = await server.handleRequest(request);
      const result = monitor.end('Role Switch', PERFORMANCE_THRESHOLDS.roleSwitch);
      
      expect(result.passed).toBe(true);
      console.log(`✓ Role switch: ${result.duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage', () => {
    test('Memory usage should be reasonable', () => {
      const memoryResults = monitor.getResults().map(r => r.memory);
      const maxMemory = Math.max(...memoryResults);
      
      expect(maxMemory).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryPerOperation);
      console.log(`✓ Max memory delta: ${(maxMemory / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Concurrent Operations', () => {
    test('Should handle concurrent requests efficiently', async () => {
      const requests = Array(10).fill(null).map((_, i) => ({
        jsonrpc: '2.0',
        id: 100 + i,
        method: 'tools/call',
        params: {
          name: 'store_context',
          arguments: {
            project_name: 'concurrent-test',
            type: 'note',
            key: `concurrent-${i}`,
            value: `Concurrent test ${i}`,
            tags: ['concurrent', 'performance']
          }
        }
      }));
      
      monitor.start();
      const responses = await Promise.all(
        requests.map(req => server.handleRequest(req))
      );
      const result = monitor.end('Concurrent Operations (10)', PERFORMANCE_THRESHOLDS.complexToolCall);
      
      expect(result.passed).toBe(true);
      expect(responses.every(r => r.result && r.result.content)).toBe(true);
      console.log(`✓ Concurrent ops: ${result.duration.toFixed(2)}ms for 10 parallel requests`);
    });
  });

  describe('Performance Regression Detection', () => {
    test('Generate baseline metrics', () => {
      const results = monitor.getResults();
      const baseline = {
        version: '0.3.0',
        date: new Date().toISOString(),
        metrics: results.reduce((acc, r) => {
          acc[r.metric] = {
            duration: r.duration,
            memory: r.memory,
            threshold: PERFORMANCE_THRESHOLDS[r.metric.replace(/[^a-zA-Z]/g, '')] || 1000
          };
          return acc;
        }, {} as any)
      };
      
      const baselinePath = join(RESULTS_DIR, 'baseline.json');
      writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
      console.log(`\n📈 Baseline metrics saved to: ${baselinePath}`);
    });
  });
});
