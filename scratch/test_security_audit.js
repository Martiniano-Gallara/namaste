import http from 'node:http';
import { handleRequest } from '../server.js';

const server = http.createServer(handleRequest);

async function runTests() {
  await new Promise(resolve => server.listen(3099, resolve));
  console.log('Test server running on port 3099\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  function req(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, 'http://localhost:3099');
      const requestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };
      const r = http.request(requestOptions, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(body); } catch (e) {}
          resolve({ status: res.statusCode, headers: res.headers, body, json });
        });
      });
      r.on('error', reject);
      if (options.body) {
        r.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      r.end();
    });
  }

  // --- PHASE 0: Containment & Static Allowlist ---
  await test('C-07: Blocking /data/database.json', async () => {
    const res = await req('/data/database.json');
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('C-07: Blocking /.env', async () => {
    const res = await req('/.env');
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('C-07: Blocking /server.js', async () => {
    const res = await req('/server.js');
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('C-07: Blocking /package.json', async () => {
    const res = await req('/package.json');
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('C-09: Serving CSS without undefined Pragma header crash', async () => {
    const res = await req('/css/main.css');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.headers['pragma'] !== undefined) throw new Error(`Pragma should not be present on CSS`);
  });

  await test('C-09: Invalid Range header returns 416 without crash', async () => {
    const res = await req('/css/main.css', {
      headers: { 'Range': 'bytes=invalid-abc' }
    });
    // For non-video files or invalid range, server returns 200 or 416 cleanly without crashing
    if (res.status !== 200 && res.status !== 416) throw new Error(`Unexpected status ${res.status}`);
  });

  // --- PHASE 1: Real Authentication ---
  await test('C-01/C-02: Reject login with admin alias without password', async () => {
    const res = await req('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { identifier: 'admin' }
    });
    if (res.status !== 400 && res.status !== 401) throw new Error(`Expected 400/401, got ${res.status}`);
  });

  await test('C-01/C-02: Reject login with wrong password', async () => {
    const res = await req('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { identifier: 'valeria.manassero@namaste.com', password: 'wrong_password_123' }
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await test('C-03: Reject login for non-existent user (no auto-free accounts)', async () => {
    const res = await req('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { identifier: 'hacker_auto_account@exploit.com', password: 'password123' }
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  let adminToken = '';
  await test('Valid admin login with valeria2026', async () => {
    const res = await req('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { identifier: 'valeria.manassero@namaste.com', password: 'valeria2026' }
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.json.token) throw new Error(`Missing token`);
    if (res.json.user.passwordHash || res.json.user.password) throw new Error(`Sensitive password leaked in user response!`);
    adminToken = res.json.token;
  });

  let studentToken = '';
  await test('Valid student login for Sofia with namaste123', async () => {
    const res = await req('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { identifier: 'sofia.varela@ejemplo.com', password: 'namaste123' }
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.json.token) throw new Error(`Missing token`);
    studentToken = res.json.token;
  });

  // --- PHASE 1.5: Admin Authorization (C-04) ---
  await test('C-04: Anonymous request to /api/admin/overview is rejected (403)', async () => {
    const res = await req('/api/admin/overview');
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('C-04: Anonymous request to /api/admin/users is rejected (403)', async () => {
    const res = await req('/api/admin/users');
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('C-04: Student request to /api/admin/overview is rejected (403)', async () => {
    const res = await req('/api/admin/overview', {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('C-04: Admin request to /api/admin/overview succeeds (200)', async () => {
    const res = await req('/api/admin/overview', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await test('A-06: Reject prototype pollution on /api/admin/users/__proto__', async () => {
    const res = await req('/api/admin/users/__proto__', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: { name: 'Polluted' }
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // --- PHASE 2: Checkout & Payment Confirmation (C-06) ---
  await test('C-06: Anonymous call to /api/checkout/confirm is rejected (403)', async () => {
    const res = await req('/api/checkout/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'sofia.varela@ejemplo.com', status: 'approved' }
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // --- PHASE 3: Class & Streaming Protection (A-01, M-06) ---
  await test('M-06: GET /api/classes returns metadata without video stream URLs', async () => {
    const res = await req('/api/classes');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.json.classes || res.json.classes.length === 0) throw new Error(`No classes returned`);
    const leaked = res.json.classes.some(c => c.videoUrl || c.streamUrl);
    if (leaked) throw new Error(`Raw videoUrl leaked in public classes catalog!`);
  });

  await test('A-01: Anonymous stream request /api/classes/cls-suave-01/stream is rejected (401)', async () => {
    const res = await req('/api/classes/cls-suave-01/stream');
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await test('A-01: Plan Esencia student cannot access Ashtanga (403)', async () => {
    // usr-invitado has plan-esencia
    const loginRes = await req('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { identifier: 'invitado@namaste.com', password: 'namaste123' }
    });
    const esenciaToken = loginRes.json.token;

    const streamRes = await req('/api/classes/cls-ashtanga-01/stream', {
      headers: { 'Authorization': `Bearer ${esenciaToken}` }
    });
    if (streamRes.status !== 403) throw new Error(`Expected 403, got ${streamRes.status}`);
  });

  await test('A-01: Plan Esencia student can access Suave class (200)', async () => {
    const loginRes = await req('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { identifier: 'invitado@namaste.com', password: 'namaste123' }
    });
    const esenciaToken = loginRes.json.token;

    const streamRes = await req('/api/classes/cls-suave-01/stream', {
      headers: { 'Authorization': `Bearer ${esenciaToken}` }
    });
    if (streamRes.status !== 200) throw new Error(`Expected 200, got ${streamRes.status}`);
    if (!streamRes.json.streamUrl) throw new Error(`Missing authorized streamUrl`);
  });

  await test('Admin can stream any class (200)', async () => {
    const streamRes = await req('/api/classes/cls-ashtanga-01/stream', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (streamRes.status !== 200) throw new Error(`Expected 200, got ${streamRes.status}`);
  });

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  server.close();
  process.exit(1);
});
