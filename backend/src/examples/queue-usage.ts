import { PostgresAdapter } from '../db/postgres';
import { TaskQueueOrchestrator } from '../queue/orchestrator';
import type { Task, TaskResult, WriteTask, ReadTask, UpdateTask } from '../agent/types';
import { Logger } from '../utils/logger';
import { InMemoryStorage } from '../agent/storage/memory';

async function main() {
  const logger = new Logger('QueueExample');

  // Initialize PostgreSQL connection
  const db = new PostgresAdapter({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    database: process.env.POSTGRES_DB || 'notion_assistant',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres'
  });

  // Create storage adapter
  const storage = new InMemoryStorage();

  // Create queue orchestrator
  const queue = new TaskQueueOrchestrator(storage, db, {
    scheduler: {
      maxConcurrentTasks: 5,
      taskTimeoutMs: 30000
    },
    recovery: {
      maxRetries: 3,
      recoveryWindowMs: 5 * 60 * 1000 // 5 minutes
    },
    locks: {
      lockTimeoutMs: 10000
    }
  });

  // Start the queue system
  await queue.start();
  logger.info('Queue system started');

  try {
    // Example: Create a new page in Notion
    const createPageTask: WriteTask = {
      id: `task-${Date.now()}`,
      type: 'write',
      status: 'pending',
      priority: '2', // High priority
      description: 'Create new project page',
      target: {
        type: 'page',
        parentId: 'your-parent-page-id' // Replace with actual parent page ID
      },
      content: {
        parent: {
          page_id: 'your-parent-page-id' // Replace with actual parent page ID
        },
        properties: {
          title: {
            title: [{ type: 'text', text: { content: 'New Project' } }]
          }
        },
        children: [
          {
            object: 'block',
            type: 'heading_1',
            heading_1: {
              rich_text: [{ type: 'text', text: { content: 'Project Overview' } }]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: 'Project description goes here.' } }]
            }
          }
        ]
      },
      created: new Date(),
      updated: new Date()
    };

    // Enqueue the task
    await queue.enqueueTask(createPageTask);
    logger.info(`Task enqueued: ${createPageTask.id}`);

    // Monitor task status
    let task = await queue.getTask(createPageTask.id);
    while (task && task.status !== 'completed' && task.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      task = await queue.getTask(createPageTask.id);
      logger.info(`Task status: ${task?.status}`);
    }

    if (task?.status === 'completed') {
      logger.info('Task completed successfully');
    } else if (task?.status === 'failed') {
      logger.error('Task failed', task.error);
    }

    // Get queue status
    const status = await queue.getStatus();
    logger.info('Queue status', { 
      queueSize: status.queueSize,
      activeLockCount: status.activeLockCount,
      scheduler: status.scheduler
    });

    // Example: Batch enqueue tasks
    const batchTasks: Task[] = [
      {
        id: `task-${Date.now()}-1`,
        type: 'read',
        status: 'pending',
        priority: '1', // Normal priority
        description: 'Read page content',
        target: {
          type: 'page',
          id: 'page-id-1' // Replace with actual page ID
        },
        created: new Date(),
        updated: new Date()
      } as ReadTask,
      {
        id: `task-${Date.now()}-2`,
        type: 'update',
        status: 'pending',
        priority: '2', // High priority
        description: 'Update page content',
        target: {
          type: 'page',
          id: 'page-id-2' // Replace with actual page ID
        },
        changes: {
          page_id: 'page-id-2',
          properties: {
            Status: { select: { name: 'In Progress' } }
          }
        },
        created: new Date(),
        updated: new Date()
      } as UpdateTask
    ];

    // Enqueue batch tasks
    await Promise.all(batchTasks.map(task => queue.enqueueTask(task)));
    logger.info(`Batch tasks enqueued: ${batchTasks.length} tasks`);

    // Example: Handle task completion
    const mockResult: TaskResult = {
      pages: [],
      databases: [],
      blocks: [],
      created: {
        id: 'new-page-id',
        object: 'page',
        created_time: new Date().toISOString(),
        last_edited_time: new Date().toISOString(),
        archived: false,
        parent: { type: 'page_id', page_id: 'your-parent-page-id' },
        url: '',
        properties: {},
        created_by: { id: 'user-id', object: 'user' },
        last_edited_by: { id: 'user-id', object: 'user' },
        icon: null,
        cover: null,
        public_url: null,
        in_trash: false
      }
    };
    await queue.completeTask(createPageTask.id, mockResult);

    // Example: Handle task failure
    const mockError = new Error('Failed to update page');
    await queue.failTask(batchTasks[1].id, mockError);

  } catch (error) {
    logger.error('Error in queue example', error as Error);
  } finally {
    // Stop the queue system
    await queue.stop();
    logger.info('Queue system stopped');

    // Close database connection
    await db.close();
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
} 