export interface User {
  id: string;
  email: string;
  name: string;
  notionWorkspaces: NotionWorkspace[];
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotionWorkspace {
  workspaceId: string;
  accessToken: string;
  scopes: string[];
  botId: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  language: string;
}

export interface Task {
  id: string;
  userId: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;
  context: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: Error;
  startedAt: Date;
  completedAt?: Date;
}

export type TaskType = 
  | 'CREATE_PAGE'
  | 'UPDATE_PAGE'
  | 'DELETE_PAGE'
  | 'CREATE_DATABASE'
  | 'UPDATE_DATABASE'
  | 'SEARCH'
  | 'CUSTOM';

export type TaskStatus = 
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  taskId?: string;
  timestamp: Date;
}

export interface Error {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface WebSocketEvents {
  'task:update': (task: Task) => void;
  'task:complete': (task: Task) => void;
  'task:error': (task: Task) => void;
  'message:received': (message: ChatMessage) => void;
  'message:sent': (message: ChatMessage) => void;
  'connection:error': (error: Error) => void;
}
