import OpenAI from 'openai';
import type { TaskType } from '../../../shared/types';
import type { ContextManager } from './context';

interface PlanStep {
  tool: string;
  params: Record<string, unknown>;
  description: string;
}

interface ExecutionPlan {
  taskType: TaskType;
  goal: string;
  steps: PlanStep[];
  estimatedTime: number; // in seconds
}

export class TaskPlanner {
  private openai: OpenAI;
  private systemPrompt: string;

  constructor(openai: OpenAI) {
    this.openai = openai;
    this.systemPrompt = `You are a task planning assistant for Notion operations. 
Your role is to break down user requests into specific, executable steps using available tools.
Each step must be precise and include all necessary parameters.
Consider dependencies between steps and maintain proper order of operations.`;
  }

  async createPlan(userRequest: string, context: ContextManager): Promise<ExecutionPlan> {
    // 1. Get relevant context
    const recentMessages = await context.getRecentMessages(5);
    const workspaceContext = await context.getWorkspaceContext();

    // 2. Create planning prompt
    const planningPrompt = [
      {
        role: 'system',
        content: this.systemPrompt
      },
      {
        role: 'user',
        content: `Current Notion workspace context:
${JSON.stringify(workspaceContext, null, 2)}

Recent conversation:
${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

User request: ${userRequest}

Create a detailed plan to accomplish this task. Consider:
1. Required permissions and access
2. Dependencies between operations
3. Potential error cases
4. Efficient ordering of operations`
      }
    ];

    // 3. Get plan from OpenAI
    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: planningPrompt,
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    // 4. Parse and validate the plan
    const planJson = JSON.parse(response.choices[0].message.content || '{}');
    
    // 5. Validate and transform the plan
    return this.validateAndTransformPlan(planJson, userRequest);
  }

  private validateAndTransformPlan(
    planJson: unknown,
    originalRequest: string
  ): ExecutionPlan {
    // Implement validation logic here
    // This should ensure the plan follows the expected structure
    // and all required fields are present
    
    // For now, return a simplified plan
    return {
      taskType: this.determineTaskType(originalRequest),
      goal: originalRequest,
      steps: [],
      estimatedTime: 60
    };
  }

  private determineTaskType(request: string): TaskType {
    // Implement logic to determine the task type based on the request
    // This could also use OpenAI for classification
    return 'CUSTOM';
  }
} 