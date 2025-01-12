export const scenarios = {
  // Basic health check scenario
  health_check: {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: [
      { duration: '30s', target: 5 },
      { duration: '1m', target: 5 },
      { duration: '30s', target: 0 }
    ],
    gracefulRampDown: '30s',
    tags: { scenario: 'health_check' }
  },

  // Normal load scenario - simulates regular usage
  normal_load: {
    executor: 'constant-vus',
    vus: 50,
    duration: '5m',
    tags: { scenario: 'normal_load' }
  },

  // Stress testing scenario - gradually increasing load
  stress_test: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 0 }
    ],
    gracefulRampDown: '30s',
    tags: { scenario: 'stress_test' }
  },

  // Spike testing scenario - sudden surge in traffic
  spike_test: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 50 },
      { duration: '30s', target: 500 },
      { duration: '1m', target: 500 },
      { duration: '30s', target: 50 },
      { duration: '1m', target: 50 }
    ],
    gracefulRampDown: '30s',
    tags: { scenario: 'spike_test' }
  },

  // Soak testing scenario - sustained load over time
  soak_test: {
    executor: 'constant-vus',
    vus: 50,
    duration: '30m',
    tags: { scenario: 'soak_test' }
  },

  // Breakpoint testing scenario - find system limits
  breakpoint_test: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '5m', target: 300 },
      { duration: '2m', target: 400 },
      { duration: '5m', target: 400 },
      { duration: '2m', target: 500 },
      { duration: '5m', target: 500 },
      { duration: '2m', target: 0 }
    ],
    gracefulRampDown: '30s',
    tags: { scenario: 'breakpoint_test' }
  }
}; 