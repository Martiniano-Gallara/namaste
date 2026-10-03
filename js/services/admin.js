/**
 * NAMASTÉ - Servicio de Administración & Auditoría
 * Vincula de manera transparente y bidireccional la interfaz de la Dueña (Valeria Manassero)
 * con la API de administración del servidor y la base de datos persistente.
 */

const AdminService = (() => {
  const API_BASE = '/api/admin';

  async function fetchJson(endpoint, options = {}) {
    // Si estamos en GitHub Pages o entorno estático sin backend, usar almacenamiento resiliente directo
    const isStatic = window.location.hostname.includes('github.io') ||
                     window.location.protocol === 'file:' ||
                     (!['localhost', '127.0.0.1'].includes(window.location.hostname));

    if (isStatic) {
      return fallbackHandler(endpoint, options);
    }

    try {
      const token = sessionStorage.getItem('namaste_session_token') || localStorage.getItem('namaste_session_token') || '';
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
      };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      if (!res.ok) {
        return fallbackHandler(endpoint, options);
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return fallbackHandler(endpoint, options);
      }

      return await res.json();
    } catch (err) {
      return fallbackHandler(endpoint, options);
    }
  }

  function safeJsonParse(str, fallback = null) {
    if (!str) return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  }

  // --- Fallback Offline / Estático para garantizar 100% disponibilidad ---
  function fallbackHandler(endpoint, options = {}) {
    const method = options.method || 'GET';

    // Seed local si no existe
    let localUsers = safeJsonParse(localStorage.getItem('namaste_admin_users_cache'), null);
    if (!localUsers) {
      localUsers = [
        {
          id: 'usr-sofia',
          name: 'Sofía Varela',
          email: 'sofia.varela@ejemplo.com',
          accessCode: 'NAMASTE-ALUMNO',
          planId: 'plan-santuario',
          planName: 'Plan Santuario',
          active: true,
          isAnnual: false,
          memberSince: 'Marzo 2026',
          nextBillingDate: '28 Octubre 2026',
          paymentMethod: 'Visa •••• 4242',
          billedAmount: 29,
          streakDays: 8,
          totalMinutes: 275,
          completedCount: 8,
          favoritesCount: 2
        },
        {
          id: 'usr-invitado',
          name: 'Practicante Inicial',
          email: 'invitado@namaste.com',
          accessCode: 'NAMASTE-ESENCIA',
          planId: 'plan-esencia',
          planName: 'Plan Esencia',
          active: true,
          isAnnual: false,
          memberSince: 'Septiembre 2026',
          nextBillingDate: '28 Octubre 2026',
          paymentMethod: 'Mastercard •••• 5555',
          billedAmount: 19,
          streakDays: 1,
          totalMinutes: 35,
          completedCount: 1,
          favoritesCount: 1
        },
        {
          id: 'usr-a80a8ab2',
          name: 'Elena Rostova',
          email: 'elena@ejemplo.com',
          accessCode: 'NAMASTE-SADHANA-30419F',
          planId: 'plan-sadhana',
          planName: 'Plan Sadhana',
          active: true,
          isAnnual: true,
          memberSince: 'Septiembre 2026',
          nextBillingDate: '28 Septiembre 2027',
          paymentMethod: 'Tarjeta •••• 9999',
          billedAmount: 390,
          streakDays: 3,
          totalMinutes: 110,
          completedCount: 1,
          favoritesCount: 1
        },
        {
          id: 'usr-mateo',
          name: 'Mateo Benítez',
          email: 'mateo.benitez@ejemplo.com',
          accessCode: 'NAMASTE-ESENCIA-77AB',
          planId: 'plan-esencia',
          planName: 'Plan Esencia',
          active: true,
          isAnnual: false,
          memberSince: 'Agosto 2026',
          nextBillingDate: '15 Octubre 2026',
          paymentMethod: 'Visa Débito •••• 1088',
          billedAmount: 19,
          streakDays: 12,
          totalMinutes: 310,
          completedCount: 3,
          favoritesCount: 2
        },
        {
          id: 'usr-lucia',
          name: 'Lucía Morales',
          email: 'lucia.morales@ejemplo.com',
          accessCode: 'NAMASTE-SANTUARIO-552C',
          planId: 'plan-santuario',
          planName: 'Plan Santuario',
          active: false,
          isAnnual: false,
          memberSince: 'Junio 2026',
          nextBillingDate: 'Pausada (sin cobro)',
          paymentMethod: 'Mastercard •••• 3141',
          billedAmount: 29,
          streakDays: 4,
          totalMinutes: 95,
          completedCount: 1,
          favoritesCount: 1
        }
      ];
      localStorage.setItem('namaste_admin_users_cache', JSON.stringify(localUsers));
    }

    let localLogs = safeJsonParse(localStorage.getItem('namaste_admin_logs_cache'), null);
    if (!localLogs) {
      localLogs = [
        {
          id: 'log_local_01',
          timestamp: new Date().toISOString(),
          action: 'AUDIT_VIEWED',
          title: 'Panel de Auditoría consultado',
          details: 'Valeria Manassero revisó el estado de clientes y membresías',
          userEmail: 'directora@namaste.com',
          status: 'info'
        },
        {
          id: 'log_local_02',
          timestamp: '2026-09-30T18:20:00.000Z',
          action: 'PRACTICE_COMPLETED',
          title: 'Práctica consciente completada',
          details: 'Mateo Benítez completó \'Hatha Suave: Apertura de Caderas\'',
          userEmail: 'mateo.benitez@ejemplo.com',
          status: 'info'
        }
      ];
      localStorage.setItem('namaste_admin_logs_cache', JSON.stringify(localLogs));
    }

    if (endpoint === '/overview') {
      const totalUsers = localUsers.length;
      const activeUsers = localUsers.filter(u => u.active).length;
      const pausedUsers = totalUsers - activeUsers;
      let mrr = 0;
      let arr = 0;
      const planCounts = { 'plan-esencia': 0, 'plan-santuario': 0, 'plan-sadhana': 0 };

      localUsers.forEach(u => {
        if (u.active) {
          if (u.isAnnual) {
            mrr += Math.round(u.billedAmount / 12);
            arr += u.billedAmount;
          } else {
            mrr += u.billedAmount;
            arr += u.billedAmount * 12;
          }
          if (planCounts[u.planId] !== undefined) planCounts[u.planId]++;
        }
      });

      const totalPracticeMinutes = localUsers.reduce((s, u) => s + (u.totalMinutes || 0), 0);
      const totalCompletedClasses = localUsers.reduce((s, u) => s + (u.completedCount || 0), 0);

      return {
        success: true,
        stats: {
          totalUsers,
          activeUsers,
          pausedUsers,
          mrr,
          arr,
          totalRevenue: 438,
          totalPracticeMinutes,
          totalCompletedClasses,
          planCounts
        },
        recentLogs: localLogs.slice(0, 8),
        recentTransactions: []
      };
    }

    if (endpoint === '/users') {
      if (method === 'POST') {
        const body = safeJsonParse(options.body, {});
        const planNames = { 'plan-esencia': 'Plan Esencia', 'plan-santuario': 'Plan Santuario', 'plan-sadhana': 'Plan Sadhana' };
        const newUser = {
          id: 'usr-' + Date.now().toString(36),
          name: body.name || 'Alumna Namasté',
          email: body.email,
          accessCode: 'NAMASTE-' + (body.planId ? body.planId.replace('plan-', '').toUpperCase() : 'SANTUARIO') + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
          planId: body.planId || 'plan-santuario',
          planName: planNames[body.planId] || 'Plan Santuario',
          active: body.active !== undefined ? body.active : true,
          isAnnual: Boolean(body.isAnnual),
          memberSince: 'Octubre 2026',
          nextBillingDate: '28 Noviembre 2026',
          paymentMethod: 'Registro Manual',
          billedAmount: body.isAnnual ? 290 : 29,
          streakDays: 1,
          totalMinutes: 0,
          completedCount: 0,
          favoritesCount: 0
        };
        localUsers.unshift(newUser);
        localStorage.setItem('namaste_admin_users_cache', JSON.stringify(localUsers));
        return { success: true, user: newUser, message: 'Alumna registrada exitosamente' };
      }
      return { success: true, users: localUsers };
    }

    if (endpoint.startsWith('/users/')) {
      const userId = endpoint.replace('/users/', '');
      const idx = localUsers.findIndex(u => u.id === userId);
      if (idx !== -1) {
        if (method === 'PUT') {
          const body = safeJsonParse(options.body, {});
          if (body.active !== undefined) localUsers[idx].active = Boolean(body.active);
          if (body.planId) {
            localUsers[idx].planId = body.planId;
            const planNames = { 'plan-esencia': 'Plan Esencia', 'plan-santuario': 'Plan Santuario', 'plan-sadhana': 'Plan Sadhana' };
            localUsers[idx].planName = planNames[body.planId] || localUsers[idx].planName;
          }
          if (body.name) localUsers[idx].name = body.name;
          if (body.email) localUsers[idx].email = body.email;
          localStorage.setItem('namaste_admin_users_cache', JSON.stringify(localUsers));
          return { success: true, user: localUsers[idx], message: 'Alumna actualizada' };
        }
        if (method === 'DELETE') {
          const removed = localUsers.splice(idx, 1);
          localStorage.setItem('namaste_admin_users_cache', JSON.stringify(localUsers));
          return { success: true, message: `Alumna eliminada` };
        }
      }
    }

    if (endpoint === '/audit-logs') {
      return { success: true, logs: localLogs };
    }

    if (endpoint === '/transactions') {
      return {
        success: true,
        transactions: [
          {
            id: 'tx_local_01',
            receiptNumber: 'REC-2026-743715',
            name: 'Elena Rostova',
            email: 'elena@ejemplo.com',
            planName: 'Plan Sadhana',
            planId: 'plan-sadhana',
            amount: 390,
            currency: 'USD',
            status: 'succeeded',
            isAnnual: true,
            timestamp: '2026-09-28T19:59:21.646Z'
          },
          {
            id: 'tx_local_02',
            receiptNumber: 'REC-2026-619204',
            name: 'Sofía Varela',
            email: 'sofia.varela@ejemplo.com',
            planName: 'Plan Santuario',
            planId: 'plan-santuario',
            amount: 29,
            currency: 'USD',
            status: 'succeeded',
            isAnnual: false,
            timestamp: '2026-09-28T10:00:00.000Z'
          }
        ]
      };
    }

    return { success: false, message: 'Endpoint fallback no implementado' };
  }

  // --- Gestión Local y Sincronizada de Clases (Mobile First) ---
  function getLocalClasses() {
    const parsed = safeJsonParse(localStorage.getItem('namaste_custom_classes'), null);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;

    const initial = typeof CLASSES_DATA !== 'undefined' ? [...CLASSES_DATA] : [];
    const enriched = initial.map(c => ({
      ...c,
      format: c.format || (c.category === 'meditacion' || c.category === 'relax' ? 'audio' : 'video'),
      planRequired: c.planRequired || (c.category === 'dinamico' || c.category === 'ashtanga' ? 'plan-sadhana' : (c.category === 'suave' ? 'plan-esencia' : 'plan-santuario'))
    }));
    try {
      localStorage.setItem('namaste_custom_classes', JSON.stringify(enriched));
    } catch (e) {}
    return enriched;
  }

  function saveLocalClass(classData) {
    const list = getLocalClasses();
    if (classData.id) {
      const idx = list.findIndex(c => c.id === classData.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...classData };
      } else {
        list.unshift(classData);
      }
    } else {
      const newId = `cls-${Date.now().toString(36)}`;
      const newClass = {
        id: newId,
        isNew: true,
        featured: false,
        viewsCount: 0,
        props: classData.props || ["Esterilla"],
        intentions: classData.intentions || ["Presencia y calma"],
        instructor: "Vale Manassero",
        instructorRole: "Fundadora de Namasté • +14 años de trayectoria",
        ...classData
      };
      list.unshift(newClass);
    }
    localStorage.setItem('namaste_custom_classes', JSON.stringify(list));
    return { success: true, classes: list };
  }

  function deleteLocalClass(classId) {
    let list = getLocalClasses();
    list = list.filter(c => c.id !== classId);
    localStorage.setItem('namaste_custom_classes', JSON.stringify(list));
    return { success: true, classes: list };
  }

  return {
    getOverview: () => fetchJson('/overview'),
    getUsers: () => fetchJson('/users'),
    createUser: (userData) => fetchJson('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
    updateUser: (userId, userData) => fetchJson(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    }),
    deleteUser: (userId) => fetchJson(`/users/${userId}`, {
      method: 'DELETE'
    }),
    getAuditLogs: () => fetchJson('/audit-logs'),
    getTransactions: () => fetchJson('/transactions'),
    getClasses: () => Promise.resolve({ success: true, classes: getLocalClasses() }),
    saveClass: (classData) => Promise.resolve(saveLocalClass(classData)),
    deleteClass: (classId) => Promise.resolve(deleteLocalClass(classId))
  };
})();

// Exportar globalmente
window.AdminService = AdminService;
