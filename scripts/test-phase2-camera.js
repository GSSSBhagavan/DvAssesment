/**
 * Phase 2 Camera Readiness Tests
 * Verifies camera readiness checks, permissions handling, error mapping, and stream lifecycle.
 */

let passed = 0;
let failed = 0;

function assert(condition, label, details) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} ${details ? '(' + JSON.stringify(details) + ')' : ''}`);
    failed++;
  }
}

function setMockNavigator(navObj) {
  Object.defineProperty(globalThis, 'navigator', {
    value: navObj,
    configurable: true,
    writable: true
  });
}

async function runTests() {
  console.log('\n=== PHASE 2: CAMERA READINESS & API TESTS ===\n');

  // Test 1: Unsupported environment (no mediaDevices)
  globalThis.window = {};
  setMockNavigator({});
  
  const { checkCameraSupport, requestCameraPermission } = require('../src/lib/readiness/readinessEngine.ts');

  console.log('Test 1: Unsupported browser without mediaDevices');
  const res1 = await checkCameraSupport();
  assert(res1.status === 'failed', 'checkCameraSupport fails when mediaDevices missing', res1);
  assert(res1.message.includes('strictly blocked or unsupported'), 'Error message describes missing API');

  const req1 = await requestCameraPermission();
  assert(req1.status === 'failed', 'requestCameraPermission fails when mediaDevices missing', req1);

  // Test 2: Permission already granted via permissions API
  console.log('\nTest 2: Permissions API query - granted state');
  setMockNavigator({
    mediaDevices: {
      getUserMedia: async () => ({})
    },
    permissions: {
      query: async (queryObj) => {
        if (queryObj && queryObj.name === 'camera') return { state: 'granted' };
        return { state: 'prompt' };
      }
    }
  });

  const res2 = await checkCameraSupport();
  assert(res2.status === 'passed', 'checkCameraSupport reports passed when granted', res2);

  // Test 3: Permission denied via permissions API
  console.log('\nTest 3: Permissions API query - denied state');
  setMockNavigator({
    mediaDevices: {
      getUserMedia: async () => ({})
    },
    permissions: {
      query: async (queryObj) => {
        if (queryObj && queryObj.name === 'camera') return { state: 'denied' };
        return { state: 'prompt' };
      }
    }
  });

  const res3 = await checkCameraSupport();
  assert(res3.status === 'failed', 'checkCameraSupport reports failed when permission denied', res3);
  assert(res3.message.includes('denied in browser settings'), 'Helpful message explaining browser settings block');

  // Test 4: Request camera permission with active video track
  console.log('\nTest 4: Successful hardware enumeration & track acquisition');
  let stopped = false;
  setMockNavigator({
    mediaDevices: {
      getUserMedia: async (constraints) => {
        assert(constraints.video !== false, 'getUserMedia requests video track');
        assert(constraints.audio === false, 'getUserMedia does NOT request audio track (camera-only scope)');
        return {
          getVideoTracks: () => [
            {
              label: 'Integrated HD Webcam (04f2:b6d9)',
              stop: () => { stopped = true; }
            }
          ]
        };
      }
    }
  });

  const req4 = await requestCameraPermission();
  assert(req4.status === 'passed', 'requestCameraPermission reports passed', req4);
  assert(req4.message.includes('Integrated HD Webcam'), 'Extracts hardware device label');
  assert(stopped === true, 'Readiness test stream stops tracks to release hardware');

  // Test 5: Camera denied on prompt
  console.log('\nTest 5: NotAllowedError handling');
  setMockNavigator({
    mediaDevices: {
      getUserMedia: async () => {
        const err = new Error('Permission denied');
        err.name = 'NotAllowedError';
        throw err;
      }
    }
  });

  const req5 = await requestCameraPermission();
  assert(req5.status === 'failed', 'requestCameraPermission fails gracefully on NotAllowedError', req5);
  assert(req5.message.includes('permission denied'), 'Explains permission denied');

  // Test 6: No physical camera found (NotFoundError)
  console.log('\nTest 6: NotFoundError handling');
  setMockNavigator({
    mediaDevices: {
      getUserMedia: async () => {
        const err = new Error('Device not found');
        err.name = 'NotFoundError';
        throw err;
      }
    }
  });

  const req6 = await requestCameraPermission();
  assert(req6.status === 'failed', 'requestCameraPermission fails gracefully on NotFoundError', req6);
  assert(req6.message.includes('No physical webcam detected'), 'Explains missing hardware');

  // Test 7: Camera in use by another app (NotReadableError)
  console.log('\nTest 7: NotReadableError / busy device');
  setMockNavigator({
    mediaDevices: {
      getUserMedia: async () => {
        const err = new Error('Camera busy');
        err.name = 'NotReadableError';
        throw err;
      }
    }
  });

  const req7 = await requestCameraPermission();
  assert(req7.status === 'failed', 'requestCameraPermission fails gracefully on NotReadableError', req7);
  assert(req7.message.includes('currently in use'), 'Explains device is in use');

  console.log(`\n${'='.repeat(50)}`);
  console.log(`PHASE 2 RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
