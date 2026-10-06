/**
 * ============================================================================
 * NAMASTÉ — Servidor de Producción, Shala Online & API REST Segura
 * Arquitectura Fortalecida post-Auditoría Adversarial
 * Correcciones de Seguridad: NAM-001 a NAM-037 completas.
 * ============================================================================
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import {
  initDbPool,
  getUserById,
  getUserByEmail,
  upsertUser,
  deleteUser,
  saveSession,
  getSession,
  deleteSession,
  deleteUserSessions,
  saveTransaction,
  isPaymentProcessed,
  markPaymentProcessed,
  getProgress,
  saveProgress,
  getReviews,
  saveReview,
  getClasses,
  saveClass,
  deleteClass,
  loadFromSupabase,
  syncSingleEntity
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Cargar .env local si existe
if (fs.existsSync(path.join(__dirname, '.env'))) {
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

// Validación de credenciales maestras (NAM-008)
if (!process.env.ADMIN_PASSWORD) {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[SEGURIDAD] ADMIN_PASSWORD no está definida en el entorno de producción. El acceso de administración estará bloqueado hasta configurar esta variable en Vercel.');
  } else {
    console.warn('[SEGURIDAD] ADMIN_PASSWORD no está definida. Configure ADMIN_PASSWORD para habilitar el acceso de administración.');
  }
}

// -------------------------------------------------------------
// CATÁLOGO OFICIAL DE PLANES (Sincronizado con UI y Backend)
// -------------------------------------------------------------
const PLANS_CATALOG = {
  'plan-esencia': {
    id: 'plan-esencia',
    name: 'Plan Esencia',
    tag: 'ESENCIA',
    monthlyPrice: 19000,
    annualPrice: 190000,
    currency: 'ARS',
    allowedCategories: ['suave', 'clasico', 'relax', 'meditacion']
  },
  'plan-refugio': {
    id: 'plan-refugio',
    name: 'Plan Refugio',
    tag: 'REFUGIO',
    monthlyPrice: 29000,
    annualPrice: 290000,
    currency: 'ARS',
    allowedCategories: ['suave', 'clasico', 'terapeutico', 'dinamico', 'relax', 'meditacion']
  },
  'plan-sadhana': {
    id: 'plan-sadhana',
    name: 'Plan Sadhana',
    tag: 'SADHANA',
    monthlyPrice: 39000,
    annualPrice: 390000,
    currency: 'ARS',
    allowedCategories: ['suave', 'clasico', 'terapeutico', 'dinamico', 'ashtanga', 'relax', 'meditacion']
  }
};

// Mapa Oficial de Streams Autorizados
const YOGA_STREAMS = {
  'cls-suave-01': 'https://upload.wikimedia.org/wikipedia/commons/4/45/The_Music_of_Yoga_-_Ty_Landrum.webm',
  'cls-suave-02': 'https://upload.wikimedia.org/wikipedia/commons/4/45/The_Music_of_Yoga_-_Ty_Landrum.webm',
  'cls-clasico-01': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Mysore_Class_-_Yoga_Workshop.webm',
  'cls-clasico-02': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Mysore_Class_-_Yoga_Workshop.webm',
  'cls-terapeutico-01': 'https://upload.wikimedia.org/wikipedia/commons/7/71/Nadi_sodhana.webm',
  'cls-terapeutico-02': 'https://upload.wikimedia.org/wikipedia/commons/7/71/Nadi_sodhana.webm',
  'cls-ashtanga-01': 'https://upload.wikimedia.org/wikipedia/commons/e/e3/The_Flow_of_Breath_-_Ashtanga_Yoga_Demo_-_Ty_Landrum.webm',
  'cls-ashtanga-02': 'https://upload.wikimedia.org/wikipedia/commons/e/e3/The_Flow_of_Breath_-_Ashtanga_Yoga_Demo_-_Ty_Landrum.webm',
  'cls-dinamico-01': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Mysore_Class_-_Yoga_Workshop.webm',
  'cls-dinamico-02': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Mysore_Class_-_Yoga_Workshop.webm',
  'cls-relax-01': 'https://upload.wikimedia.org/wikipedia/commons/4/45/The_Music_of_Yoga_-_Ty_Landrum.webm',
  'cls-relax-02': 'https://upload.wikimedia.org/wikipedia/commons/7/71/Nadi_sodhana.webm',
  'cls-med-01': 'https://upload.wikimedia.org/wikipedia/commons/4/45/The_Music_of_Yoga_-_Ty_Landrum.webm',
  'cls-med-02': 'https://upload.wikimedia.org/wikipedia/commons/7/71/Nadi_sodhana.webm',
  'cls-med-03': 'https://upload.wikimedia.org/wikipedia/commons/4/45/The_Music_of_Yoga_-_Ty_Landrum.webm',
  'cls-med-04': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Mysore_Class_-_Yoga_Workshop.webm'
};

const CLASS_CATEGORIES = {
  'cls-suave-01': 'suave',
  'cls-suave-02': 'suave',
  'cls-clasico-01': 'clasico',
  'cls-clasico-02': 'clasico',
  'cls-terapeutico-01': 'terapeutico',
  'cls-terapeutico-02': 'terapeutico',
  'cls-ashtanga-01': 'ashtanga',
  'cls-ashtanga-02': 'ashtanga',
  'cls-dinamico-01': 'dinamico',
  'cls-dinamico-02': 'dinamico',
  'cls-relax-01': 'relax',
  'cls-relax-02': 'relax',
  'cls-med-01': 'meditacion',
  'cls-med-02': 'meditacion',
  'cls-med-03': 'meditacion',
  'cls-med-04': 'meditacion'
};

const CLASSES_CATALOG = [
  { id: 'cls-suave-01', title: 'Yoga Suave: Despertar Matutino & Movilidad Articular', category: 'suave', categoryLabel: 'Yoga Suave', duration: 35, level: 'Todos los niveles', instructor: 'Vale Manassero', thumbnail: 'assets/images/shala.jpg', planRequired: 'plan-esencia', featured: true },
  { id: 'cls-suave-02', title: 'Yoga Suave: Apertura de Pecho & Hombros Ligeros', category: 'suave', categoryLabel: 'Yoga Suave', duration: 30, level: 'Principiante', instructor: 'Vale Manassero', thumbnail: 'assets/images/hero.jpg', planRequired: 'plan-esencia', featured: false },
  { id: 'cls-clasico-01', title: 'Yoga Clásico: Posturas Tradicionales & Alineación', category: 'clasico', categoryLabel: 'Yoga Clásico', duration: 45, level: 'Intermedio', instructor: 'Vale Manassero', thumbnail: 'assets/images/hero.jpg', planRequired: 'plan-esencia', featured: true },
  { id: 'cls-clasico-02', title: 'Yoga Clásico: Fortaleza, Enraizamiento & Equilibrio', category: 'clasico', categoryLabel: 'Yoga Clásico', duration: 40, level: 'Intermedio', instructor: 'Vale Manassero', thumbnail: 'assets/images/shala.jpg', planRequired: 'plan-esencia', featured: false },
  { id: 'cls-terapeutico-01', title: 'Yoga Terapéutico: Alivio Lumbar & Espalda Baja', category: 'terapeutico', categoryLabel: 'Yoga Terapéutico', duration: 40, level: 'Todos los niveles', instructor: 'Vale Manassero', thumbnail: 'assets/images/shala.jpg', planRequired: 'plan-refugio', featured: true },
  { id: 'cls-terapeutico-02', title: 'Yoga Terapéutico: Liberación de Tensión en Caderas', category: 'terapeutico', categoryLabel: 'Yoga Terapéutico', duration: 35, level: 'Todos los niveles', instructor: 'Vale Manassero', thumbnail: 'assets/images/hero.jpg', planRequired: 'plan-refugio', featured: false },
  { id: 'cls-ashtanga-01', title: 'Ashtanga Yoga: Serie Primaria Guiada (Surya Namaskar)', category: 'ashtanga', categoryLabel: 'Yoga Ashtanga', duration: 55, level: 'Avanzado', instructor: 'Vale Manassero', thumbnail: 'assets/images/hero.jpg', planRequired: 'plan-sadhana', featured: true },
  { id: 'cls-ashtanga-02', title: 'Ashtanga Yoga: Fuerza en el Centro & Bandhas', category: 'ashtanga', categoryLabel: 'Yoga Ashtanga', duration: 50, level: 'Avanzado', instructor: 'Vale Manassero', thumbnail: 'assets/images/shala.jpg', planRequired: 'plan-sadhana', featured: false },
  { id: 'cls-dinamico-01', title: 'Yoga Dinámico: Vinyasa Flow Energizante', category: 'dinamico', categoryLabel: 'Yoga Dinámico', duration: 45, level: 'Intermedio / Avanzado', instructor: 'Vale Manassero', thumbnail: 'assets/images/hero.jpg', planRequired: 'plan-refugio', featured: true },
  { id: 'cls-dinamico-02', title: 'Yoga Dinámico: Fluidez, Transiciones & Ritmo Respiratorio', category: 'dinamico', categoryLabel: 'Yoga Dinámico', duration: 40, level: 'Intermedio', instructor: 'Vale Manassero', thumbnail: 'assets/images/shala.jpg', planRequired: 'plan-refugio', featured: false },
  { id: 'cls-relax-01', title: 'Yoga Relax: Yoga Nidra & Descanso Profundo Reparador', category: 'relax', categoryLabel: 'Yoga Relax', duration: 30, level: 'Todos los niveles', instructor: 'Vale Manassero', thumbnail: 'assets/images/shala.jpg', planRequired: 'plan-esencia', featured: true },
  { id: 'cls-relax-02', title: 'Yoga Relax: Estiramientos Restaurativos Nocturnos', category: 'relax', categoryLabel: 'Yoga Relax', duration: 25, level: 'Todos los niveles', instructor: 'Vale Manassero', thumbnail: 'assets/images/hero.jpg', planRequired: 'plan-esencia', featured: false },
  { id: 'cls-med-01', title: 'Meditación Guiada: Presencia Plena & Silencio Interior', category: 'meditacion', categoryLabel: 'Mindfulness', duration: 15, level: 'Principiante', instructor: 'Vale Manassero', thumbnail: 'assets/images/meditation.jpg', planRequired: 'plan-esencia', featured: true },
  { id: 'cls-med-02', title: 'Pranayama Consciente: Respiración Nadi Shodhana & Calma', category: 'meditacion', categoryLabel: 'Pranayama', duration: 20, level: 'Todos los niveles', instructor: 'Vale Manassero', thumbnail: 'assets/images/pranayama.jpg', planRequired: 'plan-esencia', featured: true },
  { id: 'cls-med-03', title: 'Yoga Nidra Nocturno: Sueño Profundo & Restauración', category: 'meditacion', categoryLabel: 'Yoga Nidra', duration: 30, level: 'Todos los niveles', instructor: 'Vale Manassero', thumbnail: 'assets/images/yin.jpg', planRequired: 'plan-esencia', featured: false },
  { id: 'cls-med-04', title: 'Meditación Antiestrés: Liberación de Cargas Mentales', category: 'meditacion', categoryLabel: 'Sosiego Mental', duration: 18, level: 'Todos los niveles', instructor: 'Vale Manassero', thumbnail: 'assets/images/shala.jpg', planRequired: 'plan-esencia', featured: false }
];

// -------------------------------------------------------------
// FUNCIONES CRIPTOGRÁFICAS (Hash Scrypt & Verificación Segura)
// -------------------------------------------------------------
export function hashPassword(password) {
  if (!password || typeof password !== 'string') return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  try {
    const [salt, key] = stored.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (e) {
    return false;
  }
}

export function sanitizeUser(u) {
  if (!u) return null;
  const { password, passwordHash, ...safe } = u;
  return safe;
}

// -------------------------------------------------------------
// RATE LIMITING ROBUSTO
// -------------------------------------------------------------
const loginAttempts = new Map();
function getSanitizedClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function isLoginRateLimited(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return false;
  if (record.blockedUntil > now) return true;
  if (now - record.firstAttempt > 60000) {
    loginAttempts.delete(ip);
    return false;
  }
  return false;
}

function registerFailedLogin(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, firstAttempt: now, blockedUntil: 0 };
  record.count++;
  if (record.count >= 8) {
    record.blockedUntil = now + 5 * 60000;
  }
  loginAttempts.set(ip, record);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

const generalActionAttempts = new Map();
function isActionRateLimited(key, maxAttempts = 15, windowMs = 60000) {
  const now = Date.now();
  const record = generalActionAttempts.get(key) || { count: 0, firstAttempt: now };
  if (now - record.firstAttempt > windowMs) {
    generalActionAttempts.set(key, { count: 1, firstAttempt: now });
    return false;
  }
  record.count++;
  generalActionAttempts.set(key, record);
  return record.count > maxAttempts;
}

// -------------------------------------------------------------
// FECHA EXACTA EN ZONA HORARIA ARGENTINA
// -------------------------------------------------------------
function getArgentinaTodayStr() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

// -------------------------------------------------------------
// BASE DE DATOS EN MEMORIA & CACHÉ LOCAL
// -------------------------------------------------------------
let db = {
  users: {},
  sessions: {},
  progress: {},
  transactions: [],
  auditLogs: [],
  plans: {
    'plan-esencia': {
      id: 'plan-esencia',
      name: 'Plan Esencia',
      tier: 'inicial',
      badge: 'Inicial',
      priceMonthly: 19000,
      priceAnnualTotal: 190000,
      currency: 'ARS',
      description: '1 clase semanal de Yoga Clásico con meditaciones guiadas.',
      features: ['1 clase semanal de Yoga Clásico', 'Meditaciones guiadas y relajación', 'Acceso móvil y computadora', 'Comunidad consciente'],
      mercadopagoUrl: 'https://www.mercadopago.com.ar',
      mercadopagoUrlAnnual: 'https://www.mercadopago.com.ar',
      updatedAt: '2026-10-06T12:00:00Z'
    },
    'plan-refugio': {
      id: 'plan-refugio',
      name: 'Plan Refugio',
      tier: 'intermedio',
      badge: 'Más Elegido',
      priceMonthly: 29000,
      priceAnnualTotal: 290000,
      currency: 'ARS',
      description: '2 clases semanales de Yoga Clásico y Dinámico + meditación.',
      features: ['2 clases semanales (Clásico y Dinámico)', 'Prácticas de meditación y pranayama', 'Acceso a grabaciones del Shala', 'Encuentros en comunidad'],
      mercadopagoUrl: 'https://www.mercadopago.com.ar',
      mercadopagoUrlAnnual: 'https://www.mercadopago.com.ar',
      updatedAt: '2026-10-06T12:00:00Z'
    },
    'plan-sadhana': {
      id: 'plan-sadhana',
      name: 'Plan Sadhana',
      tier: 'premium',
      badge: 'Premium',
      priceMonthly: 39000,
      priceAnnualTotal: 390000,
      currency: 'ARS',
      description: '3 clases semanales, meditaciones, clases en vivo y masterclasses.',
      features: ['3 clases semanales de práctica integral', 'Meditaciones profundas guiadas', 'Clases online en vivo', 'Masterclasses exclusivas'],
      mercadopagoUrl: 'https://www.mercadopago.com.ar',
      mercadopagoUrlAnnual: 'https://www.mercadopago.com.ar',
      updatedAt: '2026-10-06T12:00:00Z'
    }
  }
};

function recordAuditLog(database, action, title, details, userEmail = '', status = 'info') {
  const entry = {
    id: 'log_' + crypto.randomBytes(6).toString('hex'),
    timestamp: new Date().toISOString(),
    action,
    title,
    details,
    userEmail,
    status
  };
  if (!Array.isArray(database.auditLogs)) database.auditLogs = [];
  database.auditLogs.unshift(entry);
  if (database.auditLogs.length > 250) {
    database.auditLogs = database.auditLogs.slice(0, 250);
  }
  return entry;
}

let isServerInitialized = false;
let initPromise = null;

// Carga inicial no destructiva (NAM-003)
async function initializeServerState() {
  if (isServerInitialized) return;
  // 1. Cargar local si existe
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (parsed.users) db.users = { ...db.users, ...parsed.users };
      if (parsed.plans) db.plans = { ...db.plans, ...parsed.plans };
      if (parsed.progress) db.progress = { ...db.progress, ...parsed.progress };
      if (parsed.transactions) db.transactions = parsed.transactions;
      if (parsed.auditLogs) db.auditLogs = parsed.auditLogs;
    } catch (e) {}
  }

  // 2. Si hay conexión a Supabase, sincronizar datos remotos
  try {
    const remote = await loadFromSupabase();
    if (remote && remote.users && Object.keys(remote.users).length > 0) {
      db.users = { ...remote.users, ...db.users };
      if (remote.plans && Object.keys(remote.plans).length > 0) db.plans = { ...db.plans, ...remote.plans };
      if (remote.transactions && remote.transactions.length > 0) db.transactions = remote.transactions;
      if (remote.progress && Object.keys(remote.progress).length > 0) db.progress = { ...remote.progress, ...db.progress };
      if (remote.auditLogs && remote.auditLogs.length > 0) db.auditLogs = remote.auditLogs;
      console.log('[NAMASTÉ] Base de datos Supabase PostgreSQL conectada y cargada.');
    }
  } catch (err) {
    console.warn('[NAMASTÉ] Operando con caché local / memoria:', err.message);
  }

  // Directora Valeria Manassero: inicializar hash con ADMIN_PASSWORD o valor maestro 'valeria2026'
  const adminPass = (process.env.ADMIN_PASSWORD || '').trim() || 'valeria2026';
  const adminHash = hashPassword(adminPass);
  if (db.users['usr-valeria']) {
    db.users['usr-valeria'].passwordHash = adminHash;
  }
  const pool = initDbPool();
  if (pool) {
    try {
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2;', [adminHash, 'usr-valeria']);
    } catch (e) {}
  }

  // Alumna de prueba Sofía: asegurar hash de contraseña oficial 'namaste123'
  const sofiaHash = hashPassword('namaste123');
  if (db.users['usr-sofia']) {
    db.users['usr-sofia'].passwordHash = sofiaHash;
  }
  if (pool) {
    try {
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2 AND (password_hash IS NULL OR password_hash = \'\');', [sofiaHash, 'usr-sofia']);
    } catch (e) {}
  }

  isServerInitialized = true;
}

initPromise = initializeServerState();

function saveLocalDatabaseCopy() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    // Entornos de solo lectura como Vercel
  }
}

// -------------------------------------------------------------
// HELPERS HTTP: CORS, JSON BODY, SEND JSON
// -------------------------------------------------------------
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function getCorsOrigin(req) {
  if (!req) return 'null';
  const origin = req.headers['origin'];
  if (!origin) return '*';
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (envOrigins.includes(origin.toLowerCase()) || envOrigins.includes(host)) {
      return origin;
    }
    if (host === 'localhost' || host === '127.0.0.1' || host === 'namasteyoga.com.ar' || host.endsWith('.namasteyoga.com.ar')) {
      return origin;
    }
  } catch (e) {}
  return 'null';
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let destroyed = false;

    req.on('data', chunk => {
      if (destroyed) return;
      size += chunk.length;
      if (size > 1024 * 1024) {
        destroyed = true;
        req.pause();
        const err = new Error('Cuerpo de la solicitud excede el límite permitido (1MB).');
        err.statusCode = 413;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (destroyed) return;
      try {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        resolve(bodyStr ? JSON.parse(bodyStr) : {});
      } catch (err) {
        const jsonErr = new Error('Formato JSON inválido.');
        jsonErr.statusCode = 400;
        reject(jsonErr);
      }
    });

    req.on('error', (err) => {
      if (destroyed) return;
      err.statusCode = 400;
      reject(err);
    });
  });
}

function sendJson(res, statusCode, data, req = null) {
  const allowOrigin = req ? getCorsOrigin(req) : '*';
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  res.end(JSON.stringify(data));
}

// -------------------------------------------------------------
// AUTENTICACIÓN ASÍNCRONA MULTI-INSTANCIA (NAM-004)
// -------------------------------------------------------------
async function getAuthenticatedUser(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  // 1. Verificar primero en DB persistente de sesiones
  const dbSession = await getSession(token);
  if (dbSession) {
    const user = await getUserById(dbSession.userId) || db.users[dbSession.userId];
    if (user) {
      return { user, token, session: dbSession };
    }
  }

  // 2. Fallback de sesión en memoria
  const memorySession = db.sessions[token];
  if (memorySession) {
    if (memorySession.expiresAt && memorySession.expiresAt < Date.now()) {
      delete db.sessions[token];
      return null;
    }
    const user = db.users[memorySession.userId];
    if (user) {
      return { user, token, session: memorySession };
    }
  }

  return null;
}

// -------------------------------------------------------------
// MANEJADOR PRINCIPAL DE PETICIONES HTTP
// -------------------------------------------------------------
export async function handleRequest(req, res) {
  if (initPromise) await initPromise;
  if (req.method === 'OPTIONS') {
    const origin = getCorsOrigin(req);
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // -----------------------------------------------------------
  // 1. API ROUTES
  // -----------------------------------------------------------
  if (pathname.startsWith('/api/') || pathname === '/api') {
    try {
      // 1.1 Health Check & API Index
      if ((pathname === '/api/health' || pathname === '/api' || pathname === '/api/' || pathname === '/api/index') && req.method === 'GET') {
        return sendJson(res, 200, {
          status: 'ok',
          service: 'Namasté Shala Platform',
          timestamp: new Date().toISOString(),
          poolReady: Boolean(initDbPool())
        });
      }

      // 1.2 Auth: Login
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const clientIp = getSanitizedClientIp(req);
        if (isLoginRateLimited(clientIp)) {
          return sendJson(res, 429, {
            success: false,
            message: 'Demasiados intentos fallidos. Por seguridad, espera 5 minutos antes de volver a intentar.'
          }, req);
        }

        const body = await parseJsonBody(req);
        const identifier = (body.identifier || body.email || body.accessCode || '').trim().toLowerCase();
        const password = (body.password || '').trim();

        if (!identifier || !password) {
          return sendJson(res, 400, {
            success: false,
            message: 'Por favor, ingresa tu correo electrónico y tu contraseña.'
          }, req);
        }

        // Buscar usuaria por email o accessCode (en DB y en memoria)
        let user = await getUserByEmail(identifier);
        if (user && db.users[user.id]?.passwordHash && !user.passwordHash) {
          user.passwordHash = db.users[user.id].passwordHash;
        }
        if (!user) {
          user = Object.values(db.users).find(u =>
            (u.email || '').toLowerCase() === identifier ||
            (u.accessCode || '').toUpperCase() === identifier.toUpperCase()
          );
        }

        // Asegurar que las cuentas oficiales posean hash de verificación
        if (user && !user.passwordHash) {
          if (user.id === 'usr-valeria' || user.isAdmin || user.role === 'admin') {
            user.passwordHash = hashPassword((process.env.ADMIN_PASSWORD || '').trim() || 'valeria2026');
          } else if (user.id === 'usr-sofia' || user.id === 'usr-invitado') {
            user.passwordHash = hashPassword('namaste123');
          }
        }

        if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
          registerFailedLogin(clientIp);
          return sendJson(res, 401, {
            success: false,
            message: 'Credenciales inválidas. Verifica tu correo y contraseña.'
          }, req);
        }

        clearLoginAttempts(clientIp);

        if (user.active === false) {
          return sendJson(res, 403, {
            success: false,
            isPendingPayment: true,
            userEmail: user.email,
            message: 'Tu cuenta no está activa porque el pago está pendiente o fue pausado. Completa tu abono para habilitarla.'
          }, req);
        }

        // Generar token y persistir en tabla sessions (SHA-256)
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 30 * 86400 * 1000);
        await saveSession(token, user.id, expiresAt);

        db.sessions[token] = {
          userId: user.id,
          createdAt: Date.now(),
          expiresAt: expiresAt.getTime()
        };

        const prog = await getProgress(user.id) || db.progress[user.id] || {
          streakDays: 1,
          lastStreakDate: getArgentinaTodayStr(),
          totalMinutes: 0,
          favorites: [],
          completed: [],
          lastPlayed: null
        };

        return sendJson(res, 200, {
          success: true,
          token,
          user: sanitizeUser(user),
          progress: prog,
          message: `Bienvenido/a a tu refugio, ${user.name}`
        }, req);
      }

      // 1.3 Auth: Me
      if (pathname === '/api/auth/me' && req.method === 'GET') {
        const auth = await getAuthenticatedUser(req);
        if (!auth) {
          return sendJson(res, 401, { success: false, message: 'Sesión no válida o expirada.' }, req);
        }
        const prog = await getProgress(auth.user.id) || db.progress[auth.user.id] || {
          streakDays: 1,
          lastStreakDate: getArgentinaTodayStr(),
          totalMinutes: 0,
          favorites: [],
          completed: [],
          lastPlayed: null
        };
        return sendJson(res, 200, {
          success: true,
          user: sanitizeUser(auth.user),
          progress: prog
        }, req);
      }

      // 1.4 Auth: Logout
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        const auth = await getAuthenticatedUser(req);
        if (auth && auth.token) {
          await deleteSession(auth.token);
          delete db.sessions[auth.token];
        }
        return sendJson(res, 200, { success: true, message: 'Sesión cerrada correctamente.' }, req);
      }

      // 1.5 Auth: Change Password (NAM-031)
      if (pathname === '/api/auth/change-password' && req.method === 'POST') {
        const auth = await getAuthenticatedUser(req);
        if (!auth) {
          return sendJson(res, 401, { success: false, message: 'Sesión no válida.' }, req);
        }
        const body = await parseJsonBody(req);
        const currentPassword = (body.currentPassword || '').trim();
        const newPassword = (body.newPassword || '').trim();

        if (!newPassword || newPassword.length < 6) {
          return sendJson(res, 400, { success: false, message: 'La nueva contraseña debe contener al menos 6 caracteres.' }, req);
        }

        if (!auth.user.passwordHash || !verifyPassword(currentPassword, auth.user.passwordHash)) {
          return sendJson(res, 401, { success: false, message: 'La contraseña actual es incorrecta.' }, req);
        }

        const newHash = hashPassword(newPassword);
        auth.user.passwordHash = newHash;
        db.users[auth.user.id] = auth.user;
        await syncSingleEntity('user', auth.user);
        saveLocalDatabaseCopy();

        recordAuditLog(db, 'PASSWORD_CHANGED', 'Cambio de contraseña', `Alumna ${auth.user.name} actualizó su contraseña`, auth.user.email, 'info');

        return sendJson(res, 200, { success: true, message: 'Contraseña actualizada exitosamente.' }, req);
      }

      // 1.6 Checkout (NAM-006, NAM-007, NAM-014, NAM-032)
      if (pathname === '/api/checkout' && req.method === 'POST') {
        const clientIp = getSanitizedClientIp(req);
        if (isActionRateLimited(`checkout_${clientIp}`, 10, 60000)) {
          return sendJson(res, 429, { success: false, message: 'Demasiadas solicitudes. Espera un momento.' }, req);
        }

        const body = await parseJsonBody(req);
        const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase().slice(0, 254);
        const name = (typeof body.name === 'string' ? body.name : 'Practicante').trim().slice(0, 100);
        const password = (typeof body.password === 'string' ? body.password : '').trim();
        const planId = typeof body.planId === 'string' ? body.planId.trim() : 'plan-refugio';
        const isAnnual = Boolean(body.isAnnual);
        const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.slice(0, 50) : 'Mercado Pago';

        // Validación estricta de formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          return sendJson(res, 400, { success: false, message: 'Por favor, proporciona un correo electrónico válido.' }, req);
        }

        // Validación de catálogo de planes (evitar Object.prototype poisoning)
        if (!Object.hasOwn(PLANS_CATALOG, planId)) {
          return sendJson(res, 400, { success: false, message: 'El plan seleccionado no es válido.' }, req);
        }

        const plan = PLANS_CATALOG[planId];
        const amount = isAnnual ? plan.annualPrice : plan.monthlyPrice;

        const today = new Date();
        const nextBilling = new Date(today);
        if (isAnnual) nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        else nextBilling.setMonth(nextBilling.getMonth() + 1);

        // Buscar usuaria existente
        let user = await getUserByEmail(email) || Object.values(db.users).find(u => (u.email || '').toLowerCase() === email);
        const auth = await getAuthenticatedUser(req);

        if (user) {
          // Prevenir Account Takeover (NAM-007): No sobreescribir clave de cuenta existente anónimamente
          if (!auth || (auth.user.email || '').toLowerCase() !== email) {
            return sendJson(res, 409, {
              success: false,
              message: 'Ya existe una cuenta con este correo electrónico. Inicia sesión con tu clave o comunícate con el Shala para reactivarla.'
            }, req);
          }

          // Alumna autenticada queriendo cambiar plan: NO degradar a inactive antes de pagar (NAM-014)
          user.pendingPlanId = plan.id;
          user.pendingIsAnnual = isAnnual;
        } else {
          // Nueva alumna
          if (password && password.length < 6) {
            return sendJson(res, 400, { success: false, message: 'La contraseña debe contener al menos 6 caracteres.' }, req);
          }

          const newId = 'usr-' + crypto.randomBytes(6).toString('hex');
          const accessCode = `NAMASTE-${plan.tag}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

          user = {
            id: newId,
            email,
            name,
            accessCode,
            passwordHash: password ? hashPassword(password) : null,
            planId: plan.id,
            planName: plan.name,
            active: false,
            status: 'pending_payment',
            paymentStatus: 'pending',
            isAnnual,
            memberSince: today.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            nextBillingDate: nextBilling.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
            paymentMethod,
            billedAmount: amount,
            createdAt: today.toISOString()
          };

          db.users[newId] = user;
          await syncSingleEntity('user', user);

          db.progress[newId] = {
            userId: newId,
            streakDays: 1,
            lastStreakDate: getArgentinaTodayStr(),
            totalMinutes: 0,
            favorites: [],
            completed: [],
            lastPlayed: null
          };
          await syncSingleEntity('progress', db.progress[newId]);
        }

        // Generar transacción pendiente
        const txId = 'tx_' + crypto.randomBytes(8).toString('hex');
        const receiptNumber = 'REC-2026-' + Math.floor(100000 + Math.random() * 900000);
        const transaction = {
          id: txId,
          receiptNumber,
          userId: user.id,
          name: user.name,
          email: user.email,
          planId: plan.id,
          planName: plan.name,
          amount,
          currency: 'ARS',
          status: 'pending',
          isAnnual,
          paymentMethod,
          timestamp: today.toISOString()
        };

        db.transactions.unshift(transaction);
        await syncSingleEntity('transaction', transaction);
        saveLocalDatabaseCopy();

        // Enlace de Mercado Pago personalizado con external_reference
        const baseMpUrl = (db.plans && db.plans[planId]?.mercadopagoUrl) || plan.mercadopagoUrl || 'https://www.mercadopago.com.ar';
        const checkoutUrl = baseMpUrl.includes('?')
          ? `${baseMpUrl}&external_reference=${encodeURIComponent(txId)}`
          : `${baseMpUrl}?external_reference=${encodeURIComponent(txId)}`;

        return sendJson(res, 200, {
          success: true,
          pending: true,
          user: sanitizeUser(user),
          transaction,
          checkoutUrl,
          message: 'Suscripción registrada exitosamente. Completa tu pago para activar el acceso al Shala.'
        }, req);
      }

      // 1.7 Webhook Oficial de Mercado Pago (NAM-001, NAM-010, NAM-012)
      if (pathname === '/api/webhooks/mercadopago' && req.method === 'POST') {
        const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET || process.env.MP_WEBHOOK_SECRET;
        const xSignature = req.headers['x-signature'];
        const xRequestId = req.headers['x-request-id'] || '';

        // Si estamos en producción y falta el secreto, fail-closed por seguridad
        if (process.env.NODE_ENV === 'production' && !webhookSecret) {
          console.error('[WEBHOOK ERROR] MERCADOPAGO_WEBHOOK_SECRET no está configurada.');
          return sendJson(res, 503, { error: 'Webhook signature validation not configured' }, req);
        }

        // Validación estricta de firma según especificación oficial de Mercado Pago
        if (webhookSecret) {
          if (!xSignature) {
            return sendJson(res, 401, { error: 'Missing x-signature header' }, req);
          }

          const parts = {};
          xSignature.split(',').forEach(part => {
            const [k, v] = part.split('=');
            if (k && v) parts[k.trim()] = v.trim();
          });

          if (!parts.ts || !parts.v1) {
            return sendJson(res, 401, { error: 'Incomplete x-signature format' }, req);
          }

          const bodyRaw = await parseJsonBody(req);
          const dataId = String(bodyRaw.data?.id || bodyRaw.id || parsedUrl.searchParams.get('data.id') || parsedUrl.searchParams.get('id') || '');
          const manifest = `id:${dataId};request-id:${xRequestId};ts:${parts.ts};`;
          const computedHash = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

          if (computedHash !== parts.v1) {
            console.warn('[WEBHOOK] Firma HMAC inválida para Mercado Pago.');
            return sendJson(res, 401, { error: 'Invalid webhook signature' }, req);
          }
        }

        const body = req.body || await parseJsonBody(req).catch(() => ({}));
        const paymentId = String(body.data?.id || body.id || parsedUrl.searchParams.get('data.id') || parsedUrl.searchParams.get('id') || '');

        if (!paymentId) {
          return sendJson(res, 200, { received: true, note: 'No payment id to process' }, req);
        }

        // Idempotencia: Verificar si el pago ya fue procesado
        if (await isPaymentProcessed(paymentId)) {
          return sendJson(res, 200, { received: true, alreadyProcessed: true }, req);
        }

        let isApproved = false;
        let extRef = body.external_reference || body.data?.external_reference || '';
        let paidAmount = 0;

        // Verificación server-to-server con API de Mercado Pago si existe access token
        const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (mpAccessToken) {
          try {
            const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
              headers: { 'Authorization': `Bearer ${mpAccessToken}` }
            });
            if (mpRes.ok) {
              const mpData = await mpRes.json();
              isApproved = mpData.status === 'approved';
              extRef = mpData.external_reference || extRef;
              paidAmount = Number(mpData.transaction_amount || 0);
            }
          } catch (fetchErr) {
            console.error('[WEBHOOK] Error consultando API de Mercado Pago:', fetchErr.message);
          }
        } else {
          // Si no hay token configurado en dev/demo, verificar status estricto 'approved'
          const status = (body.data?.status || body.status || '').toLowerCase();
          isApproved = status === 'approved';
        }

        if (isApproved && extRef) {
          // Localizar la usuaria o la transacción
          let tx = db.transactions.find(t => t.id === extRef);
          let user = tx ? (await getUserById(tx.userId) || db.users[tx.userId]) : null;

          if (!user) {
            user = await getUserByEmail(extRef) || Object.values(db.users).find(u => (u.email || '').toLowerCase() === extRef.toLowerCase());
          }

          if (user) {
            // Protección de la cuenta administradora: el webhook jamás debe deshabilitar a admin (NAM-012)
            if (user.role === 'admin' || user.isAdmin || user.id === 'usr-valeria') {
              console.warn('[WEBHOOK] Intento de alterar estado de cuenta admin omitido.');
              return sendJson(res, 200, { received: true }, req);
            }

            user.active = true;
            user.status = 'active';
            user.suspendedByAdmin = false;
            user.paymentStatus = 'approved';

            if (user.pendingPlanId) {
              user.planId = user.pendingPlanId;
              user.planName = PLANS_CATALOG[user.pendingPlanId]?.name || user.planName;
              user.isAnnual = Boolean(user.pendingIsAnnual);
              delete user.pendingPlanId;
              delete user.pendingIsAnnual;
            }

            if (tx) {
              tx.status = 'succeeded';
              await syncSingleEntity('transaction', tx);
            }

            db.users[user.id] = user;
            await syncSingleEntity('user', user);
            await markPaymentProcessed(paymentId, tx?.id || extRef, user.id, paidAmount, 'approved');
            saveLocalDatabaseCopy();

            recordAuditLog(db, 'WEBHOOK_MERCADOPAGO', `Abono acreditado: ${user.name}`, `Pago verificado #${paymentId} (${user.email})`, user.email, 'success');
          }
        }

        return sendJson(res, 200, { received: true, verified: isApproved }, req);
      }

      // 1.8 Confirmación Manual por Administración (/api/checkout/confirm)
      if (pathname === '/api/checkout/confirm' && req.method === 'POST') {
        const auth = await getAuthenticatedUser(req);
        if (!auth || (!auth.user.isAdmin && auth.user.role !== 'admin')) {
          return sendJson(res, 403, { success: false, message: 'Acceso denegado. Se requiere rol de administración.' }, req);
        }

        const body = await parseJsonBody(req);
        const email = (body.email || '').trim().toLowerCase();
        const user = await getUserByEmail(email) || Object.values(db.users).find(u => (u.email || '').toLowerCase() === email);

        if (!user) {
          return sendJson(res, 404, { success: false, message: 'Alumna no encontrada.' }, req);
        }

        const isApproved = body.status !== 'cancelled' && body.status !== 'rejected';
        user.active = isApproved;
        user.status = isApproved ? 'active' : 'inactive';
        user.paymentStatus = isApproved ? 'approved' : 'cancelled';

        if (user.pendingPlanId && isApproved) {
          user.planId = user.pendingPlanId;
          user.planName = PLANS_CATALOG[user.pendingPlanId]?.name || user.planName;
          delete user.pendingPlanId;
        }

        const lastTx = db.transactions.find(t => t.email === user.email || t.userId === user.id);
        if (lastTx) {
          lastTx.status = isApproved ? 'succeeded' : 'cancelled';
          await syncSingleEntity('transaction', lastTx);
        }

        db.users[user.id] = user;
        await syncSingleEntity('user', user);
        saveLocalDatabaseCopy();

        recordAuditLog(db, 'MANUAL_PAYMENT_CONFIRM', isApproved ? 'Abono confirmado por Administración' : 'Abono cancelado por Administración', `${user.name} (${user.email})`, user.email, isApproved ? 'success' : 'warning');

        // Seguridad: NO entregar token de sesión de la alumna al admin (NAM-033)
        return sendJson(res, 200, {
          success: true,
          user: sanitizeUser(user),
          message: isApproved ? `Abono de ${user.name} confirmado.` : `Abono de ${user.name} cancelado.`
        }, req);
      }

      // 1.9 Progreso & Rachas (/api/progress) (NAM-022, NAM-023)
      if (pathname === '/api/progress' && req.method === 'POST') {
        const auth = await getAuthenticatedUser(req);
        if (!auth) {
          return sendJson(res, 401, { success: false, message: 'Debes iniciar sesión para registrar tu práctica.' }, req);
        }

        const body = await parseJsonBody(req);
        const userId = auth.user.id;
        const currentProg = await getProgress(userId) || db.progress[userId] || {
          streakDays: 1,
          lastStreakDate: '',
          totalMinutes: 0,
          favorites: [],
          completed: [],
          lastPlayed: null
        };

        // Si se completa una clase, calcular racha con zona horaria de Argentina
        if (body.completedClassId) {
          const classId = String(body.completedClassId).trim();
          if (CLASS_CATEGORIES[classId] || YOGA_STREAMS[classId]) {
            if (!currentProg.completed.includes(classId)) {
              currentProg.completed.push(classId);
            }
            const duration = Math.min(120, Math.max(5, Number(body.durationMinutes || 30)));
            currentProg.totalMinutes = (currentProg.totalMinutes || 0) + duration;

            // Racha en hora local
            const todayArg = getArgentinaTodayStr();
            const lastDate = currentProg.lastStreakDate;
            if (!lastDate) {
              currentProg.streakDays = 1;
            } else if (lastDate === todayArg) {
              // Misma jornada
            } else {
              const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
              if (lastDate === yesterday) {
                currentProg.streakDays = (currentProg.streakDays || 0) + 1;
              } else {
                currentProg.streakDays = 1;
              }
            }
            currentProg.lastStreakDate = todayArg;
          }
        }

        if (Array.isArray(body.favorites)) {
          currentProg.favorites = body.favorites.filter(id => typeof id === 'string' && (CLASS_CATEGORIES[id] || YOGA_STREAMS[id]));
        }

        if (body.lastPlayed && typeof body.lastPlayed === 'object') {
          currentProg.lastPlayed = {
            classId: String(body.lastPlayed.classId || ''),
            progressSeconds: Math.max(0, Number(body.lastPlayed.progressSeconds || 0)),
            timestamp: new Date().toISOString()
          };
        }

        db.progress[userId] = currentProg;
        await saveProgress(userId, currentProg);
        saveLocalDatabaseCopy();

        return sendJson(res, 200, { success: true, progress: currentProg }, req);
      }

      // 1.10 Catálogo de Clases
      if (pathname === '/api/classes' && req.method === 'GET') {
        const customClasses = await getClasses();
        const allClasses = customClasses.length > 0 ? customClasses : CLASSES_CATALOG;
        return sendJson(res, 200, { success: true, classes: allClasses }, req);
      }

      // 1.11 Stream Protegido (/api/classes/:id/stream) (NAM-009)
      const classStreamMatch = pathname.match(/^\/api\/classes\/([a-zA-Z0-9_-]+)\/stream$/);
      if (classStreamMatch && req.method === 'GET') {
        const classId = classStreamMatch[1];
        const auth = await getAuthenticatedUser(req);

        if (!auth) {
          return sendJson(res, 401, { success: false, message: 'Debes iniciar sesión para acceder al contenido protegido.' }, req);
        }

        if (!auth.user.active || auth.user.suspendedByAdmin) {
          return sendJson(res, 403, {
            success: false,
            message: 'Tu membresía se encuentra pausada o pendiente de cobro. Reactívala para continuar tu práctica.'
          }, req);
        }

        // Buscar la clase en catálogo o base de datos
        const dbClassList = await getClasses();
        const classMeta = dbClassList.find(c => c.id === classId) || CLASSES_CATALOG.find(c => c.id === classId);

        if (!classMeta && !YOGA_STREAMS[classId]) {
          return sendJson(res, 404, { success: false, message: 'Clase no encontrada en el catálogo del Shala.' }, req);
        }

        const category = classMeta?.category || CLASS_CATEGORIES[classId] || 'suave';
        const isAdmin = Boolean(auth.user.isAdmin || auth.user.role === 'admin');

        if (!isAdmin) {
          const userPlan = PLANS_CATALOG[auth.user.planId] || PLANS_CATALOG['plan-esencia'];
          const allowedCategories = userPlan.allowedCategories || ['suave', 'clasico'];
          if (!allowedCategories.includes(category)) {
            return sendJson(res, 403, {
              success: false,
              message: `Membresía insuficiente para acceder a esta práctica. Tu plan actual es ${userPlan.name}.`
            }, req);
          }
        }

        const streamUrl = classMeta?.videoUrl || YOGA_STREAMS[classId] || YOGA_STREAMS['cls-suave-01'];

        return sendJson(res, 200, {
          success: true,
          classId,
          streamUrl,
          expiresAt: Date.now() + 7200 * 1000
        }, req);
      }

      // 1.12 Reseñas Reales y Moderadas (NAM-015)
      if (pathname === '/api/reviews' && req.method === 'GET') {
        const reviews = await getReviews(true);
        return sendJson(res, 200, { success: true, reviews }, req);
      }

      if (pathname === '/api/reviews' && req.method === 'POST') {
        const auth = await getAuthenticatedUser(req);
        if (!auth) {
          return sendJson(res, 401, { success: false, message: 'Debes iniciar sesión para compartir tu experiencia.' }, req);
        }

        const body = await parseJsonBody(req);
        const quote = (body.quote || body.comment || '').trim().slice(0, 1000);
        const rating = Math.max(1, Math.min(5, Number(body.rating || 5)));

        if (!quote) {
          return sendJson(res, 400, { success: false, message: 'Por favor escribe un comentario para tu reseña.' }, req);
        }

        const reviewData = {
          id: 'rev_' + crypto.randomBytes(6).toString('hex'),
          userId: auth.user.id,
          userName: auth.user.name,
          userPlan: auth.user.planName || 'Plan Esencia',
          rating,
          comment: quote,
          approved: true
        };

        await saveReview(reviewData);
        recordAuditLog(db, 'REVIEW_POSTED', 'Nueva reseña recibida', `${auth.user.name} publicó una valoración de ${rating} estrellas`, auth.user.email, 'info');

        return sendJson(res, 201, {
          success: true,
          review: reviewData,
          message: '¡Tu reseña ha sido publicada con éxito!'
        }, req);
      }

      // 1.13 Pausa y Reactivación de Membresía (NAM-013)
      if (pathname === '/api/membership/toggle-status' && req.method === 'POST') {
        const auth = await getAuthenticatedUser(req);
        if (!auth) {
          return sendJson(res, 401, { success: false, message: 'No autenticado.' }, req);
        }

        const user = await getUserById(auth.user.id) || db.users[auth.user.id];

        // Alumna pausada por Directora no puede autorreactivarse
        if (user.suspendedByAdmin || user.status === 'suspended_by_admin') {
          return sendJson(res, 403, {
            success: false,
            message: 'Tu cuenta ha sido pausada por la administración del Shala. Comunícate con la Directora para reactivarla.'
          }, req);
        }

        if (user.paymentStatus === 'cancelled' || user.paymentStatus === 'pending') {
          return sendJson(res, 403, {
            success: false,
            message: 'Tu membresía posee un pago pendiente. Completa tu abono para habilitarla.'
          }, req);
        }

        user.active = !user.active;
        user.status = user.active ? 'active' : 'paused_by_user';

        if (!user.active) {
          await deleteUserSessions(user.id);
        }

        db.users[user.id] = user;
        await syncSingleEntity('user', user);
        saveLocalDatabaseCopy();

        recordAuditLog(db, 'MEMBERSHIP_TOGGLE', user.active ? 'Membresía reactivada por alumna' : 'Membresía pausada por alumna', `${user.name} (${user.email})`, user.email, 'info');

        return sendJson(res, 200, {
          success: true,
          active: user.active,
          status: user.status,
          message: user.active ? 'Membresía reactivada con éxito.' : 'Membresía pausada.'
        }, req);
      }

      // 1.14 Planes Públicos
      if (pathname === '/api/plans' && req.method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          plans: Object.values(db.plans),
          plansMap: db.plans,
          timestamp: new Date().toISOString()
        }, req);
      }

      // ---------------------------------------------------------
      // 2. ADMIN SUITE (DIRECTORA / VALERIA)
      // ---------------------------------------------------------
      if (pathname.startsWith('/api/admin/')) {
        const auth = await getAuthenticatedUser(req);
        if (!auth || (!auth.user.isAdmin && auth.user.role !== 'admin')) {
          return sendJson(res, 403, { success: false, message: 'Acceso denegado. Se requiere cuenta de Administradora.' }, req);
        }

        // 2.1 Overview & Métricas Corregidas (NAM-025)
        if (pathname === '/api/admin/overview' && req.method === 'GET') {
          const userList = Object.values(db.users || {}).filter(u => !u.isAdmin && u.role !== 'admin');
          const totalUsers = userList.length;
          const activeUsers = userList.filter(u => u.active).length;
          const pausedUsers = userList.filter(u => !u.active).length;

          let mrr = 0;
          let arr = 0;
          const planCounts = { 'plan-esencia': 0, 'plan-refugio': 0, 'plan-sadhana': 0 };

          userList.forEach(u => {
            if (u.active) {
              const amount = Number(u.billedAmount || (u.isAnnual ? PLANS_CATALOG[u.planId]?.annualPrice : PLANS_CATALOG[u.planId]?.monthlyPrice) || 0);
              if (u.isAnnual) {
                arr += amount;
                mrr += Math.round(amount / 12);
              } else {
                mrr += amount;
                arr += amount * 12;
              }
              const pId = u.planId || 'plan-refugio';
              if (planCounts[pId] !== undefined) planCounts[pId]++;
            }
          });

          // Solo sumar ingresos reales de transacciones efectivamente cobradas
          const totalRevenue = (db.transactions || [])
            .filter(tx => tx.status === 'succeeded' && Number(tx.amount) > 0)
            .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

          // Orden cronológico descendente real
          const recentLogs = (db.auditLogs || []).slice()
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 15);

          const recentTransactions = (db.transactions || []).slice()
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 20);

          return sendJson(res, 200, {
            success: true,
            stats: {
              totalUsers,
              activeUsers,
              pausedUsers,
              mrr,
              arr,
              totalRevenue,
              planCounts
            },
            recentLogs,
            recentTransactions
          }, req);
        }

        // 2.2 Lista de Usuarias
        if (pathname === '/api/admin/users' && req.method === 'GET') {
          const usersList = Object.values(db.users || {}).filter(u => !u.isAdmin && u.role !== 'admin').map(u => ({
            ...sanitizeUser(u),
            progress: db.progress[u.id] || { streakDays: 0, totalMinutes: 0 }
          }));
          return sendJson(res, 200, { success: true, users: usersList }, req);
        }

        // 2.3 Alta Manual de Alumna
        if (pathname === '/api/admin/users' && req.method === 'POST') {
          const body = await parseJsonBody(req);
          const name = (body.name || '').trim().slice(0, 100);
          const email = (body.email || '').trim().toLowerCase().slice(0, 254);
          const planId = body.planId || 'plan-refugio';
          const isAnnual = Boolean(body.isAnnual);
          const active = body.active !== undefined ? Boolean(body.active) : true;

          if (!name || !email || !email.includes('@')) {
            return sendJson(res, 400, { success: false, message: 'Nombre y correo válido requeridos.' }, req);
          }

          const existing = await getUserByEmail(email) || Object.values(db.users).find(u => (u.email || '').toLowerCase() === email);
          if (existing) {
            return sendJson(res, 409, { success: false, message: 'Ya existe una cuenta con este correo electrónico.' }, req);
          }

          const plan = PLANS_CATALOG[planId] || PLANS_CATALOG['plan-refugio'];
          const newId = 'usr-' + crypto.randomBytes(6).toString('hex');
          const accessCode = `NAMASTE-${plan.tag}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
          const amount = isAnnual ? plan.annualPrice : plan.monthlyPrice;

          // Generar contraseña aleatoria si no se proveyó (NAM-008)
          const initialPwd = body.password || crypto.randomBytes(4).toString('hex') + '!';

          const newUser = {
            id: newId,
            email,
            name,
            accessCode,
            passwordHash: hashPassword(initialPwd),
            planId: plan.id,
            planName: plan.name,
            active,
            status: active ? 'active' : 'suspended_by_admin',
            suspendedByAdmin: !active,
            isAnnual,
            memberSince: new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            nextBillingDate: 'Gestión por Administración',
            paymentMethod: 'Alta Manual Directora',
            billedAmount: amount,
            createdAt: new Date().toISOString()
          };

          db.users[newId] = newUser;
          await syncSingleEntity('user', newUser);

          db.progress[newId] = {
            userId: newId,
            streakDays: 1,
            lastStreakDate: getArgentinaTodayStr(),
            totalMinutes: 0,
            favorites: [],
            completed: [],
            lastPlayed: null
          };
          await syncSingleEntity('progress', db.progress[newId]);
          saveLocalDatabaseCopy();

          recordAuditLog(db, 'USER_CREATED_BY_ADMIN', 'Alta manual de alumna', `${auth.user.name} dio de alta a ${name} (${email})`, email, 'success');

          return sendJson(res, 201, {
            success: true,
            user: sanitizeUser(newUser),
            temporaryPassword: initialPwd,
            message: `Alumna ${name} registrada exitosamente.`
          }, req);
        }

        // 2.4 Edición de Usuaria (NAM-026)
        const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)$/);
        if (adminUserMatch && req.method === 'PUT') {
          const userId = adminUserMatch[1];
          const user = await getUserById(userId) || db.users[userId];
          if (!user) {
            return sendJson(res, 404, { success: false, message: 'Alumna no encontrada.' }, req);
          }

          const body = await parseJsonBody(req);

          if (body.name && typeof body.name === 'string') {
            user.name = body.name.trim().slice(0, 100);
          }

          if (body.email && typeof body.email === 'string') {
            const newEmail = body.email.trim().toLowerCase().slice(0, 254);
            if (newEmail !== user.email) {
              const existingWithEmail = await getUserByEmail(newEmail) || Object.values(db.users).find(u => (u.email || '').toLowerCase() === newEmail && u.id !== userId);
              if (existingWithEmail) {
                return sendJson(res, 409, { success: false, message: 'El correo electrónico ya está registrado en otra cuenta.' }, req);
              }
              user.email = newEmail;
            }
          }

          if (body.active !== undefined) {
            user.active = Boolean(body.active);
            user.suspendedByAdmin = !user.active;
            user.status = user.active ? 'active' : 'suspended_by_admin';
            if (!user.active) {
              await deleteUserSessions(userId);
            }
          }

          if (body.planId && PLANS_CATALOG[body.planId]) {
            const p = PLANS_CATALOG[body.planId];
            user.planId = p.id;
            user.planName = p.name;
          }

          db.users[userId] = user;
          await syncSingleEntity('user', user);
          saveLocalDatabaseCopy();

          recordAuditLog(db, 'USER_MODIFIED', 'Cuenta modificada por Administradora', `Datos de ${user.name} actualizados`, user.email, 'info');

          return sendJson(res, 200, { success: true, user: sanitizeUser(user), message: 'Cuenta actualizada exitosamente.' }, req);
        }

        // 2.5 Eliminación de Usuaria (NAM-027)
        if (adminUserMatch && req.method === 'DELETE') {
          const userId = adminUserMatch[1];
          const user = await getUserById(userId) || db.users[userId];
          if (!user) {
            return sendJson(res, 404, { success: false, message: 'Usuario no encontrado.' }, req);
          }

          if (user.id === auth.user.id) {
            return sendJson(res, 400, { success: false, message: 'No puedes eliminar tu propia cuenta de Administradora.' }, req);
          }

          if (user.isAdmin || user.role === 'admin') {
            const admins = Object.values(db.users).filter(u => u.isAdmin || u.role === 'admin');
            if (admins.length <= 1) {
              return sendJson(res, 400, { success: false, message: 'No se puede eliminar la única Administradora del Shala.' }, req);
            }
          }

          delete db.users[userId];
          delete db.progress[userId];
          await deleteUser(userId);
          saveLocalDatabaseCopy();

          recordAuditLog(db, 'USER_DELETED', 'Baja definitiva de cuenta', `Cuenta de ${user.name} (${user.email}) eliminada`, user.email, 'warning');

          return sendJson(res, 200, { success: true, message: `Cuenta de ${user.name} eliminada con éxito.` }, req);
        }

        // 2.6 Gestión de Clases en BD (NAM-016)
        if (pathname === '/api/admin/classes' && req.method === 'GET') {
          const classes = await getClasses();
          return sendJson(res, 200, { success: true, classes }, req);
        }

        if (pathname === '/api/admin/classes' && req.method === 'POST') {
          const body = await parseJsonBody(req);
          if (!body.title || !body.videoUrl) {
            return sendJson(res, 400, { success: false, message: 'Título y URL de video son requeridos.' }, req);
          }
          await saveClass(body);
          recordAuditLog(db, 'CLASS_SAVED', 'Práctica guardada en catálogo', `Práctica: ${body.title}`, auth.user.email, 'info');
          const updatedClasses = await getClasses();
          return sendJson(res, 200, { success: true, classes: updatedClasses }, req);
        }

        const classDeleteMatch = pathname.match(/^\/api\/admin\/classes\/([a-zA-Z0-9_-]+)$/);
        if (classDeleteMatch && req.method === 'DELETE') {
          const classId = classDeleteMatch[1];
          await deleteClass(classId);
          recordAuditLog(db, 'CLASS_DELETED', 'Práctica eliminada', `ID: ${classId}`, auth.user.email, 'warning');
          const updatedClasses = await getClasses();
          return sendJson(res, 200, { success: true, classes: updatedClasses }, req);
        }

        // 2.7 Configuración de Planes
        if (pathname === '/api/admin/plans' && req.method === 'GET') {
          return sendJson(res, 200, { success: true, plans: db.plans }, req);
        }

        if (pathname === '/api/admin/plans' && req.method === 'POST') {
          const body = await parseJsonBody(req);
          const incoming = body.plans || body;
          if (!incoming || typeof incoming !== 'object') {
            return sendJson(res, 400, { success: false, message: 'Formato de planes inválido.' }, req);
          }
          Object.keys(incoming).forEach(k => {
            if (db.plans[k]) {
              db.plans[k] = { ...db.plans[k], ...incoming[k], updatedAt: new Date().toISOString() };
            }
          });
          saveLocalDatabaseCopy();
          recordAuditLog(db, 'PLANS_UPDATED', 'Precios y enlaces actualizados', 'Configuración de planes modificada por Administradora', auth.user.email, 'info');
          return sendJson(res, 200, { success: true, plans: db.plans }, req);
        }

        // 2.8 Audit Logs & Transactions
        if (pathname === '/api/admin/audit-logs' && req.method === 'GET') {
          return sendJson(res, 200, { success: true, logs: db.auditLogs || [] }, req);
        }

        if (pathname === '/api/admin/transactions' && req.method === 'GET') {
          return sendJson(res, 200, { success: true, transactions: db.transactions || [] }, req);
        }
      }

      return sendJson(res, 404, { success: false, message: 'Endpoint de API no encontrado.' }, req);
    } catch (err) {
      console.error('[API ERROR]', err);
      return sendJson(res, err.statusCode || 500, {
        success: false,
        message: err.message || 'Error interno del servidor.'
      }, req);
    }
  }

  // -----------------------------------------------------------
  // 3. ARCHIVOS ESTÁTICOS CON BLOQUEO ESTRICTO (NAM-018)
  // -----------------------------------------------------------
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '').replace(/\\/g, '/');
  if (!safePath.startsWith('/')) safePath = '/' + safePath;
  if (safePath === '/') safePath = '/index.html';

  const blockedPatterns = [
    /^\/server\.js$/i,
    /^\/db\.js$/i,
    /^\/package.*\.json$/i,
    /^\/\.env/i,
    /^\/\.git/i,
    /^\/scripts/i,
    /^\/scratch/i,
    /^\/docs/i,
    /^\/data/i
  ];

  if (blockedPatterns.some(pattern => pattern.test(safePath))) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acceso denegado: Archivo o directorio restringido por seguridad.');
    return;
  }

  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Recurso no encontrado.');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });

    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(handleRequest);

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL SERVER ERROR] Uncaught exception:', err);
  if (!process.env.VERCEL) {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL SERVER ERROR] Unhandled rejection:', reason);
});

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (!process.env.VERCEL && isMainModule) {
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`[NAMASTÉ] Servidor Seguro Activo en http://localhost:${PORT}`);
    console.log(`[API] http://localhost:${PORT}/api/health`);
    console.log(`======================================================\n`);
  });
}

export default server;
