import type { 
  NotionBlock, 
  NotionPage, 
  NotionDatabase, 
  NotionBlockContent,
  NotionPageCreateParams,
  NotionPageUpdateParams
} from '../types/notion';

// Task status tracking
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// Priority levels for tasks
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3
}

// Base task interface
export interface BaseTask {
  id: string;
  type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description: string;
  dependencies?: string[];
  created: Date;
  updated: Date;
  completedAt?: Date;
  retryCount?: number;
  error?: Error;
  result?: TaskResult;
  priority: TaskPriority;
  deadline?: Date;
  weight?: number; // For fine-grained priority adjustment
}

// Task context for maintaining state
export interface TaskContext {
  userId: string;
  sessionId: string;
  workspaceId: string;
  variables: Record<string, unknown>;
  history: BaseTask[];
  created: Date;
  updated: Date;
}

// Specific task types
export interface SearchTask extends BaseTask {
  type: 'search';
  query: string;
  filters?: Record<string, unknown>;
}

export interface ReadTask extends BaseTask {
  type: 'read';
  target: {
    type: 'page' | 'database' | 'block';
    id: string;
  };
}

export interface WriteTask extends BaseTask {
  type: 'write';
  target: {
    type: 'page' | 'block';
    id?: string; // Optional for creation
    parentId?: string;
  };
  content: NotionPageCreateParams | NotionBlockContent;
}

export interface UpdateTask extends BaseTask {
  type: 'update';
  target: {
    type: 'page' | 'block';
    id: string;
  };
  changes: NotionPageUpdateParams | Partial<NotionBlockContent>;
}

export interface DeleteTask extends BaseTask {
  type: 'delete';
  target: {
    type: 'page' | 'block';
    id: string;
  };
}

// Task results
export interface SearchResult {
  pages: NotionPage[];
  databases: NotionDatabase[];
  blocks: NotionBlock[];
}

export interface ReadResult {
  content: NotionPage | NotionDatabase | NotionBlock;
}

export interface WriteResult {
  created: NotionPage | NotionBlock;
}

export interface UpdateResult {
  updated: NotionPage | NotionBlock;
}

export interface DeleteResult {
  success: boolean;
}

// Base result interface for error handling
export interface BaseResult {
  error?: Error;
}

// Union type for all tasks
export type Task = 
  | SearchTask 
  | ReadTask 
  | WriteTask 
  | UpdateTask 
  | DeleteTask;

// Union type for all results
export type TaskResult = 
  | (SearchResult & BaseResult)
  | (ReadResult & BaseResult)
  | (WriteResult & BaseResult)
  | (UpdateResult & BaseResult)
  | (DeleteResult & BaseResult); 