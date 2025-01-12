import type {
  SearchParameters,
  CreatePageParameters,
  UpdatePageParameters,
  UpdateBlockParameters,
  PageObjectResponse,
  DatabaseObjectResponse,
  BlockObjectResponse,
  PartialBlockObjectResponse
} from '@notionhq/client/build/src/api-endpoints';

export type TaskType = 'search' | 'read' | 'write' | 'update' | 'delete';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'dead_letter';
export type TaskPriority = '0' | '1' | '2' | '3'; // LOW to URGENT

export type NotionObjectType = 'page' | 'database' | 'block';

export interface TaskTarget {
  type: NotionObjectType;
  id?: string;
  parentId?: string;
}

export interface BaseTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority?: TaskPriority;
  description?: string;
  created?: Date;
  updated?: Date;
  completedAt?: Date;
  deadline?: Date;
  retryCount?: number;
  error?: Error;
  movedToDeadLetterAt?: Date;
  result?: TaskResult;
}

export interface SearchTask extends BaseTask {
  type: 'search';
  query: string;
  filters?: Partial<SearchParameters>;
}

export interface ReadTask extends BaseTask {
  type: 'read';
  target: TaskTarget;
}

export interface WriteTask extends BaseTask {
  type: 'write';
  target: TaskTarget;
  content: CreatePageParameters | PartialBlockObjectResponse;
}

export interface UpdateTask extends BaseTask {
  type: 'update';
  target: TaskTarget;
  changes: UpdatePageParameters | UpdateBlockParameters;
}

export interface DeleteTask extends BaseTask {
  type: 'delete';
  target: TaskTarget;
}

export type Task = SearchTask | ReadTask | WriteTask | UpdateTask | DeleteTask;

export interface TaskResult {
  pages?: PageObjectResponse[];
  databases?: DatabaseObjectResponse[];
  blocks?: BlockObjectResponse[];
  content?: PageObjectResponse | DatabaseObjectResponse | BlockObjectResponse;
  created?: PageObjectResponse | BlockObjectResponse;
  updated?: PageObjectResponse | BlockObjectResponse;
  success?: boolean;
} 