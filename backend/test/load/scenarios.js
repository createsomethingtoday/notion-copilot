import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { scenarios } from './config.js';

// Custom metrics
const errorRate = new Rate('errors');
const notionApiLatency = new Trend('notion_api_latency');
const taskProcessingTime = new Trend('task_processing_time');

// Export test configuration
export const options = {
  scenarios: scenarios,
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.1'],
    notion_api_latency: ['p(95)<1000'],
    task_processing_time: ['p(95)<5000']
  }
};

// Simulated user behavior
export default function () {
  const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
  
  group('Health Checks', () => {
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
      'health check returns 200': (r) => r.status === 200,
      'health check response is ok': (r) => r.json('status') === 'ok'
    }) || errorRate.add(1);

    sleep(1);
  });

  group('Authentication', () => {
    const loginRes = http.post(`${BASE_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'testpassword'
    });
    
    check(loginRes, {
      'login successful': (r) => r.status === 200,
      'token received': (r) => r.json('token') !== undefined
    }) || errorRate.add(1);

    sleep(2);
  });

  group('Notion Integration', () => {
    const startTime = new Date();
    
    const notionRes = http.get(`${BASE_URL}/notion/pages`, {
      headers: {
        'Authorization': `Bearer ${__ENV.TEST_TOKEN || 'test-token'}`
      }
    });
    
    notionApiLatency.add(new Date() - startTime);
    
    check(notionRes, {
      'notion api returns 200': (r) => r.status === 200,
      'notion pages received': (r) => Array.isArray(r.json('pages'))
    }) || errorRate.add(1);

    sleep(3);
  });

  group('Task Processing', () => {
    const startTime = new Date();
    
    // Create task
    const createTaskRes = http.post(`${BASE_URL}/tasks`, {
      type: 'summarize',
      pageId: 'test-page-id',
      options: {
        format: 'markdown',
        length: 'medium'
      }
    }, {
      headers: {
        'Authorization': `Bearer ${__ENV.TEST_TOKEN || 'test-token'}`
      }
    });
    
    check(createTaskRes, {
      'task creation successful': (r) => r.status === 201,
      'task id received': (r) => r.json('taskId') !== undefined
    }) || errorRate.add(1);

    // Poll task status
    const taskId = createTaskRes.json('taskId');
    let taskComplete = false;
    let attempts = 0;
    
    while (!taskComplete && attempts < 10) {
      const statusRes = http.get(`${BASE_URL}/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${__ENV.TEST_TOKEN || 'test-token'}`
        }
      });
      
      check(statusRes, {
        'status check successful': (r) => r.status === 200
      }) || errorRate.add(1);

      if (statusRes.json('status') === 'completed') {
        taskComplete = true;
        taskProcessingTime.add(new Date() - startTime);
      } else {
        attempts++;
        sleep(1);
      }
    }

    sleep(2);
  });

  group('Error Handling', () => {
    // Invalid auth
    const invalidAuthRes = http.get(`${BASE_URL}/notion/pages`, {
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    });
    
    check(invalidAuthRes, {
      'invalid auth returns 401': (r) => r.status === 401
    });

    // Invalid task type
    const invalidTaskRes = http.post(`${BASE_URL}/tasks`, {
      type: 'invalid-type',
      pageId: 'test-page-id'
    }, {
      headers: {
        'Authorization': `Bearer ${__ENV.TEST_TOKEN || 'test-token'}`
      }
    });
    
    check(invalidTaskRes, {
      'invalid task returns 400': (r) => r.status === 400
    });

    sleep(1);
  });
}; 