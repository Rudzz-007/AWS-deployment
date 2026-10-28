const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function isServerRunning() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerRunning()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function runTests() {
  let serverProcess = null;

  if (!(await isServerRunning())) {
    console.log(`[Test Runner] Server is not running on port ${PORT}. Spawning test server...`);
    serverProcess = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
      env: { ...process.env, PORT: String(PORT), FORCE_MOCK_MODE: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stderr.on('data', () => {});

    const ready = await waitForServer(8000);
    if (!ready) {
      if (serverProcess) serverProcess.kill();
      throw new Error(`Test server failed to start within 8 seconds on port ${PORT}.`);
    }
    console.log('[Test Runner] Test server started successfully.\n');
  } else {
    console.log(`[Test Runner] Connected to existing server running on port ${PORT}.\n`);
  }

  try {
    console.log('--- 1. Testing GET /health ---');
    let res = await fetch(`${BASE_URL}/health`);
    let data = await res.json();
    console.log('Health check:', data);
    if (data.status !== 'ok') throw new Error('Health check failed: expected status "ok"');

    console.log('\n--- 2. Testing GET /api/status ---');
    res = await fetch(`${BASE_URL}/api/status`);
    data = await res.json();
    console.log('Storage Status:', data.data);
    if (!data.success) throw new Error('Status API failed');

    console.log('\n--- 3. Testing GET /api/students ---');
    res = await fetch(`${BASE_URL}/api/students`);
    data = await res.json();
    console.log(`Found ${data.count} students. First student:`, data.data[0]);

    console.log('\n--- 4. Testing POST /api/students (Add new student) ---');
    const newStudent = {
      studentId: 'STU-TEST-' + Date.now(),
      name: 'Jordan Miller',
      course: 'Cloud Computing & AWS Architecture',
      email: 'jordan.miller@example.com',
    };
    res = await fetch(`${BASE_URL}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newStudent),
    });
    data = await res.json();
    console.log('Create result:', data);
    if (!data.success) throw new Error('Create student failed: ' + data.message);

    console.log(`\n--- 5. Testing GET /api/students/${newStudent.studentId} ---`);
    res = await fetch(`${BASE_URL}/api/students/${newStudent.studentId}`);
    data = await res.json();
    console.log('Get by ID result:', data);
    if (!data.success || data.data.studentId !== newStudent.studentId) {
      throw new Error('Get by ID failed');
    }

    console.log(`\n--- 6. Testing DELETE /api/students/${newStudent.studentId} ---`);
    res = await fetch(`${BASE_URL}/api/students/${newStudent.studentId}`, { method: 'DELETE' });
    data = await res.json();
    console.log('Delete result:', data);
    if (!data.success) throw new Error('Delete student failed: ' + data.message);

    console.log('\n--- 7. Verify student list after deletion ---');
    res = await fetch(`${BASE_URL}/api/students/${newStudent.studentId}`);
    if (res.status !== 404) {
      throw new Error('Student should have been deleted (expected 404)');
    }
    console.log('Verified: deleted student returns 404.');

    console.log('\n🎉 All API CRUD & Health Check tests passed successfully!');
  } finally {
    if (serverProcess) {
      console.log('[Test Runner] Stopping test server...');
      serverProcess.kill();
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
