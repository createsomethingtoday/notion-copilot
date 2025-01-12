import type { ChatMessage } from '../../../shared/types';
import type { RedisClientType } from 'redis';

interface WorkspaceContext {
  pages: Array<{
    id: string;
    title: string;
    lastAccessed: Date;
  }>;
  databases: Array<{
    id: string;
    title: string;
    schema: Record<string, unknown>;
  }>;
  recentActions: Array<{
    type: string;
    timestamp: Date;
    details: Record<string, unknown>;
  }>;
}

interface ToolResult {
  tool: string;
  result: unknown;
  timestamp: Date;
}

export class ContextManager {
  private redis: RedisClientType;
  private userId: string;

  constructor(redis: RedisClientType, userId: string) {
    this.redis = redis;
    this.userId = userId;
  }

  async addMessage(message: ChatMessage): Promise<void> {
    const key = `user:${this.userId}:messages`;
    await this.redis.lPush(key, JSON.stringify(message));
    // Keep only last 100 messages
    await this.redis.lTrim(key, 0, 99);
  }

  async getRecentMessages(count: number): Promise<ChatMessage[]> {
    const key = `user:${this.userId}:messages`;
    const messages = await this.redis.lRange(key, 0, count - 1);
    return messages.map(m => JSON.parse(m));
  }

  async addToolResult(taskId: string, tool: string, result: unknown): Promise<void> {
    const key = `task:${taskId}:results`;
    const toolResult: ToolResult = {
      tool,
      result,
      timestamp: new Date()
    };
    await this.redis.lPush(key, JSON.stringify(toolResult));
  }

  async getToolResults(taskId: string): Promise<ToolResult[]> {
    const key = `task:${taskId}:results`;
    const results = await this.redis.lRange(key, 0, -1);
    return results.map(r => JSON.parse(r));
  }

  async updateWorkspaceContext(context: Partial<WorkspaceContext>): Promise<void> {
    const key = `user:${this.userId}:workspace`;
    const current = await this.getWorkspaceContext();
    const updated = { ...current, ...context };
    await this.redis.set(key, JSON.stringify(updated));
  }

  async getWorkspaceContext(): Promise<WorkspaceContext> {
    const key = `user:${this.userId}:workspace`;
    const context = await this.redis.get(key);
    if (!context) {
      return {
        pages: [],
        databases: [],
        recentActions: []
      };
    }
    return JSON.parse(context);
  }

  async clearContext(): Promise<void> {
    const keys = [
      `user:${this.userId}:messages`,
      `user:${this.userId}:workspace`
    ];
    await Promise.all(keys.map(key => this.redis.del(key)));
  }
} 