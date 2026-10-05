/**
 * Script de migración automática de datos locales a Supabase PostgreSQL
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

const localDbPath = path.resolve(__dirname, '../data/database.json');
const localDb = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));

async function migrate() {
  console.log('[SUPABASE] Conectando a PostgreSQL...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[SUPABASE] Conexión establecida con éxito.');

  try {
    console.log('[SUPABASE] Creando tablas si no existen...');

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

    // 2. Tabla de Usuarios / Alumnas
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        is_admin BOOLEAN DEFAULT FALSE,
        access_code VARCHAR(100),
        plan_id VARCHAR(50),
        plan_name VARCHAR(100),
        active BOOLEAN DEFAULT TRUE,
        is_annual BOOLEAN DEFAULT FALSE,
        member_since VARCHAR(50),
        next_billing_date VARCHAR(100),
        payment_method VARCHAR(100),
        billed_amount NUMERIC(12, 2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    // Asegurar que si la tabla ya existía, se desactive la FK estricta
    await client.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_id_fkey;
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

    // 6. Tabla de Sesiones Activas
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    console.log('[SUPABASE] Tablas verificadas/creadas con éxito.');

    // Sembrar Planes
    console.log('[SUPABASE] Sincronizando catálogo de planes...');
    if (localDb.plans) {
      for (const [key, p] of Object.entries(localDb.plans)) {
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

    // Sembrar Usuarios
    console.log('[SUPABASE] Sincronizando usuarios...');
    if (localDb.users) {
      for (const [key, u] of Object.entries(localDb.users)) {
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
          u.id || key,
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
          u.paymentMethod || 'Visa •••• 4242',
          u.billedAmount || 0,
          u.createdAt || new Date().toISOString()
        ]);
      }
    }

    // Sembrar Transacciones
    console.log('[SUPABASE] Sincronizando transacciones...');
    if (Array.isArray(localDb.transactions)) {
      for (const tx of localDb.transactions) {
        await client.query(`
          INSERT INTO transactions (id, receipt_number, user_id, name, email, plan_id, plan_name, amount, currency, status, is_annual, payment_method, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO NOTHING;
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
      }
    }

    // Sembrar Progreso
    console.log('[SUPABASE] Sincronizando progreso de alumnas...');
    if (localDb.progress) {
      for (const [userId, prog] of Object.entries(localDb.progress)) {
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
          prog.streakDays || 0,
          prog.lastStreakDate || '',
          prog.totalMinutes || 0,
          JSON.stringify(prog.favorites || []),
          JSON.stringify(prog.completed || []),
          JSON.stringify(prog.lastPlayed || {}),
          new Date().toISOString()
        ]);
      }
    }

    // Sembrar Logs de Auditoría
    console.log('[SUPABASE] Sincronizando registros de auditoría...');
    if (Array.isArray(localDb.auditLogs)) {
      for (const log of localDb.auditLogs) {
        await client.query(`
          INSERT INTO audit_logs (id, timestamp, action, title, details, user_email, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING;
        `, [
          log.id,
          log.timestamp || new Date().toISOString(),
          log.action,
          log.title,
          log.details,
          log.userEmail || '',
          log.status || 'info'
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
