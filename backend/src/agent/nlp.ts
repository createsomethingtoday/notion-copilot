import OpenAI from 'openai';
import type { Task, TaskContext } from './types';

export interface TaskAnalysis {
  tasks: {
    type: Task['type'];
    description: string;
    target?: {
      type: string;
      id?: string;
      parentId?: string;
    };
    content?: unknown;
    changes?: unknown;
    query?: string;
    filters?: Record<string, unknown>;
    dependencies?: string[];
  }[];
  reasoning: string;
}

export class NLPService {
  private openai: OpenAI;
  
  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Analyzes a natural language request and extracts task information
   */
  async analyzeRequest(request: string, context: TaskContext): Promise<TaskAnalysis> {
    const prompt = this.buildPrompt(request, context);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a task planning assistant that breaks down user requests into specific tasks for interacting with Notion.
Your output should be valid JSON matching this structure:
{
  "tasks": [
    {
      "type": "search" | "read" | "write" | "update" | "delete",
      "description": "Human readable description",
      "target": { // Required for read/write/update/delete
        "type": "page" | "database" | "block",
        "id": "string", // Required for read/update/delete
        "parentId": "string" // Required for block creation
      },
      "content": {}, // Required for write
      "changes": {}, // Required for update
      "query": "string", // Required for search
      "filters": {}, // Optional for search
      "dependencies": ["taskId"] // Optional task dependencies
    }
  ],
  "reasoning": "Explanation of why these tasks were chosen"
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      throw new Error('Failed to get response from OpenAI');
    }

    try {
      return JSON.parse(result) as TaskAnalysis;
    } catch (error) {
      throw new Error('Failed to parse OpenAI response as JSON');
    }
  }

  /**
   * Builds the prompt for the OpenAI API
   */
  private buildPrompt(request: string, context: TaskContext): string {
    const recentTasks = context.history
      .slice(-5)
      .map(task => `- ${task.type}: ${task.description}`)
      .join('\n');

    return `User Request: ${request}

Recent Task History:
${recentTasks || 'No recent tasks'}

Break down this request into specific tasks that need to be performed in Notion.
Consider:
1. Dependencies between tasks
2. Required information gathering
3. Efficient task ordering
4. Error handling steps

Respond with a JSON object containing the tasks and your reasoning.`;
  }

  /**
   * Validates task analysis output
   */
  private validateTaskAnalysis(analysis: TaskAnalysis): void {
    // Ensure we have at least one task
    if (!analysis.tasks?.length) {
      throw new Error('No tasks generated from analysis');
    }

    // Validate each task
    for (const task of analysis.tasks) {
      // Check required fields based on task type
      switch (task.type) {
        case 'search':
          if (!task.query) {
            throw new Error('Search task missing query');
          }
          break;

        case 'read':
        case 'update':
        case 'delete':
          if (!task.target?.type || !task.target.id) {
            throw new Error(`${task.type} task missing target type or id`);
          }
          break;

        case 'write':
          if (!task.target?.type) {
            throw new Error('Write task missing target type');
          }
          if (task.target.type === 'block' && !task.target.parentId) {
            throw new Error('Block creation task missing parentId');
          }
          if (!task.content) {
            throw new Error('Write task missing content');
          }
          break;

        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Validate description
      if (!task.description) {
        throw new Error('Task missing description');
      }
    }

    // Validate reasoning
    if (!analysis.reasoning) {
      throw new Error('Analysis missing reasoning');
    }
  }
} 