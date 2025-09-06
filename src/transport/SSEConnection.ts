/**
 * Server-Sent Events Connection Handler
 * Manages individual SSE connections for real-time MCP communication
 */

import { Response } from 'express';

export interface SSEEvent {
  type: string;
  data: any;
  id?: string;
  retry?: number;
}

export class SSEConnection {
  private closed = false;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(
    private sessionId: string,
    private response: Response,
    private tenantId?: string
  ) {
    this.setupHeartbeat();
  }

  private setupHeartbeat(): void {
    // Send heartbeat every 30 seconds to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (!this.closed) {
        this.send({
          type: 'heartbeat',
          data: { timestamp: new Date().toISOString() }
        });
      }
    }, 30000);
  }

  public send(event: SSEEvent): boolean {
    if (this.closed) {
      return false;
    }

    try {
      // Format SSE event according to specification
      let sseData = '';
      
      if (event.id) {
        sseData += `id: ${event.id}\n`;
      }
      
      if (event.type) {
        sseData += `event: ${event.type}\n`;
      }
      
      if (event.retry) {
        sseData += `retry: ${event.retry}\n`;
      }
      
      // Handle data serialization
      const dataString = typeof event.data === 'string' 
        ? event.data 
        : JSON.stringify(event.data);
      
      // Split multi-line data properly
      const dataLines = dataString.split('\n');
      for (const line of dataLines) {
        sseData += `data: ${line}\n`;
      }
      
      sseData += '\n'; // End event with empty line
      
      this.response.write(sseData);
      return true;

    } catch (error) {
      console.error(`[SSE] Error sending event to session ${this.sessionId}:`, error);
      this.close();
      return false;
    }
  }

  public sendToolResult(toolName: string, result: any, error?: string): void {
    this.send({
      type: 'tool_result',
      data: {
        tool: toolName,
        result: error ? null : result,
        error: error || null,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId
      },
      id: `tool_${Date.now()}`
    });
  }

  public sendToolProgress(toolName: string, progress: {
    step: string;
    percentage?: number;
    message?: string;
  }): void {
    this.send({
      type: 'tool_progress',
      data: {
        tool: toolName,
        progress,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId
      },
      id: `progress_${Date.now()}`
    });
  }

  public sendNotification(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    this.send({
      type: 'notification',
      data: {
        message,
        level,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId
      },
      id: `notification_${Date.now()}`
    });
  }

  public close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;

    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    // Send final event and close connection
    try {
      this.send({
        type: 'connection_closed',
        data: {
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
          reason: 'Server initiated close'
        }
      });

      this.response.end();
    } catch (error) {
      // Ignore errors during close
      console.error(`[SSE] Error during connection close for session ${this.sessionId}:`, error);
    }

    console.log(`[SSE] Connection closed for session ${this.sessionId}`);
  }

  public isClosed(): boolean {
    return this.closed;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getTenantId(): string | undefined {
    return this.tenantId;
  }

  public ping(): boolean {
    if (this.closed) {
      return false;
    }

    return this.send({
      type: 'ping',
      data: { timestamp: new Date().toISOString() }
    });
  }

  // Method to test if connection is still alive
  public isAlive(): boolean {
    if (this.closed) {
      return false;
    }

    try {
      // Try to write a comment (ignored by SSE clients)
      this.response.write(': connection-test\n\n');
      return true;
    } catch (error) {
      this.close();
      return false;
    }
  }
}