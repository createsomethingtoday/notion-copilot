import 'dotenv/config';
import { databaseInitializer } from '../db/init';
import { Logger } from '../utils/logger';
import { TaskPriority } from '../agent/types';
import type { SearchTask, ReadTask, WriteTask, TaskResult } from '../agent/types';
import type { NotionPage } from '../types/notion';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger('TestDataSeeder');

// Mock Notion page for testing
const mockNotionPage: NotionPage = {
  id: 'test-page-1',
  object: 'page',
  created_time: new Date().toISOString(),
  last_edited_time: new Date().toISOString(),
  archived: false,
  icon: null,
  cover: null,
  properties: {
    title: {
      id: 'title',
      type: 'title',
      title: [{
        type: 'text',
        text: { content: 'Meeting Notes', link: null },
        plain_text: 'Meeting Notes',
        href: null,
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default'
        }
      }]
    }
  },
  parent: { type: 'workspace', workspace: true },
  url: 'https://notion.so/test-page-1'
};

async function seedTestData(): Promise<void> {
  try {
    logger.info('Starting test data seeding');
    
    const db = await databaseInitializer.initialize();

    // Create test tasks
    const tasks = [
      {
        id: uuidv4(),
        type: 'search' as const,
        status: 'pending' as const,
        priority: TaskPriority.NORMAL,
        description: 'Search for documents about project planning',
        created: new Date(),
        updated: new Date(),
        query: 'project planning',
        filters: {},
        result: {
          pages: [],
          databases: [],
          blocks: []
        }
      } as SearchTask,
      {
        id: uuidv4(),
        type: 'read' as const,
        status: 'completed' as const,
        priority: TaskPriority.HIGH,
        description: 'Read meeting notes from last week',
        created: new Date(Date.now() - 86400000), // 1 day ago
        updated: new Date(),
        completedAt: new Date(),
        target: {
          type: 'page',
          id: 'test-page-1'
        },
        result: {
          content: mockNotionPage
        }
      } as ReadTask,
      {
        id: uuidv4(),
        type: 'write' as const,
        status: 'failed' as const,
        priority: TaskPriority.URGENT,
        description: 'Create weekly report document',
        created: new Date(Date.now() - 172800000), // 2 days ago
        updated: new Date(),
        error: new Error('Failed to create document: Permission denied'),
        retryCount: 2,
        target: {
          type: 'page',
          parentId: 'test-parent-1'
        },
        content: {
          parent: { page_id: 'test-parent-1' },
          properties: {
            title: {
              title: [
                {
                  text: {
                    content: 'Weekly Report'
                  }
                }
              ]
            }
          }
        }
      } as WriteTask
    ];

    // Save tasks
    for (const task of tasks) {
      await db.saveTask(task);
      logger.info(`Created test task: ${task.description}`);
    }

    // Record some test metrics
    await db.saveMetric('task_processing_time', 150, { task_type: 'search' });
    await db.saveMetric('task_processing_time', 250, { task_type: 'write' });
    await db.saveMetric('task_error_count', 1, { task_type: 'write' });
    
    logger.info('Test data seeding completed');
    
    await databaseInitializer.shutdown();
    logger.info('Database connections closed');
    
    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed test data', error as Error);
    process.exit(1);
  }
}

// Run seeder
seedTestData().catch(error => {
  logger.error('Unhandled error during test data seeding', error as Error);
  process.exit(1);
}); 