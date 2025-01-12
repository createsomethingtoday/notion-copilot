import request from 'supertest';
import { createTestServer } from './setup';
import { describe, it, expect } from '@jest/globals';

describe('Health Check API', () => {
  const app = createTestServer();

  it('should return 200 OK for health check', async () => {
    const response = await request(app)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      version: expect.any(String),
      timestamp: expect.any(String)
    });
  });

  it('should include system metrics in health check', async () => {
    const response = await request(app)
      .get('/health/detailed')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      version: expect.any(String),
      timestamp: expect.any(String),
      metrics: {
        memory: expect.any(Object),
        cpu: expect.any(Object),
        uptime: expect.any(Number),
        connections: expect.any(Object)
      },
      services: {
        database: expect.any(String),
        redis: expect.any(String),
        notion: expect.any(String)
      }
    });
  });
}); 