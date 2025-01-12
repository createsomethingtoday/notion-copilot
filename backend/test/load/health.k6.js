import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 },  // Stay at 20 users for 1 minute
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests must complete below 500ms
    'errors': ['rate<0.1'],             // Error rate must be less than 10%
  },
};

export default function () {
  const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
  
  // Basic health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check returns 200': (r) => r.status === 200,
    'health check response is ok': (r) => r.json('status') === 'ok',
  }) || errorRate.add(1);

  sleep(1);

  // Detailed health check
  const detailedRes = http.get(`${BASE_URL}/health/detailed`);
  check(detailedRes, {
    'detailed health check returns 200': (r) => r.status === 200,
    'detailed health check has metrics': (r) => r.json('metrics') !== undefined,
    'detailed health check has services': (r) => r.json('services') !== undefined,
  }) || errorRate.add(1);

  sleep(1);
} 