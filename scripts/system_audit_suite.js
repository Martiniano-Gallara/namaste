import { initDbPool } from '../db.js';
import crypto from 'node:crypto';

const BASE_URL = 'http://localhost:3000';

async function runAudit() {
  console.log('\n===============================================================');
  console.log('       INICIANDO AUDITORÍA INTEGRAL DE SISTEMA - NAMASTÉ       ');
  console.log('===============================================================\n');

  const report = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
  };

  function assert(condition, testName, note = '') {
    report.totalTests++;
    if (condition) {
      report.passed++;
      console.log(`  [OK] ${testName}`);
      report.details.push({ test: testName, status: 'PASSED', note });
    } else {
      report.failed++;
      console.error(`  [FALLO] ${testName} - ${note}`);
      report.details.push({ test: testName, status: 'FAILED', note });
    }
  }

  function warn(testName, note = '') {
    report.warnings++;
    console.warn(`  [ADVERTENCIA] ${testName} - ${note}`);
    report.details.push({ test: testName, status: 'WARNING', note });
  }

  // -------------------------------------------------------------
  // 1. AUDITORÍA DE CONECTIVIDAD & SERVIDOR
  // -------------------------------------------------------------
  console.log('\n--- 1. CONECTIVIDAD & DISPONIBILIDAD DEL SERVIDOR ---');
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert(healthRes.status === 200, 'Endpoint /api/health responde con código HTTP 200');
    const healthData = await healthRes.json();
    assert(healthData.status === 'ok', 'Health status reporta "ok"');
    assert(healthData.poolReady === true, 'Conexión a PostgreSQL en Supabase lista y activa');
  } catch (err) {
    assert(false, 'Servidor accesible en puerto 3000', err.message);
  }

  // -------------------------------------------------------------
  // 2. AUDITORÍA DE SEGURIDAD EN ARCHIVOS ESTÁTICOS & PATH TRAVERSAL
  // -------------------------------------------------------------
  console.log('\n--- 2. PROTECCIÓN DE CÓDIGO FUENTE & CONTROL DE ACCESO WEB ---');
  try {
    const blockServer = await fetch(`${BASE_URL}/server.js`);
    assert(blockServer.status === 403, 'Bloqueo estricto de server.js (código HTTP 403)');

    const blockDb = await fetch(`${BASE_URL}/db.js`);
    assert(blockDb.status === 403, 'Bloqueo estricto de db.js (código HTTP 403)');

    const blockEnv = await fetch(`${BASE_URL}/.env`);
    assert(blockEnv.status === 403, 'Bloqueo estricto de .env (código HTTP 403)');

    const blockTraversal = await fetch(`${BASE_URL}/..%2f..%2fpackage.json`);
    assert(blockTraversal.status === 403 || blockTraversal.status === 404, 'Protección contra Directory Traversal');

    const indexRes = await fetch(`${BASE_URL}/index.html`);
    assert(indexRes.status === 200, 'Entrega de index.html público HTTP 200');
    const indexText = await indexRes.text();
    assert(indexText.includes('Plan Esencia') && indexText.includes('Plan Refugio'), 'index.html contiene los planes oficiales');
    assert(!indexText.includes('19.000'), 'index.html NO contiene precio desactualizado $19.000');
    assert(!indexText.includes('data-plan="plan-sadhana"'), 'index.html eliminó la tarjeta obsoleta plan-sadhana');
  } catch (err) {
    assert(false, 'Inspección de archivos estáticos', err.message);
  }

  // -------------------------------------------------------------
  // 3. AUDITORÍA DE PLANES Y PRECIOS EN BASE DE DATOS Y MEMORIA
  // -------------------------------------------------------------
  console.log('\n--- 3. CATÁLOGO DE PLANES & BASE DE DATOS SUPABASE ---');
  const pool = initDbPool();
  try {
    if (pool) {
      const dbPlansRes = await pool.query('SELECT * FROM plans ORDER BY price_monthly ASC');
      assert(dbPlansRes.rows.length === 2, `Supabase tiene exactamente 2 planes oficiales (obtenidos: ${dbPlansRes.rows.length})`);

      const esencia = dbPlansRes.rows.find(p => p.id === 'plan-esencia');
      const refugio = dbPlansRes.rows.find(p => p.id === 'plan-refugio');

      assert(Boolean(esencia), 'Plan Esencia existe en tabla plans de Supabase');
      if (esencia) {
        assert(Number(esencia.price_monthly) === 29000, `Plan Esencia precio mensual es 29000 (actual: ${esencia.price_monthly})`);
        assert(Number(esencia.price_annual_total) === 290000, `Plan Esencia precio anual es 290000 (actual: ${esencia.price_annual_total})`);
        const feats = Array.isArray(esencia.features) ? esencia.features : JSON.parse(esencia.features || '[]');
        assert(feats.includes('Clases de Hatha Yoga Clásico'), 'Plan Esencia incluye Hatha Yoga Clásico');
        assert(feats.includes('Hatha Yoga Kinésico Terapéutico'), 'Plan Esencia incluye Hatha Yoga Kinésico Terapéutico');
        assert(feats.includes('Meditaciones guiadas'), 'Plan Esencia incluye Meditaciones guiadas');
      }

      assert(Boolean(refugio), 'Plan Refugio existe en tabla plans de Supabase');
      if (refugio) {
        assert(Number(refugio.price_monthly) === 39000, `Plan Refugio precio mensual es 39000 (actual: ${refugio.price_monthly})`);
        assert(Number(refugio.price_annual_total) === 390000, `Plan Refugio precio anual es 390000 (actual: ${refugio.price_annual_total})`);
        const feats = Array.isArray(refugio.features) ? refugio.features : JSON.parse(refugio.features || '[]');
        assert(feats.includes('Clases de Hatha Yoga Clásico'), 'Plan Refugio incluye Hatha Yoga Clásico');
        assert(feats.includes('Hatha Yoga Kinésico Terapéutico'), 'Plan Refugio incluye Hatha Yoga Kinésico Terapéutico');
        assert(feats.includes('Hatha Yoga Dinámico'), 'Plan Refugio incluye Hatha Yoga Dinámico');
        assert(feats.includes('Vinyasa Flow'), 'Plan Refugio incluye Vinyasa Flow');
        assert(feats.includes('Ashtanga'), 'Plan Refugio incluye Ashtanga');
        assert(feats.includes('Meditaciones guiadas'), 'Plan Refugio incluye Meditaciones guiadas');
        assert(feats.includes('Masterclasses exclusivas'), 'Plan Refugio incluye Masterclasses exclusivas');
      }
    } else {
      warn('Conexión PostgreSQL', 'No se pudo inicializar pgPool directamente');
    }
  } catch (err) {
    assert(false, 'Consulta SQL de planes en Supabase', err.message);
  }

  // -------------------------------------------------------------
  // 4. AUDITORÍA DE AUTENTICACIÓN, SESIONES & ROLES
  // -------------------------------------------------------------
  console.log('\n--- 4. AUTENTICACIÓN, ROLES Y CONTROL DE SESIÓN ---');
  let adminToken = '';
  let studentToken = '';

  try {
    // 4.1 Login Admin
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'valeria.manassero@namaste.com', password: 'valeria2026' })
    });
    assert(adminLoginRes.status === 200, 'Login Directora / Admin exitoso (HTTP 200)');
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginData.success === true, 'Respuesta de login admin exitosa');
    assert(adminLoginData.user && adminLoginData.user.isAdmin === true, 'Usuario administrador identificado con isAdmin: true');
    adminToken = adminLoginData.token || '';
    assert(Boolean(adminToken), 'Token de sesión JWT/Bearer generado para administración');

    // 4.2 Login Alumna
    const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'sofia.varela@ejemplo.com', password: 'namaste123' })
    });
    assert(studentLoginRes.status === 200, 'Login Alumna exitoso (HTTP 200)');
    const studentLoginData = await studentLoginRes.json();
    assert(studentLoginData.success === true, 'Respuesta de login alumna exitosa');
    assert(studentLoginData.user && studentLoginData.user.planId === 'plan-refugio', 'Alumna Sofía posee Plan Refugio');
    studentToken = studentLoginData.token || '';

    // 4.3 Login Fallido
    const failLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'sofia.varela@ejemplo.com', password: 'clave-incorrecta' })
    });
    assert(failLoginRes.status === 401, 'Rechazo de contraseña incorrecta con HTTP 401');

    // 4.4 Intento de Alumna accediendo a endpoints de Admin
    const forbiddenRes = await fetch(`${BASE_URL}/api/admin/overview`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert(forbiddenRes.status === 403, 'Bloqueo de acceso de alumna a panel de admin (HTTP 403 Forbidden)');

    // 4.5 Acceso anónimo a endpoints de Admin
    const unauthRes = await fetch(`${BASE_URL}/api/admin/overview`);
    assert(unauthRes.status === 401 || unauthRes.status === 403, 'Bloqueo de acceso no autenticado a admin (HTTP 401/403)');
  } catch (err) {
    assert(false, 'Módulo de autenticación y autorización', err.message);
  }

  // -------------------------------------------------------------
  // 5. AUDITORÍA DE CHECKOUT & MERCADO PAGO
  // -------------------------------------------------------------
  console.log('\n--- 5. PROCESO DE CHECKOUT & ENLACES DE MERCADO PAGO ---');
  const tempAuditEmail1 = `audit_esencia_${Date.now()}@namaste.com`;
  const tempAuditEmail2 = `audit_refugio_${Date.now()}@namaste.com`;

  try {
    // 5.1 Registro Plan Esencia Mensual
    const chkEsenciaRes = await fetch(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Auditoría Esencia',
        email: tempAuditEmail1,
        password: 'passwordSegura2026',
        planId: 'plan-esencia',
        isAnnual: false
      })
    });
    assert(chkEsenciaRes.status === 200, 'Checkout Plan Esencia HTTP 200');
    const chkEsenciaData = await chkEsenciaRes.json();
    assert(chkEsenciaData.success === true, 'Checkout Esencia registrado como exitoso');
    assert(chkEsenciaData.pending === true, 'Cuenta registrada con estado pendiente de pago');
    assert(chkEsenciaData.transaction && chkEsenciaData.transaction.amount === 29000, `Monto de transacción Esencia es $ 29.000 (actual: ${chkEsenciaData.transaction?.amount})`);
    assert(chkEsenciaData.checkoutUrl && chkEsenciaData.checkoutUrl.includes('external_reference='), 'Enlace de Mercado Pago contiene external_reference única');

    // 5.2 Registro Plan Refugio Mensual
    const chkRefugioRes = await fetch(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Auditoría Refugio',
        email: tempAuditEmail2,
        password: 'passwordSegura2026',
        planId: 'plan-refugio',
        isAnnual: false
      })
    });
    assert(chkRefugioRes.status === 200, 'Checkout Plan Refugio HTTP 200');
    const chkRefugioData = await chkRefugioRes.json();
    assert(chkRefugioData.transaction && chkRefugioData.transaction.amount === 39000, `Monto de transacción Refugio es $ 39.000 (actual: ${chkRefugioData.transaction?.amount})`);

    // 5.3 Validación contra Plan Inválido (Prevención de inyecciones)
    const chkBadPlan = await fetch(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Auditoría Ataque',
        email: 'attacker@namaste.com',
        password: 'passwordSegura2026',
        planId: 'plan-inexistente-hack',
        isAnnual: false
      })
    });
    assert(chkBadPlan.status === 400, 'Rechazo de plan no existente o malicioso (HTTP 400)');
  } catch (err) {
    assert(false, 'Módulo de checkout y facturación', err.message);
  }

  // -------------------------------------------------------------
  // 6. AUDITORÍA DEL PANEL DE ADMINISTRACIÓN
  // -------------------------------------------------------------
  console.log('\n--- 6. FUNCIONALIDADES DEL PANEL DE ADMINISTRACIÓN ---');
  try {
    // 6.1 Obtención de Métricas
    const ovRes = await fetch(`${BASE_URL}/api/admin/overview`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(ovRes.status === 200, 'Consulta de métricas globales /api/admin/overview HTTP 200');
    const ovData = await ovRes.json();
    assert(ovData.success === true, 'Respuesta de métricas exitosa');
    assert(typeof ovData.stats?.totalUsers === 'number', `Conteo de alumnas totales presente en stats (${ovData.stats?.totalUsers})`);
    assert(Array.isArray(ovData.recentLogs), 'Pista de auditoría recentLogs presente');

    // 6.2 Obtención de Planes Administrativos
    const plansAdminRes = await fetch(`${BASE_URL}/api/admin/plans`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(plansAdminRes.status === 200, 'Consulta de planes administrativos /api/admin/plans HTTP 200');
    const plansAdminData = await plansAdminRes.json();
    assert(Boolean(plansAdminData.plans['plan-esencia']), 'Plan Esencia disponible en admin');
    assert(Boolean(plansAdminData.plans['plan-refugio']), 'Plan Refugio disponible en admin');
    assert(plansAdminData.plans['plan-esencia'].priceMonthly === 29000, 'Precio administrativo de Esencia es $ 29.000');
    assert(plansAdminData.plans['plan-refugio'].priceMonthly === 39000, 'Precio administrativo de Refugio es $ 39.000');

    // 6.3 Listado de Clases
    const classesRes = await fetch(`${BASE_URL}/api/classes`);
    assert(classesRes.status === 200, 'Listado público de clases HTTP 200');
    const classesData = await classesRes.json();
    const clList = classesData.classes || [];
    assert(clList.length > 0, `Catálogo de clases activo (${clList.length} prácticas registradas)`);

    const clsTerapeutico = clList.find(c => c.category === 'terapeutico');
    if (clsTerapeutico) {
      assert(clsTerapeutico.planRequired === 'plan-esencia', 'Clase terapéutica accesible con Plan Esencia');
    }

    const clsDinamico = clList.find(c => c.category === 'dinamico');
    if (clsDinamico) {
      assert(clsDinamico.planRequired === 'plan-refugio', 'Clase dinámica requiere Plan Refugio');
    }

    const clsAshtanga = clList.find(c => c.category === 'ashtanga');
    if (clsAshtanga) {
      assert(clsAshtanga.planRequired === 'plan-refugio', 'Clase de Ashtanga requiere Plan Refugio');
    }
  } catch (err) {
    assert(false, 'Pruebas de panel de administración y clases', err.message);
  }

  // -------------------------------------------------------------
  // 7. LIMPIEZA DE DATOS GENERADOS EN LA AUDITORÍA
  // -------------------------------------------------------------
  console.log('\n--- 7. SANEAMIENTO POST-AUDITORÍA ---');
  try {
    if (pool) {
      await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [tempAuditEmail1, tempAuditEmail2]);
      await pool.query('DELETE FROM transactions WHERE email IN ($1, $2)', [tempAuditEmail1, tempAuditEmail2]);
      console.log('  [OK] Cuentas de prueba de auditoría removidas de Supabase.');
    }
  } catch (err) {
    warn('Limpieza de auditoría', err.message);
  } finally {
    if (pool) await pool.end();
  }

  // -------------------------------------------------------------
  // RESUMEN FINAL
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(` RESULTADOS: ${report.passed}/${report.totalTests} PASADOS | ${report.failed} FALLOS | ${report.warnings} AVISOS`);
  console.log('===============================================================\n');

  return report;
}

runAudit();
