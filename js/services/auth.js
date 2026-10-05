/**
 * NAMASTÉ - Servicio de Autenticación & Sesión
 * Conecta de forma transparente con la API REST (/api/auth)
 * y mantiene fallback seguro para entornos estáticos.
 */

const AuthService = (() => {
  const SESSION_KEY = 'namaste_current_user';
  const TOKEN_KEY = 'namaste_session_token';
  const CODES_STORAGE_KEY = 'namaste_registered_codes';

  // Usuarios semilla pre-configurados para demostración inmediata
  const DEFAULT_USERS = {
    'NAMASTE-DIRECTORA': {
      id: 'usr-valeria',
      name: 'Valeria Manassero',
      email: 'valeria.manassero@namaste.com',
      role: 'admin',
      isAdmin: true,
      accessCode: 'NAMASTE-DIRECTORA',
      planId: 'plan-admin',
      planName: 'Directora & Fundadora',
      memberSince: 'Enero 2012',
      nextBillingDate: 'Cuenta Maestra (Vitalicia)',
      active: true,
      streakDays: 365,
      totalMinutesPracticed: 9999,
      completedClassesCount: 150
    },
    'NAMASTE-ALUMNO': {
      id: 'usr-sofia',
      name: 'Sofía Varela',
      email: 'sofia.varela@ejemplo.com',
      accessCode: 'NAMASTE-ALUMNO',
      planId: 'plan-refugio',
      planName: 'Plan Refugio',
      memberSince: 'Marzo 2026',
      nextBillingDate: '28 Octubre 2026',
      active: true,
      streakDays: 8,
      totalMinutesPracticed: 275,
      completedClassesCount: 8
    },
    'NAMASTE-DEMO': {
      id: 'usr-invitado',
      name: 'Yogui Invitado',
      email: 'invitado@namaste.com',
      accessCode: 'NAMASTE-DEMO',
      planId: 'plan-esencia',
      planName: 'Plan Esencia',
      memberSince: 'Septiembre 2026',
      nextBillingDate: '28 Octubre 2026',
      active: true,
      streakDays: 1,
      totalMinutesPracticed: 35,
      completedClassesCount: 1
    }
  };

  const getToken = () => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || null;
    } catch (e) {
      return null;
    }
  };

  const setToken = (token) => {
    try {
      if (token) {
        sessionStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      // Ignorar si storage está bloqueado
    }
  };

  const getStoredUsers = () => {
    try {
      const stored = localStorage.getItem(CODES_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      return { ...DEFAULT_USERS, ...parsed };
    } catch (e) {
      return { ...DEFAULT_USERS };
    }
  };

  const saveUserRecord = (user) => {
    try {
      const allUsers = getStoredUsers();
      if (user.accessCode) {
        allUsers[user.accessCode.toUpperCase()] = user;
      }
      localStorage.setItem(CODES_STORAGE_KEY, JSON.stringify(allUsers));
    } catch (e) {
      console.warn('Error saving user record:', e);
    }
  };

  const getCurrentUser = () => {
    try {
      const userJson = localStorage.getItem(SESSION_KEY);
      return userJson ? JSON.parse(userJson) : null;
    } catch (e) {
      return null;
    }
  };

  const isAuthenticated = () => {
    return !!getCurrentUser();
  };

  const isStatic = () => {
    if (typeof window === 'undefined') return true;
    return window.location.hostname.includes('github.io') ||
           window.location.protocol === 'file:';
  };

  // Login seguro que autentica contra API REST con contraseña
  const login = async (identifier, password = '') => {
    if (!identifier || typeof identifier !== 'string') {
      return { success: false, message: 'Por favor ingresa tu correo electrónico o datos de acceso.' };
    }

    const clean = identifier.trim().toLowerCase();
    const cleanPwd = (password || '').trim();

    if (!cleanPwd) {
      return { success: false, message: 'Por favor ingresa tu contraseña.' };
    }

    // 1. Autenticación oficial contra API REST en servidores activos (Localhost & Vercel)
    if (!isStatic() && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: clean, password: cleanPwd })
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.success && data.user) {
          setToken(data.token);
          localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
          saveUserRecord(data.user);
          if (data.progress && typeof ProgressService !== 'undefined') {
            ProgressService.setInitialProgress(data.user.id, data.progress);
          }
          window.dispatchEvent(new CustomEvent('namaste:auth-changed', { detail: data.user }));
          return { success: true, user: data.user };
        }

        // Si el servidor devolvió un error de autenticación, devolverlo sin bypass
        return {
          success: false,
          isPendingPayment: data.isPendingPayment || false,
          userEmail: data.userEmail || clean,
          message: data.message || 'Credenciales inválidas. Verifica tu correo y contraseña.'
        };
      } catch (err) {
        return {
          success: false,
          message: 'No fue posible conectar con el servidor de Namasté. Por favor verifica tu conexión a internet.'
        };
      }
    }

    // 2. Modo estático restringido (Solo GitHub Pages / file:)
    const allUsers = getStoredUsers();
    let user = Object.values(allUsers).find(u => (u.email || '').toLowerCase() === clean);
    if (!user) {
      user = allUsers[clean.toUpperCase()];
    }

    if (clean === 'valeria.manassero@namaste.com' || clean === 'namaste-directora') {
      if (cleanPwd !== 'valeria2026') {
        return { success: false, message: 'Contraseña de administradora incorrecta.' };
      }
      user = DEFAULT_USERS['NAMASTE-DIRECTORA'];
    } else if (user) {
      if (cleanPwd !== 'namaste123') {
        return { success: false, message: 'Contraseña incorrecta. Por favor verifica tu clave.' };
      }
    } else {
      return { success: false, message: 'No existe una cuenta registrada con este correo. Por favor suscríbete desde la página principal.' };
    }

    if (!user.active) {
      return {
        success: false,
        isPendingPayment: true,
        userEmail: user.email,
        message: 'Tu cuenta no está activa porque el pago está pendiente o fue cancelado. Completa tu abono en Mercado Pago para habilitar tu acceso.'
      };
    }

    try {
      setToken('local-token-' + Date.now());
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      saveUserRecord(user);
      window.dispatchEvent(new CustomEvent('namaste:auth-changed', { detail: user }));
      return { success: true, user };
    } catch (e) {
      return { success: false, message: 'Error al iniciar sesión local.' };
    }
  };

  const loginUser = (user, token) => {
    if (!user) return { success: false };
    try {
      if (token) setToken(token);
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      saveUserRecord(user);
      window.dispatchEvent(new CustomEvent('namaste:auth-changed', { detail: user }));
      return { success: true, user };
    } catch (e) {
      return { success: false, message: 'Error al iniciar sesión.' };
    }
  };

  const logout = async () => {
    const token = getToken();
    if (!isStatic() && token && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {
        // Ignorar error al cerrar sesión
      }
    }
    setToken(null);
    localStorage.removeItem(SESSION_KEY);
    if (typeof ProgressService !== 'undefined') {
      ProgressService.clearActiveUser();
    }
    window.dispatchEvent(new CustomEvent('namaste:auth-changed', { detail: null }));
  };

  const registerNewMember = (name, email, planId, planName, options = {}) => {
    const cleanEmail = (email || 'alumno@namaste.com').trim().toLowerCase();
    const cleanName = (name || 'Practicante de Namasté').trim();
    const isAnnual = !!options.isAnnual;
    const amount = options.amount || 29;
    const paymentMethod = options.paymentMethod || 'MercadoPago';
    const password = options.password || '';
    const active = options.active !== undefined ? Boolean(options.active) : false; // Inactivo hasta pagar
    const paymentStatus = options.paymentStatus || (active ? 'approved' : 'pending');

    const now = new Date();
    const monthsEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const memberSince = `${monthsEs[now.getMonth()]} ${now.getFullYear()}`;

    const billingDate = new Date(now);
    if (isAnnual) {
      billingDate.setFullYear(billingDate.getFullYear() + 1);
    } else {
      billingDate.setMonth(billingDate.getMonth() + 1);
    }
    const nextBillingDate = `${billingDate.getDate()} de ${monthsEs[billingDate.getMonth()]} de ${billingDate.getFullYear()}`;

    const allUsers = getStoredUsers();
    let existingUser = Object.values(allUsers).find(u => (u.email || '').toLowerCase() === cleanEmail);

    if (existingUser) {
      existingUser.name = cleanName || existingUser.name;
      existingUser.planId = planId;
      existingUser.planName = planName;
      existingUser.active = active;
      existingUser.paymentStatus = paymentStatus;
      existingUser.isAnnual = isAnnual;
      existingUser.billedAmount = amount;
      existingUser.paymentMethod = paymentMethod;
      existingUser.nextBillingDate = nextBillingDate;
      if (password) existingUser.password = password;
      saveUserRecord(existingUser);
      return existingUser;
    }

    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const planTag = (planId.includes('refugio') || planId.includes('santuario')) ? 'REFUGIO' : (planId.includes('sadhana') ? 'SADHANA' : 'ESENCIA');
    const newCode = `NAMASTE-${planTag}-${randomDigits}`;

    const newUser = {
      id: 'usr-' + Date.now(),
      name: cleanName,
      email: cleanEmail,
      password: password,
      accessCode: newCode,
      planId: planId,
      planName: planName,
      isAnnual: isAnnual,
      billedAmount: amount,
      paymentMethod: paymentMethod,
      memberSince: memberSince,
      nextBillingDate: nextBillingDate,
      active: active, // Inactivo hasta que se complete el pago
      paymentStatus: paymentStatus,
      streakDays: 1,
      totalMinutesPracticed: 0,
      completedClassesCount: 0,
      lastPracticeDate: null
    };

    saveUserRecord(newUser);
    return newUser;
  };

  /**
   * Activa o desactiva la cuenta según el resultado del pago en Mercado Pago
   */
  const activateMemberPayment = (email, isApproved = true) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const allUsers = getStoredUsers();
    const user = Object.values(allUsers).find(u => (u.email || '').toLowerCase() === cleanEmail);
    if (!user) return null;

    user.active = Boolean(isApproved);
    user.paymentStatus = isApproved ? 'approved' : 'cancelled';
    saveUserRecord(user);

    if (isApproved) {
      loginUser(user);
    } else {
      logout();
    }
    return user;
  };

  const updateUserProfile = async (updatedData) => {
    const current = getCurrentUser();
    if (!current) return null;
    const merged = { ...current, ...updatedData };
    localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
    saveUserRecord(merged);

    // Sync with backend if membership or plan changed (solo si no es estático)
    const token = getToken();
    if (!isStatic() && token && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      try {
        if ('active' in updatedData) {
          await fetch('/api/membership/toggle-status', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
        if (updatedData.planId) {
          await fetch('/api/membership/change-plan', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ planId: updatedData.planId })
          });
        }
      } catch (e) {
        // Fallback local silencioso
      }
    }

    window.dispatchEvent(new CustomEvent('namaste:auth-changed', { detail: merged }));
    return merged;
  };

  // Auto-sync de perfil con el servidor al cargar
  const syncWithServer = async () => {
    if (isStatic()) return;
    const token = getToken();
    if (!token || typeof window === 'undefined' || !window.location.protocol.startsWith('http')) return;
    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
          if (data.progress && typeof ProgressService !== 'undefined') {
            ProgressService.setInitialProgress(data.user.id, data.progress);
          }
          window.dispatchEvent(new CustomEvent('namaste:auth-changed', { detail: data.user }));
        }
      }
    } catch (e) {
      // Ignorar si offline
    }
  };

  // Inicializar sincronización en segundo plano
  if (typeof window !== 'undefined') {
    setTimeout(syncWithServer, 500);
  }

  return {
    getCurrentUser,
    isAuthenticated,
    getToken,
    setToken,
    login,
    loginWithCode: login,
    loginUser,
    logout,
    registerNewMember,
    activateMemberPayment,
    updateUserProfile,
    getStoredUsers,
    syncWithServer
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthService };
}
