/**
 * Script de migración y esquema robusto para Supabase PostgreSQL (Namasté)
 * Incorpora fixes para: NAM-002, NAM-003, NAM-011, NAM-014, NAM-015, NAM-016, NAM-021, NAM-027.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env si existe
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
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

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('[ERROR] DATABASE_URL no está configurada.');
  process.exit(1);
}

const localDbPath = path.resolve(__dirname, '../data/database.json');
let localDb = { users: {}, plans: {}, transactions: [], progress: {}, auditLogs: [] };
if (fs.existsSync(localDbPath)) {
  try {
    localDb = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
  } catch (e) {
    console.warn('[AVISO] No se pudo leer database.json local:', e.message);
  }
}

async function migrate() {
  console.log('[SUPABASE] Conectando a PostgreSQL...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[SUPABASE] Conexión establecida con éxito.');

  try {
    console.log('[SUPABASE] Creando y actualizando tablas con esquema seguro...');

    // 1. Tabla de Planes
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        tier VARCHAR(50),
        badge VARCHAR(50),
        price_monthly NUMERIC(12, 2) NOT NULL,
        price_annual_total NUMERIC(12, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'ARS',
        description TEXT,
        features JSONB DEFAULT '[]',
        mercadopago_url TEXT,
        mercadopago_url_annual TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 2. Tabla de Usuarios / Alumnas (Con password_hash, status y suspensiones)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        is_admin BOOLEAN DEFAULT FALSE,
        access_code VARCHAR(100),
        password_hash TEXT,
        plan_id VARCHAR(50),
        plan_name VARCHAR(100),
        active BOOLEAN DEFAULT TRUE,
        status VARCHAR(50) DEFAULT 'active',
        suspended_by_admin BOOLEAN DEFAULT FALSE,
        payment_status VARCHAR(50) DEFAULT 'approved',
        current_period_end TIMESTAMP WITH TIME ZONE,
        email_verified BOOLEAN DEFAULT FALSE,
        is_annual BOOLEAN DEFAULT FALSE,
        member_since VARCHAR(50),
        next_billing_date VARCHAR(100),
        payment_method VARCHAR(100),
        billed_amount NUMERIC(12, 2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Migraciones idempotentes de columnas en users si la tabla ya existía
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by_admin BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'approved';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_id_fkey;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email ON users (LOWER(email));
    `);

    // 3. Tabla de Transacciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(100) PRIMARY KEY,
        receipt_number VARCHAR(100) NOT NULL,
        user_id VARCHAR(100),
        name VARCHAR(150),
        email VARCHAR(255),
        plan_id VARCHAR(50),
        plan_name VARCHAR(100),
        amount NUMERIC(12, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'ARS',
        status VARCHAR(50) DEFAULT 'succeeded',
        is_annual BOOLEAN DEFAULT FALSE,
        payment_method VARCHAR(100),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 4. Tabla de Progreso
    await client.query(`
      CREATE TABLE IF NOT EXISTS progress (
        user_id VARCHAR(100) PRIMARY KEY,
        streak_days INTEGER DEFAULT 0,
        last_streak_date VARCHAR(20),
        total_minutes INTEGER DEFAULT 0,
        favorites JSONB DEFAULT '[]',
        completed JSONB DEFAULT '[]',
        last_played JSONB DEFAULT '{}',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 5. Tabla de Auditoría / Logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(100) PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        action VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        details TEXT,
        user_email VARCHAR(255),
        status VARCHAR(50) DEFAULT 'info'
      );
    `);

    // 6. Tabla de Sesiones Activas (con token_hash seguro)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    // 7. Tabla de Idempotencia de Pagos (Mercado Pago)
    await client.query(`
      CREATE TABLE IF NOT EXISTS processed_payments (
        payment_id VARCHAR(100) PRIMARY KEY,
        tx_id VARCHAR(100),
        user_id VARCHAR(100),
        amount NUMERIC(12, 2),
        currency VARCHAR(10) DEFAULT 'ARS',
        status VARCHAR(50),
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 8. Tabla de Reseñas Reales (Persistentes)
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100),
        user_name VARCHAR(150) NOT NULL,
        user_plan VARCHAR(100),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT NOT NULL,
        approved BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 9. Tabla de Clases del Shala (Persistentes)
    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        category_label VARCHAR(100),
        duration INTEGER NOT NULL,
        level VARCHAR(50) DEFAULT 'Todos los niveles',
        instructor VARCHAR(100) DEFAULT 'Vale Manassero',
        instructor_role VARCHAR(255) DEFAULT 'Fundadora de Namasté • +14 años de trayectoria',
        thumbnail TEXT,
        description TEXT,
        props JSONB DEFAULT '[]',
        intentions JSONB DEFAULT '[]',
        plan_required VARCHAR(50) DEFAULT 'plan-esencia',
        format VARCHAR(20) DEFAULT 'video',
        video_url TEXT NOT NULL,
        views_count INTEGER DEFAULT 0,
        is_new BOOLEAN DEFAULT FALSE,
        featured BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 10. Activar Row Level Security (RLS) y revocar privilegios anónimos (NAM-011)
    console.log('[SUPABASE] Habilitando Row Level Security (RLS) en todas las tablas...');
    const tables = [
      'plans', 'users', 'transactions', 'progress',
      'audit_logs', 'sessions', 'processed_payments', 'reviews', 'classes'
    ];
    for (const t of tables) {
      await client.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`);
    }

    await client.query(`
      REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    `);

    console.log('[SUPABASE] Tablas verificadas, RLS activado y permisos anónimos restringidos.');

    // Sembrar Planes (Solo si no existen, preservando personalizaciones de precios - NAM-003)
    console.log('[SUPABASE] Verificando planes base...');
    if (localDb.plans) {
      for (const [key, p] of Object.entries(localDb.plans)) {
        await client.query(`
          INSERT INTO plans (id, name, tier, badge, price_monthly, price_annual_total, currency, description, features, mercadopago_url, mercadopago_url_annual, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING;
        `, [
          p.id || key,
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

    // Migrar Usuarios locales persistiendo contraseña (NAM-002)
    if (localDb.users) {
      console.log('[SUPABASE] Sincronizando usuarios preservando hashes de contraseña...');
      for (const [key, u] of Object.entries(localDb.users)) {
        // En producción no crear cuentas demo de relleno si no existen
        await client.query(`
          INSERT INTO users (
            id, email, name, role, is_admin, access_code, password_hash,
            plan_id, plan_name, active, status, suspended_by_admin, payment_status,
            is_annual, member_since, next_billing_date, payment_method, billed_amount, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          ON CONFLICT (id) DO UPDATE SET
            password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            is_admin = EXCLUDED.is_admin,
            plan_id = EXCLUDED.plan_id,
            plan_name = EXCLUDED.plan_name,
            active = EXCLUDED.active,
            status = EXCLUDED.status,
            payment_status = EXCLUDED.payment_status,
            billed_amount = EXCLUDED.billed_amount;
        `, [
          u.id || key,
          u.email,
          u.name,
          u.role || (u.isAdmin ? 'admin' : 'member'),
          Boolean(u.isAdmin || u.role === 'admin'),
          u.accessCode || '',
          u.passwordHash || null,
          u.planId || 'plan-refugio',
          u.planName || 'Plan Refugio',
          u.active !== false,
          u.status || 'active',
          Boolean(u.suspendedByAdmin),
          u.paymentStatus || 'approved',
          Boolean(u.isAnnual),
          u.memberSince || 'Marzo 2026',
          u.nextBillingDate || '28 Octubre 2026',
          u.paymentMethod || 'Mercado Pago',
          u.billedAmount || 0,
          u.createdAt || new Date().toISOString()
        ]);
      }
    }

    console.log('\n[ÉXITO] Migración a Supabase completada con éxito.');
  } finally {
    await client.end();
  }
}

migrate().catch(err => {
  console.error('[ERROR] Error en la migración:', err);
  process.exit(1);
});
