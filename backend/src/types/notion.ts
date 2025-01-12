import type { Client } from '@notionhq/client';
import type {
  SearchParameters,
  PageObjectResponse,
  PartialPageObjectResponse,
  DatabaseObjectResponse,
  BlockObjectResponse,
  CreatePageParameters,
  UpdatePageParameters,
  QueryDatabaseParameters
} from '@notionhq/client/build/src/api-endpoints';

// Re-export Notion's types directly
export type NotionSearchParams = SearchParameters;
export type NotionPage = PageObjectResponse | PartialPageObjectResponse;
export type NotionDatabase = DatabaseObjectResponse;
export type NotionBlock = BlockObjectResponse;
export type NotionBlockContent = Parameters<typeof Client.prototype.blocks.children.append>[0]['children'][number];

// Custom error type for handling Notion API errors
export interface NotionError extends Error {
  code: 'rate_limited' | 'internal_server_error' | 'service_unavailable' | 'validation_error' | string;
  status?: number;
  headers?: Record<string, string>;
}

// Database query types using Notion's built-in types
type QueryFilter = NonNullable<QueryDatabaseParameters['filter']>;
export type NotionFilter = QueryFilter;

export interface NotionDatabaseQueryParams extends Omit<QueryDatabaseParameters, 'database_id'> {
  filter?: NotionFilter;
}

// Page operation types
export type NotionPageCreateParams = CreatePageParameters;
export type NotionPageUpdateParams = Omit<UpdatePageParameters, 'page_id'>; 