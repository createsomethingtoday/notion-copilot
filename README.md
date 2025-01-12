# Notion Assistant

An intelligent assistant for Notion workspace management, powered by advanced task execution and NLP.

## Current Status

🟢 **Production Ready**
- Task Queue System
- Worker Pool Management
- Type-safe Task Execution
- Concurrency Management
- Priority Management
- Performance Monitoring
- Basic Notion Integration
- PostgreSQL Integration
- Database Migrations

🟡 **In Development**
- Task Recovery System
- Task Scheduling Logic
- Advanced Monitoring
- Testing Infrastructure

🔴 **Planned**
- AI/NLP Integration
- Content Building System
- Security Features
- Task Batching

For detailed status, see [CODE_STATUS.md](./CODE_STATUS.md)

## Features

### Core System
- Priority-based task scheduling
- Worker pool with auto-scaling
- Type-safe task execution
- Concurrent operation handling
- Rate limiting and resource protection
- Automatic retry and error recovery
- Real-time performance monitoring

### Queue Management
- Persistent task storage with PostgreSQL
- Priority queue with deadlines
- Worker pool management
- Dependency handling
- Progress tracking
- Transaction support
- Connection pooling
- Batch operation support (planned)

### Performance Monitoring
- Real-time metrics collection
- Task execution analytics
- Resource usage tracking
- Database health monitoring
- Automatic alerting
- Performance optimization

## Getting Started

### Prerequisites
- Node.js 16+
- TypeScript 4.5+
- PostgreSQL 14+
- Notion API Key
- OpenAI API Key (coming soon)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/notion-assistant.git
cd notion-assistant
```

2. Install dependencies:
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. Configure environment:
```bash
# Backend configuration
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# Frontend configuration
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your settings
```

4. Initialize database:
```bash
# Create and set up database
cd backend
npm run db:init

# Optional: Seed test data
npm run db:seed
```

### Running the Application

1. Start the backend:
```bash
cd backend
npm run dev
```

2. Start the frontend:
```bash
cd frontend
npm run dev
```

## Development

### Database Management
```bash
# Initialize database
npm run db:init

# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:rollback

# Seed test data
npm run db:seed
```

### Building
```bash
# Build backend
cd backend
npm run build

# Build frontend
cd frontend
npm run build
```

### Testing
```bash
# Run backend tests
cd backend
npm test

# Run frontend tests
cd frontend
npm test
```

## Architecture

### Core Components
- Task Queue: Manages task lifecycle and execution
- Priority Manager: Handles task scheduling and ordering
- Concurrency Manager: Controls parallel execution and rate limits
- Metrics Collector: Tracks performance and system health
- PostgreSQL Adapter: Handles data persistence and transactions

### Design Principles
- Reliability: No task loss, guaranteed execution
- Scalability: Handle increasing load gracefully
- Observability: Full system visibility
- Efficiency: Optimal resource utilization
- Data Integrity: ACID compliance for all operations

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Roadmap

See [NEXT_STEPS.md](./NEXT_STEPS.md) for planned features and improvements.

## Known Issues

See [CODE_STATUS.md](./CODE_STATUS.md) for current known issues and technical debt.

## License

MIT 