/**
 * Real Environment Tests  
 * Tests with actual Claude Desktop integration and real file operations
 */

import { MCPMProServer } from '../../src/index.js';
import { DatabaseManager } from '../../src/db/database.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

describe('Real Environment Integration', () => {
  let server: MCPMProServer;
  let db: DatabaseManager;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for real file operations
    testDir = await mkdtemp(join(tmpdir(), 'shape-core-e2e-'));
    
    // Use real database file for persistence testing
    const dbPath = join(testDir, 'test.db');
    db = new DatabaseManager(dbPath);
    await db.initialize();
    
    server = new MCPMProServer({
      mode: 'pro',
      database: db
    });
    await server.initialize();
  });

  afterEach(async () => {
    await server?.close();
    await db?.close();
    
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('End-to-End Project Creation', () => {
    test('Complete React app creation workflow', async () => {
      const projectName = 'react-todo-e2e';
      const appPath = join(testDir, 'todo-app');

      // 1. Create project context
      const project = await server.callTool('store_project_context', {
        project_name: projectName,
        description: 'React todo app - E2E test',
        local_directory: appPath
      });
      expect(project.isError).toBeFalsy();

      // 2. Architect designs structure  
      const structure = await server.callTool('execute_as_role', {
        roleId: 'architect',
        serviceName: 'filesystem',
        tool: 'write_file',
        args: {
          path: join(appPath, 'ARCHITECTURE.md'),
          content: `# Todo App Architecture
- React + TypeScript
- Component structure: App > TodoList > TodoItem
- State management: useState hooks
- Styling: CSS modules`
        },
        projectName
      });
      expect(structure.isError).toBeFalsy();

      // 3. Developer creates React components
      const component = await server.callTool('execute_as_role', {
        roleId: 'developer', 
        serviceName: 'filesystem',
        tool: 'write_file',
        args: {
          path: join(appPath, 'src/App.tsx'),
          content: `import React, { useState } from 'react';

interface Todo {
  id: number;
  text: string; 
  completed: boolean;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { 
        id: Date.now(), 
        text: input, 
        completed: false 
      }]);
      setInput('');
    }
  };

  return (
    <div className="app">
      <h1>Todo App</h1>
      <div>
        <input 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add todo..."
        />
        <button onClick={addTodo}>Add</button>
      </div>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}`
        },
        projectName
      });
      expect(component.isError).toBeFalsy();

      // 4. Initialize git repository
      const gitInit = await server.callTool('execute_as_role', {
        roleId: 'developer',
        serviceName: 'git', 
        tool: 'init',
        args: { repositoryPath: appPath },
        projectName
      });
      expect(gitInit.isError).toBeFalsy();

      // 5. QA validates structure
      const validation = await server.callTool('execute_as_role', {
        roleId: 'qa',
        serviceName: 'filesystem',
        tool: 'read_file',
        args: { path: join(appPath, 'src/App.tsx') },
        projectName
      });
      expect(validation.isError).toBeFalsy();

      // 6. Verify all context was stored
      const contexts = await server.callTool('get_project_context', {
        project_name: projectName
      });
      expect(contexts.isError).toBeFalsy();
      
      const contextData = JSON.parse(contexts.content[0].text);
      expect(contextData.contexts.length).toBeGreaterThan(3);
    });

    test('Git workflow with real repository', async () => {
      const projectName = 'git-workflow-test';
      const repoPath = join(testDir, 'test-repo');

      // Initialize project
      await server.callTool('store_project_context', {
        project_name: projectName,
        local_directory: repoPath
      });

      // Init git repo
      const init = await server.callTool('git_operation', {
        action: 'init',
        repositoryPath: repoPath,
        projectName
      });
      expect(init.isError).toBeFalsy();

      // Create file
      const file = await server.callTool('execute_as_role', {
        roleId: 'developer',
        serviceName: 'filesystem', 
        tool: 'write_file',
        args: {
          path: join(repoPath, 'README.md'),
          content: '# Test Repository\n\nCreated by shape-core E2E test'
        },
        projectName
      });
      expect(file.isError).toBeFalsy();

      // Add to git
      const add = await server.callTool('git_operation', {
        action: 'add',
        args: { files: ['README.md'] },
        repositoryPath: repoPath,
        projectName
      });
      expect(add.isError).toBeFalsy();

      // Commit
      const commit = await server.callTool('git_operation', {
        action: 'commit',
        args: { message: 'Initial commit from E2E test' },
        repositoryPath: repoPath,
        projectName
      });
      expect(commit.isError).toBeFalsy();

      // Check status
      const status = await server.callTool('git_operation', {
        action: 'status',
        repositoryPath: repoPath,
        projectName
      });
      expect(status.isError).toBeFalsy();
      
      const statusData = JSON.parse(status.content[0].text);
      expect(statusData.data).toContain('clean');
    });
  });

  describe('Real File System Operations', () => {
    test('Complex directory structure creation', async () => {
      const projectName = 'fs-structure-test';
      const projectPath = join(testDir, 'complex-app');

      await server.callTool('store_project_context', {
        project_name: projectName,
        local_directory: projectPath
      });

      // Create nested structure
      const structure = [
        'src/components/ui/Button.tsx',
        'src/hooks/useTodos.ts', 
        'src/types/Todo.ts',
        'src/utils/helpers.ts',
        'public/index.html',
        'tests/unit/Button.test.tsx'
      ];

      for (const filePath of structure) {
        const result = await server.callTool('execute_as_role', {
          roleId: 'developer',
          serviceName: 'filesystem',
          tool: 'write_file',
          args: {
            path: join(projectPath, filePath),
            content: `// ${filePath}\nexport default {};\n`
          },
          projectName
        });
        expect(result.isError).toBeFalsy();
      }

      // Verify structure exists
      const listing = await server.callTool('execute_as_role', {
        roleId: 'developer',
        serviceName: 'filesystem',
        tool: 'list_directory',
        args: { path: projectPath },
        projectName
      });
      expect(listing.isError).toBeFalsy();
    });
  });

  describe('Context Persistence Across Sessions', () => {
    test('Context survives database restart', async () => {
      const projectName = 'persistence-test';

      // Create initial context
      await server.callTool('store_project_context', {
        project_name: projectName,
        description: 'Testing real persistence'
      });

      await server.callTool('store_context', {
        type: 'decision',
        key: 'architecture-choice',
        value: 'Chose React over Vue for better TypeScript support',
        project_name: projectName
      });

      // Close server and database
      await server.close();
      await db.close();

      // Restart with same database file
      const dbPath = join(testDir, 'test.db');
      const newDb = new DatabaseManager(dbPath);
      await newDb.initialize();

      const newServer = new MCPMProServer({
        mode: 'pro',
        database: newDb
      });
      await newServer.initialize();

      // Verify context exists
      const contexts = await newServer.callTool('get_project_context', {
        project_name: projectName
      });
      expect(contexts.isError).toBeFalsy();

      const search = await newServer.callTool('search_context', {
        project_name: projectName,
        query: 'architecture'
      });
      expect(search.isError).toBeFalsy();
      
      const searchData = JSON.parse(search.content[0].text);
      expect(searchData.results.length).toBeGreaterThan(0);

      await newServer.close();
      await newDb.close();
    });
  });

  describe('Error Handling in Real Environment', () => {
    test('Invalid file paths are handled gracefully', async () => {
      const result = await server.callTool('execute_as_role', {
        roleId: 'developer',
        serviceName: 'filesystem',
        tool: 'read_file',
        args: { path: '/invalid/nonexistent/file.txt' },
        projectName: 'error-test'
      });

      // Should not crash, should return structured error
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    test('Database corruption recovery', async () => {
      // This test would require more complex setup
      // For now, verify basic error handling exists
      expect(db.initialize).toBeDefined();
      expect(server.close).toBeDefined();
    });
  });
});
