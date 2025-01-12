import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    health_check: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 }
      ],
      gracefulRampDown: '30s'
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01']
  }
};

export default function () {
  const response = http.get(`${__ENV.BASE_URL}/health`);
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response is ok': (r) => r.json().status === 'ok'
  });

  sleep(1);
} 