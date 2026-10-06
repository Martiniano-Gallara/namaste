/**
 * Módulo de Base de Datos para Namasté (Híbrido: Supabase PostgreSQL + JSON Local)
 * 
 * Funcionalidad:
 * - Si existe variable DATABASE_URL o credenciales de Supabase, utiliza PostgreSQL en la nube.
 * - Si no existen credenciales de red, opera de forma transparente con data/database.json.
 * - Mantiene sincronizado el estado en memoria para respuestas ultra-rápidas (< 5ms).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Cargar .env local si existe (sin dependencias adicionales)
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
  } catch (err) {
    // Silently continue
  }
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let pgPool = null;

export function initDbPool() {
  if (pgPool) return pgPool;
  try {
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    pgPool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client', err);
    });
    return pgPool;
  } catch (err) {
    console.warn('[DB] Could not initialize PostgreSQL pool:', err.message);
    return null;
  }
}

/**
 * Carga la base de datos completa desde Supabase PostgreSQL
 */
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
        sessions: {}
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

      // 2. Usuarios
      const usersRes = await client.query('SELECT * FROM users');
      usersRes.rows.forEach(u => {
        db.users[u.id] = {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          isAdmin: Boolean(u.is_admin || u.role === 'admin'),
          accessCode: u.access_code,
          planId: u.plan_id,
          planName: u.plan_name,
          active: u.active,
          isAnnual: Boolean(u.is_annual),
          memberSince: u.member_since,
          nextBillingDate: u.next_billing_date,
          paymentMethod: u.payment_method,
          billedAmount: Number(u.billed_amount || 0),
          createdAt: u.created_at
        };
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
 * Persiste cambios a Supabase PostgreSQL de manera asíncrona
 */
export async function syncToSupabase(database) {
  const pool = initDbPool();
  if (!pool || !database) return;

  try {
    const client = await pool.connect();
    try {
      // 1. Sincronizar Usuarios
      if (database.users) {
        for (const u of Object.values(database.users)) {
          await client.query(`
            INSERT INTO users (id, email, name, role, is_admin, access_code, plan_id, plan_name, active, is_annual, member_since, next_billing_date, payment_method, billed_amount, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (id) DO UPDATE SET
              email = EXCLUDED.email,
              name = EXCLUDED.name,
              role = EXCLUDED.role,
              is_admin = EXCLUDED.is_admin,
              access_code = EXCLUDED.access_code,
              plan_id = EXCLUDED.plan_id,
              plan_name = EXCLUDED.plan_name,
              active = EXCLUDED.active,
              is_annual = EXCLUDED.is_annual,
              member_since = EXCLUDED.member_since,
              next_billing_date = EXCLUDED.next_billing_date,
              payment_method = EXCLUDED.payment_method,
              billed_amount = EXCLUDED.billed_amount;
          `, [
            u.id,
            u.email,
            u.name,
            u.role || (u.isAdmin ? 'admin' : 'member'),
            Boolean(u.isAdmin || u.role === 'admin'),
            u.accessCode || '',
            u.planId || 'plan-refugio',
            u.planName || 'Plan Refugio',
            u.active !== false,
            Boolean(u.isAnnual),
            u.memberSince || 'Marzo 2026',
            u.nextBillingDate || '28 Octubre 2026',
            u.paymentMethod || 'Mercado Pago',
            u.billedAmount || 0,
            u.createdAt || new Date().toISOString()
          ]);
        }
      }

      // 2. Sincronizar Planes
      if (database.plans) {
        for (const p of Object.values(database.plans)) {
          await client.query(`
            INSERT INTO plans (id, name, tier, badge, price_monthly, price_annual_total, currency, description, features, mercadopago_url, mercadopago_url_annual, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              tier = EXCLUDED.tier,
              badge = EXCLUDED.badge,
              price_monthly = EXCLUDED.price_monthly,
              price_annual_total = EXCLUDED.price_annual_total,
              currency = EXCLUDED.currency,
              description = EXCLUDED.description,
              features = EXCLUDED.features,
              mercadopago_url = EXCLUDED.mercadopago_url,
              mercadopago_url_annual = EXCLUDED.mercadopago_url_annual,
              updated_at = EXCLUDED.updated_at;
          `, [
            p.id,
            p.name,
            p.tier || 'intermedio',
            p.badge || '',
            p.priceMonthly,
            p.priceAnnualTotal,
            p.currency || 'ARS',
            p.description || '',
            JSON.stringify(p.features || []),
            p.mercadopagoUrl || '',
            p.mercadopagoUrlAnnual || '',
            p.updatedAt || new Date().toISOString()
          ]);
        }
      }

      // 3. Sincronizar Transacciones recientes (A-09, A-10)
      if (Array.isArray(database.transactions) && database.transactions.length > 0) {
        for (const tx of database.transactions.slice(-100)) {
          try {
            await client.query(`
              INSERT INTO transactions (id, receipt_number, user_id, name, email, plan_id, plan_name, amount, currency, status, is_annual, payment_method, timestamp)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                timestamp = EXCLUDED.timestamp,
                amount = EXCLUDED.amount,
                is_annual = EXCLUDED.is_annual;
            `, [
              tx.id,
              tx.receiptNumber,
              tx.userId,
              tx.name,
              tx.email,
              tx.planId,
              tx.planName,
              tx.amount,
              tx.currency || 'ARS',
              tx.status || 'succeeded',
              Boolean(tx.isAnnual),
              tx.paymentMethod,
              tx.timestamp || new Date().toISOString()
            ]);
          } catch (txErr) {
            console.error(`[DB] Error sincronizando transacción ${tx.id}:`, txErr.message);
          }
        }
      }

      // 4. Sincronizar Progreso
      if (database.progress) {
        for (const [userId, pr] of Object.entries(database.progress)) {
          try {
            await client.query(`
              INSERT INTO progress (user_id, streak_days, last_streak_date, total_minutes, favorites, completed, last_played, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
              pr.streakDays || 0,
              pr.lastStreakDate || '',
              pr.totalMinutes || 0,
              JSON.stringify(pr.favorites || []),
              JSON.stringify(pr.completed || []),
              JSON.stringify(pr.lastPlayed || {}),
              new Date().toISOString()
            ]);
          } catch (progErr) {
            console.error(`[DB] Error sincronizando progreso ${userId}:`, progErr.message);
          }
        }
      }

      // 5. Sincronizar Logs (A-10)
      if (Array.isArray(database.auditLogs) && database.auditLogs.length > 0) {
        for (const l of database.auditLogs.slice(-100)) {
          try {
            await client.query(`
              INSERT INTO audit_logs (id, timestamp, action, title, details, user_email, status)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (id) DO NOTHING;
            `, [
              l.id,
              l.timestamp || new Date().toISOString(),
              l.action,
              l.title,
              l.details,
              l.userEmail || '',
              l.status || 'info'
            ]);
          } catch (logErr) {
            console.error(`[DB] Error sincronizando log ${l.id}:`, logErr.message);
          }
        }
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[DB] Error writing to Supabase:', err.message);
  }
}

/**
 * Elimina definitivamente un usuario y sus registros relacionados en Supabase PostgreSQL (M-01)
 */
export async function deleteUserFromSupabase(userId) {
  const pool = initDbPool();
  if (!pool || !userId) return;

  try {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM progress WHERE user_id = $1;', [userId]);
      await client.query('DELETE FROM users WHERE id = $1;', [userId]);
      console.log(`[DB] Usuario ${userId} eliminado de Supabase PostgreSQL.`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`[DB] Error eliminando usuario ${userId} de Supabase:`, err.message);
  }
}
