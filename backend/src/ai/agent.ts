import { Client as NotionClient } from '@notionhq/client';
import OpenAI from 'openai';
import { Task, ChatMessage } from '../../../shared/types';
import { NotionToolRegistry } from '../tools/registry';
import { TaskPlanner } from './planner';
import { ContextManager } from './context';

export class NotionAgent {
  private notion: NotionClient;
  private openai: OpenAI;
  private tools: NotionToolRegistry;
  private planner: TaskPlanner;
  private context: ContextManager;

  constructor(
    notionClient: NotionClient,
    openaiClient: OpenAI,
    tools: NotionToolRegistry,
    planner: TaskPlanner,
    context: ContextManager
  ) {
    this.notion = notionClient;
    this.openai = openaiClient;
    this.tools = tools;
    this.planner = planner;
    this.context = context;
  }

  async processMessage(message: ChatMessage): Promise<Task> {
    // 1. Update context with new message
    await this.context.addMessage(message);

    // 2. Plan task execution
    const plan = await this.planner.createPlan(message.content, this.context);

    // 3. Create task
    const task: Task = {
      id: crypto.randomUUID(),
      userId: message.userId,
      type: plan.taskType,
      status: 'PENDING',
      progress: 0,
      context: {
        plan: plan,
        messageId: message.id
      },
      startedAt: new Date()
    };

    // 4. Execute task asynchronously
    this.executeTask(task).catch(error => {
      console.error('Task execution failed:', error);
      task.status = 'FAILED';
      task.error = {
        code: 'EXECUTION_ERROR',
        message: error.message
      };
    });

    return task;
  }

  private async executeTask(task: Task): Promise<void> {
    try {
      // 1. Update task status
      task.status = 'IN_PROGRESS';

      // 2. Get execution plan
      const plan = task.context.plan as ReturnType<TaskPlanner['createPlan']>;

      // 3. Execute each step in the plan
      for (const step of plan.steps) {
        // Update progress
        task.progress = (plan.steps.indexOf(step) / plan.steps.length) * 100;

        // Get tool for this step
        const tool = this.tools.getTool(step.tool);
        if (!tool) {
          throw new Error(`Tool not found: ${step.tool}`);
        }

        // Execute tool with parameters
        const result = await tool.execute(step.params, {
          notion: this.notion,
          openai: this.openai,
          context: this.context
        });

        // Store result in context
        await this.context.addToolResult(task.id, step.tool, result);
      }

      // 4. Mark task as completed
      task.status = 'COMPLETED';
      task.progress = 100;
      task.completedAt = new Date();

    } catch (error) {
      // Handle errors and update task status
      task.status = 'FAILED';
      task.error = {
        code: 'EXECUTION_ERROR',
        message: error.message,
        details: error
      };
      throw error;
    }
  }

  async cancelTask(taskId: string): Promise<void> {
    // Implement task cancellation logic
    // This would need to handle ongoing API calls and cleanup
  }
} 