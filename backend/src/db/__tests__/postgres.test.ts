import type { TaskResult, SearchTask } from '../../agent/types';

const result: TaskResult = {
  pages: [],
  databases: [],
  blocks: [],
  success: true
};

const searchTask: SearchTask = {
  id: 'test-search',
  type: 'search',
  status: 'pending',
  priority: '1',
  query: 'test query'
}; 