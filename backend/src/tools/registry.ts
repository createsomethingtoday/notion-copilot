import type { Client as NotionClient } from '@notionhq/client';
import type OpenAI from 'openai';
import type { ContextManager } from '../ai/context';

interface ToolContext {
  notion: NotionClient;
  openai: OpenAI;
  context: ContextManager;
}

interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
}

export class NotionToolRegistry {
  private tools: Map<string, Tool>;

  constructor() {
    this.tools = new Map();
    this.registerDefaultTools();
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  private registerDefaultTools(): void {
    // Search tools
    this.registerTool({
      name: 'search_pages',
      description: 'Search for pages in the workspace',
      parameters: {
        query: 'string',
        filter: 'object?',
        sort: 'object?'
      },
      execute: async ({ query, filter, sort }, { notion }) => {
        return notion.search({
          query: query as string,
          filter: filter as any,
          sort: sort as any
        });
      }
    });

    // Page tools
    this.registerTool({
      name: 'create_page',
      description: 'Create a new page',
      parameters: {
        parent: 'object',
        properties: 'object',
        children: 'array?'
      },
      execute: async ({ parent, properties, children }, { notion }) => {
        return notion.pages.create({
          parent: parent as any,
          properties: properties as any,
          children: children as any
        });
      }
    });

    this.registerTool({
      name: 'update_page',
      description: 'Update an existing page',
      parameters: {
        pageId: 'string',
        properties: 'object'
      },
      execute: async ({ pageId, properties }, { notion }) => {
        return notion.pages.update({
          page_id: pageId as string,
          properties: properties as any
        });
      }
    });

    // Database tools
    this.registerTool({
      name: 'query_database',
      description: 'Query a database',
      parameters: {
        databaseId: 'string',
        filter: 'object?',
        sorts: 'array?'
      },
      execute: async ({ databaseId, filter, sorts }, { notion }) => {
        return notion.databases.query({
          database_id: databaseId as string,
          filter: filter as any,
          sorts: sorts as any
        });
      }
    });

    this.registerTool({
      name: 'create_database',
      description: 'Create a new database',
      parameters: {
        parent: 'object',
        title: 'array',
        properties: 'object'
      },
      execute: async ({ parent, title, properties }, { notion }) => {
        return notion.databases.create({
          parent: parent as any,
          title: title as any,
          properties: properties as any
        });
      }
    });

    // Block tools
    this.registerTool({
      name: 'append_blocks',
      description: 'Append blocks to a page or block',
      parameters: {
        blockId: 'string',
        children: 'array'
      },
      execute: async ({ blockId, children }, { notion }) => {
        return notion.blocks.children.append({
          block_id: blockId as string,
          children: children as any
        });
      }
    });

    // Comment tools
    this.registerTool({
      name: 'create_comment',
      description: 'Create a comment on a page',
      parameters: {
        pageId: 'string',
        content: 'array'
      },
      execute: async ({ pageId, content }, { notion }) => {
        return notion.comments.create({
          parent: { page_id: pageId as string },
          rich_text: content as any
        });
      }
    });
  }
} 