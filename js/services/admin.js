/**
 * NAMASTÉ - Servicio de Administración & Auditoría
 * Vincula de manera transparente y bidireccional la interfaz de la Dueña (Valeria Manassero)
 * con la API de administración del servidor y la base de datos persistente.
 */

const AdminService = (() => {
  const API_BASE = '/api/admin';

  async function fetchJson(endpoint, options = {}) {
    // Si estamos en GitHub Pages o entorno estático sin backend, usar almacenamiento local
    const isStatic = window.location.hostname.includes('github.io') ||
                     window.location.protocol === 'file:';

    if (isStatic) {
      return { success: false, message: 'El panel de administración requiere conexión con el servidor backend de Namasté.' };
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
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          status: res.status,
          message: errorData.message || `Error ${res.status}: Acceso no autorizado o fallo del servidor.`
        };
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, message: 'Respuesta inválida del servidor.' };
      }

      return await res.json();
    } catch (err) {
      return { success: false, message: 'No se pudo contactar al servidor de administración.' };
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

  // --- Gestión Local y Sincronizada de Clases (Mobile First) ---
  function getLocalClasses() {
    const parsed = safeJsonParse(localStorage.getItem('namaste_custom_classes'), null);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;

    const initial = typeof CLASSES_DATA !== 'undefined' ? [...CLASSES_DATA] : [];
    const enriched = initial.map(c => ({
      ...c,
      format: c.format || (c.category === 'meditacion' || c.category === 'relax' ? 'audio' : 'video'),
      planRequired: c.planRequired || (c.category === 'dinamico' || c.category === 'ashtanga' ? 'plan-sadhana' : (c.category === 'suave' ? 'plan-esencia' : 'plan-refugio'))
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
    deleteClass: (classId) => Promise.resolve(deleteLocalClass(classId)),
    getPlans: () => fetchJson('/plans'),
    savePlans: (plansData) => fetchJson('/plans', {
      method: 'POST',
      body: JSON.stringify({ plans: plansData })
    })
  };
})();

// Exportar globalmente
window.AdminService = AdminService;
