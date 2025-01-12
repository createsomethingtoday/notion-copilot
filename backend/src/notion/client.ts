import { Client as NotionClient } from '@notionhq/client';
import { RateLimiter } from 'redis-rate-limiter';
import type { RedisClientType } from 'redis';
import type {
  NotionError,
  NotionSearchParams,
  NotionPage,
  NotionDatabase,
  NotionBlock,
  NotionDatabaseQueryParams,
  NotionPageCreateParams,
  NotionPageUpdateParams,
  NotionBlockContent
} from '../types/notion';

export class NotionClientWrapper {
  private client: NotionClient;
  private rateLimiter: RateLimiter;
  private retryDelay = 1000; // Start with 1 second
  private maxRetries = 3;

  constructor(
    accessToken: string,
    redis: RedisClientType,
    rateLimit = { points: 3, duration: 1 } // 3 requests per second
  ) {
    this.client = new NotionClient({ auth: accessToken });
    this.rateLimiter = new RateLimiter({
      redis,
      namespace: 'notion-rate-limit',
      points: rateLimit.points,
      duration: rateLimit.duration
    });
  }

  private async waitForRateLimit(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.rateLimiter.try(key, (err: Error | null, timeLeft: number | null) => {
        if (err) reject(err);
        else if (timeLeft) {
          // Wait for the rate limit to reset
          setTimeout(resolve, timeLeft * 1000);
        } else {
          resolve();
        }
      });
    });
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retries = this.maxRetries
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const notionError = error as NotionError;
      if (retries === 0 || !this.isRetryableError(notionError)) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      this.retryDelay *= 2; // Exponential backoff

      return this.retryWithBackoff(operation, retries - 1);
    }
  }

  private isRetryableError(error: NotionError): boolean {
    return (
      error.code === 'rate_limited' ||
      error.code === 'internal_server_error' ||
      error.code === 'service_unavailable'
    );
  }

  // Notion API Methods with rate limiting and retries
  async searchPages(params: NotionSearchParams): Promise<NotionPage[]> {
    await this.waitForRateLimit('search');
    const response = await this.retryWithBackoff(() => this.client.search(params));
    return response.results.filter(result => 
      result.object === 'page'
    ) as NotionPage[];
  }

  async getPage(pageId: string): Promise<NotionPage> {
    await this.waitForRateLimit(`page:${pageId}`);
    const response = await this.retryWithBackoff(() => 
      this.client.pages.retrieve({ page_id: pageId })
    );
    if (response.object !== 'page') {
      throw new Error('Retrieved object is not a page');
    }
    return response as NotionPage;
  }

  async updatePage(
    pageId: string,
    params: NotionPageUpdateParams
  ): Promise<NotionPage> {
    await this.waitForRateLimit(`page:${pageId}`);
    const response = await this.retryWithBackoff(() =>
      this.client.pages.update({
        page_id: pageId,
        ...params
      })
    );
    if (response.object !== 'page') {
      throw new Error('Updated object is not a page');
    }
    return response as NotionPage;
  }

  async createPage(params: NotionPageCreateParams): Promise<NotionPage> {
    await this.waitForRateLimit('create-page');
    const response = await this.retryWithBackoff(() => 
      this.client.pages.create(params)
    );
    if (response.object !== 'page') {
      throw new Error('Created object is not a page');
    }
    return response as NotionPage;
  }

  async getDatabase(databaseId: string): Promise<NotionDatabase> {
    await this.waitForRateLimit(`db:${databaseId}`);
    const response = await this.retryWithBackoff(() =>
      this.client.databases.retrieve({ database_id: databaseId })
    );
    if (response.object !== 'database') {
      throw new Error('Retrieved object is not a database');
    }
    return response as NotionDatabase;
  }

  async queryDatabase(
    databaseId: string,
    params: NotionDatabaseQueryParams
  ): Promise<NotionPage[]> {
    await this.waitForRateLimit(`db:${databaseId}`);
    const response = await this.retryWithBackoff(() =>
      this.client.databases.query({
        database_id: databaseId,
        ...params
      })
    );
    return response.results.filter(result => 
      result.object === 'page'
    ) as NotionPage[];
  }

  async getBlock(blockId: string): Promise<NotionBlock> {
    await this.waitForRateLimit(`block:${blockId}`);
    const response = await this.retryWithBackoff(() =>
      this.client.blocks.retrieve({ block_id: blockId })
    );
    if (response.object !== 'block') {
      throw new Error('Retrieved object is not a block');
    }
    return response as NotionBlock;
  }

  async updateBlock(
    blockId: string,
    content: Partial<NotionBlockContent>
  ): Promise<NotionBlock> {
    await this.waitForRateLimit(`block:${blockId}`);
    const response = await this.retryWithBackoff(() =>
      this.client.blocks.update({
        block_id: blockId,
        ...content
      })
    );
    if (response.object !== 'block') {
      throw new Error('Updated object is not a block');
    }
    return response as NotionBlock;
  }

  async getBlockChildren(blockId: string): Promise<NotionBlock[]> {
    await this.waitForRateLimit(`block:${blockId}:children`);
    const response = await this.retryWithBackoff(() =>
      this.client.blocks.children.list({ block_id: blockId })
    );
    return response.results.filter(result => 
      result.object === 'block'
    ) as NotionBlock[];
  }

  async appendBlockChildren(
    blockId: string,
    children: NotionBlockContent[]
  ): Promise<NotionBlock[]> {
    await this.waitForRateLimit(`block:${blockId}:children`);
    const response = await this.retryWithBackoff(() =>
      this.client.blocks.children.append({
        block_id: blockId,
        children
      })
    );
    return response.results.filter(result => 
      result.object === 'block'
    ) as NotionBlock[];
  }
} 