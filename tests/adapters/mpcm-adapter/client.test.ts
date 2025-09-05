/**
 * Tests for UnixSocketClient
 * Tests the client that connects to the Rust MPCM Service
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock the net module properly for ES modules
const mockCreateConnection = jest.fn();
const mockSocket = new EventEmitter();
(mockSocket as any).write = jest.fn();
(mockSocket as any).end = jest.fn();
(mockSocket as any).destroy = jest.fn();

jest.unstable_mockModule('net', () => ({
  createConnection: mockCreateConnection
}));

// Now import after mocking
const { UnixSocketClient } = await import('../../../src/adapters/mpcm-adapter/client.js');

describe.skip('UnixSocketClient', () => {
  let client: UnixSocketClient;
  const testSocketPath = '/tmp/mpcm-test.sock';

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateConnection.mockReturnValue(mockSocket);
    client = new UnixSocketClient(testSocketPath);
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  describe('connection management', () => {
    it('should connect to Unix socket', async () => {
      // Simulate successful connection
      const connectPromise = client.connect();
      
      // Simulate the socket emitting 'connect' event
      setImmediate(() => {
        mockSocket.emit('connect');
      });
      
      await connectPromise;
      
      expect(mockCreateConnection).toHaveBeenCalledWith(testSocketPath);
      expect(client.isConnected()).toBe(true);
    });

    it('should handle connection errors', async () => {
      // Simulate connection error
      const connectPromise = client.connect();
      
      // Simulate the socket emitting 'error' event
      setImmediate(() => {
        mockSocket.emit('error', new Error('Connection refused'));
      });

      await expect(connectPromise).rejects.toThrow('Connection refused');
      expect(client.isConnected()).toBe(false);
    });

    it('should disconnect gracefully', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
      
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it('should handle multiple connect calls', async () => {
      await client.connect();
      await client.connect(); // Should not error
      
      expect(mockedCreateConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe('request/response handling', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should send request and receive response', async () => {
      const request: ServiceRequest = {
        id: 'test-123',
        method: 'store_context',
        params: { key: 'test', value: 'data' },
      };

      const expectedResponse: ServiceResponse = {
        id: 'test-123',
        result: { success: true },
      };

      // Simulate response when data is written
      mockSocket.write = function(data: string, cb?: (error?: Error) => void) {
        this.writeBuffer.push(data);
        if (cb) cb();
        
        // Simulate response from server
        process.nextTick(() => {
          this.emit('data', Buffer.from(JSON.stringify(expectedResponse) + '\n'));
        });
        
        return true;
      };

      const response = await client.sendRequest(request);

      expect(response.id).toBe('test-123');
      expect(response.result).toEqual({ success: true });
      expect(mockSocket.writeBuffer[0]).toBe(JSON.stringify(request) + '\n');
    });

    it('should handle error responses', async () => {
      const request: ServiceRequest = {
        id: 'error-test',
        method: 'invalid_method',
        params: {},
      };

      const errorResponse: ServiceResponse = {
        id: 'error-test',
        error: {
          code: -32601,
          message: 'Method not found',
        },
      };

      mockSocket.write = function(data: string, cb?: (error?: Error) => void) {
        this.writeBuffer.push(data);
        if (cb) cb();
        
        process.nextTick(() => {
          this.emit('data', Buffer.from(JSON.stringify(errorResponse) + '\n'));
        });
        
        return true;
      };

      await expect(client.sendRequest(request)).rejects.toThrow('Method not found');
    });

    it('should handle request timeout', async () => {
      const request: ServiceRequest = {
        id: 'timeout-test',
        method: 'store_context',
        params: {},
      };

      // Create client with short timeout
      const clientWithTimeout = new UnixSocketClient(testSocketPath, { timeout: 50 });
      mockCreateConnection.mockReturnValue(new MockSocket() as any);
      await clientWithTimeout.connect();

      // Don't send any response
      await expect(clientWithTimeout.sendRequest(request)).rejects.toThrow('Request timeout');
      await clientWithTimeout.disconnect();
    });
  });

  describe('reconnection logic', () => {
    it('should not reconnect when autoReconnect is false', async () => {
      const clientNoReconnect = new UnixSocketClient(testSocketPath, { 
        autoReconnect: false 
      });
      
      const noReconnectSocket = new MockSocket();
      mockCreateConnection.mockReturnValue(noReconnectSocket as any);
      
      await clientNoReconnect.connect();
      expect(clientNoReconnect.isConnected()).toBe(true);

      // Simulate connection close
      noReconnectSocket.emit('close');
      
      // Wait a bit to ensure no reconnection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockedCreateConnection).toHaveBeenCalledTimes(1); // Only initial connection
      await clientNoReconnect.disconnect();
    });

    it('should automatically reconnect on connection loss', async () => {
      let connectCalls = 0;
      
      mockCreateConnection.mockImplementation(() => {
        connectCalls++;
        const socket = new MockSocket();
        
        if (connectCalls === 1) {
          // First connection succeeds then closes
          socket.connect = function(path: string, cb?: () => void) {
            this.connected = true;
            if (cb) process.nextTick(cb);
            
            // Simulate connection loss after 10ms
            setTimeout(() => this.emit('close'), 10);
            return this;
          };
        }
        
        return socket as any;
      });

      const reconnectClient = new UnixSocketClient(testSocketPath, { 
        autoReconnect: true,
        reconnectDelay: 50,
        maxReconnectAttempts: 3
      });

      await reconnectClient.connect();
      
      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(connectCalls).toBeGreaterThanOrEqual(2);
      
      await reconnectClient.disconnect();
    });
  });
});
