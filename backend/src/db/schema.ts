import type { TaskPriority, TaskStatus } from '../agent/types';

export interface DBTask {
  id: string;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;
  description: string;
  dependencies?: string[];
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  retry_count: number;
  error?: string;
  result?: Record<string, unknown>;
  weight?: number;
  deadline?: Date;
  metadata?: Record<string, unknown>;
}

export interface DBTaskResult {
  id: string;
  task_id: string;
  result: Record<string, unknown>;
  error?: string;
  created_at: Date;
}

export interface DBMetric {
  id: string;
  timestamp: Date;
  metric_type: string;
  value: number;
  labels: Record<string, string>;
}

// SQL table definitions
export const SCHEMA_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Task Status enum
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');

-- Task Priority enum
CREATE TYPE task_priority AS ENUM ('0', '1', '2', '3');

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  priority task_priority NOT NULL DEFAULT '1',
  description TEXT NOT NULL,
  dependencies UUID[] DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  retry_count INTEGER DEFAULT 0,
  error TEXT DEFAULT NULL,
  result JSONB DEFAULT NULL,
  weight FLOAT DEFAULT NULL,
  deadline TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  metadata JSONB DEFAULT NULL
);

-- Task Results table
CREATE TABLE IF NOT EXISTS task_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  result JSONB NOT NULL,
  error TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Metrics table
CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metric_type VARCHAR(100) NOT NULL,
  value FLOAT NOT NULL,
  labels JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_task_results_task_id ON task_results(task_id);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
`;

// Migration version tracking
export const MIGRATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`; 