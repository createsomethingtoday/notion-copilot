import { v4 as uuidv4 } from 'uuid';
import type { 
  Task, 
  TaskContext, 
  SearchTask,
  ReadTask,
  WriteTask,
  UpdateTask,
  DeleteTask
} from './types';
import { TaskValidator } from './validator';
import { TaskResolver } from './resolver';
import { NLPService, type TaskAnalysis } from './nlp';

export class TaskPlanner {
  private context: TaskContext;
  private validator: TaskValidator;
  private resolver: TaskResolver;
  private nlp: NLPService;

  constructor(context: TaskContext, openAiKey: string) {
    this.context = context;
    this.validator = new TaskValidator();
    this.resolver = new TaskResolver();
    this.nlp = new NLPService(openAiKey);
  }

  /**
   * Creates a new task with default fields
   */
  private createBaseTask(
    type: string, 
    description: string,
    dependencies?: string[]
  ): Omit<Task, 'type'> {
    return {
      id: uuidv4(),
      status: 'pending',
      description,
      dependencies,
      created: new Date(),
      updated: new Date()
    };
  }

  /**
   * Creates a search task
   */
  createSearchTask(
    query: string,
    description: string,
    dependencies?: string[],
    filters?: Record<string, unknown>
  ): SearchTask {
    return {
      ...this.createBaseTask('search', description, dependencies),
      type: 'search',
      query,
      filters
    };
  }

  /**
   * Creates a read task
   */
  createReadTask(
    targetType: 'page' | 'database' | 'block',
    targetId: string,
    description: string,
    dependencies?: string[]
  ): ReadTask {
    return {
      ...this.createBaseTask('read', description, dependencies),
      type: 'read',
      target: {
        type: targetType,
        id: targetId
      }
    };
  }

  /**
   * Creates a write task
   */
  createWriteTask(
    targetType: 'page' | 'block',
    content: WriteTask['content'],
    description: string,
    dependencies?: string[],
    parentId?: string
  ): WriteTask {
    return {
      ...this.createBaseTask('write', description, dependencies),
      type: 'write',
      target: {
        type: targetType,
        parentId
      },
      content
    };
  }

  /**
   * Creates an update task
   */
  createUpdateTask(
    targetType: 'page' | 'block',
    targetId: string,
    changes: UpdateTask['changes'],
    description: string,
    dependencies?: string[]
  ): UpdateTask {
    return {
      ...this.createBaseTask('update', description, dependencies),
      type: 'update',
      target: {
        type: targetType,
        id: targetId
      },
      changes
    };
  }

  /**
   * Creates a delete task
   */
  createDeleteTask(
    targetType: 'page' | 'block',
    targetId: string,
    description: string,
    dependencies?: string[]
  ): DeleteTask {
    return {
      ...this.createBaseTask('delete', description, dependencies),
      type: 'delete',
      target: {
        type: targetType,
        id: targetId
      }
    };
  }

  /**
   * Plans a sequence of tasks based on a natural language request
   */
  async planTasks(request: string): Promise<Task[]> {
    // Analyze request using NLP
    const analysis = await this.nlp.analyzeRequest(request, this.context);
    
    // Convert analysis into tasks
    const tasks: Task[] = [];
    for (const taskInfo of analysis.tasks) {
      const task = await this.createTaskFromAnalysis(taskInfo);
      tasks.push(task);
    }

    // Validate all tasks
    const errors = this.validator.validateTasks(tasks, this.context);
    if (errors.size > 0) {
      throw new Error(this.formatValidationErrors(errors));
    }

    // Check preconditions for all tasks
    for (const task of tasks) {
      if (!await this.resolver.checkPreconditions(task, this.context)) {
        throw new Error(`Preconditions not met for task: ${task.id}`);
      }
    }

    // Resolve tasks into subtasks if needed
    const resolvedTasks: Task[] = [];
    for (const task of tasks) {
      const subtasks = await this.resolver.resolveTask(task, this.context);
      resolvedTasks.push(...subtasks);
    }

    // Validate resolved tasks
    const resolvedErrors = this.validator.validateTasks(resolvedTasks, this.context);
    if (resolvedErrors.size > 0) {
      throw new Error(this.formatValidationErrors(resolvedErrors));
    }

    return resolvedTasks;
  }

  /**
   * Creates a task from NLP analysis output
   */
  private async createTaskFromAnalysis(
    taskInfo: TaskAnalysis['tasks'][0]
  ): Promise<Task> {
    // Validate required fields based on task type
    switch (taskInfo.type) {
      case 'search':
        if (!taskInfo.query) {
          throw new Error('Search task missing query');
        }
        return this.createSearchTask(
          taskInfo.query,
          taskInfo.description,
          taskInfo.dependencies,
          taskInfo.filters
        );

      case 'read':
        if (!taskInfo.target?.type || !taskInfo.target.id) {
          throw new Error('Read task missing target type or id');
        }
        return this.createReadTask(
          taskInfo.target.type as 'page' | 'database' | 'block',
          taskInfo.target.id,
          taskInfo.description,
          taskInfo.dependencies
        );

      case 'write':
        if (!taskInfo.target?.type || !taskInfo.content) {
          throw new Error('Write task missing target type or content');
        }
        return this.createWriteTask(
          taskInfo.target.type as 'page' | 'block',
          taskInfo.content,
          taskInfo.description,
          taskInfo.dependencies,
          taskInfo.target.parentId
        );

      case 'update':
        if (!taskInfo.target?.type || !taskInfo.target.id || !taskInfo.changes) {
          throw new Error('Update task missing target type, id, or changes');
        }
        return this.createUpdateTask(
          taskInfo.target.type as 'page' | 'block',
          taskInfo.target.id,
          taskInfo.changes,
          taskInfo.description,
          taskInfo.dependencies
        );

      case 'delete':
        if (!taskInfo.target?.type || !taskInfo.target.id) {
          throw new Error('Delete task missing target type or id');
        }
        return this.createDeleteTask(
          taskInfo.target.type as 'page' | 'block',
          taskInfo.target.id,
          taskInfo.description,
          taskInfo.dependencies
        );

      default:
        throw new Error(`Unknown task type: ${taskInfo.type}`);
    }
  }

  /**
   * Updates the context with new tasks and their dependencies
   */
  async updateContext(tasks: Task[]): Promise<void> {
    // Validate tasks
    const errors = this.validator.validateTasks(tasks, this.context);
    if (errors.size > 0) {
      throw new Error(this.formatValidationErrors(errors));
    }

    // Check preconditions for all tasks
    for (const task of tasks) {
      if (!await this.resolver.checkPreconditions(task, this.context)) {
        throw new Error(`Preconditions not met for task: ${task.id}`);
      }
    }

    // Update context
    this.context.history.push(...tasks);
    this.context.updated = new Date();
  }

  /**
   * Formats validation errors into a readable string
   */
  private formatValidationErrors(errors: Map<string, Error[]>): string {
    return `Task validation failed:\n${
      Array.from(errors.entries())
        .map(([taskId, taskErrors]) => 
          `Task ${taskId}:\n${
            taskErrors.map(e => `- ${e.message}`).join('\n')
          }`
        )
        .join('\n\n')
    }`;
  }

  /**
   * Retrieves the current context
   */
  getContext(): TaskContext {
    return this.context;
  }
} 