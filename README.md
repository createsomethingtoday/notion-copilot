# Notion Assistant

A robust task execution system for managing and automating Notion workspace operations.

## Features

### Core Features
- Task execution system with priority-based scheduling
- Distributed task queue with Redis
- Dead letter queue for failed task management
- Circuit breakers for external service resilience
- PostgreSQL for persistent storage
- Comprehensive test infrastructure

### Monitoring & Observability
- System metrics collection (CPU, memory, event loop)
- Queue health monitoring
- API rate limit tracking
- Circuit breaker state tracking
- Dead letter queue metrics
- Prometheus metrics export
- Grafana dashboards

### Security
- Rate limiting for authentication endpoints
- API key management
- JWT-based authentication
- Role-based authorization (coming soon)

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Notion API Key

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see .env.example)
4. Run migrations: `npm run migrate`
5. Start the server: `npm start`

### Configuration
Key configuration options:
- `REDIS_URL`: Redis connection string
- `DATABASE_URL`: PostgreSQL connection string
- `NOTION_API_KEY`: Your Notion API key
- `JWT_SECRET`: Secret for JWT signing
- `RATE_LIMIT_POINTS`: Number of requests allowed per window
- `RATE_LIMIT_DURATION`: Duration of rate limit window in seconds
- `DLQ_MAX_SIZE`: Maximum size of dead letter queue
- `DLQ_RETENTION_PERIOD`: How long to keep failed tasks
- `CLEANUP_INTERVAL`: Interval for DLQ cleanup job

## Documentation
- [API Documentation](./docs/api.md)
- [Architecture Overview](./docs/architecture.md)
- [Development Guide](./docs/development.md)
- [Deployment Guide](./docs/deployment.md)
- [Troubleshooting Guide](./docs/troubleshooting.md)

## Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License
MIT License - see [LICENSE](./LICENSE) for details. 