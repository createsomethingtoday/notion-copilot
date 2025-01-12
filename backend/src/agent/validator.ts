import type { 
  Task, 
  TaskContext,
  WriteTask,
  UpdateTask
} from './types';

import type {
  NotionPageCreateParams,
  NotionBlockContent,
  NotionPageUpdateParams
} from '../types/notion';

export interface ValidationError extends Error {
  field: string;
  code: string;
}

export class TaskValidator {
  /**
   * Validates a single task
   */
  validateTask(task: Task, context: TaskContext): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate base task properties
    if (!task.id) {
      errors.push(this.createError('id', 'required', 'Task ID is required'));
    }

    if (!task.description) {
      errors.push(this.createError('description', 'required', 'Task description is required'));
    }

    // Validate dependencies exist in context
    if (task.dependencies?.length) {
      const missingDeps = task.dependencies.filter(
        depId => !context.history.some(t => t.id === depId)
      );

      if (missingDeps.length) {
        errors.push(
          this.createError(
            'dependencies',
            'invalid_reference',
            `Dependencies not found: ${missingDeps.join(', ')}`
          )
        );
      }
    }

    // Validate task-specific properties
    switch (task.type) {
      case 'search':
        errors.push(...this.validateSearchTask(task));
        break;
      case 'read':
        errors.push(...this.validateReadTask(task));
        break;
      case 'write':
        errors.push(...this.validateWriteTask(task));
        break;
      case 'update':
        errors.push(...this.validateUpdateTask(task));
        break;
      case 'delete':
        errors.push(...this.validateDeleteTask(task));
        break;
      default:
        errors.push(
          this.createError('type', 'invalid', `Unknown task type: ${(task as Task).type}`)
        );
    }

    return errors;
  }

  /**
   * Validates a sequence of tasks
   */
  validateTasks(tasks: Task[], context: TaskContext): Map<string, ValidationError[]> {
    const errorMap = new Map<string, ValidationError[]>();

    // Validate individual tasks
    for (const task of tasks) {
      const errors = this.validateTask(task, context);
      if (errors.length) {
        errorMap.set(task.id, errors);
      }
    }

    // Validate dependency graph
    const graphErrors = this.validateDependencyGraph(tasks);
    for (const [taskId, errors] of graphErrors) {
      const existing = errorMap.get(taskId) || [];
      errorMap.set(taskId, [...existing, ...errors]);
    }

    return errorMap;
  }

  /**
   * Validates search task properties
   */
  private validateSearchTask(task: Task & { type: 'search' }): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!task.query) {
      errors.push(this.createError('query', 'required', 'Search query is required'));
    }

    return errors;
  }

  /**
   * Validates read task properties
   */
  private validateReadTask(task: Task & { type: 'read' }): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!task.target?.type) {
      errors.push(this.createError('target.type', 'required', 'Target type is required'));
    }

    if (!task.target?.id) {
      errors.push(this.createError('target.id', 'required', 'Target ID is required'));
    }

    return errors;
  }

  /**
   * Validates write task properties
   */
  private validateWriteTask(task: WriteTask): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!task.target?.type) {
      errors.push(this.createError('target.type', 'required', 'Target type is required'));
    }

    if (!task.content) {
      errors.push(this.createError('content', 'required', 'Content is required'));
    }

    if (task.target?.type === 'block' && !task.target.parentId) {
      errors.push(
        this.createError('target.parentId', 'required', 'Parent ID is required for blocks')
      );
    }

    // Validate content type matches target type
    try {
      if (task.target?.type === 'page') {
        this.validatePageContent(task.content as NotionPageCreateParams);
      } else if (task.target?.type === 'block') {
        this.validateBlockContent(task.content as NotionBlockContent);
      }
    } catch (error) {
      errors.push(
        this.createError('content', 'invalid', (error as Error).message)
      );
    }

    return errors;
  }

  /**
   * Validates update task properties
   */
  private validateUpdateTask(task: UpdateTask): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!task.target?.type) {
      errors.push(this.createError('target.type', 'required', 'Target type is required'));
    }

    if (!task.target?.id) {
      errors.push(this.createError('target.id', 'required', 'Target ID is required'));
    }

    if (!task.changes) {
      errors.push(this.createError('changes', 'required', 'Changes are required'));
    }

    // Validate changes type matches target type
    try {
      if (task.target?.type === 'page') {
        this.validatePageUpdates(task.changes as NotionPageUpdateParams);
      } else if (task.target?.type === 'block') {
        this.validateBlockContent(task.changes as Partial<NotionBlockContent>);
      }
    } catch (error) {
      errors.push(
        this.createError('changes', 'invalid', (error as Error).message)
      );
    }

    return errors;
  }

  /**
   * Validates delete task properties
   */
  private validateDeleteTask(task: Task & { type: 'delete' }): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!task.target?.type) {
      errors.push(this.createError('target.type', 'required', 'Target type is required'));
    }

    if (!task.target?.id) {
      errors.push(this.createError('target.id', 'required', 'Target ID is required'));
    }

    return errors;
  }

  /**
   * Validates the dependency graph for cycles and invalid references
   */
  private validateDependencyGraph(tasks: Task[]): Map<string, ValidationError[]> {
    const errorMap = new Map<string, ValidationError[]>();
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // Check for cycles using DFS
    const checkCycles = (taskId: string, path: string[] = []): boolean => {
      if (recursionStack.has(taskId)) {
        const cycle = path.slice(path.indexOf(taskId));
        cycle.push(taskId);
        const error = this.createError(
          'dependencies',
          'cyclic_dependency',
          `Dependency cycle detected: ${cycle.join(' -> ')}`
        );
        for (const id of cycle) {
          const errors = errorMap.get(id) || [];
          errors.push(error);
          errorMap.set(id, errors);
        }
        return true;
      }

      if (visited.has(taskId)) {
        return false;
      }

      visited.add(taskId);
      recursionStack.add(taskId);

      const task = tasks.find(t => t.id === taskId);
      if (task?.dependencies) {
        for (const depId of task.dependencies) {
          if (checkCycles(depId, [...path, taskId])) {
            return true;
          }
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    // Check each task for cycles
    for (const task of tasks) {
      if (!visited.has(task.id)) {
        checkCycles(task.id);
      }
    }

    return errorMap;
  }

  /**
   * Validates page content structure
   */
  private validatePageContent(content: NotionPageCreateParams): void {
    // TODO: Implement page content validation
    // This would validate the structure matches Notion's requirements
  }

  /**
   * Validates block content structure
   */
  private validateBlockContent(content: NotionBlockContent | Partial<NotionBlockContent>): void {
    // TODO: Implement block content validation
    // This would validate the structure matches Notion's requirements
  }

  /**
   * Validates page update structure
   */
  private validatePageUpdates(updates: NotionPageUpdateParams): void {
    // TODO: Implement page updates validation
    // This would validate the structure matches Notion's requirements
  }

  /**
   * Creates a validation error
   */
  private createError(field: string, code: string, message: string): ValidationError {
    const error = new Error(message) as ValidationError;
    error.field = field;
    error.code = code;
    return error;
  }
} 