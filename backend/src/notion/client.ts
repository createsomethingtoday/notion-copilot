import type { 
  PageObjectResponse,
  DatabaseObjectResponse,
  BlockObjectResponse,
  SearchResponse,
  SearchParameters,
  CreatePageParameters,
  UpdatePageParameters,
  UpdateBlockParameters,
  PartialBlockObjectResponse
} from '@notionhq/client/build/src/api-endpoints';

export interface NotionSearchResults {
  pages: PageObjectResponse[];
  databases: DatabaseObjectResponse[];
  blocks: BlockObjectResponse[];
}

export interface NotionClient {
  search(query: string, filters?: Partial<SearchParameters>): Promise<NotionSearchResults>;
  getPage(id: string): Promise<PageObjectResponse>;
  getDatabase(id: string): Promise<DatabaseObjectResponse>;
  getBlock(id: string): Promise<BlockObjectResponse>;
  createPage(content: CreatePageParameters): Promise<PageObjectResponse>;
  createBlock(parentId: string, content: PartialBlockObjectResponse): Promise<BlockObjectResponse>;
  updatePage(id: string, changes: UpdatePageParameters): Promise<PageObjectResponse>;
  updateBlock(id: string, changes: UpdateBlockParameters): Promise<BlockObjectResponse>;
  deletePage(id: string): Promise<void>;
  deleteBlock(id: string): Promise<void>;
} 