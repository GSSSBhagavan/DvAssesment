import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

/**
 * DATAVALLEY ASSESSMENT PLATFORM — STAGING LOAD TEST SCRIPT (k6)
 *
 * SAFETY INVARIANT:
 * NEVER run this against production or the shared database.
 * Run ONLY against an isolated staging environment with a dedicated staging database.
 *
 * USAGE:
 *   k6 run --env TARGET_URL=https://staging.datavalley.ai --env ALLOW_STAGING_LOAD_TEST=true scripts/load-test-k6.js
 */

// Custom Trends & Metrics
const loginTrend = new Trend('dv_login_duration', true);
const sessionStartTrend = new Trend('dv_session_start_duration', true);
const syncTrend = new Trend('dv_sync_duration', true);
const integrityTrend = new Trend('dv_integrity_event_duration', true);
const submitTrend = new Trend('dv_submit_duration', true);
const rateLimitCount = new Counter('dv_rate_limited_requests');
const errorRate = new Rate('dv_error_rate');

export const options = {
  scenarios: {
    candidate_assessment_workload: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },  // 2-minute ramp-up to 100 concurrent candidates
        { duration: '15m', target: 100 }, // 15-minute sustained assessment period
        { duration: '3m', target: 0 },    // 3-minute ramp-down (staggered completion)
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // Quality gates
    'http_req_failed': ['rate<0.01'],             // HTTP failure rate below 1%
    'http_req_duration': ['p(95)<400'],           // p95 latency below 400ms
    'dv_sync_duration': ['p(95)<300'],            // Answer sync p95 below 300ms
    'dv_submit_duration': ['p(95)<800'],          // Final submission p95 below 800ms
    'dv_integrity_event_duration': ['p(95)<200'], // Integrity heartbeat p95 below 200ms
    'dv_error_rate': ['rate<0.01'],               // Custom error rate below 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const ALLOW_LOAD_TEST = __ENV.ALLOW_STAGING_LOAD_TEST === 'true';

// Comprehensive question list matching assessment bank
const SAMPLE_QUESTIONS = [
  'mcq_py_01', 'mcq_py_02', 'mcq_py_03', 'mcq_py_04', 'mcq_py_05',
  'mcq_sql_01', 'mcq_sql_02', 'mcq_sql_03', 'mcq_sql_04', 'mcq_sql_05',
  'mcq_dsa_01', 'mcq_dsa_02', 'mcq_dsa_03', 'mcq_dsa_04', 'mcq_dsa_05',
  'mcq_git_01', 'mcq_git_02', 'mcq_git_03', 'mcq_git_04', 'mcq_git_05',
  'git_cmd_01', 'git_cmd_02', 'git_cmd_03', 'git_cmd_04', 'git_cmd_05'
];

const MCQ_CHOICES = ['A', 'B', 'C', 'D'];
const GIT_COMMANDS = [
  'git commit -m "initial commit"',
  'git checkout -b feature-login',
  'git push origin main',
  'git rebase main',
  'git stash pop'
];

export function setup() {
  if (!ALLOW_LOAD_TEST) {
    throw new Error(
      'SAFETY ABORT: Load testing is disabled by default to prevent accidental execution against shared databases. ' +
      'To run in isolated staging, set ALLOW_STAGING_LOAD_TEST=true and specify TARGET_URL=<staging-url>.'
    );
  }

  // Pre-flight health check
  const res = http.get(`${BASE_URL}/api/health`, { timeout: '5s' });
  if (res.status !== 200 && res.status !== 404) {
    console.warn(`Health check returned ${res.status}. Proceeding with caution on staging.`);
  }

  return { testStartTime: Date.now() };
}

export default function (data) {
  const vuId = __VU;
  const iterId = __ITER;

  // Each VU maps to an isolated staging candidate created during staging seed
  // e.g. candidate_staging_001@staging.datavalley.ai
  const candidateEmail = `staging_vu_${String(vuId).padStart(3, '0')}@staging.datavalley.ai`;
  const candidatePassword = __ENV.STAGING_CANDIDATE_PASSWORD || 'StagingPass123!';

  const jar = http.cookieJar();

  // 1. Candidate Authentication / Login
  const loginPayload = JSON.stringify({
    email: candidateEmail,
    password: candidatePassword,
  });

  const headers = {
    'Content-Type': 'application/json',
    'Origin': BASE_URL,
  };

  const loginStart = Date.now();
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, { headers, jar });
  loginTrend.add(Date.now() - loginStart);

  if (loginRes.status === 429) {
    rateLimitCount.add(1);
    sleep(2);
    return;
  }

  const loginOk = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login sets token cookie': (r) => jar.cookiesForURL(BASE_URL)['dv_auth_token'] !== undefined,
  });

  if (!loginOk) {
    errorRate.add(1);
    return;
  }

  sleep(1); // Read assessment rules / instructions

  // 2. Start Assessment Session
  const sessionStartReqTime = Date.now();
  const startRes = http.post(`${BASE_URL}/api/assessment/start`, JSON.stringify({}), { headers, jar });
  sessionStartTrend.add(Date.now() - sessionStartReqTime);

  const startOk = check(startRes, {
    'session start is 200': (r) => r.status === 200,
    'session body contains questions': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.questions && body.questions.length === 60;
      } catch (e) {
        return false;
      }
    },
  });

  if (!startOk) {
    errorRate.add(1);
    return;
  }

  // 3. Sustained Assessment Phase: Candidate answers questions with realistic think times
  // 100 candidates will answer questions throughout the 15-minute window
  const answersSubmitted = {};

  for (let i = 0; i < 15; i++) {
    // Stagger think time: 20-30 seconds between answering questions
    sleep(Math.random() * 10 + 20);

    // Pick 1-3 questions to answer in this batch
    const qCount = Math.floor(Math.random() * 2) + 1;
    const batchUpdates = {};

    for (let j = 0; j < qCount; j++) {
      const qIndex = (i * 2 + j) % SAMPLE_QUESTIONS.length;
      const qId = SAMPLE_QUESTIONS[qIndex];

      if (qId.startsWith('git_cmd')) {
        const ans = GIT_COMMANDS[Math.floor(Math.random() * GIT_COMMANDS.length)];
        batchUpdates[qId] = ans;
        answersSubmitted[qId] = ans;
      } else {
        const ans = MCQ_CHOICES[Math.floor(Math.random() * MCQ_CHOICES.length)];
        batchUpdates[qId] = ans;
        answersSubmitted[qId] = ans;
      }
    }

    // A. Sync Answers
    const syncStart = Date.now();
    const syncRes = http.post(
      `${BASE_URL}/api/assessment/sync`,
      JSON.stringify({ answers: batchUpdates, currentQuestionIndex: i * 2 }),
      { headers, jar }
    );
    syncTrend.add(Date.now() - syncStart);

    check(syncRes, {
      'sync status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    // B. Periodic Integrity / Proctoring Heartbeat
    if (i % 2 === 0) {
      sleep(1);
      const integrityStart = Date.now();
      const integrityRes = http.post(
        `${BASE_URL}/api/assessment/integrity-event`,
        JSON.stringify({ eventType: 'HEARTBEAT', details: { tabActive: true } }),
        { headers, jar }
      );
      integrityTrend.add(Date.now() - integrityStart);

      check(integrityRes, {
        'integrity status is 200': (r) => r.status === 200,
      });
    }
  }

  // 4. Staggered Final Assessment Submission
  // Candidates finish at different times during the ramp-down window
  sleep(Math.random() * 15 + 5);

  const submitStart = Date.now();
  const submitRes = http.post(
    `${BASE_URL}/api/assessment/submit`,
    JSON.stringify({ finalAnswers: answersSubmitted }),
    { headers, jar }
  );
  submitTrend.add(Date.now() - submitStart);

  const submitOk = check(submitRes, {
    'submit status is 200': (r) => r.status === 200,
    'result contains valid score': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.score === 'number' && body.status === 'SUBMITTED';
      } catch (e) {
        return false;
      }
    },
  });

  if (!submitOk) {
    errorRate.add(1);
  }

  // 5. Test Submission Idempotency: Duplicate Submit
  sleep(1);
  const dupSubmitRes = http.post(
    `${BASE_URL}/api/assessment/submit`,
    JSON.stringify({ finalAnswers: answersSubmitted }),
    { headers, jar }
  );

  check(dupSubmitRes, {
    'duplicate submit is idempotent (200)': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(2);
}
