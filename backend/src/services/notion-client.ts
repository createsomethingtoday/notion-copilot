import { Client } from '@notionhq/client';
import type {
  SearchParameters,
  GetPageParameters,
  GetDatabaseParameters,
  CreatePageParameters,
  UpdatePageParameters,
  UpdateBlockParameters,
  DeleteBlockParameters,
  BlockObjectRequest
} from '@notionhq/client/build/src/api-endpoints';
import type {
  NotionPageContent,
  NotionBlockContent
} from '../types/notion-content';
import { toNotionContent, toNotionUpdate } from '../types/notion-content';
import { ContentValidator } from './content-validator';

export class NotionClientWrapper {
  private client: Client;
  private validator: ContentValidator;

  constructor(auth: string) {
    this.client = new Client({ auth });
    this.validator = new ContentValidator();
  }

  /**
   * Search for pages in Notion
   */
  async search(params: SearchParameters) {
    const response = await this.client.search(params);
    return response.results.filter(result => result.object === 'page');
  }

  /**
   * Get a page by ID
   */
  async getPage(params: GetPageParameters) {
    const response = await this.client.pages.retrieve(params);
    if (response.object !== 'page') {
      throw new Error('Retrieved object is not a page');
    }
    return response;
  }

  /**
   * Get a database by ID
   */
  async getDatabase(params: GetDatabaseParameters) {
    const response = await this.client.databases.retrieve(params);
    if (response.object !== 'database') {
      throw new Error('Retrieved object is not a database');
    }
    return response;
  }

  /**
   * Create a new page
   */
  async createPage(content: NotionPageContent) {
    // Validate content before creating
    this.validator.validatePageContent(content);

    // Convert to Notion API format
    const params = toNotionContent(content) as CreatePageParameters;
    
    const response = await this.client.pages.create(params);
    if (response.object !== 'page') {
      throw new Error('Created object is not a page');
    }
    return response;
  }

  /**
   * Update a page
   */
  async updatePage(pageId: string, content: Partial<NotionPageContent>) {
    // Convert to Notion API format
    const params = {
      ...toNotionUpdate(content) as UpdatePageParameters,
      page_id: pageId
    };
    
    const response = await this.client.pages.update(params);
    
    if (response.object !== 'page') {
      throw new Error('Updated object is not a page');
    }
    return response;
  }

  /**
   * Create a block as a child of a page or block
   */
  async createBlock(parentId: string, content: NotionBlockContent) {
    // Validate content before creating
    this.validator.validateBlockContent(content);

    // Convert to Notion API format and ensure it's a block
    const blockContent = toNotionContent(content);
    if (!('type' in blockContent)) {
      throw new Error('Content must be a block');
    }
    
    const response = await this.client.blocks.children.append({
      block_id: parentId,
      children: [blockContent as BlockObjectRequest]
    });
    
    return response.results[0];
  }

  /**
   * Update a block
   */
  async updateBlock(blockId: string, content: Partial<NotionBlockContent>) {
    // Convert to Notion API format
    const params = {
      ...toNotionUpdate(content) as UpdateBlockParameters,
      block_id: blockId
    };
    
    const response = await this.client.blocks.update(params);
    
    if (response.object !== 'block') {
      throw new Error('Updated object is not a block');
    }
    return response;
  }

  /**
   * Delete a block
   */
  async deleteBlock(params: DeleteBlockParameters) {
    const response = await this.client.blocks.delete(params);
    if (response.object !== 'block') {
      throw new Error('Deleted object is not a block');
    }
    return response;
  }
} 