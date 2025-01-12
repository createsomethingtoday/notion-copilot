import type { 
  Task, TaskResult, SearchTask, ReadTask, WriteTask, UpdateTask, DeleteTask
} from '../agent/types';
import type { NotionClient, NotionSearchResults } from '../notion/client';
import type { 
  PageObjectResponse, 
  DatabaseObjectResponse, 
  BlockObjectResponse,
  CreatePageParameters,
  UpdatePageParameters,
  UpdateBlockParameters,
  PartialBlockObjectResponse
} from '@notionhq/client/build/src/api-endpoints';
import { Logger } from '../utils/logger';

export class TaskExecutor {
  private readonly notion: NotionClient;
  private readonly logger: Logger;

  constructor(notion: NotionClient) {
    this.notion = notion;
    this.logger = new Logger('TaskExecutor');
  }

  async executeTask(task: Task): Promise<TaskResult> {
    this.logger.debug('Executing task', { type: task.type, id: task.id });

    switch (task.type) {
      case 'search': {
        return this.executeSearchTask(task as SearchTask);
      }
      case 'read': {
        return this.executeReadTask(task as ReadTask);
      }
      case 'write': {
        return this.executeWriteTask(task as WriteTask);
      }
      case 'update': {
        return this.executeUpdateTask(task as UpdateTask);
      }
      case 'delete': {
        return this.executeDeleteTask(task as DeleteTask);
      }
      default: {
        const exhaustiveCheck: never = task;
        throw new Error(`Unknown task type: ${(exhaustiveCheck as Task).type}`);
      }
    }
  }

  /**
   * Execute a search task
   */
  private async executeSearchTask(task: SearchTask): Promise<TaskResult> {
    const { query, filters } = task;
    const results = await this.notion.search(query, filters);
    return results;
  }

  /**
   * Execute a read task
   */
  private async executeReadTask(task: ReadTask): Promise<TaskResult> {
    const { type, id } = task.target;
    if (!id) throw new Error('Target ID is required for read operations');

    let content: PageObjectResponse | DatabaseObjectResponse | BlockObjectResponse;

    switch (type) {
      case 'page':
        content = await this.notion.getPage(id);
        break;
      case 'database':
        content = await this.notion.getDatabase(id);
        break;
      case 'block':
        content = await this.notion.getBlock(id);
        break;
      default:
        throw new Error(`Unknown target type: ${type}`);
    }

    return { content };
  }

  /**
   * Execute a write task
   */
  private async executeWriteTask(task: WriteTask): Promise<TaskResult> {
    const { type, parentId } = task.target;
    let created: PageObjectResponse | BlockObjectResponse;

    switch (type) {
      case 'page':
        created = await this.notion.createPage(task.content as CreatePageParameters);
        break;
      case 'block':
        if (!parentId) throw new Error('Parent ID required for block creation');
        created = await this.notion.createBlock(parentId, task.content as PartialBlockObjectResponse);
        break;
      default:
        throw new Error(`Unknown target type: ${type}`);
    }

    return { created };
  }

  /**
   * Execute an update task
   */
  private async executeUpdateTask(task: UpdateTask): Promise<TaskResult> {
    const { type, id } = task.target;
    if (!id) throw new Error('Target ID is required for update operations');

    let updated: PageObjectResponse | BlockObjectResponse;

    switch (type) {
      case 'page':
        updated = await this.notion.updatePage(id, task.changes as UpdatePageParameters);
        break;
      case 'block':
        updated = await this.notion.updateBlock(id, task.changes as UpdateBlockParameters);
        break;
      default:
        throw new Error(`Unknown target type: ${type}`);
    }

    return { updated };
  }

  /**
   * Execute a delete task
   */
  private async executeDeleteTask(task: DeleteTask): Promise<TaskResult> {
    const { type, id } = task.target;
    if (!id) throw new Error('Target ID is required for delete operations');

    switch (type) {
      case 'page':
        await this.notion.deletePage(id);
        break;
      case 'block':
        await this.notion.deleteBlock(id);
        break;
      default:
        throw new Error(`Unknown target type: ${type}`);
    }

    return { success: true };
  }
} 