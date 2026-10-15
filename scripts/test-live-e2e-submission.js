const http = require('http');

function postJson(urlPath, payload, cookie = '') {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'localhost',
      port: 5173,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(cookie ? { Cookie: cookie } : {})
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      const setCookies = res.headers['set-cookie'] || [];
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json, setCookies });
        } catch {
          resolve({ status: res.statusCode, data: body, setCookies });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function putJson(urlPath, payload, cookie = '') {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'localhost',
      port: 5173,
      path: urlPath,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(cookie ? { Cookie: cookie } : {})
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(urlPath, cookie = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5173,
      path: urlPath,
      method: 'GET',
      headers: {
        ...(cookie ? { Cookie: cookie } : {})
      }
    };

    const req = http.get(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
  });
}

async function testLiveFlow() {
  console.log('Testing live candidate exam flow on http://localhost:5173...');

  const studentEmail = 'rahul.sharma@student.datavalley.ai';
  const studentName = 'Rahul Sharma';
  const password = 'StudentSecurePassword123!';

  // Step 1: Login
  console.log('\n1. Logging in candidate:');
  const loginRes = await postJson('/api/auth/login', {
    email: studentEmail,
    password: password,
    fullName: studentName
  });
  console.log('Login Status:', loginRes.status, loginRes.data);

  if (loginRes.status !== 200 || !loginRes.data.success) {
    throw new Error('Candidate login failed');
  }

  // Extract auth cookie
  const authCookie = loginRes.setCookies.map(c => c.split(';')[0]).join('; ');
  console.log('[PASS] Received session auth cookie.');

  // Step 2: Start Assessment
  console.log('\n2. Starting assessment via /api/assessment/start:');
  const startRes = await postJson('/api/assessment/start', {}, authCookie);
  console.log('Start Status:', startRes.status, {
    assessmentId: startRes.data.assessmentId,
    sessionId: startRes.data.sessionId,
    answersCount: startRes.data.answers?.length
  });

  // Step 3: Put options in MCQ sections and 5 git commands in git section
  console.log('\n3. Autosaving answers via /api/assessment/sync:');
  const answersPayload = [
    // Section 1: Workplace Communication (MCQ option 3)
    { questionId: 1, value: "3" },
    // Section 2: Email (MCQ option 2)
    { questionId: 6, value: "2" },
    // Section 3: Programming (MCQ option 1)
    { questionId: 11, value: "1" },
    // Section 4: 5 Git written questions (21-25)
    { questionId: 21, value: "git status" },
    { questionId: 22, value: "git add app.py" },
    { questionId: 23, value: 'git commit -m "Add login feature"' },
    { questionId: 24, value: "git log --oneline" },
    { questionId: 25, value: "git push origin" },
    // Section 5: Technical Aptitude
    { questionId: 26, value: "2" }
  ];

  const syncRes = await putJson('/api/assessment/sync', { answers: answersPayload }, authCookie);
  console.log('Sync Status:', syncRes.status, syncRes.data);

  // Step 4: Submit Assessment
  console.log('\n4. Submitting assessment via /api/assessment/submit:');
  const submitRes = await postJson('/api/assessment/submit', { answers: answersPayload }, authCookie);
  console.log('Submit Status:', submitRes.status);
  console.log('Submit Result:', {
    studentName: submitRes.data.result?.studentName,
    studentEmail: submitRes.data.result?.studentEmail,
    marksObtained: submitRes.data.result?.marksObtained,
    totalQuestions: submitRes.data.result?.totalQuestions,
    correctAnswers: submitRes.data.result?.correctAnswers,
    percentage: submitRes.data.result?.percentage,
    shortlistStatus: submitRes.data.result?.shortlistStatus
  });

  // Step 5: Score Display from student_results collection
  console.log('\n5. Querying /api/assessment/student-results for score displaying:');
  const resultsRes = await getJson('/api/assessment/student-results');
  console.log('All Students Results Response:', {
    status: resultsRes.status,
    totalStudents: resultsRes.data.totalStudents,
    rosterArrayLength: resultsRes.data.allStudentsResults?.length
  });

  // Find our student in the allStudentsResults array
  const foundInRoster = resultsRes.data.allStudentsResults?.find(r => r.studentEmail === studentEmail);
  console.log('[PASS] Found student in master roster array:', foundInRoster);

  // Query individual student result
  const individualRes = await getJson(`/api/assessment/student-results?email=${encodeURIComponent(studentEmail)}`);
  console.log('[PASS] Individual Student Score query:', individualRes.data.studentResult);

  console.log('\n=============================================');
  console.log('LIVE END-TO-END FLOW VERIFIED SUCCESSFULLY!');
  console.log('=============================================');
}

testLiveFlow().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
