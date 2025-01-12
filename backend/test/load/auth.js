import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  scenarios: {
    auth_flow: {
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

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  const email = `test.${randomString(10)}@example.com`;
  const password = 'Test123!@#';
  let token;

  // Register
  const registerResponse = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email,
    password,
    firstName: 'Test',
    lastName: 'User'
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  check(registerResponse, {
    'register status is 201': (r) => r.status === 201,
    'register response has token': (r) => r.json().token !== undefined
  });

  sleep(1);

  // Login
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email,
    password
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response has token': (r) => r.json().token !== undefined
  });

  token = loginResponse.json().token;
  sleep(1);

  // Get user info
  const meResponse = http.get(`${BASE_URL}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  check(meResponse, {
    'me status is 200': (r) => r.status === 200,
    'me response has user data': (r) => r.json().user !== undefined,
    'me response has correct email': (r) => r.json().user.email === email
  });

  sleep(1);
} 