# Notion Assistant

A powerful AI-powered assistant for managing and interacting with Notion workspaces.

## Features

- 🔒 **Secure Authentication**
  - JWT-based authentication
  - Rate limiting protection
  - IP-based blocking for security
  - Redis-backed distributed rate limiting

- 🚀 **Task Processing**
  - Robust task queue system
  - Concurrent task execution
  - Progress tracking
  - Error recovery

- 📊 **Advanced Monitoring**
  - System metrics tracking
  - Performance monitoring
  - Error tracking
  - Datadog integration

- 🔄 **Notion Integration**
  - Real-time updates
  - Workspace management
  - Content synchronization
  - Page operations

## Getting Started

### Prerequisites

- Node.js 18+
- Redis 6+
- PostgreSQL 14+
- Datadog account (optional)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/notion-assistant.git
   cd notion-assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start Redis:
   ```bash
   docker-compose up -d redis
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Configuration

### Required Environment Variables

```bash
# Server
PORT=3001
NODE_ENV=development

# Database
POSTGRES_URL=postgresql://user:pass@localhost:5432/notion_assistant

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Monitoring
DATADOG_API_KEY=your-api-key
```

### Optional Environment Variables

```bash
# Monitoring
DATADOG_APP_KEY=your-app-key
METRICS_FLUSH_INTERVAL=10000
METRICS_BATCH_SIZE=50

# Rate Limiting
LOGIN_RATE_LIMIT_POINTS=5
LOGIN_RATE_LIMIT_DURATION=300
LOGIN_BLOCK_DURATION=900

REGISTER_RATE_LIMIT_POINTS=3
REGISTER_RATE_LIMIT_DURATION=3600
REGISTER_BLOCK_DURATION=7200
```

## Development

### Running Tests

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run type-check
```

## Monitoring

### Available Metrics

- System metrics (CPU, memory, event loop)
- API request rates and latencies
- Task processing metrics
- Rate limiting events
- Error rates and types

### Health Checks

- `/health`: Basic health check
- `/health/redis`: Redis connection status
- `/health/db`: Database connection status
- `/metrics`: Prometheus metrics endpoint

## Troubleshooting

See [GOTCHAS.md](./GOTCHAS.md) for common issues and solutions.

## Architecture

See [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) for detailed architecture documentation.

## Roadmap

See [NEXT_STEPS.md](./NEXT_STEPS.md) for planned features and improvements.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 