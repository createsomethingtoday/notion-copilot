import type { 
  Task,
  TaskContext,
  SearchTask,
  ReadTask,
  WriteTask,
  UpdateTask,
  DeleteTask
} from './types';

interface TaskCondition<T extends Task = Task> {
  check: (task: T, context: TaskContext) => Promise<boolean>;
  description: string;
}

interface TaskResolution {
  subtasks: Task[];
  postconditions: TaskCondition[];
}

export class TaskResolver {
  private preconditions: Map<string, TaskCondition[]>;
  private resolutionStrategies: Map<string, (task: Task) => Promise<TaskResolution>>;

  constructor() {
    this.preconditions = new Map();
    this.resolutionStrategies = new Map();
    this.initializePreconditions();
    this.initializeResolutionStrategies();
  }

  /**
   * Initialize default preconditions for each task type
   */
  private initializePreconditions(): void {
    // Search task preconditions
    this.preconditions.set('search', []);

    // Read task preconditions
    this.preconditions.set('read', [
      {
        check: async (task: Task, context: TaskContext) => {
          if (task.type !== 'read') return false;
          // Check if we have necessary permissions/access
          return true; // TODO: Implement actual permission check
        },
        description: 'Verify read permissions'
      }
    ]);

    // Write task preconditions
    this.preconditions.set('write', [
      {
        check: async (task: Task, context: TaskContext) => {
          if (task.type !== 'write') return false;
          if (task.target.type === 'block' && !task.target.parentId) {
            return false;
          }
          return true;
        },
        description: 'Verify parent exists for block creation'
      }
    ]);

    // Update task preconditions
    this.preconditions.set('update', [
      {
        check: async (task: Task, context: TaskContext) => {
          if (task.type !== 'update') return false;
          // Check if target exists
          return true; // TODO: Implement existence check
        },
        description: 'Verify target exists'
      }
    ]);

    // Delete task preconditions
    this.preconditions.set('delete', [
      {
        check: async (task: Task, context: TaskContext) => {
          if (task.type !== 'delete') return false;
          // Check if target exists and we have delete permissions
          return true; // TODO: Implement permission check
        },
        description: 'Verify delete permissions'
      }
    ]);
  }

  /**
   * Initialize resolution strategies for complex tasks
   */
  private initializeResolutionStrategies(): void {
    // Example: Strategy for creating a new page with blocks
    this.resolutionStrategies.set('write_page_with_blocks', async (task: Task) => {
      if (task.type !== 'write' || task.target.type !== 'page' || !task.content) {
        throw new Error('Invalid task for write_page_with_blocks strategy');
      }

      const subtasks: Task[] = [];
      const pageId = `temp_${Date.now()}`; // Using template literal

      // Create page first
      subtasks.push({
        ...task,
        id: `${task.id}_page`,
        description: `Create page: ${task.description}`,
        dependencies: task.dependencies
      });

      // Then create blocks
      // TODO: Extract blocks from content and create block creation tasks

      return {
        subtasks,
        postconditions: [
          {
            check: async (task: Task, context: TaskContext) => {
              // Verify page was created
              return true; // TODO: Implement verification
            },
            description: 'Verify page creation'
          }
        ]
      };
    });
  }

  /**
   * Check if all preconditions are met for a task
   */
  async checkPreconditions(task: Task, context: TaskContext): Promise<boolean> {
    const conditions = this.preconditions.get(task.type) || [];
    
    for (const condition of conditions) {
      if (!await condition.check(task, context)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Resolve a task into subtasks if needed
   */
  async resolveTask(task: Task, context: TaskContext): Promise<Task[]> {
    // Check if task needs decomposition
    const strategy = this.findResolutionStrategy(task);
    if (!strategy) {
      return [task];
    }

    // Apply resolution strategy
    const resolution = await strategy(task);
    
    // Validate and return subtasks
    return resolution.subtasks;
  }

  /**
   * Find appropriate resolution strategy for a task
   */
  private findResolutionStrategy(task: Task): ((task: Task) => Promise<TaskResolution>) | undefined {
    if (task.type === 'write' && 'target' in task && task.target.type === 'page') {
      // Check if content contains blocks
      return this.resolutionStrategies.get('write_page_with_blocks');
    }

    return undefined;
  }

  /**
   * Add a custom precondition for a task type
   */
  addPrecondition(taskType: string, condition: TaskCondition): void {
    const conditions = this.preconditions.get(taskType) || [];
    conditions.push(condition);
    this.preconditions.set(taskType, conditions);
  }

  /**
   * Add a custom resolution strategy
   */
  addResolutionStrategy(
    name: string, 
    strategy: (task: Task) => Promise<TaskResolution>
  ): void {
    this.resolutionStrategies.set(name, strategy);
  }
} 