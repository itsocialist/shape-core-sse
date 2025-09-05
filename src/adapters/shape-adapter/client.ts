import * as net from 'net';
import { EventEmitter } from 'events';
import { 
  ServiceRequest, 
  ServiceResponse, 
  UnixSocketClientOptions,
  ErrorCode 
} from './types.js';

/**
 * Unix Socket Client for communicating with Rust MPCM Service
 */
export class UnixSocketClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private connected = false;
  private readonly socketPath: string;
  private readonly options: Required<UnixSocketClientOptions>;
  private pendingRequests: Map<string, {
    resolve: (response: ServiceResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private buffer = '';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(socketPath: string, options: UnixSocketClientOptions = {}) {
    super();
    this.socketPath = socketPath;
    this.options = {
      timeout: options.timeout ?? 30000,
      autoReconnect: options.autoReconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
    };
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.socketPath);

      this.socket.once('connect', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.setupSocketHandlers();
        resolve();
      });

      this.socket.once('error', (error) => {
        this.connected = false;
        reject(error);
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.socket || !this.connected) {
      return;
    }

    return new Promise((resolve) => {
      this.socket!.end(() => {
        this.connected = false;
        this.socket = null;
        this.clearPendingRequests(new Error('Client disconnected'));
        resolve();
      });
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendRequest(request: ServiceRequest): Promise<ServiceResponse> {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error('Request timeout'));
      }, this.options.timeout);

      this.pendingRequests.set(request.id, { resolve, reject, timeout });

      const message = JSON.stringify(request) + '\n';
      this.socket!.write(message, (error) => {
        if (error) {
          this.pendingRequests.delete(request.id);
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on('data', (data) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.socket.on('close', () => {
      this.connected = false;
      this.handleDisconnection();
    });

    this.socket.on('error', (error) => {
      this.emit('error', error);
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    
    // Keep the incomplete line in the buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response: ServiceResponse = JSON.parse(line);
          this.handleResponse(response);
        } catch (error) {
          this.emit('error', new Error(`Failed to parse response: ${line}`));
        }
      }
    }
  }

  private handleResponse(response: ServiceResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.id);
      
      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response);
      }
    }
  }

  private handleDisconnection(): void {
    this.clearPendingRequests(new Error('Connection lost'));

    if (this.options.autoReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.scheduleReconnection();
    }
  }

  private scheduleReconnection(): void {
    this.reconnectAttempts++;
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        this.emit('reconnected');
      } catch (error) {
        if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
          this.scheduleReconnection();
        } else {
          this.emit('reconnect_failed', error);
        }
      }
    }, this.options.reconnectDelay);
  }

  private clearPendingRequests(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}
