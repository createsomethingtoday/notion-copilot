CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT,
  description TEXT,
  created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  deadline TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  error TEXT,
  moved_to_dead_letter_at TIMESTAMP WITH TIME ZONE,
  result JSONB,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX tasks_status_idx ON tasks(status);
CREATE INDEX tasks_created_idx ON tasks(created);
CREATE INDEX tasks_updated_idx ON tasks(updated);
CREATE INDEX tasks_priority_idx ON tasks(priority);
CREATE INDEX tasks_deadline_idx ON tasks(deadline);
CREATE INDEX tasks_moved_to_dead_letter_at_idx ON tasks(moved_to_dead_letter_at); 