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
  userResponse: string; // Natural language response to the user
  contextUpdates?: { // Optional updates to the context
    variables?: Record<string, unknown>;
    notes?: string[];
  };
}

interface ContextSummary {
  recentTasks: string[];
  relevantVariables: Record<string, unknown>;
  workspaceState: {
    recentPages?: string[];
    recentDatabases?: string[];
    commonOperations?: string[];
  };
}

export class NLPService {
  private openai: OpenAI;
  private contextCache: Map<string, ContextSummary>;
  
  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    this.contextCache = new Map();
  }

  /**
   * Analyzes a natural language request and extracts task information
   */
  async analyzeRequest(request: string, context: TaskContext): Promise<TaskAnalysis> {
    // Get or build context summary
    const contextSummary = await this.getContextSummary(context);
    
    // First, analyze the request for complexity and required subtasks
    const taskDecomposition = await this.decomposeRequest(request, contextSummary);
    
    // Then, convert the decomposition into specific tasks
    const analysis = await this.convertToTasks(taskDecomposition, contextSummary);
    
    // Validate the analysis
    this.validateTaskAnalysis(analysis);
    
    // Update context cache with new information
    await this.updateContextCache(context.sessionId, analysis);
    
    return analysis;
  }

  /**
   * Gets or builds a summary of the current context
   */
  private async getContextSummary(context: TaskContext): Promise<ContextSummary> {
    const cached = this.contextCache.get(context.sessionId);
    if (cached) return cached;

    const summary: ContextSummary = {
      recentTasks: context.history
        .slice(-5)
        .map(task => `${task.type}: ${task.description}`),
      relevantVariables: this.extractRelevantVariables(context.variables),
      workspaceState: await this.analyzeWorkspaceState(context)
    };

    this.contextCache.set(context.sessionId, summary);
    return summary;
  }

  /**
   * Extracts relevant variables from context
   */
  private extractRelevantVariables(variables: Record<string, unknown>): Record<string, unknown> {
    // Filter to only include variables that might be relevant for task planning
    const relevantKeys = ['currentPage', 'selectedItems', 'preferences', 'permissions'];
    return Object.fromEntries(
      Object.entries(variables)
        .filter(([key]) => relevantKeys.includes(key))
    );
  }

  /**
   * Analyzes the current workspace state
   */
  private async analyzeWorkspaceState(context: TaskContext): Promise<ContextSummary['workspaceState']> {
    // This would typically involve analyzing recent operations and workspace structure
    // For now, return a basic structure
    return {
      recentPages: [],
      recentDatabases: [],
      commonOperations: this.extractCommonOperations(context.history as Task[])
    };
  }

  /**
   * Extracts common operations from task history
   */
  private extractCommonOperations(history: Task[]): string[] {
    const operations = history.map(task => task.type);
    const frequency = new Map<string, number>();
    
    for (const op of operations) {
      frequency.set(op, (frequency.get(op) || 0) + 1);
    }

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([op]) => op);
  }

  /**
   * Decomposes a complex request into logical steps
   */
  private async decomposeRequest(
    request: string,
    context: ContextSummary
  ): Promise<{steps: string[], reasoning: string}> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a task planning assistant that breaks down complex Notion operations into logical steps.
Consider:
1. Information gathering needs
2. Dependencies between operations
3. Potential error cases
4. Optimization opportunities
5. User's context and history

Your output should be valid JSON with this structure:
{
  "steps": ["Detailed step descriptions"],
  "reasoning": "Explanation of the decomposition strategy"
}`
        },
        {
          role: 'user',
          content: `Request: ${request}

Context:
${JSON.stringify(context, null, 2)}

Break this request down into logical steps, considering the context.`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      throw new Error('Failed to get response from OpenAI');
    }

    return JSON.parse(result);
  }

  /**
   * Converts decomposed steps into specific tasks
   */
  private async convertToTasks(
    decomposition: {steps: string[], reasoning: string},
    context: ContextSummary
  ): Promise<TaskAnalysis> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Convert these logical steps into specific Notion tasks.
Consider:
1. Task dependencies
2. Required information
3. Error handling
4. User feedback

Output valid JSON matching the TaskAnalysis interface.`
        },
        {
          role: 'user',
          content: `Steps: ${JSON.stringify(decomposition.steps)}
Reasoning: ${decomposition.reasoning}
Context: ${JSON.stringify(context, null, 2)}

Convert these steps into specific tasks with clear dependencies and user feedback.`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      throw new Error('Failed to get response from OpenAI');
    }

    return JSON.parse(result);
  }

  /**
   * Updates the context cache with new information
   */
  private async updateContextCache(
    sessionId: string,
    analysis: TaskAnalysis
  ): Promise<void> {
    const current = this.contextCache.get(sessionId) || {
      recentTasks: [],
      relevantVariables: {},
      workspaceState: {}
    };

    // Update with new tasks
    current.recentTasks = [
      ...analysis.tasks.map(t => `${t.type}: ${t.description}`),
      ...current.recentTasks
    ].slice(0, 5);

    // Update variables if provided
    if (analysis.contextUpdates?.variables) {
      current.relevantVariables = {
        ...current.relevantVariables,
        ...analysis.contextUpdates.variables
      };
    }

    this.contextCache.set(sessionId, current);
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