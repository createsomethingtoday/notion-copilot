-- Create enum types
CREATE TYPE task_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE task_type AS ENUM (
  'search',
  'read',
  'write',
  'update',
  'delete'
);

CREATE TYPE task_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

-- Create tasks table
CREATE TABLE tasks (
  id VARCHAR(255) PRIMARY KEY,
  type task_type NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  priority task_priority NOT NULL DEFAULT 'normal',
  description TEXT,
  dependencies TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  result JSONB,
  weight INTEGER DEFAULT 1,
  deadline TIMESTAMP WITH TIME ZONE,
  target JSONB NOT NULL
);

-- Create task_results table
CREATE TABLE task_results (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  result JSONB NOT NULL,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create metrics table
CREATE TABLE metrics (
  id SERIAL PRIMARY KEY,
  metric_type VARCHAR(255) NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  labels JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_task_results_task_id ON task_results(task_id);
CREATE INDEX idx_metrics_type_timestamp ON metrics(metric_type, timestamp);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 