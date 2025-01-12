import type { NotionClientWrapper } from '../notion/client';
import type { NotionPageCreateParams, NotionPageUpdateParams, NotionBlockContent } from '../types/notion';
import type { 
  Task, 
  TaskContext,
  TaskResult,
  SearchResult,
  ReadResult,
  WriteResult,
  UpdateResult,
  DeleteResult,
  BaseResult
} from './types';

export class TaskExecutor {
  private notion: NotionClientWrapper;
  private context: TaskContext;

  constructor(notion: NotionClientWrapper, context: TaskContext) {
    this.notion = notion;
    this.context = context;
  }

  /**
   * Executes a search task
   */
  private async executeSearchTask(task: Task & { type: 'search' }): Promise<SearchResult & BaseResult> {
    const pages = await this.notion.searchPages({
      query: task.query,
      ...task.filters
    });

    return {
      pages,
      databases: [], // TODO: Implement database search
      blocks: [] // TODO: Implement block search
    };
  }

  /**
   * Executes a read task
   */
  private async executeReadTask(task: Task & { type: 'read' }): Promise<ReadResult & BaseResult> {
    let content: ReadResult['content'];
    
    switch (task.target.type) {
      case 'page': {
        content = await this.notion.getPage(task.target.id);
        break;
      }
      case 'database': {
        content = await this.notion.getDatabase(task.target.id);
        break;
      }
      case 'block': {
        content = await this.notion.getBlock(task.target.id);
        break;
      }
      default: {
        throw new Error(`Unsupported target type: ${task.target.type}`);
      }
    }

    return { content };
  }

  /**
   * Executes a write task
   */
  private async executeWriteTask(task: Task & { type: 'write' }): Promise<WriteResult & BaseResult> {
    let created: WriteResult['created'];

    switch (task.target.type) {
      case 'page': {
        const pageParams = task.content as NotionPageCreateParams;
        created = await this.notion.createPage(pageParams);
        break;
      }
      case 'block': {
        if (!task.target.parentId) {
          throw new Error('Parent ID is required for creating blocks');
        }
        const blockContent = task.content as NotionBlockContent;
        const blocks = await this.notion.appendBlockChildren(
          task.target.parentId,
          [blockContent]
        );
        created = blocks[0];
        break;
      }
      default: {
        throw new Error(`Unsupported target type: ${task.target.type}`);
      }
    }

    return { created };
  }

  /**
   * Executes an update task
   */
  private async executeUpdateTask(task: Task & { type: 'update' }): Promise<UpdateResult & BaseResult> {
    let updated: UpdateResult['updated'];

    switch (task.target.type) {
      case 'page': {
        const pageChanges = task.changes as NotionPageUpdateParams;
        updated = await this.notion.updatePage(task.target.id, pageChanges);
        break;
      }
      case 'block': {
        const blockChanges = task.changes as Partial<NotionBlockContent>;
        updated = await this.notion.updateBlock(task.target.id, blockChanges);
        break;
      }
      default: {
        throw new Error(`Unsupported target type: ${task.target.type}`);
      }
    }

    return { updated };
  }

  /**
   * Executes a delete task
   */
  private async executeDeleteTask(task: Task & { type: 'delete' }): Promise<DeleteResult & BaseResult> {
    // TODO: Implement deletion
    // For now, just return success
    return { success: true };
  }

  /**
   * Executes a single task
   */
  private async executeTask(task: Task): Promise<TaskResult> {
    try {
      switch (task.type) {
        case 'search':
          return await this.executeSearchTask(task);
        case 'read':
          return await this.executeReadTask(task);
        case 'write':
          return await this.executeWriteTask(task);
        case 'update':
          return await this.executeUpdateTask(task);
        case 'delete':
          return await this.executeDeleteTask(task);
        default:
          throw new Error(`Unsupported task type: ${(task as Task).type}`);
      }
    } catch (error) {
      task.status = 'failed';
      task.error = error as Error;
      return { error: error as Error, success: false } as DeleteResult & BaseResult;
    }
  }

  /**
   * Executes a sequence of tasks
   */
  async executeTasks(tasks: Task[]): Promise<TaskResult[]> {
    const results: TaskResult[] = [];

    for (const task of tasks) {
      task.status = 'in_progress';
      task.updated = new Date();

      const result = await this.executeTask(task);
      
      if ('error' in result) {
        task.status = 'failed';
      } else {
        task.status = 'completed';
        task.result = result;
      }

      results.push(result);
      task.updated = new Date();
    }

    return results;
  }
} 