-- Drop trigger
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_tasks_status;
DROP INDEX IF EXISTS idx_tasks_priority;
DROP INDEX IF EXISTS idx_tasks_created_at;
DROP INDEX IF EXISTS idx_tasks_deadline;
DROP INDEX IF EXISTS idx_task_results_task_id;
DROP INDEX IF EXISTS idx_metrics_type_timestamp;

-- Drop tables
DROP TABLE IF EXISTS metrics;
DROP TABLE IF EXISTS task_results;
DROP TABLE IF EXISTS tasks;

-- Drop enum types
DROP TYPE IF EXISTS task_status;
DROP TYPE IF EXISTS task_type;
DROP TYPE IF EXISTS task_priority; 