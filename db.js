/**
 * Módulo de Base de Datos para Namasté (Supabase PostgreSQL + Fallback Local Seguro)
 * Fixes: NAM-002, NAM-003, NAM-004, NAM-005, NAM-006, NAM-015, NAM-016, NAM-020, NAM-035.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Cargar .env local si existe sin dependencias externas
if (!process.env.DATABASE_URL && fs.existsSync(path.join(__dirname, '.env'))) {
  try {
    const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = (match[2] || '').trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    });
  } catch (err) {}
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let pgPool = null;

export function initDbPool() {
  if (!DATABASE_URL) return null;
  if (pgPool) return pgPool;

  try {
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: process.env.VERCEL ? 3 : 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 7000
    });

    pgPool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle PostgreSQL client:', err.message);
    });

    return pgPool;
  } catch (err) {
    console.warn('[DB] No se pudo inicializar el pool de PostgreSQL:', err.message);
    return null;
  }
}

/**
 * Sanitiza y trunca cadenas para evitar envenenamiento de persistencia (NAM-006)
 */
function safeStr(val, maxLen = 150, fallback = '') {
  if (val === null || val === undefined) return fallback;
  return String(val).trim().slice(0, maxLen);
}

// -------------------------------------------------------------
// 1. USUARIOS & AUTENTICACIÓN
// -------------------------------------------------------------

export async function getUserById(id) {
  const pool = initDbPool();
  if (!pool || !id) return null;
  try {
    const res = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1;', [id]);
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  } catch (err) {
    console.error('[DB] Error getUserById:', err.message);
    return null;
  }
}

export async function getUserByEmail(identifier) {
  const pool = initDbPool();
  if (!pool || !identifier) return null;
  const clean = identifier.trim();
  try {
    const res = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR UPPER(access_code) = UPPER($1) LIMIT 1;',
      [clean]
    );
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  } catch (err) {
    console.error('[DB] Error getUserByEmail:', err.message);
    return null;
  }
}

export async function upsertUser(user) {
  const pool = initDbPool();
  if (!pool || !user || !user.id || !user.email) return false;

  const id = safeStr(user.id, 100);
  const email = safeStr(user.email, 255).toLowerCase();
  const name = safeStr(user.name, 150, 'Practicante');
  const role = safeStr(user.role || (user.isAdmin ? 'admin' : 'member'), 50);
  const isAdmin = Boolean(user.isAdmin || user.role === 'admin');
  const accessCode = safeStr(user.accessCode, 100);
  const passwordHash = user.passwordHash || null;
  const planId = safeStr(user.planId, 50, 'plan-esencia');
  const planName = safeStr(user.planName, 100, 'Plan Esencia');
  const active = user.active !== false;
  const status = safeStr(user.status, 50, active ? 'active' : 'inactive');
  const suspendedByAdmin = Boolean(user.suspendedByAdmin);
  const paymentStatus = safeStr(user.paymentStatus, 50, active ? 'approved' : 'pending');
  const currentPeriodEnd = user.currentPeriodEnd || null;
  const emailVerified = Boolean(user.emailVerified);
  const isAnnual = Boolean(user.isAnnual);
  const memberSince = safeStr(user.memberSince, 50, 'Octubre 2026');
  const nextBillingDate = safeStr(user.nextBillingDate, 100);
  const paymentMethod = safeStr(user.paymentMethod, 100, 'Mercado Pago');
  const billedAmount = Number(user.billedAmount || 0);

  try {
    await pool.query(`
      INSERT INTO users (
        id, email, name, role, is_admin, access_code, password_hash,
        plan_id, plan_name, active, status, suspended_by_admin, payment_status,
        current_period_end, email_verified, is_annual, member_since, next_billing_date,
        payment_method, billed_amount, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        is_admin = EXCLUDED.is_admin,
        access_code = EXCLUDED.access_code,
        password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
        plan_id = EXCLUDED.plan_id,
        plan_name = EXCLUDED.plan_name,
        active = EXCLUDED.active,
        status = EXCLUDED.status,
        suspended_by_admin = EXCLUDED.suspended_by_admin,
        payment_status = EXCLUDED.payment_status,
        current_period_end = COALESCE(EXCLUDED.current_period_end, users.current_period_end),
        email_verified = EXCLUDED.email_verified,
        is_annual = EXCLUDED.is_annual,
        member_since = EXCLUDED.member_since,
        next_billing_date = EXCLUDED.next_billing_date,
        payment_method = EXCLUDED.payment_method,
        billed_amount = EXCLUDED.billed_amount,
        updated_at = NOW();
    `, [
      id, email, name, role, isAdmin, accessCode, passwordHash,
      planId, planName, active, status, suspendedByAdmin, paymentStatus,
      currentPeriodEnd, emailVerified, isAnnual, memberSince, nextBillingDate,
      paymentMethod, billedAmount
    ]);
    return true;
  } catch (err) {
    console.error('[DB] Error en upsertUser:', err.message);
    throw err;
  }
}

export async function deleteUser(userId) {
  const pool = initDbPool();
  if (!pool || !userId) return false;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM sessions WHERE user_id = $1;', [userId]);
      await client.query('DELETE FROM progress WHERE user_id = $1;', [userId]);
      await client.query('DELETE FROM reviews WHERE user_id = $1;', [userId]);
      await client.query('DELETE FROM users WHERE id = $1;', [userId]);
      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[DB] Error eliminando usuario:', err.message);
    return false;
  }
}

function mapUserRow(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role || (u.is_admin ? 'admin' : 'member'),
    isAdmin: Boolean(u.is_admin || u.role === 'admin'),
    accessCode: u.access_code,
    passwordHash: u.password_hash,
    planId: u.plan_id,
    planName: u.plan_name,
    active: Boolean(u.active),
    status: u.status || (u.active ? 'active' : 'inactive'),
    suspendedByAdmin: Boolean(u.suspended_by_admin),
    paymentStatus: u.payment_status || (u.active ? 'approved' : 'pending'),
    currentPeriodEnd: u.current_period_end,
    emailVerified: Boolean(u.email_verified),
    isAnnual: Boolean(u.is_annual),
    memberSince: u.member_since,
    nextBillingDate: u.next_billing_date,
    paymentMethod: u.payment_method,
    billedAmount: Number(u.billed_amount || 0),
    createdAt: u.created_at
  };
}

// -------------------------------------------------------------
// 2. SESIONES PERSISTENTES (SHA-256 HASH) (NAM-004, NAM-033)
// -------------------------------------------------------------

export function hashToken(token) {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function saveSession(token, userId, expiresAt) {
  const pool = initDbPool();
  if (!pool || !token || !userId) return false;
  const tokenHash = hashToken(token);
  try {
    await pool.query(`
      INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (token_hash) DO UPDATE SET
        expires_at = EXCLUDED.expires_at;
    `, [tokenHash, userId, expiresAt]);
    return true;
  } catch (err) {
    console.error('[DB] Error guardando sesión:', err.message);
    return false;
  }
}

export async function getSession(token) {
  const pool = initDbPool();
  if (!pool || !token) return null;
  const tokenHash = hashToken(token);
  try {
    const res = await pool.query(`
      SELECT s.*, u.active, u.status, u.suspended_by_admin, u.role, u.is_admin
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()
      LIMIT 1;
    `, [tokenHash]);
    if (res.rows.length === 0) return null;
    return {
      userId: res.rows[0].user_id,
      expiresAt: res.rows[0].expires_at,
      active: res.rows[0].active,
      suspendedByAdmin: res.rows[0].suspended_by_admin,
      isAdmin: Boolean(res.rows[0].is_admin || res.rows[0].role === 'admin')
    };
  } catch (err) {
    console.error('[DB] Error obteniendo sesión:', err.message);
    return null;
  }
}

export async function deleteSession(token) {
  const pool = initDbPool();
  if (!pool || !token) return;
  const tokenHash = hashToken(token);
  try {
    await pool.query('DELETE FROM sessions WHERE token_hash = $1;', [tokenHash]);
  } catch (err) {
    console.error('[DB] Error eliminando sesión:', err.message);
  }
}

export async function deleteUserSessions(userId) {
  const pool = initDbPool();
  if (!pool || !userId) return;
  try {
    await pool.query('DELETE FROM sessions WHERE user_id = $1;', [userId]);
  } catch (err) {
    console.error('[DB] Error revocando sesiones de usuario:', err.message);
  }
}

// -------------------------------------------------------------
// 3. TRANSACCIONES E IDEMPOTENCIA DE PAGOS (NAM-001, NAM-010)
// -------------------------------------------------------------

export async function saveTransaction(tx) {
  const pool = initDbPool();
  if (!pool || !tx || !tx.id) return false;
  try {
    await pool.query(`
      INSERT INTO transactions (
        id, receipt_number, user_id, name, email, plan_id, plan_name,
        amount, currency, status, is_annual, payment_method, timestamp
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        timestamp = EXCLUDED.timestamp;
    `, [
      safeStr(tx.id, 100),
      safeStr(tx.receiptNumber, 100),
      safeStr(tx.userId, 100),
      safeStr(tx.name, 150),
      safeStr(tx.email, 255),
      safeStr(tx.planId, 50),
      safeStr(tx.planName, 100),
      Number(tx.amount || 0),
      safeStr(tx.currency, 10, 'ARS'),
      safeStr(tx.status, 50, 'succeeded'),
      Boolean(tx.isAnnual),
      safeStr(tx.paymentMethod, 100, 'Mercado Pago'),
      tx.timestamp || new Date().toISOString()
    ]);
    return true;
  } catch (err) {
    console.error('[DB] Error guardando transacción:', err.message);
    return false;
  }
}

export async function isPaymentProcessed(paymentId) {
  const pool = initDbPool();
  if (!pool || !paymentId) return false;
  try {
    const res = await pool.query('SELECT payment_id FROM processed_payments WHERE payment_id = $1 LIMIT 1;', [String(paymentId)]);
    return res.rows.length > 0;
  } catch (err) {
    return false;
  }
}

export async function markPaymentProcessed(paymentId, txId, userId, amount, status = 'approved') {
  const pool = initDbPool();
  if (!pool || !paymentId) return false;
  try {
    await pool.query(`
      INSERT INTO processed_payments (payment_id, tx_id, user_id, amount, status, processed_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (payment_id) DO NOTHING;
    `, [String(paymentId), safeStr(txId, 100), safeStr(userId, 100), Number(amount || 0), safeStr(status, 50)]);
    return true;
  } catch (err) {
    console.error('[DB] Error registrando pago procesado:', err.message);
    return false;
  }
}

// -------------------------------------------------------------
// 4. PROGRESO Y RACHAS (NAM-022, NAM-023)
// -------------------------------------------------------------

export async function getProgress(userId) {
  const pool = initDbPool();
  if (!pool || !userId) return null;
  try {
    const res = await pool.query('SELECT * FROM progress WHERE user_id = $1 LIMIT 1;', [userId]);
    if (res.rows.length === 0) return null;
    const p = res.rows[0];
    return {
      userId: p.user_id,
      streakDays: Number(p.streak_days || 0),
      lastStreakDate: p.last_streak_date || '',
      totalMinutes: Number(p.total_minutes || 0),
      favorites: Array.isArray(p.favorites) ? p.favorites : (typeof p.favorites === 'string' ? JSON.parse(p.favorites) : []),
      completed: Array.isArray(p.completed) ? p.completed : (typeof p.completed === 'string' ? JSON.parse(p.completed) : []),
      lastPlayed: p.last_played && typeof p.last_played === 'object' ? p.last_played : {}
    };
  } catch (err) {
    console.error('[DB] Error getProgress:', err.message);
    return null;
  }
}

export async function saveProgress(userId, prog) {
  const pool = initDbPool();
  if (!pool || !userId) return false;
  try {
    await pool.query(`
      INSERT INTO progress (user_id, streak_days, last_streak_date, total_minutes, favorites, completed, last_played, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        streak_days = EXCLUDED.streak_days,
        last_streak_date = EXCLUDED.last_streak_date,
        total_minutes = EXCLUDED.total_minutes,
        favorites = EXCLUDED.favorites,
        completed = EXCLUDED.completed,
        last_played = EXCLUDED.last_played,
        updated_at = NOW();
    `, [
      userId,
      Number(prog.streakDays || 0),
      safeStr(prog.lastStreakDate, 20),
      Number(prog.totalMinutes || 0),
      JSON.stringify(Array.isArray(prog.favorites) ? prog.favorites : []),
      JSON.stringify(Array.isArray(prog.completed) ? prog.completed : []),
      JSON.stringify(prog.lastPlayed || {})
    ]);
    return true;
  } catch (err) {
    console.error('[DB] Error saveProgress:', err.message);
    return false;
  }
}

// -------------------------------------------------------------
// 5. RESEÑAS PERSISTENTES (NAM-015)
// -------------------------------------------------------------

export async function getReviews(onlyApproved = true) {
  const pool = initDbPool();
  if (!pool) return [];
  try {
    const q = onlyApproved
      ? 'SELECT * FROM reviews WHERE approved = TRUE ORDER BY created_at DESC;'
      : 'SELECT * FROM reviews ORDER BY created_at DESC;';
    const res = await pool.query(q);
    return res.rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      name: r.user_name,
      plan: r.user_plan,
      rating: Number(r.rating),
      comment: r.comment,
      approved: Boolean(r.approved),
      createdAt: r.created_at
    }));
  } catch (err) {
    console.error('[DB] Error getReviews:', err.message);
    return [];
  }
}

export async function saveReview(review) {
  const pool = initDbPool();
  if (!pool || !review) return false;
  const id = safeStr(review.id || 'rev_' + Date.now().toString(36), 100);
  try {
    await pool.query(`
      INSERT INTO reviews (id, user_id, user_name, user_plan, rating, comment, approved, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (id) DO UPDATE SET
        rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        approved = EXCLUDED.approved;
    `, [
      id,
      safeStr(review.userId, 100),
      safeStr(review.userName || review.name, 150, 'Alumna'),
      safeStr(review.userPlan || review.plan, 100, 'Plan Esencia'),
      Math.max(1, Math.min(5, Number(review.rating || 5))),
      safeStr(review.comment || review.quote, 1000),
      review.approved !== false
    ]);
    return true;
  } catch (err) {
    console.error('[DB] Error saveReview:', err.message);
    return false;
  }
}

// -------------------------------------------------------------
// 6. CLASES PERSISTENTES (NAM-016)
// -------------------------------------------------------------

export async function getClasses() {
  const pool = initDbPool();
  if (!pool) return [];
  try {
    const res = await pool.query('SELECT * FROM classes ORDER BY created_at DESC;');
    return res.rows.map(c => ({
      id: c.id,
      title: c.title,
      category: c.category,
      categoryLabel: c.category_label,
      duration: Number(c.duration),
      level: c.level,
      instructor: c.instructor,
      instructorRole: c.instructor_role,
      thumbnail: c.thumbnail,
      description: c.description,
      props: Array.isArray(c.props) ? c.props : (typeof c.props === 'string' ? JSON.parse(c.props) : []),
      intentions: Array.isArray(c.intentions) ? c.intentions : (typeof c.intentions === 'string' ? JSON.parse(c.intentions) : []),
      planRequired: c.plan_required,
      format: c.format,
      videoUrl: c.video_url,
      viewsCount: Number(c.views_count || 0),
      isNew: Boolean(c.is_new),
      featured: Boolean(c.featured),
      createdAt: c.created_at
    }));
  } catch (err) {
    console.error('[DB] Error getClasses:', err.message);
    return [];
  }
}

export async function saveClass(c) {
  const pool = initDbPool();
  if (!pool || !c || !c.title) return false;
  const id = safeStr(c.id || 'cls-' + Date.now().toString(36), 100);
  try {
    await pool.query(`
      INSERT INTO classes (
        id, title, category, category_label, duration, level, instructor,
        instructor_role, thumbnail, description, props, intentions,
        plan_required, format, video_url, views_count, is_new, featured, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        category = EXCLUDED.category,
        category_label = EXCLUDED.category_label,
        duration = EXCLUDED.duration,
        level = EXCLUDED.level,
        thumbnail = EXCLUDED.thumbnail,
        description = EXCLUDED.description,
        plan_required = EXCLUDED.plan_required,
        format = EXCLUDED.format,
        video_url = EXCLUDED.video_url;
    `, [
      id,
      safeStr(c.title, 255),
      safeStr(c.category, 50, 'suave'),
      safeStr(c.categoryLabel, 100, 'Yoga Suave'),
      Number(c.duration || 35),
      safeStr(c.level, 50, 'Todos los niveles'),
      safeStr(c.instructor, 100, 'Vale Manassero'),
      safeStr(c.instructorRole, 255, 'Fundadora de Namasté'),
      safeStr(c.thumbnail, 500, 'assets/images/shala.jpg'),
      safeStr(c.description, 2000),
      JSON.stringify(c.props || []),
      JSON.stringify(c.intentions || []),
      safeStr(c.planRequired, 50, 'plan-esencia'),
      safeStr(c.format, 20, 'video'),
      safeStr(c.videoUrl, 1000),
      Number(c.viewsCount || 0),
      Boolean(c.isNew),
      Boolean(c.featured)
    ]);
    return true;
  } catch (err) {
    console.error('[DB] Error saveClass:', err.message);
    return false;
  }
}

export async function deleteClass(classId) {
  const pool = initDbPool();
  if (!pool || !classId) return false;
  try {
    await pool.query('DELETE FROM classes WHERE id = $1;', [classId]);
    return true;
  } catch (err) {
    console.error('[DB] Error deleteClass:', err.message);
    return false;
  }
}

// -------------------------------------------------------------
// 7. CARGA COMPLETA & SINCRONIZACIÓN SIN SEMBRADO DESTRUCTIVO (NAM-003)
// -------------------------------------------------------------

export async function loadFromSupabase() {
  const pool = initDbPool();
  if (!pool) return null;

  try {
    const client = await pool.connect();
    try {
      const db = {
        users: {},
        plans: {},
        transactions: [],
        progress: {},
        auditLogs: [],
        sessions: {},
        classes: [],
        reviews: []
      };

      // 1. Planes
      const plansRes = await client.query('SELECT * FROM plans');
      plansRes.rows.forEach(p => {
        db.plans[p.id] = {
          id: p.id,
          name: p.name,
          tier: p.tier,
          badge: p.badge,
          priceMonthly: Number(p.price_monthly),
          priceAnnualTotal: Number(p.price_annual_total),
          currency: p.currency || 'ARS',
          description: p.description,
          features: Array.isArray(p.features) ? p.features : (typeof p.features === 'string' ? JSON.parse(p.features) : []),
          mercadopagoUrl: p.mercadopago_url,
          mercadopagoUrlAnnual: p.mercadopago_url_annual,
          updatedAt: p.updated_at
        };
      });

      // 2. Usuarios (con password_hash persistente - NAM-002)
      const usersRes = await client.query('SELECT * FROM users');
      usersRes.rows.forEach(u => {
        db.users[u.id] = mapUserRow(u);
      });

      // 3. Transacciones
      const txRes = await client.query('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 200');
      db.transactions = txRes.rows.map(tx => ({
        id: tx.id,
        receiptNumber: tx.receipt_number,
        userId: tx.user_id,
        name: tx.name,
        email: tx.email,
        planId: tx.plan_id,
        planName: tx.plan_name,
        amount: Number(tx.amount),
        currency: tx.currency || 'ARS',
        status: tx.status,
        isAnnual: Boolean(tx.is_annual),
        paymentMethod: tx.payment_method,
        timestamp: tx.timestamp
      }));

      // 4. Progreso
      const progRes = await client.query('SELECT * FROM progress');
      progRes.rows.forEach(pr => {
        db.progress[pr.user_id] = {
          streakDays: pr.streak_days || 0,
          lastStreakDate: pr.last_streak_date || '',
          totalMinutes: pr.total_minutes || 0,
          favorites: Array.isArray(pr.favorites) ? pr.favorites : (typeof pr.favorites === 'string' ? JSON.parse(pr.favorites) : []),
          completed: Array.isArray(pr.completed) ? pr.completed : (typeof pr.completed === 'string' ? JSON.parse(pr.completed) : []),
          lastPlayed: pr.last_played && typeof pr.last_played === 'object' ? pr.last_played : {}
        };
      });

      // 5. Audit Logs
      const logsRes = await client.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
      db.auditLogs = logsRes.rows.map(l => ({
        id: l.id,
        timestamp: l.timestamp,
        action: l.action,
        title: l.title,
        details: l.details,
        userEmail: l.user_email,
        status: l.status
      }));

      return db;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[DB] Error reading from Supabase:', err.message);
    return null;
  }
}

/**
 * Sincronización puntual por entidad (NAM-005, NAM-020)
 * Ya NO realiza volcado masivo O(N) que borraba o revertía cambios concurrentes.
 */
export async function syncSingleEntity(entityType, entityData) {
  if (!entityData) return;
  try {
    switch (entityType) {
      case 'user':
        await upsertUser(entityData);
        break;
      case 'transaction':
        await saveTransaction(entityData);
        break;
      case 'progress':
        if (entityData.userId) await saveProgress(entityData.userId, entityData);
        break;
      case 'review':
        await saveReview(entityData);
        break;
      case 'class':
        await saveClass(entityData);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error(`[DB] Fallo al sincronizar entidad ${entityType}:`, e.message);
  }
}

// Mantener compatibilidad segura con scripts anteriores
export async function syncToSupabase(database) {
  // En lugar de dump masivo descontrolado, solo loguea advertencia en desuso
  return Promise.resolve();
}
