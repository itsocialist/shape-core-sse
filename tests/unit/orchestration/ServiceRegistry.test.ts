/**
 * Unit tests for ServiceRegistry
 * Testing the core orchestration component
 */

import { ServiceRegistry } from '../../../src/orchestration/registry/ServiceRegistry';
import { MockSuccessAdapter, MockErrorAdapter, MockConfigurableAdapter } from '../../../src/test-utils/mockAdapters';
import { DatabaseManager } from '../../../src/db/database.js';
import { join, dirname } from 'path';
import { rmSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;
  let db: DatabaseManager;
  let testDbPath: string;
  
  beforeEach(async () => {
    // Create a fresh test database for each test
    testDbPath = join(__dirname, `test-serviceregistry-${Date.now()}.db`);
    try {
      rmSync(testDbPath, { force: true });
      rmSync(testDbPath + '-shm', { force: true });
      rmSync(testDbPath + '-wal', { force: true });
    } catch (error) {
      // Files might not exist, which is fine
    }

    db = await DatabaseManager.create(testDbPath);
    registry = new ServiceRegistry(db);
  });
  
  afterEach(async () => {
    // Shutdown registry after each test
    await registry.shutdown();
    
    // Clean up test database
    if (db) {
      await db.close();
    }
    try {
      rmSync(testDbPath, { force: true });
      rmSync(testDbPath + '-shm', { force: true });
      rmSync(testDbPath + '-wal', { force: true });
    } catch (error) {
      // Files might not exist, which is fine
    }
  });
  
  describe('Service Registration', () => {
    it('should register a valid adapter successfully', async () => {
      const adapter = new MockSuccessAdapter('test-service');
      
      await registry.register(adapter);
      
      const services = registry.getServices();
      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('test-service');
      expect(services[0].status).toBe('active');
    });
    
    it('should reject duplicate service registration', async () => {
      const adapter1 = new MockSuccessAdapter('duplicate');
      const adapter2 = new MockSuccessAdapter('duplicate');
      
      await registry.register(adapter1);
      
      await expect(registry.register(adapter2))
        .rejects.toThrow('Service duplicate is already registered');
    });
    
    it('should handle adapter initialization failure', async () => {
      const adapter = new MockErrorAdapter();
      
      await expect(registry.register(adapter))
        .rejects.toThrow('Failed to register service mock-error');
      
      const services = registry.getServices();
      expect(services).toHaveLength(1);
      expect(services[0].status).toBe('error');
    });
    
    it('should register service successfully', async () => {
      const adapter = new MockSuccessAdapter('db-test');
      
      await registry.register(adapter);
      
      // Verify service is registered in memory
      const services = registry.getServices();
      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('db-test');
      expect(services[0].status).toBe('active');
    });
  });
  
  describe('Service Execution', () => {
    beforeEach(async () => {
      // Register a test service
      const adapter = new MockSuccessAdapter('exec-test');
      await registry.register(adapter);
    });
    
    it('should execute command on registered service', async () => {
      const result = await registry.execute('exec-test', {
        tool: 'test_command',
        args: { input: 'hello' }
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('input', { input: 'hello' });
    });
    
    it('should return error for non-existent service', async () => {
      await expect(registry.execute('non-existent', {
        tool: 'test',
        args: {}
      })).rejects.toThrow('Service non-existent not found');
    });
    
    it('should handle service execution errors', async () => {
      const adapter = new MockConfigurableAdapter({
        name: 'error-exec',
        shouldSucceed: false
      });
      await registry.register(adapter);
      
      const result = await registry.execute('error-exec', {
        tool: 'configurable_command',
        args: {}
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Configured to fail');
    });
    
    it('should enrich command with project context', async () => {
      // Create a test project
      const project = db.upsertProject({
        name: 'test-project',
        description: 'Test project for context enrichment'
      });
      
      const adapter = new MockConfigurableAdapter({
        name: 'context-test'
      });
      await registry.register(adapter);
      
      // Execute with project context
      const result = await registry.execute('context-test', {
        tool: 'test',
        args: {},
        projectName: 'test-project'
      });
      
      expect(result.success).toBe(true);
    });
    
    it('should execute service successfully with project context', async () => {
      // Create a test project
      db.upsertProject({
        name: 'storage-test',
        description: 'Test result storage'
      });
      
      const result = await registry.execute('exec-test', {
        tool: 'test_command',
        args: { data: 'test-data' },
        projectName: 'storage-test',
        storeResult: true
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('input');
      expect(result.data).toHaveProperty('timestamp');
    });
  });
  
  describe('Service Discovery', () => {
    it('should list all registered services', async () => {
      const adapter1 = new MockSuccessAdapter('service-1');
      const adapter2 = new MockSuccessAdapter('service-2');
      const adapter3 = new MockConfigurableAdapter({ name: 'service-3' });
      
      await registry.register(adapter1);
      await registry.register(adapter2);
      await registry.register(adapter3);
      
      const services = registry.getServices();
      expect(services).toHaveLength(3);
      expect(services.map(s => s.name)).toEqual(['service-1', 'service-2', 'service-3']);
    });
    
    it('should get specific service details', async () => {
      const adapter = new MockSuccessAdapter('detail-test');
      await registry.register(adapter);
      
      const service = registry.getService('detail-test');
      expect(service).toBeDefined();
      expect(service?.name).toBe('detail-test');
      expect(service?.capabilities).toHaveLength(1);
    });
  });
  
  describe('Service Lifecycle', () => {
    it('should shutdown all services gracefully', async () => {
      const adapter1 = new MockSuccessAdapter('shutdown-1');
      const adapter2 = new MockSuccessAdapter('shutdown-2');
      
      await registry.register(adapter1);
      await registry.register(adapter2);
      
      await registry.shutdown();
      
      const services = registry.getServices();
      expect(services).toHaveLength(0);
    });
  });
});
