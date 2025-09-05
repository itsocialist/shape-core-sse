/**
 * Database Manager for MCP Context Memory
 * Handles all database operations with SQLite
 * Now with enhanced security and error handling
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir, hostname, cpus } from 'os';
import { existsSync, mkdirSync } from 'fs';
import { schema, statements } from './schema.js';
import { MigrationManager } from './migrations/migrationManager.js';
import type { 
  Project, 
  System, 
  ContextEntry, 
  UpdateHistory,
  SearchOptions,
  SystemInfo
} from '../types/index.js';
import { 
  parseJsonTags, 
  parseJsonMetadata, 
  validateTags, 
  validateMetadata 
} from '../utils/jsonValidation.js';
import { 
  DatabaseError, 
  NotFoundError,
  ValidationError 
} from '../utils/errors.js';
import { safeJsonStringify } from '../utils/security.js';

export class DatabaseManager {
  private db: Database.Database;
  private readonly dbPath: string;
  private migrationManager!: MigrationManager; // Use definite assignment assertion
  private readonly retryOptions = {
    maxRetries: 5,
    retryDelay: 100, // ms
  };

  private constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // Better performance
    this.db.pragma('foreign_keys = ON');  // Enforce foreign keys
  }

  /**
   * Create and initialize a new DatabaseManager instance
   */
  static async create(dbPath?: string): Promise<DatabaseManager> {
    // Default to ~/.mcp-context-memory/context.db
    const defaultDir = join(homedir(), '.mcp-context-memory');
    if (!existsSync(defaultDir)) {
      mkdirSync(defaultDir, { recursive: true });
    }
    
    const finalPath = dbPath || join(defaultDir, 'context.db');
    const manager = new DatabaseManager(finalPath);
    await manager.initialize();
    return manager;
  }

  /**
   * Initialize database with schema
   */
  private async initialize(): Promise<void> {
    try {
      // Create initial schema
      this.db.exec(schema);
      
      // Initialize migration manager
      this.migrationManager = new MigrationManager(this.db);
      
      // Run any pending migrations
      await this.migrationManager.migrate();
      
      // Ensure current system is registered
      this.ensureCurrentSystem();
    } catch (error) {
      throw new DatabaseError(`Failed to initialize database: ${(error as Error).message}`);
    }
  }

  /**
   * Execute a database operation with retry logic for SQLITE_BUSY errors
   */
  private withRetry<T>(operation: () => T): T {
    let lastError: Error = new Error('No error occurred');
    
    for (let i = 0; i < this.retryOptions.maxRetries; i++) {
      try {
        return operation();
      } catch (error) {
        lastError = error as Error;
        
        // Only retry on SQLITE_BUSY errors
        if ((error as any).code === 'SQLITE_BUSY') {
          if (i < this.retryOptions.maxRetries - 1) {
            // Wait before retrying
            const delay = this.retryOptions.retryDelay * Math.pow(2, i);
            const start = Date.now();
            while (Date.now() - start < delay) {
              // Busy wait
            }
            continue;
          }
        }
        
        // Don't retry on other errors
        throw error;
      }
    }
    
    throw new DatabaseError(`Operation failed after ${this.retryOptions.maxRetries} retries: ${lastError.message}`);
  }

  /**
   * Ensure we have a current system registered
   */
  private ensureCurrentSystem(): void {
    const current = this.withRetry(() => 
      this.db.prepare(statements.getCurrentSystem).get()
    );
    
    if (!current) {
      // Auto-detect and register current system
      const systemInfo = this.detectSystemInfo();
      this.registerSystem(systemInfo, true);
    }
  }

  /**
   * Detect current system information
   */
  private detectSystemInfo(): SystemInfo {
    return {
      name: process.env.COMPUTERNAME || process.env.HOSTNAME || 'Unknown',
      hostname: hostname(),
      platform: process.platform,
      metadata: {
        arch: process.arch,
        cpus: cpus().length,
        nodeVersion: process.version
      }
    };
  }

  /**
   * Register a system
   */
  registerSystem(info: SystemInfo, setCurrent = false): System {
    const stmt = this.db.prepare(`
      INSERT INTO systems (name, hostname, platform, is_current, metadata)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(hostname) DO UPDATE SET
        name = excluded.name,
        platform = excluded.platform,
        metadata = excluded.metadata,
        last_seen = CURRENT_TIMESTAMP
      RETURNING *
    `);
    
    const result = this.withRetry(() => stmt.get(
      info.name,
      info.hostname,
      info.platform,
      setCurrent ? 1 : 0,
      safeJsonStringify(info.metadata || {})
    )) as System;
    
    if (setCurrent && !result.is_current) {
      this.setCurrentSystem(result.id);
    }
    
    return result;
  }

  /**
   * Set current system
   */
  setCurrentSystem(systemId: number): void {
    this.withRetry(() => {
      // Clear current system first
      this.db.prepare('UPDATE systems SET is_current = 0').run();
      // Then set the new current system
      this.db.prepare(statements.setCurrentSystem).run(systemId);
    });
  }

  /**
   * Get current system
   */
  getCurrentSystem(): System | null {
    return this.withRetry(() => 
      this.db.prepare(statements.getCurrentSystem).get()
    ) as System | null;
  }

  /**
   * Create or update a project with validation
   */
  upsertProject(project: Partial<Project>): Project {
    if (!project.name) {
      throw new ValidationError('Project name is required');
    }

    const current = this.getCurrentSystem();
    const stmt = this.db.prepare(`
      INSERT INTO projects (
        name, description, status, repository_url, 
        local_directory, primary_system_id, tags, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        description = COALESCE(excluded.description, description),
        status = COALESCE(excluded.status, status),
        repository_url = COALESCE(excluded.repository_url, repository_url),
        local_directory = COALESCE(excluded.local_directory, local_directory),
        primary_system_id = COALESCE(excluded.primary_system_id, primary_system_id),
        tags = COALESCE(excluded.tags, tags),
        metadata = COALESCE(excluded.metadata, metadata),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `);

    try {
      // Validate and stringify JSON fields
      const tagsJson = safeJsonStringify(validateTags(project.tags || []));
      const metadataJson = safeJsonStringify(validateMetadata(project.metadata || {}));

      const result = this.withRetry(() => stmt.get(
        project.name,
        project.description || null,
        project.status || 'active',
        project.repository_url || null,
        project.local_directory || null,
        project.primary_system_id || current?.id || null,
        tagsJson,
        metadataJson
      )) as Project;

      this.logUpdate('project', result.id, 'upsert', project);
      
      // Parse JSON fields for return
      result.tags = parseJsonTags(result.tags as any);
      result.metadata = parseJsonMetadata(result.metadata as any);
      
      return result;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError(`Failed to upsert project: ${(error as Error).message}`, 'upsert');
    }
  }

  /**
   * Get project by name with safe JSON parsing
   */
  getProject(name: string): Project | null {
    const project = this.withRetry(() => 
      this.db.prepare(statements.getProjectByName).get(name)
    ) as Project | null;
    
    if (project) {
      // Update last accessed
      this.withRetry(() => 
        this.db.prepare(statements.updateProjectAccess).run(project.id)
      );
      
      // Parse JSON fields safely
      project.tags = parseJsonTags(project.tags as any);
      project.metadata = parseJsonMetadata(project.metadata as any);
    }
    
    return project;
  }

  /**
   * List all projects with safe JSON parsing
   */
  listProjects(includeArchived = false): Project[] {
    const query = includeArchived
      ? 'SELECT * FROM projects ORDER BY last_accessed DESC'
      : "SELECT * FROM projects WHERE status != 'archived' ORDER BY last_accessed DESC";
    
    const projects = this.withRetry(() => 
      this.db.prepare(query).all()
    ) as Project[];
    
    return projects.map(p => ({
      ...p,
      tags: parseJsonTags(p.tags as any),
      metadata: parseJsonMetadata(p.metadata as any)
    }));
  }

  /**
   * Store context entry with validation
   */
  storeContext(entry: Partial<ContextEntry>): ContextEntry {
    if (!entry.key) {
      throw new ValidationError('Context key is required');
    }
    if (!entry.value) {
      throw new ValidationError('Context value is required');
    }
    if (!entry.type) {
      throw new ValidationError('Context type is required');
    }

    const current = this.getCurrentSystem();
    
    // Check if the entry already exists
    const existingStmt = this.db.prepare(`
      SELECT id FROM context_entries 
      WHERE project_id IS ? AND key = ?
    `);
    
    const existing = this.withRetry(() => 
      existingStmt.get(entry.project_id || null, entry.key)
    ) as { id: number } | undefined;

    let stmt: Database.Statement;
    let params: any[];
    
    // Validate and stringify JSON fields
    const tagsJson = safeJsonStringify(validateTags(entry.tags || []));
    const metadataJson = safeJsonStringify(validateMetadata(entry.metadata || {}));
    
    if (existing) {
      // Update existing entry
      stmt = this.db.prepare(`
        UPDATE context_entries SET
          value = ?,
          type = ?,
          system_id = ?,
          is_system_specific = ?,
          tags = ?,
          metadata = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        RETURNING *
      `);
      params = [
        entry.value,
        entry.type,
        entry.is_system_specific ? (entry.system_id || current?.id) : null,
        entry.is_system_specific ? 1 : 0,
        tagsJson,
        metadataJson,
        existing.id
      ];
    } else {
      // Insert new entry
      stmt = this.db.prepare(`
        INSERT INTO context_entries (
          project_id, system_id, type, key, value,
          is_system_specific, tags, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `);
      params = [
        entry.project_id || null,
        entry.is_system_specific ? (entry.system_id || current?.id) : null,
        entry.type,
        entry.key,
        entry.value,
        entry.is_system_specific ? 1 : 0,
        tagsJson,
        metadataJson
      ];
    }

    try {
      const result = this.withRetry(() => stmt.get(...params)) as ContextEntry;

      this.logUpdate('context', result.id, existing ? 'update' : 'create', entry);
      this.updateSearchIndex(result);

      // Parse JSON fields for return
      result.tags = parseJsonTags(result.tags as any);
      result.metadata = parseJsonMetadata(result.metadata as any);

      return result;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError(`Failed to store context: ${(error as Error).message}`, 'store');
    }
  }

  /**
   * Log update history
   */
  private logUpdate(entityType: string, entityId: number, action: string, details: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO update_history (entity_type, entity_id, action, changes)
      VALUES (?, ?, ?, ?)
    `);
    
    try {
      const detailsJson = safeJsonStringify(details);
      this.withRetry(() => stmt.run(entityType, entityId, action, detailsJson));
    } catch (error) {
      // Log errors shouldn't fail the main operation
      console.error('Failed to log update history:', error);
    }
  }

  /**
   * Update project status
   */
  updateProjectStatus(name: string, status: string): Project {
    const project = this.getProject(name);
    if (!project) {
      throw new NotFoundError('Project', name);
    }

    const stmt = this.db.prepare('UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?');
    this.withRetry(() => stmt.run(status, name));
    
    this.logUpdate('project', project.id, 'status_change', { from: project.status, to: status });
    
    return { ...project, status: status as Project['status'] };
  }

  /**
   * Search context with improved security
   */
  searchContext(options: SearchOptions): ContextEntry[] {
    let query = 'SELECT DISTINCT ce.* FROM context_entries ce';
    const conditions: string[] = [];
    const params: any[] = [];

    // Build query conditions
    if (options.projectId !== undefined) {
      conditions.push('ce.project_id = ?');
      params.push(options.projectId);
    }

    if (options.type) {
      conditions.push('ce.type = ?');
      params.push(options.type);
    }

    if (options.since) {
      conditions.push("ce.updated_at > datetime('now', ?)");
      params.push(options.since);
    }

    if (options.systemSpecific !== undefined) {
      conditions.push('ce.is_system_specific = ?');
      params.push(options.systemSpecific ? 1 : 0);
    }

    if (options.tags && options.tags.length > 0) {
      // Use EXISTS with json_each for proper tag search
      const tagConditions = options.tags.map(() => 
        `EXISTS (SELECT 1 FROM json_each(ce.tags) WHERE value = ?)`
      );
      conditions.push(`(${tagConditions.join(' OR ')})`);
      options.tags.forEach(tag => params.push(tag));
    }

    // Full-text search with proper escaping
    if (options.query) {
      query += " JOIN context_search cs ON ce.id = cs.entity_id AND cs.entity_type = 'context'";
      conditions.push('cs.content MATCH ?');
      // Properly escape FTS5 special characters
      // FTS5 treats hyphens and other punctuation as word separators
      // Wrap the entire query in quotes to search for the exact phrase
      let escapedQuery = options.query;
      
      // If the query contains special characters, wrap it in quotes for phrase search
      if (/[-+*()":^]/.test(escapedQuery)) {
        // Escape any existing quotes first
        escapedQuery = escapedQuery.replace(/"/g, '""');
        // Wrap in quotes for phrase search
        escapedQuery = `"${escapedQuery}"`;
      }
      
      params.push(escapedQuery);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY ce.updated_at DESC';
    
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(Math.min(options.limit, 1000)); // Cap at 1000 for safety
    }

    try {
      const results = this.withRetry(() => 
        this.db.prepare(query).all(...params)
      ) as ContextEntry[];
      
      // Parse JSON fields safely
      return results.map(r => ({
        ...r,
        tags: parseJsonTags(r.tags as any),
        metadata: parseJsonMetadata(r.metadata as any)
      }));
    } catch (error) {
      throw new DatabaseError(`Search failed: ${(error as Error).message}`, 'search');
    }
  }

  /**
   * Get recent updates with safe JSON parsing
   */
  getRecentUpdates(since = '-1 day', limit = 50): UpdateHistory[] {
    const safeLimit = Math.min(limit, 1000); // Cap at 1000 for safety
    
    try {
      const results = this.withRetry(() => 
        this.db.prepare(statements.getRecentUpdates).all(since, safeLimit)
      ) as UpdateHistory[];
      
      // Parse JSON details safely
      return results.map(r => ({
        ...r,
        details: typeof r.details === 'string' 
          ? parseJsonMetadata(r.details) 
          : r.details
      }));
    } catch (error) {
      throw new DatabaseError(`Failed to get recent updates: ${(error as Error).message}`, 'recent_updates');
    }
  }

  /**
   * Update search index with validation
   */
  private updateSearchIndex(entry: ContextEntry): void {
    try {
      // Remove old entry
      this.withRetry(() => 
        this.db.prepare(
          "DELETE FROM context_search WHERE entity_id = ? AND entity_type = 'context'"
        ).run(entry.id)
      );

      // Add new entry with safe content
      const content = `${entry.key} ${entry.value} ${entry.type}`.substring(0, 10000); // Limit content size
      const tags = safeJsonStringify(entry.tags || []);
      
      this.withRetry(() => 
        this.db.prepare(
          "INSERT INTO context_search (entity_id, entity_type, content, tags) VALUES (?, ?, ?, ?)"
        ).run(entry.id, 'context', content, tags)
      );
    } catch (error) {
      // Search index errors shouldn't fail the main operation
      // Silent fail - search index is optional functionality
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    try {
      this.db.close();
    } catch (error) {
      throw new DatabaseError(`Failed to close database: ${(error as Error).message}`, 'close');
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus() {
    return this.migrationManager.getStatus();
  }

  /**
   * Get project context entries
   */
  getProjectContext(projectId: number): ContextEntry[] {
    try {
      const results = this.withRetry(() => 
        this.db.prepare(statements.getProjectContext).all(projectId)
      ) as ContextEntry[];
      
      return results.map(r => ({
        ...r,
        tags: parseJsonTags(r.tags as any),
        metadata: parseJsonMetadata(r.metadata as any)
      }));
    } catch (error) {
      throw new DatabaseError(`Failed to get project context: ${(error as Error).message}`, 'get_context');
    }
  }

  /**
   * Get shared context entries
   */
  getSharedContext(): ContextEntry[] {
    try {
      const results = this.withRetry(() => 
        this.db.prepare(statements.getSharedContext).all()
      ) as ContextEntry[];
      
      return results.map(r => ({
        ...r,
        tags: parseJsonTags(r.tags as any),
        metadata: parseJsonMetadata(r.metadata as any)
      }));
    } catch (error) {
      throw new DatabaseError(`Failed to get shared context: ${(error as Error).message}`, 'get_shared_context');
    }
  }

  /**
   * Get all table names in the database
   */
  getAllTables(): string[] {
    try {
      const tables = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      ).all() as Array<{ name: string }>;
      
      return tables.map(t => t.name);
    } catch (error) {
      throw new DatabaseError(`Failed to get tables: ${(error as Error).message}`, 'get_tables');
    }
  }

  /**
   * Get current schema version
   */
  getSchemaVersion(): number {
    try {
      const result = this.db.prepare(
        'SELECT MAX(version) as version FROM schema_migrations WHERE applied_at IS NOT NULL'
      ).get() as { version: number } | undefined;
      
      return result?.version || 0;
    } catch (error) {
      // If schema_migrations doesn't exist, we're at version 0
      return 0;
    }
  }

  /**
   * Get a single context entry by ID
   */
  getContext(contextId: string): ContextEntry | null {
    try {
      const result = this.db.prepare(
        'SELECT * FROM context_entries WHERE id = ?'
      ).get(contextId) as ContextEntry | undefined;
      
      if (!result) return null;
      
      return {
        ...result,
        tags: parseJsonTags(result.tags as any),
        metadata: parseJsonMetadata(result.metadata as any)
      };
    } catch (error) {
      throw new DatabaseError(`Failed to get context: ${(error as Error).message}`, 'get_context');
    }
  }
}
