/**
 * ============================================================================
 * VERIFICACIÓN DE AUDITORÍA ADVERSARIAL V2 — NAMASTÉ
 * Pruebas automatizadas de los 5 puntos críticos y pendientes de validación
 * ============================================================================
 */
import http from 'node:http';

async function runAdversarialAudit() {
  console.log('\n================================================================');
  console.log('    EJECUTANDO VALIDACIÓN RIGUROSA POST-AUDITORÍA ADVERSARIAL V2   ');
  console.log('================================================================\n');

  // FASE 1: Servidor SIN ADMIN_PASSWORD (Simular omisión de env var)
  delete process.env.ADMIN_PASSWORD;

  const { handleRequest } = await import('../server.js');

  const testServer = http.createServer(handleRequest);
  const TEST_PORT = 3847;

  await new Promise((resolve) => testServer.listen(TEST_PORT, resolve));
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, message, detail = '') {
    if (condition) {
      passed++;
      console.log(`  [PASS] ${message}`);
    } else {
      failed++;
      console.error(`  [FAIL] ${message} -> ${detail}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // PUNTO 1: NAM-008 (FAIL-CLOSED Y CREDENCIALES POR DEFECTO)
    // -------------------------------------------------------------
    console.log('\n--- 1. VALIDACIÓN DE NAM-008 (FAIL-CLOSED SIN ADMIN_PASSWORD) ---');

    // 1.1 Intentar login de admin con 'valeria2026'
    const resAdminValeria = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'valeria.manassero@namaste.com', password: 'valeria2026' })
    });
    const dataAdminValeria = await resAdminValeria.json();
    assert(
      resAdminValeria.status === 401 && dataAdminValeria.success === false,
      'Login admin con valeria2026 es RECHAZADO (HTTP 401, success: false)',
      `Status: ${resAdminValeria.status}, Message: ${dataAdminValeria.message}`
    );

    // 1.2 Intentar login de admin con cualquier password arbitrario sin ADMIN_PASSWORD
    const resAdminAny = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'valeria.manassero@namaste.com', password: 'RandomPassword123!' })
    });
    const dataAdminAny = await resAdminAny.json();
    assert(
      resAdminAny.status === 401 && dataAdminAny.success === false,
      'Login admin sin ADMIN_PASSWORD en env es completamente BLOQUEADO (Fail-Closed HTTP 401)',
      `Status: ${resAdminAny.status}, Message: ${dataAdminAny.message}`
    );

    // 1.3 Intentar login con 'namaste123'
    const resStudentNamaste = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'sofia.varela@ejemplo.com', password: 'namaste123' })
    });
    const dataStudentNamaste = await resStudentNamaste.json();
    assert(
      resStudentNamaste.status === 401 && dataStudentNamaste.success === false,
      'Login alumna con contraseña por defecto "namaste123" es RECHAZADO (HTTP 401)',
      `Status: ${resStudentNamaste.status}, Message: ${dataStudentNamaste.message}`
    );

    // -------------------------------------------------------------
    // PUNTO 2: CHECKOUT SIN PASSWORD
    // -------------------------------------------------------------
    console.log('\n--- 2. VALIDACIÓN DE CHECKOUT SIN CONTRASEÑA ---');

    // 2.1 Checkout omitiendo el campo password
    const resCheckoutNoPwd = await fetch(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alumna Sin Clave',
        email: `test-nopwd-${Date.now()}@test.com`,
        planId: 'plan-esencia',
        isAnnual: false,
        paymentMethod: 'mercadopago'
      })
    });
    const dataCheckoutNoPwd = await resCheckoutNoPwd.json();
    assert(
      resCheckoutNoPwd.status === 400 && dataCheckoutNoPwd.success === false,
      'Checkout sin contraseña es RECHAZADO (HTTP 400)',
      `Status: ${resCheckoutNoPwd.status}, Message: ${dataCheckoutNoPwd.message}`
    );

    // 2.2 Checkout con password menor a 6 caracteres
    const resCheckoutShortPwd = await fetch(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alumna Clave Corta',
        email: `test-shortpwd-${Date.now()}@test.com`,
        password: '123',
        planId: 'plan-esencia',
        isAnnual: false,
        paymentMethod: 'mercadopago'
      })
    });
    const dataCheckoutShortPwd = await resCheckoutShortPwd.json();
    assert(
      resCheckoutShortPwd.status === 400 && dataCheckoutShortPwd.success === false,
      'Checkout con contraseña corta (<6) es RECHAZADO (HTTP 400)',
      `Status: ${resCheckoutShortPwd.status}, Message: ${dataCheckoutShortPwd.message}`
    );

    // 2.3 Checkout exitoso con contraseña segura
    const testStudentEmail = `alumna-${Date.now()}@shala-test.com`;
    const testStudentPass = 'MiClaveSegura2026!';
    const resCheckoutOk = await fetch(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alumna Legítima',
        email: testStudentEmail,
        password: testStudentPass,
        planId: 'plan-esencia',
        isAnnual: false,
        paymentMethod: 'mercadopago'
      })
    });
    const dataCheckoutOk = await resCheckoutOk.json();
    assert(
      resCheckoutOk.status === 200 && dataCheckoutOk.success === true,
      'Checkout con contraseña válida se crea exitosamente (HTTP 200)',
      `Status: ${resCheckoutOk.status}`
    );

    // -------------------------------------------------------------
    // PUNTO 3: CORS (ORIGIN REFLECTION & RESTRICTION)
    // -------------------------------------------------------------
    console.log('\n--- 3. VALIDACIÓN DE POLÍTICA CORS ---');

    // 3.1 Petición sin cabecera Origin
    const resNoOrigin = await fetch(`${BASE_URL}/api/health`);
    const allowOriginNoOrigin = resNoOrigin.headers.get('access-control-allow-origin');
    assert(
      allowOriginNoOrigin === null,
      'Petición sin cabecera Origin NO devuelve Access-Control-Allow-Origin (nunca "*")',
      `Valor obtenido: ${allowOriginNoOrigin}`
    );

    // 3.2 Petición con Origin no autorizado (ej: atacante)
    const resUntrustedOrigin = await fetch(`${BASE_URL}/api/health`, {
      headers: { 'Origin': 'https://evil-attacker-website.com' }
    });
    const allowOriginUntrusted = resUntrustedOrigin.headers.get('access-control-allow-origin');
    assert(
      allowOriginUntrusted === null,
      'Petición con Origin no autorizado NO refleja el origen (Access-Control-Allow-Origin ausente)',
      `Valor obtenido: ${allowOriginUntrusted}`
    );

    // 3.3 OPTIONS Preflight con Origin no autorizado -> 403 Forbidden
    const resPreflightUntrusted = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://evil-attacker-website.com',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert(
      resPreflightUntrusted.status === 403,
      'Preflight OPTIONS con Origin no autorizado devuelve HTTP 403 Forbidden',
      `Status: ${resPreflightUntrusted.status}`
    );

    // 3.4 Petición con Origin autorizado (ej: namasteyoga.com.ar)
    const resTrustedOrigin = await fetch(`${BASE_URL}/api/health`, {
      headers: { 'Origin': 'https://namasteyoga.com.ar' }
    });
    const allowOriginTrusted = resTrustedOrigin.headers.get('access-control-allow-origin');
    assert(
      allowOriginTrusted === 'https://namasteyoga.com.ar',
      'Petición con Origin autorizado refleja exactamente el dominio permitido',
      `Valor obtenido: ${allowOriginTrusted}`
    );

    // -------------------------------------------------------------
    // PUNTO 4: EDICIÓN DE PLANES (PROTOTYPE POLLUTION & ALLOWLIST)
    // -------------------------------------------------------------
    console.log('\n--- 4. VALIDACIÓN DE EDICIÓN DE PLANES (ALLOWLIST Y PROTOTYPE POLLUTION) ---');

    // 4.1 Acceso no autenticado a /api/admin/plans -> 403 Forbidden
    const resPlansUnauth = await fetch(`${BASE_URL}/api/admin/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'plan-esencia': { priceMonthly: 30000 } })
    });
    assert(
      resPlansUnauth.status === 403,
      'Acceso no autenticado a POST /api/admin/plans es bloqueado con HTTP 403 Forbidden',
      `Status: ${resPlansUnauth.status}`
    );

    // 4.2 Configuración en entorno de ADMIN_PASSWORD legítima
    process.env.ADMIN_PASSWORD = 'DirectoraSuperSegura2026!';
    
    // Login con ADMIN_PASSWORD configurada
    const resLoginAdminOk = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'valeria.manassero@namaste.com', password: 'DirectoraSuperSegura2026!' })
    });
    const dataLoginAdminOk = await resLoginAdminOk.json();
    const liveAdminToken = dataLoginAdminOk.token;

    assert(
      resLoginAdminOk.status === 200 && Boolean(liveAdminToken),
      'Login admin con ADMIN_PASSWORD configurada es exitoso y emite token',
      `Status: ${resLoginAdminOk.status}`
    );

    // Intentar login con valeria2026 AÚN con ADMIN_PASSWORD configurada -> debe ser 401
    const resValeriaStillBlocked = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'valeria.manassero@namaste.com', password: 'valeria2026' })
    });
    assert(
      resValeriaStillBlocked.status === 401,
      'Login admin con "valeria2026" sigue RECHAZADO (HTTP 401) incluso con ADMIN_PASSWORD configurada',
      `Status: ${resValeriaStillBlocked.status}`
    );

    // 4.3 Intentar payload de Prototype Pollution en POST /api/admin/plans autenticado
    const pollutionPayload = JSON.parse('{"__proto__": {"polluted": true}}');
    const resPollution = await fetch(`${BASE_URL}/api/admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${liveAdminToken}`
      },
      body: JSON.stringify(pollutionPayload)
    });

    const isPolluted = ({}).polluted === true;
    assert(
      !isPolluted,
      'Payload de inyección "__proto__" NO contamina Object.prototype (Anti-Prototype Pollution)',
      `Object.prototype.polluted: ${isPolluted}`
    );

    // 4.4 Intentar inyectar un plan no existente en allowlist (ej: plan-malicioso)
    const resInjectPlan = await fetch(`${BASE_URL}/api/admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${liveAdminToken}`
      },
      body: JSON.stringify({
        'plan-malicioso': { priceMonthly: 1, name: 'Plan Inyectado' }
      })
    });
    const dataInjectPlan = await resInjectPlan.json();
    assert(
      dataInjectPlan.plans && !dataInjectPlan.plans['plan-malicioso'],
      'Inyección de ID de plan arbitrario ("plan-malicioso") es descartada por allowlist',
      `Planes resultantes: ${Object.keys(dataInjectPlan.plans || {}).join(', ')}`
    );

    // 4.5 Intentar inyectar campo no permitido en plan legítimo (ej: backdoor o datos no autorizados)
    const resInjectField = await fetch(`${BASE_URL}/api/admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${liveAdminToken}`
      },
      body: JSON.stringify({
        'plan-esencia': {
          priceMonthly: 31500,
          injectedForbiddenField: 'exploit_data'
        }
      })
    });
    const dataInjectField = await resInjectField.json();
    const updatedEsencia = (dataInjectField.plans || {})['plan-esencia'] || {};
    assert(
      updatedEsencia.priceMonthly === 31500 &&
      updatedEsencia.injectedForbiddenField === undefined,
      'Solo campos en ALLOWED_FIELDS se actualizan; campos no permitidos son estrictamente ignorados',
      `priceMonthly: ${updatedEsencia.priceMonthly}, injected: ${updatedEsencia.injectedForbiddenField}`
    );

    // -------------------------------------------------------------
    // PUNTO 5: RATE LIMITING & IP SPOOFING (ROTACIÓN X-FORWARDED-FOR)
    // -------------------------------------------------------------
    console.log('\n--- 5. VALIDACIÓN DE RATE LIMITING & MITIGACIÓN DE IP SPOOFING ---');

    const bruteTargetEmail = `target-victim-${Date.now()}@shala.com`;
    // Intentar 5 intentos fallidos rotando X-Forwarded-For simulando una botnet o evasión
    for (let i = 1; i <= 5; i++) {
      await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `192.168.1.${100 + i}, 10.0.0.1` // rotando IP falsificada
        },
        body: JSON.stringify({ identifier: bruteTargetEmail, password: `bad-pwd-${i}` })
      });
    }

    // El 6to intento para la misma cuenta debe ser bloqueado con 429 independientemente de la IP
    const resRateLimited = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.99' // nueva IP distinta
      },
      body: JSON.stringify({ identifier: bruteTargetEmail, password: 'another-bad-pwd' })
    });
    const dataRateLimited = await resRateLimited.json();
    assert(
      resRateLimited.status === 429 && dataRateLimited.success === false,
      'Rate limiting bloquea ataques de fuerza bruta por cuenta (HTTP 429) neutralizando rotación de X-Forwarded-For',
      `Status: ${resRateLimited.status}, Message: ${dataRateLimited.message}`
    );

  } catch (error) {
    console.error('Error durante la ejecución del test suite:', error);
  } finally {
    testServer.close();
  }

  console.log('\n================================================================');
  console.log(`    RESULTADO FINAL: ${passed} PASADOS, ${failed} FALLADOS`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAdversarialAudit();
