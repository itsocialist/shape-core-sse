#!/usr/bin/env node

/**
 * Manual test script for MCP Context Memory Server
 * Tests basic functionality via stdio
 */

import { spawn } from 'child_process';
import { join } from 'path';

const serverPath = join(process.cwd(), 'dist', 'index.js');

console.log('Starting MCP Context Memory Server test...');

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Handle server output
server.stdout.on('data', (data) => {
  console.log('Server:', data.toString());
});

server.stderr.on('data', (data) => {
  console.error('Server Error:', data.toString());
});

// Test 1: Initialize connection
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '1.0.0',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

console.log('\nSending initialize request...');
server.stdin.write(JSON.stringify(initRequest) + '\n');

// Test 2: List tools after a delay
setTimeout(() => {
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };
  
  console.log('\nSending tools/list request...');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
}, 1000);

// Test 3: Create a project
setTimeout(() => {
  const createProjectRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'store_project_context',
      arguments: {
        project_name: 'test-project',
        description: 'Test project for MCP server',
        repository_url: 'https://github.com/test/test-project',
        local_directory: '/tmp/test-project',
        tags: ['test', 'mcp'],
        metadata: {
          language: 'typescript',
          framework: 'node'
        }
      }
    }
  };
  
  console.log('\nSending store_project_context request...');
  server.stdin.write(JSON.stringify(createProjectRequest) + '\n');
}, 2000);

// Test 4: List projects
setTimeout(() => {
  const listProjectsRequest = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {}
    }
  };
  
  console.log('\nSending list_projects request...');
  server.stdin.write(JSON.stringify(listProjectsRequest) + '\n');
}, 3000);

// Clean exit after tests
setTimeout(() => {
  console.log('\nTest completed. Shutting down server...');
  server.kill();
  process.exit(0);
}, 4000);

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
