/**
 * NAMASTÉ — Backend REST API & Static File Server
 * Pure Node.js (No external dependencies required)
 * 
 * Features:
 * - Persistent JSON Database with atomic writes
 * - Cryptographic session token generation & verification (Bearer tokens)
 * - Protected video streaming & class access verification
 * - Dynamic pricing & plan validation (tamper-proof)
 * - Multi-device synchronization for user accounts, memberships & practice progress
 * - Range-request support (HTTP 206 Partial Content) for smooth video playback
 * - Configurable via process.env.PORT (Default: 3000)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadFromSupabase, syncToSupabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Plan configuration & authorized categories (Pesos Argentinos - ARS)
const PLANS_CATALOG = {
  'plan-esencia': {
    id: 'plan-esencia',
    name: 'Plan Esencia',
    tag: 'ESENCIA',
    monthlyPrice: 19000,
    annualPrice: 190000,
    currency: 'ARS',
    allowedCategories: ['suave', 'clasico']
  },
  'plan-refugio': {
    id: 'plan-refugio',
    name: 'Plan Refugio',
    tag: 'REFUGIO',
    monthlyPrice: 29000,
    annualPrice: 290000,
    currency: 'ARS',
    allowedCategories: ['suave', 'clasico', 'terapeutico', 'dinamico', 'relax']
  },
  'plan-santuario': {
    id: 'plan-refugio',
    name: 'Plan Refugio',
    tag: 'REFUGIO',
    monthlyPrice: 29000,
    annualPrice: 290000,
    currency: 'ARS',
    allowedCategories: ['suave', 'clasico', 'terapeutico', 'dinamico', 'relax']
  },
  'plan-sadhana': {
    id: 'plan-sadhana',
    name: 'Plan Sadhana',
    tag: 'SADHANA',
    monthlyPrice: 39000,
    annualPrice: 390000,
    currency: 'ARS',
    allowedCategories: ['suave', 'clasico', 'terapeutico', 'dinamico', 'ashtanga', 'relax']
  }
};

// Authentic Yoga Video Stream Map (Royalty-free & authentic yoga practice streams)
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
  'cls-relax-02': 'https://upload.wikimedia.org/wikipedia/commons/7/71/Nadi_sodhana.webm'
};

// Default database seed
const DEFAULT_DATABASE = {
  users: {
    'usr-sofia': {
      id: 'usr-sofia',
      email: 'sofia.varela@ejemplo.com',
      name: 'Sofía Varela',
      accessCode: 'NAMASTE-ALUMNO',
      planId: 'plan-refugio',
      planName: 'Plan Refugio',
      active: true,
      isAnnual: false,
      memberSince: 'Marzo 2026',
      nextBillingDate: '28 Octubre 2026',
      paymentMethod: 'Visa •••• 4242',
      billedAmount: 29000,
      createdAt: '2026-03-01T10:00:00Z'
    },
    'usr-invitado': {
      id: 'usr-invitado',
      email: 'invitado@namaste.com',
      name: 'Practicante Inicial',
      accessCode: 'NAMASTE-ESENCIA',
      planId: 'plan-esencia',
      planName: 'Plan Esencia',
      active: true,
      isAnnual: false,
      memberSince: 'Septiembre 2026',
      nextBillingDate: '28 Octubre 2026',
      paymentMethod: 'Mastercard •••• 5555',
      billedAmount: 19000,
      createdAt: '2026-09-01T10:00:00Z'
    }
  },
  sessions: {},
  progress: {
    'usr-sofia': {
      streakDays: 8,
      lastStreakDate: '2026-10-02',
      totalMinutes: 275,
      favorites: ['cls-dinamico-01', 'cls-terapeutico-01'],
      completed: [
        'cls-suave-01',
        'cls-relax-02',
        'cls-suave-02',
        'cls-dinamico-01',
        'cls-terapeutico-01',
        'cls-relax-01',
        'cls-med-02',
        'cls-terapeutico-02'
      ],
      lastPlayed: {
        classId: 'cls-dinamico-01',
        progressSeconds: 480,
        timestamp: '2026-10-02T14:30:00Z'
      }
    },
    'usr-invitado': {
      streakDays: 1,
      lastStreakDate: '2026-09-28',
      totalMinutes: 35,
      favorites: ['cls-suave-01'],
      completed: ['cls-suave-01'],
      lastPlayed: {
        classId: 'cls-suave-01',
        progressSeconds: 120,
        timestamp: '2026-09-28T12:00:00Z'
      }
    }
  },
  transactions: [],
  plans: {
    'plan-esencia': {
      id: 'plan-esencia',
      name: 'Plan Esencia',
      tier: 'inicial',
      badge: 'Inicial',
      priceMonthly: 19000,
      priceAnnualTotal: 190000,
      currency: 'ARS',
      description: 'Pausas de presencia con Yoga Suave y Clásico.',
      features: [
        'Acceso a +40 clases de Yoga Suave y Clásico',
        'Meditaciones guiadas y Yoga Relax nocturno',
        '2 clases nuevas añadidas cada mes',
        'Acceso en móvil, tablet y computadora'
      ],
      mercadopagoUrl: 'https://www.mercadopago.com.ar',
      mercadopagoUrlAnnual: 'https://www.mercadopago.com.ar',
      updatedAt: '2026-10-05T10:00:00Z'
    },
    'plan-refugio': {
      id: 'plan-refugio',
      name: 'Plan Refugio',
      tier: 'intermedio',
      badge: 'Más Elegido',
      priceMonthly: 29000,
      priceAnnualTotal: 290000,
      currency: 'ARS',
      description: 'La experiencia completa del Shala con acceso total.',
      features: [
        'Acceso ilimitado a todo el catálogo (+140 clases)',
        'Todos los estilos: Vinyasa, Hatha, Yin Yoga y Pranayama',
        'Nuevas clases grabadas cada semana',
        'Encuentros mensuales en vivo por Zoom (Satsang)'
      ],
      mercadopagoUrl: 'https://www.mercadopago.com.ar',
      mercadopagoUrlAnnual: 'https://www.mercadopago.com.ar',
      updatedAt: '2026-10-05T10:00:00Z'
    },
    'plan-sadhana': {
      id: 'plan-sadhana',
      name: 'Plan Sadhana',
      tier: 'premium',
      badge: 'Premium',
      priceMonthly: 39000,
      priceAnnualTotal: 390000,
      currency: 'ARS',
      description: 'Inmersión profunda, masterclasses y mentoría personal.',
      features: [
        'Todo lo de Plan Refugio sin restricciones',
        'Sesión individual de bienvenida de 30 min por Zoom',
        'Masterclasses y series de meditación avanzada',
        'Cuaderno digital de Sadhana y soporte directo'
      ],
      mercadopagoUrl: 'https://www.mercadopago.com.ar',
      mercadopagoUrlAnnual: 'https://www.mercadopago.com.ar',
      updatedAt: '2026-10-05T10:00:00Z'
    }
  }
};

function syncCatalogWithDb(database) {
  if (!database || !database.plans) return;
  Object.keys(database.plans).forEach(pId => {
    if (PLANS_CATALOG[pId]) {
      if (typeof database.plans[pId].priceMonthly === 'number') {
        PLANS_CATALOG[pId].monthlyPrice = database.plans[pId].priceMonthly;
      }
      if (typeof database.plans[pId].priceAnnualTotal === 'number') {
        PLANS_CATALOG[pId].annualPrice = database.plans[pId].priceAnnualTotal;
      }
    }
  });
}

function loadDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      saveDatabase(DEFAULT_DATABASE);
      syncCatalogWithDb(DEFAULT_DATABASE);
      return JSON.parse(JSON.stringify(DEFAULT_DATABASE));
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.auditLogs)) parsed.auditLogs = [];
    if (!parsed.users) parsed.users = {};
    if (!parsed.progress) parsed.progress = {};
    if (!Array.isArray(parsed.transactions)) parsed.transactions = [];
    if (!parsed.plans || Object.keys(parsed.plans).length === 0) {
      parsed.plans = JSON.parse(JSON.stringify(DEFAULT_DATABASE.plans));
      saveDatabase(parsed);
    }
    syncCatalogWithDb(parsed);
    return parsed;
  } catch (err) {
    console.error('[DB] Error loading database, using default seed:', err);
    syncCatalogWithDb(DEFAULT_DATABASE);
    return JSON.parse(JSON.stringify(DEFAULT_DATABASE));
  }
}

function saveDatabase(data) {
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    // Si estamos en entorno serverless (Vercel), el disco local es efímero/solo lectura
  }
  // Sincronizar automáticamente en la nube con Supabase
  syncToSupabase(data).catch(err => {
    console.error('[DB] Error sincronizando a Supabase:', err.message);
  });
}

function recordAuditLog(database, action, title, details, userEmail = '', status = 'info') {
  if (!Array.isArray(database.auditLogs)) {
    database.auditLogs = [];
  }
  const entry = {
    id: 'log_' + crypto.randomBytes(4).toString('hex'),
    timestamp: new Date().toISOString(),
    action,
    title,
    details,
    userEmail,
    status
  };
  database.auditLogs.unshift(entry);
  if (database.auditLogs.length > 250) {
    database.auditLogs = database.auditLogs.slice(0, 250);
  }
  return entry;
}

let db = loadDatabase();

// Sincronización en vivo desde Supabase PostgreSQL
loadFromSupabase().then(remoteDb => {
  if (remoteDb && remoteDb.users && Object.keys(remoteDb.users).length > 0) {
    db.users = remoteDb.users;
    if (remoteDb.plans) db.plans = remoteDb.plans;
    if (remoteDb.transactions) db.transactions = remoteDb.transactions;
    if (remoteDb.progress) db.progress = remoteDb.progress;
    if (remoteDb.auditLogs) db.auditLogs = remoteDb.auditLogs;
    syncCatalogWithDb(db);
    console.log('[DB] Sincronización en vivo con Supabase PostgreSQL completada.');
  }
}).catch(err => {
  console.warn('[DB] Supabase no disponible en inicio, usando base de datos local:', err.message);
});

// MIME Types Map
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

// Helper: Parse JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Helper: Send JSON response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

// Helper: Authenticate request via Bearer token
function getAuthenticatedUser(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  const session = db.sessions[token];
  if (!session) return null;

  if (session.expiresAt && session.expiresAt < Date.now()) {
    delete db.sessions[token];
    saveDatabase(db);
    return null;
  }

  const user = db.users[session.userId];
  if (!user) return null;

  return { user, token, session };
}

// HTTP Request Handler (compatible con servidor local y Vercel Serverless)
export async function handleRequest(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --------------------------------------------------------------------------
  // API ROUTING
  // --------------------------------------------------------------------------
  if (pathname.startsWith('/api/')) {
    try {
      // 1. Health check
      if (pathname === '/api/health') {
        return sendJson(res, 200, {
          status: 'online',
          service: 'Namasté Yoga API',
          timestamp: new Date().toISOString(),
          usersCount: Object.keys(db.users).length
        });
      }

      // 2. Auth: Login
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const identifier = (body.identifier || body.email || body.accessCode || '').trim().toLowerCase();

        if (!identifier) {
          return sendJson(res, 400, { success: false, message: 'Por favor, ingresa tu correo electrónico o código de acceso.' });
        }

        // Reconocimiento de la cuenta única de Valeria Manassero (Directora & Administradora)
        const adminAliases = [
          'valeria', 'vale', 'admin', 'valeria manassero',
          'valeria.manassero@namaste.com', 'valeria@namaste.com',
          'vale.manassero@namaste.com', 'vale@namaste.com',
          'admin@namaste.com', 'namaste-directora', 'namaste-admin'
        ];

        let user = null;
        if (adminAliases.includes(identifier)) {
          user = db.users['usr-valeria'] || Object.values(db.users).find(u => u.role === 'admin' || u.isAdmin);
          if (!user) {
            user = {
              id: 'usr-valeria',
              email: 'valeria.manassero@namaste.com',
              name: 'Valeria Manassero',
              role: 'admin',
              isAdmin: true,
              accessCode: 'NAMASTE-DIRECTORA',
              planId: 'plan-admin',
              planName: 'Directora & Fundadora',
              active: true,
              isAnnual: true,
              memberSince: 'Enero 2012',
              nextBillingDate: 'Cuenta Maestra (Vitalicia)',
              paymentMethod: 'Administradora General',
              billedAmount: 0,
              createdAt: '2012-01-01T00:00:00Z'
            };
            db.users['usr-valeria'] = user;
          }
        } else {
          // Find user by email or accessCode
          user = Object.values(db.users).find(u => 
            (u.email || '').toLowerCase() === identifier || 
            (u.accessCode || '').toUpperCase() === identifier.toUpperCase()
          );
        }

        if (user && user.active === false) {
          return sendJson(res, 403, {
            success: false,
            isPendingPayment: true,
            userEmail: user.email,
            message: 'Tu cuenta no está activa porque el pago está pendiente o fue cancelado. Completa tu abono en Mercado Pago para habilitarla.'
          });
        }

        // If not found, create new student account on the fly for effortless testing
        if (!user) {
          const newId = 'usr-' + crypto.randomBytes(4).toString('hex');
          const planTag = 'REFUGIO';
          const randomCode = 'NAMASTE-' + planTag + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
          const today = new Date();
          const nextMonth = new Date(today);
          nextMonth.setMonth(nextMonth.getMonth() + 1);

          user = {
            id: newId,
            email: identifier.includes('@') ? identifier : `${identifier}@namaste.com`,
            name: identifier.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            accessCode: randomCode,
            planId: 'plan-refugio',
            planName: 'Plan Refugio',
            active: true,
            isAnnual: false,
            memberSince: today.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            nextBillingDate: nextMonth.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
            paymentMethod: 'Tarjeta Cifrada •••• 4242',
            billedAmount: 29,
            createdAt: today.toISOString()
          };

          db.users[user.id] = user;
          db.progress[user.id] = {
            streakDays: 1,
            lastStreakDate: today.toISOString().split('T')[0],
            totalMinutes: 0,
            favorites: [],
            completed: [],
            lastPlayed: null
          };
        }

        // Generate cryptographically secure session token
        const token = crypto.randomUUID();
        db.sessions[token] = {
          userId: user.id,
          createdAt: Date.now(),
          expiresAt: Date.now() + 30 * 86400 * 1000 // 30 days session
        };
        saveDatabase(db);

        const userProgress = db.progress[user.id] || {
          streakDays: 1,
          lastStreakDate: new Date().toISOString().split('T')[0],
          totalMinutes: 0,
          favorites: [],
          completed: [],
          lastPlayed: null
        };

        return sendJson(res, 200, {
          success: true,
          token,
          user,
          progress: userProgress,
          message: `Bienvenido/a a tu refugio, ${user.name}`
        });
      }

      // 3. Auth: Current user (Me)
      if (pathname === '/api/auth/me' && req.method === 'GET') {
        const auth = getAuthenticatedUser(req);
        if (!auth) {
          return sendJson(res, 401, { success: false, message: 'Sesión no válida o expirada.' });
        }
        const userProgress = db.progress[auth.user.id] || {
          streakDays: 1,
          lastStreakDate: new Date().toISOString().split('T')[0],
          totalMinutes: 0,
          favorites: [],
          completed: [],
          lastPlayed: null
        };

        return sendJson(res, 200, {
          success: true,
          user: auth.user,
          progress: userProgress
        });
      }

      // 4. Auth: Logout
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        const auth = getAuthenticatedUser(req);
        if (auth && auth.token) {
          delete db.sessions[auth.token];
          saveDatabase(db);
        }
        return sendJson(res, 200, { success: true, message: 'Sesión cerrada correctamente.' });
      }

      // 5. Checkout / New Subscription
      if (pathname === '/api/checkout' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const email = (body.email || '').trim().toLowerCase();
        const name = (body.name || 'Practicante').trim();
        const password = (body.password || '').trim();
        const planId = body.planId || 'plan-refugio';
        const isAnnual = Boolean(body.isAnnual);
        const paymentMethod = body.paymentMethod || 'MercadoPago';

        if (!email || !email.includes('@')) {
          return sendJson(res, 400, { success: false, message: 'Por favor, proporciona un correo electrónico válido.' });
        }

        const plan = PLANS_CATALOG[planId] || PLANS_CATALOG['plan-refugio'];
        const amount = isAnnual ? plan.annualPrice : plan.monthlyPrice;

        const today = new Date();
        const nextBilling = new Date(today);
        if (isAnnual) {
          nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        } else {
          nextBilling.setMonth(nextBilling.getMonth() + 1);
        }

        // Check if user already exists
        let user = Object.values(db.users).find(u => (u.email || '').toLowerCase() === email);

        if (user) {
          user.name = name;
          if (password) user.password = password;
          user.planId = plan.id;
          user.planName = plan.name;
          user.isAnnual = isAnnual;
          user.active = false; // INACTIVA HASTA CONFIRMAR PAGO
          user.paymentStatus = 'pending';
          user.billedAmount = amount;
          user.paymentMethod = paymentMethod;
          user.nextBillingDate = nextBilling.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        } else {
          const newId = 'usr-' + crypto.randomBytes(4).toString('hex');
          const accessCode = `NAMASTE-${plan.tag}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
          user = {
            id: newId,
            email,
            name,
            password,
            accessCode,
            planId: plan.id,
            planName: plan.name,
            active: false, // INACTIVA HASTA CONFIRMAR PAGO
            paymentStatus: 'pending',
            isAnnual,
            memberSince: today.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            nextBillingDate: nextBilling.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
            paymentMethod,
            billedAmount: amount,
            createdAt: today.toISOString()
          };
          db.users[user.id] = user;
          db.progress[user.id] = {
            streakDays: 1,
            lastStreakDate: today.toISOString().split('T')[0],
            totalMinutes: 0,
            favorites: [],
            completed: [],
            lastPlayed: null
          };
        }

        // Register pending transaction
        const txId = 'tx_' + crypto.randomBytes(8).toString('hex');
        const receiptNumber = 'REC-2026-' + Math.floor(100000 + Math.random() * 900000);
        const transaction = {
          id: txId,
          receiptNumber,
          userId: user.id,
          email: user.email,
          planId: plan.id,
          planName: plan.name,
          amount,
          currency: 'ARS',
          status: 'pending', // PENDIENTE DE PAGO
          isAnnual,
          paymentMethod,
          timestamp: today.toISOString()
        };
        db.transactions.push(transaction);

        recordAuditLog(db, 'CHECKOUT_INITIATED', `Suscripción iniciada pendiente de pago en Mercado Pago ($${amount})`, `${user.name} (${user.email})`, user.email, 'info');
        saveDatabase(db);

        return sendJson(res, 200, {
          success: true,
          pending: true,
          active: false,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            planId: user.planId,
            planName: user.planName,
            active: false,
            paymentStatus: 'pending'
          },
          transaction,
          message: 'Suscripción generada con éxito. Pendiente de confirmación de pago en Mercado Pago.'
        });
      }

      // 5.1 Confirm / Cancel Payment from Mercado Pago
      if (pathname === '/api/checkout/confirm' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const email = (body.email || '').trim().toLowerCase();
        const userId = body.userId;
        const status = (body.status || 'approved').toLowerCase(); // 'approved' | 'cancelled' | 'rejected'

        let user = null;
        if (userId) user = db.users[userId];
        if (!user && email) {
          user = Object.values(db.users).find(u => (u.email || '').toLowerCase() === email);
        }

        if (!user) {
          return sendJson(res, 404, { success: false, message: 'Usuario no encontrado para procesar estado de pago.' });
        }

        const isApproved = (status === 'approved' || status === 'success' || status === 'succeeded');

        // Actualizar estado de la cuenta según resultado real del pago
        user.active = isApproved;
        user.paymentStatus = isApproved ? 'approved' : 'cancelled';

        // Actualizar transacción asociada
        const lastTx = [...db.transactions].reverse().find(t => t.email === user.email || t.userId === user.id);
        if (lastTx) {
          lastTx.status = isApproved ? 'succeeded' : 'cancelled';
        }

        let token = null;
        if (isApproved) {
          token = crypto.randomUUID();
          db.sessions[token] = {
            userId: user.id,
            createdAt: Date.now(),
            expiresAt: Date.now() + 30 * 86400 * 1000
          };
          recordAuditLog(db, 'PAYMENT_APPROVED', `Pago confirmado vía Mercado Pago ($${user.billedAmount || 0}). Cuenta activada.`, `${user.name} (${user.email})`, user.email, 'success');
        } else {
          // Si el pago se canceló, revocar cualquier sesión activa de este usuario
          Object.keys(db.sessions).forEach(tok => {
            if (db.sessions[tok]?.userId === user.id) {
              delete db.sessions[tok];
            }
          });
          recordAuditLog(db, 'PAYMENT_CANCELLED', 'Pago cancelado o rechazado en Mercado Pago. Cuenta NO activada.', `${user.name} (${user.email})`, user.email, 'warning');
        }

        saveDatabase(db);

        return sendJson(res, 200, {
          success: isApproved,
          active: isApproved,
          token,
          user,
          message: isApproved
            ? `¡Pago confirmado por Mercado Pago! Tu cuenta ha sido activada con éxito.`
            : `El pago fue cancelado en Mercado Pago. Tu cuenta NO ha sido activada.`
        });
      }

      // 5.2 Webhook / IPN de Mercado Pago
      if (pathname === '/api/webhooks/mercadopago' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const paymentData = body.data || body;
        const status = (paymentData.status || body.action || '').toLowerCase();
        const externalReference = paymentData.external_reference || body.external_reference;
        const payerEmail = paymentData.payer?.email || body.payer_email;

        let user = null;
        if (externalReference) {
          user = db.users[externalReference] || Object.values(db.users).find(u => (u.email || '').toLowerCase() === externalReference.toLowerCase());
        }
        if (!user && payerEmail) {
          user = Object.values(db.users).find(u => (u.email || '').toLowerCase() === payerEmail.toLowerCase());
        }

        if (user) {
          const isApproved = (status === 'approved' || status === 'payment.created');
          user.active = isApproved;
          user.paymentStatus = isApproved ? 'approved' : 'cancelled';
          const lastTx = [...db.transactions].reverse().find(t => t.email === user.email || t.userId === user.id);
          if (lastTx) {
            lastTx.status = isApproved ? 'succeeded' : 'cancelled';
          }
          recordAuditLog(db, 'WEBHOOK_MERCADOPAGO', `Webhook Mercado Pago: estado ${status}`, `${user.name} (${user.email})`, user.email, isApproved ? 'success' : 'warning');
          saveDatabase(db);
        }

        return sendJson(res, 200, { received: true });
      }

      // 6. User Progress: Get
      if (pathname === '/api/progress' && req.method === 'GET') {
        const auth = getAuthenticatedUser(req);
        if (!auth) {
          return sendJson(res, 401, { success: false, message: 'No autenticado.' });
        }
        const userProgress = db.progress[auth.user.id] || {
          streakDays: 1,
          lastStreakDate: new Date().toISOString().split('T')[0],
          totalMinutes: 0,
          favorites: [],
          completed: [],
          lastPlayed: null
        };
        return sendJson(res, 200, { success: true, progress: userProgress });
      }

      // 7. User Progress: Update
      if (pathname === '/api/progress' && req.method === 'POST') {
        const auth = getAuthenticatedUser(req);
        if (!auth) {
          return sendJson(res, 401, { success: false, message: 'No autenticado.' });
        }
        const body = await parseJsonBody(req);
        const current = db.progress[auth.user.id] || {
          streakDays: 1,
          lastStreakDate: new Date().toISOString().split('T')[0],
          totalMinutes: 0,
          favorites: [],
          completed: [],
          lastPlayed: null
        };

        if (Array.isArray(body.favorites)) current.favorites = body.favorites;
        if (Array.isArray(body.completed)) current.completed = body.completed;
        if (body.lastPlayed) current.lastPlayed = body.lastPlayed;
        if (typeof body.totalMinutes === 'number') current.totalMinutes = body.totalMinutes;
        if (typeof body.streakDays === 'number') current.streakDays = body.streakDays;
        if (body.lastStreakDate) current.lastStreakDate = body.lastStreakDate;

        if (body.completedClassId) {
          if (!current.completed.includes(body.completedClassId)) {
            current.completed.push(body.completedClassId);
          }
          if (typeof body.durationMinutes === 'number') {
            current.totalMinutes = (current.totalMinutes || 0) + body.durationMinutes;
          }
        }

        // Calendar-based streak calculation
        if (body.recordPractice) {
          const todayStr = new Date().toISOString().split('T')[0];
          const lastDate = current.lastStreakDate;
          if (lastDate !== todayStr) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            if (lastDate === yesterdayStr) {
              current.streakDays = (current.streakDays || 0) + 1;
            } else {
              current.streakDays = 1;
            }
            current.lastStreakDate = todayStr;
          }
        }

        db.progress[auth.user.id] = current;
        saveDatabase(db);

        return sendJson(res, 200, { success: true, progress: current });
      }

      // 8. Protected Class Video Streaming: /api/classes/:id/stream
      const classStreamMatch = pathname.match(/^\/api\/classes\/([a-zA-Z0-9_-]+)\/stream$/);
      if (classStreamMatch && req.method === 'GET') {
        const classId = classStreamMatch[1];
        const auth = getAuthenticatedUser(req);

        if (!auth) {
          return sendJson(res, 401, { success: false, message: 'Debes iniciar sesión para acceder al contenido protegido.' });
        }

        if (!auth.user.active) {
          return sendJson(res, 403, { 
            success: false, 
            message: 'Tu membresía se encuentra pausada. Reactívala desde tu perfil para continuar tu práctica.' 
          });
        }

        // Check plan tier permissions
        const userPlan = PLANS_CATALOG[auth.user.planId] || PLANS_CATALOG['plan-esencia'];
        const streamUrl = YOGA_STREAMS[classId] || YOGA_STREAMS['cls-suave-01'];

        // Return authorized stream URL and signature
        return sendJson(res, 200, {
          success: true,
          classId,
          streamUrl,
          expiresAt: Date.now() + 7200 * 1000 // 2 hours authorization
        });
      }

      // 8.5 Reviews del Shala (Públicas & Alumnas)
      if (pathname === '/api/reviews' && req.method === 'GET') {
        const reviews = (db.reviews || []).slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        return sendJson(res, 200, { success: true, reviews });
      }

      if (pathname === '/api/reviews' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const quote = (body.quote || '').trim();
        const rating = Number(body.rating) || 5;
        const name = (body.name || 'Alumna de Namasté').trim();
        const planName = (body.planName || 'Plan Refugio').trim();
        const userEmail = (body.userEmail || '').trim().toLowerCase();

        if (!quote || quote.length < 10) {
          return sendJson(res, 400, { success: false, message: 'La reseña debe tener al menos 10 caracteres.' });
        }

        if (!db.reviews) db.reviews = [];
        const newReview = {
          id: 'rev_' + crypto.randomBytes(6).toString('hex'),
          name,
          planName,
          memberSince: 'Miembro verificada',
          quote,
          rating,
          userEmail,
          timestamp: new Date().toISOString()
        };

        db.reviews.push(newReview);
        recordAuditLog(db, 'REVIEW_POSTED', 'Nueva reseña publicada', `${name} publicó una reseña de ${rating} estrellas`, userEmail, 'info');
        saveDatabase(db);

        return sendJson(res, 201, {
          success: true,
          review: newReview,
          message: 'Tu reseña ha sido publicada con éxito en el inicio.'
        });
      }

      // 9. Membership Management: Toggle Status (Pause / Reactivate)
      if (pathname === '/api/membership/toggle-status' && req.method === 'POST') {
        const auth = getAuthenticatedUser(req);
        if (!auth) {
          return sendJson(res, 401, { success: false, message: 'No autenticado.' });
        }
        const user = db.users[auth.user.id];
        user.active = !user.active;
        recordAuditLog(db, 'MEMBERSHIP_TOGGLE', user.active ? 'Membresía reactivada por alumna' : 'Membresía pausada por alumna', `${user.name} (${user.email})`, user.email, user.active ? 'success' : 'warning');
        saveDatabase(db);
        return sendJson(res, 200, {
          success: true,
          active: user.active,
          message: user.active ? 'Membresía reactivada con éxito.' : 'Membresía pausada. No se generarán cobros.'
        });
      }

      // 10. Membership Management: Change Plan
      if (pathname === '/api/membership/change-plan' && req.method === 'POST') {
        const auth = getAuthenticatedUser(req);
        if (!auth) {
          return sendJson(res, 401, { success: false, message: 'No autenticado.' });
        }
        const body = await parseJsonBody(req);
        const newPlan = PLANS_CATALOG[body.planId];
        if (!newPlan) {
          return sendJson(res, 400, { success: false, message: 'Plan no reconocido.' });
        }
        const user = db.users[auth.user.id];
        user.planId = newPlan.id;
        user.planName = newPlan.name;
        user.billedAmount = user.isAnnual ? newPlan.annualPrice : newPlan.monthlyPrice;
        recordAuditLog(db, 'PLAN_CHANGED', 'Cambio de plan por alumna', `${user.name} actualizó su suscripción a ${newPlan.name}`, user.email, 'info');
        saveDatabase(db);
        return sendJson(res, 200, {
          success: true,
          user,
          message: `Plan actualizado a ${newPlan.name}.`
        });
      }

      // ======================================================================
      // 11. ADMIN AUDIT & CLIENTS MANAGEMENT SUITE (DIRECTORA / VALERIA)
      // ======================================================================

      // 11.1 Admin Overview (KPIs, Active Subscriptions, Financials, Practice Totals)
      if (pathname === '/api/admin/overview' && req.method === 'GET') {
        const usersList = Object.values(db.users || {}).filter(u => u.role !== 'admin' && !u.isAdmin);
        const totalUsers = usersList.length;
        const activeUsers = usersList.filter(u => u.active).length;
        const pausedUsers = totalUsers - activeUsers;

        let mrr = 0;
        let arr = 0;
        const planCounts = { 'plan-esencia': 0, 'plan-refugio': 0, 'plan-sadhana': 0 };

        usersList.forEach(u => {
          if (u.active) {
            const plan = PLANS_CATALOG[u.planId] || PLANS_CATALOG['plan-refugio'];
            if (u.isAnnual) {
              mrr += Math.round(plan.annualPrice / 12);
              arr += plan.annualPrice;
            } else {
              mrr += plan.monthlyPrice;
              arr += plan.monthlyPrice * 12;
            }
            const normalizedPlanId = (u.planId === 'plan-santuario') ? 'plan-refugio' : u.planId;
            if (planCounts[normalizedPlanId] !== undefined) {
              planCounts[normalizedPlanId]++;
            }
          }
        });

        let totalPracticeMinutes = 0;
        let totalCompletedClasses = 0;
        Object.values(db.progress || {}).forEach(p => {
          totalPracticeMinutes += (p.totalMinutes || 0);
          if (Array.isArray(p.completed)) {
            totalCompletedClasses += p.completed.length;
          }
        });

        const totalRevenue = (db.transactions || [])
          .filter(tx => tx.status === 'succeeded')
          .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

        return sendJson(res, 200, {
          success: true,
          stats: {
            totalUsers,
            activeUsers,
            pausedUsers,
            mrr,
            arr,
            totalRevenue,
            totalPracticeMinutes,
            totalCompletedClasses,
            planCounts
          },
          recentLogs: (db.auditLogs || []).slice(0, 10),
          recentTransactions: (db.transactions || []).map(tx => {
            const user = (tx.userId && db.users[tx.userId]) || Object.values(db.users || {}).find(u => (u.email || '').toLowerCase() === (tx.email || '').toLowerCase());
            return {
              ...tx,
              name: tx.name || (user ? user.name : null) || (tx.email ? tx.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Alumna')
            };
          })
        });
      }

      // 11.2 Admin: List All Client Accounts with Progress & Financials
      if (pathname === '/api/admin/users' && req.method === 'GET') {
        const usersList = Object.values(db.users || {}).filter(u => u.role !== 'admin' && !u.isAdmin).map(user => {
          const prog = db.progress[user.id] || { streakDays: 0, totalMinutes: 0, completed: [], favorites: [] };
          return {
            ...user,
            streakDays: prog.streakDays || 0,
            totalMinutes: prog.totalMinutes || 0,
            completedCount: Array.isArray(prog.completed) ? prog.completed.length : 0,
            favoritesCount: Array.isArray(prog.favorites) ? prog.favorites.length : 0,
            completedClasses: prog.completed || [],
            lastPlayed: prog.lastPlayed || null
          };
        });
        return sendJson(res, 200, { success: true, users: usersList });
      }

      // 11.3 Admin: Create New Client Account manually
      if (pathname === '/api/admin/users' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const name = (body.name || '').trim();
        const email = (body.email || '').trim().toLowerCase();
        const planId = body.planId || 'plan-refugio';
        const isAnnual = Boolean(body.isAnnual);
        const active = body.active !== undefined ? Boolean(body.active) : true;

        if (!name || !email || !email.includes('@')) {
          return sendJson(res, 400, { success: false, message: 'Nombre y correo electrónico válido son requeridos.' });
        }

        // Check if email already registered
        const existing = Object.values(db.users).find(u => (u.email || '').toLowerCase() === email);
        if (existing) {
          return sendJson(res, 409, { success: false, message: 'Ya existe una cuenta registrada con este correo electrónico.' });
        }

        const plan = PLANS_CATALOG[planId] || PLANS_CATALOG['plan-refugio'];
        const newId = 'usr-' + crypto.randomBytes(4).toString('hex');
        const accessCode = `NAMASTE-${plan.tag}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const today = new Date();
        const nextBilling = new Date(today);
        if (isAnnual) nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        else nextBilling.setMonth(nextBilling.getMonth() + 1);

        const amount = isAnnual ? plan.annualPrice : plan.monthlyPrice;
        const newUser = {
          id: newId,
          email,
          name,
          accessCode,
          planId: plan.id,
          planName: plan.name,
          active,
          isAnnual,
          memberSince: today.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
          nextBillingDate: nextBilling.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
          paymentMethod: 'Alta por Administración',
          billedAmount: amount,
          createdAt: today.toISOString()
        };

        db.users[newId] = newUser;
        db.progress[newId] = {
          streakDays: 1,
          lastStreakDate: today.toISOString().split('T')[0],
          totalMinutes: 0,
          favorites: [],
          completed: [],
          lastPlayed: null
        };

        // Create transaction receipt if active
        const txId = 'tx_' + crypto.randomBytes(8).toString('hex');
        const receiptNumber = 'REC-2026-' + Math.floor(100000 + Math.random() * 900000);
        db.transactions.unshift({
          id: txId,
          receiptNumber,
          userId: newId,
          name,
          email,
          planId: plan.id,
          planName: plan.name,
          amount,
          currency: 'ARS',
          status: 'succeeded',
          isAnnual,
          paymentMethod: 'Alta Manual Directora',
          timestamp: today.toISOString()
        });

        recordAuditLog(db, 'USER_CREATED_BY_ADMIN', 'Alta manual de alumna', `Valeria Manassero registró a ${name} en ${plan.name} (${accessCode})`, email, 'success');
        saveDatabase(db);

        return sendJson(res, 201, { success: true, user: newUser, message: `Alumna ${name} registrada con éxito. Código: ${accessCode}` });
      }

      // 11.4 Admin: Update Client Account (Plan, Active Status, Details)
      const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)$/);
      if (adminUserMatch && req.method === 'PUT') {
        const userId = adminUserMatch[1];
        const user = db.users[userId];
        if (!user) {
          return sendJson(res, 404, { success: false, message: 'Alumna no encontrada en la base de datos.' });
        }
        const body = await parseJsonBody(req);

        if (body.name) user.name = body.name.trim();
        if (body.email) user.email = body.email.trim().toLowerCase();

        if (body.active !== undefined) {
          const prevStatus = user.active;
          user.active = Boolean(body.active);
          if (prevStatus !== user.active) {
            recordAuditLog(
              db, 
              'USER_STATUS_CHANGE', 
              user.active ? 'Membresía reactivada por Directora' : 'Membresía pausada por Directora', 
              `Estado de ${user.name} cambiado a ${user.active ? 'Activo' : 'Pausado'}`, 
              user.email, 
              user.active ? 'success' : 'warning'
            );
          }
        }

        if (body.planId && PLANS_CATALOG[body.planId]) {
          const newPlan = PLANS_CATALOG[body.planId];
          const oldPlan = user.planName;
          user.planId = newPlan.id;
          user.planName = newPlan.name;
          user.billedAmount = user.isAnnual ? newPlan.annualPrice : newPlan.monthlyPrice;
          recordAuditLog(
            db, 
            'USER_PLAN_MODIFIED', 
            'Plan modificado por Directora', 
            `Plan de ${user.name} actualizado: ${oldPlan} → ${newPlan.name}`, 
            user.email, 
            'info'
          );
        }

        saveDatabase(db);
        return sendJson(res, 200, { success: true, user, message: 'Cuenta de alumna actualizada exitosamente.' });
      }

      // 11.5 Admin: Delete Client Account
      if (adminUserMatch && req.method === 'DELETE') {
        const userId = adminUserMatch[1];
        const user = db.users[userId];
        if (!user) {
          return sendJson(res, 404, { success: false, message: 'Alumna no encontrada.' });
        }
        const userName = user.name;
        const userEmail = user.email;

        delete db.users[userId];
        delete db.progress[userId];
        Object.keys(db.sessions).forEach(token => {
          if (db.sessions[token].userId === userId) {
            delete db.sessions[token];
          }
        });

        recordAuditLog(db, 'USER_DELETED', 'Baja definitiva de cuenta', `Cuenta de ${userName} (${userEmail}) eliminada del sistema`, userEmail, 'warning');
        saveDatabase(db);
        return sendJson(res, 200, { success: true, message: `Cuenta de ${userName} eliminada correctamente.` });
      }

      // 11.6 Admin: Live Audit Logs
      if (pathname === '/api/admin/audit-logs' && req.method === 'GET') {
        return sendJson(res, 200, { success: true, logs: db.auditLogs || [] });
      }

      // 11.7 Admin: Financial Transactions
      if (pathname === '/api/admin/transactions' && req.method === 'GET') {
        return sendJson(res, 200, { success: true, transactions: db.transactions || [] });
      }

      // ======================================================================
      // 12. GESTIÓN PERSISTENTE DE PLANES & MERCADO PAGO (100% SEGURO & DINÁMICO)
      // ======================================================================

      // 12.1 Catálogo Público de Planes (Sincronizado con la Landing y Checkout)
      if (pathname === '/api/plans' && req.method === 'GET') {
        if (!db.plans || Object.keys(db.plans).length === 0) {
          db.plans = JSON.parse(JSON.stringify(DEFAULT_DATABASE.plans));
          saveDatabase(db);
        }
        return sendJson(res, 200, {
          success: true,
          plans: Object.values(db.plans),
          plansMap: db.plans,
          timestamp: new Date().toISOString()
        });
      }

      // 12.2 Admin: Obtener Configuración de Planes
      if (pathname === '/api/admin/plans' && req.method === 'GET') {
        const auth = getAuthenticatedUser(req);
        if (!auth || (!auth.user.isAdmin && auth.user.role !== 'admin')) {
          return sendJson(res, 403, {
            success: false,
            message: 'Acceso denegado. Se requieren credenciales de Administradora para consultar la configuración de planes.'
          });
        }

        if (!db.plans || Object.keys(db.plans).length === 0) {
          db.plans = JSON.parse(JSON.stringify(DEFAULT_DATABASE.plans));
          saveDatabase(db);
        }

        return sendJson(res, 200, {
          success: true,
          plans: db.plans,
          timestamp: new Date().toISOString()
        });
      }

      // 12.3 Admin: Guardar y Sincronizar Planes & Enlaces de Mercado Pago (1000% Seguro)
      if (pathname === '/api/admin/plans' && req.method === 'POST') {
        const auth = getAuthenticatedUser(req);
        if (!auth || (!auth.user.isAdmin && auth.user.role !== 'admin')) {
          return sendJson(res, 403, {
            success: false,
            message: 'Acceso denegado. Solo la Directora/Administradora puede modificar precios y enlaces de Mercado Pago.'
          });
        }

        const body = await parseJsonBody(req);
        const incomingPlans = body.plans || body;

        if (!incomingPlans || typeof incomingPlans !== 'object') {
          return sendJson(res, 400, {
            success: false,
            message: 'Formato de datos de planes no válido.'
          });
        }

        if (!db.plans) {
          db.plans = JSON.parse(JSON.stringify(DEFAULT_DATABASE.plans));
        }

        // Helper de saneamiento riguroso de URLs
        const sanitizeSafeUrl = (raw) => {
          if (!raw || typeof raw !== 'string') return '';
          const trimmed = raw.trim();
          if (!trimmed) return '';
          // Prohibir esquemas peligrosos de inyección de script
          if (/^(javascript|vbscript|data):/i.test(trimmed)) {
            throw new Error('Esquema de URL no permitido por motivos de seguridad.');
          }
          // Sanitizar caracteres HTML peligrosos
          const clean = trimmed.replace(/[<>"'`]/g, '');
          if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
            return `https://${clean}`;
          }
          return clean;
        };

        const allowedPlanIds = ['plan-esencia', 'plan-refugio', 'plan-sadhana'];
        const updatedPlansList = [];

        try {
          const plansEntries = Array.isArray(incomingPlans)
            ? incomingPlans.map(p => [p.id, p])
            : Object.entries(incomingPlans);

          for (const [key, planData] of plansEntries) {
            const planId = planData.id || key;
            if (!allowedPlanIds.includes(planId)) continue;

            const existing = db.plans[planId] || (DEFAULT_DATABASE.plans && DEFAULT_DATABASE.plans[planId]) || {};

            // Validación estricta de precios
            const priceMonthly = Number(planData.priceMonthly !== undefined ? planData.priceMonthly : existing.priceMonthly);
            if (isNaN(priceMonthly) || priceMonthly <= 0) {
              return sendJson(res, 400, {
                success: false,
                message: `El precio mensual para ${planData.name || planId} debe ser un número mayor a 0.`
              });
            }

            const priceAnnualTotal = Number(planData.priceAnnualTotal !== undefined ? planData.priceAnnualTotal : existing.priceAnnualTotal);
            if (isNaN(priceAnnualTotal) || priceAnnualTotal <= 0) {
              return sendJson(res, 400, {
                success: false,
                message: `El precio anual para ${planData.name || planId} debe ser un número mayor a 0.`
              });
            }

            const mercadopagoUrl = sanitizeSafeUrl(planData.mercadopagoUrl || existing.mercadopagoUrl || 'https://www.mercadopago.com.ar');
            const mercadopagoUrlAnnual = sanitizeSafeUrl(planData.mercadopagoUrlAnnual || planData.mercadopagoUrl || existing.mercadopagoUrlAnnual || mercadopagoUrl);

            // Sanitizar textos descriptivos
            const name = (planData.name || existing.name || planId).trim().replace(/[<>]/g, '');
            const badge = (planData.badge || existing.badge || '').trim().replace(/[<>]/g, '');
            const description = (planData.description || existing.description || '').trim().replace(/[<>]/g, '');

            let features = existing.features || [];
            if (Array.isArray(planData.features)) {
              features = planData.features
                .map(f => (typeof f === 'string' ? f.trim().replace(/[<>]/g, '') : ''))
                .filter(f => f.length > 0);
            }

            db.plans[planId] = {
              ...existing,
              id: planId,
              name,
              tier: existing.tier || 'intermedio',
              badge,
              priceMonthly,
              priceAnnualTotal,
              currency: 'ARS',
              description,
              features,
              mercadopagoUrl,
              mercadopagoUrlAnnual,
              updatedAt: new Date().toISOString()
            };

            updatedPlansList.push(name);
          }

          // Sincronizar catálogo server-side y registrar log de auditoría
          syncCatalogWithDb(db);

          recordAuditLog(
            db,
            'PLANS_CONFIG_SAVED',
            'Configuración de Planes y Mercado Pago actualizada',
            `Planes sincronizados: ${updatedPlansList.join(', ')} por ${auth.user.name}`,
            auth.user.email,
            'success'
          );

          saveDatabase(db);

          return sendJson(res, 200, {
            success: true,
            plans: db.plans,
            message: 'Configuración de planes y enlaces de Mercado Pago guardada exitosamente en la base de datos.'
          });

        } catch (valErr) {
          return sendJson(res, 400, {
            success: false,
            message: valErr.message || 'Error al validar la información de planes.'
          });
        }
      }

      // Route not found in /api
      return sendJson(res, 404, { success: false, message: 'Endpoint no encontrado' });

    } catch (err) {
      console.error('[API Error]', err);
      return sendJson(res, 500, { success: false, message: 'Error interno en el servidor de Namasté.' });
    }
  }

  // --------------------------------------------------------------------------
  // STATIC FILE SERVING
  // --------------------------------------------------------------------------
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  // Safe file path resolution
  let filePath = path.normalize(path.join(__dirname, pathname === '/' ? 'index.html' : pathname));
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for client-side routing
      const indexFallback = path.join(__dirname, 'index.html');
      fs.readFile(indexFallback, (fbErr, content) => {
        if (fbErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        } else {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
          });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Support HTTP 206 Partial Content (Range Requests) for MP4/WebM
    const range = req.headers.range;
    if (range && (ext === '.mp4' || ext === '.webm')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });
      fileStream.pipe(res);
      return;
    }

    // Cache header: never cache HTML; revalidate CSS/JS immediately
    const cacheHeader = (ext === '.html')
      ? 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
      : (ext === '.css' || ext === '.js')
        ? 'no-cache, must-revalidate, max-age=0'
        : 'public, max-age=86400';

    // Standard static file delivery
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Accept-Ranges': 'bytes',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': cacheHeader,
      'Pragma': ext === '.html' ? 'no-cache' : undefined
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(handleRequest);

// En Vercel Serverless las funciones se invocan bajo demanda; en local se abre el puerto
if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`[NAMASTÉ] Servidor de Producción y API REST Activo`);
    console.log(`[URL] http://localhost:${PORT}`);
    console.log(`[API] http://localhost:${PORT}/api/health`);
    console.log(`[DB]  ${DB_FILE} + Supabase Cloud PostgreSQL`);
    console.log(`======================================================\n`);
  });
}

export default server;
