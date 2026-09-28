/**
 * NAMASTÉ - Servicio de Autenticación & Sesión
 * Conecta de forma transparente con la API REST (/api/auth)
 * y mantiene fallback seguro para entornos estáticos.
 */

const AuthService = (() => {
  const SESSION_KEY = 'namaste_current_user';
  const TOKEN_KEY = 'namaste_session_token';
  const CODES_STORAGE_KEY = 'namaste_registered_codes';

  // Alumnos semilla pre-configurados para demostración inmediata
  const DEFAULT_USERS = {
    'NAMASTE-ALUMNO': {
      id: 'usr-sofia',
      name: 'Sofía Varela',
      email: 'sofia.varela@ejemplo.com',
      accessCode: 'NAMASTE-ALUMNO',
      planId: 'plan-santuario',
      planName: 'Plan Santuario',
      memberSince: 'Marzo 2026',
      nextBillingDate: '28 Octubre 2026',
      active: true,
      streakDays: 8,
      totalMinutesPracticed: 245,
      completedClassesCount: 7
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
      streakDays: 3,
      totalMinutesPracticed: 80,
      completedClassesCount: 3
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

  // Login transparente que intenta el backend REST y sincroniza
  const login = async (identifier) => {
    if (!identifier || typeof identifier !== 'string') {
      return { success: false, message: 'Por favor ingresa tu correo electrónico o datos de acceso.' };
    }

    const clean = identifier.trim().toLowerCase();

    // 1. Intentar autenticación contra API REST si está en servidor HTTP
    if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: clean })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setToken(data.token);
            localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
            saveUserRecord(data.user);
            window.dispatchEvent(new CustomEvent('namaste:auth-changed', { detail: data.user }));
            return { success: true, user: data.user };
          }
        }
      } catch (err) {
        // En caso de que el backend no responda, usar fallback local
      }
    }

    // 2. Fallback de demostración / offline
    const allUsers = getStoredUsers();
    let user = Object.values(allUsers).find(u => (u.email || '').toLowerCase() === clean);

    if (!user) {
      user = allUsers[clean.toUpperCase()];
    }

    if (!user) {
      return {
        success: false,
        message: 'No encontramos una cuenta con ese correo. Puedes probar con la cuenta demo de Sofía o elegir un plan.'
      };
    }

    if (!user.active) {
      return {
        success: false,
        message: 'Esta membresía se encuentra pausada o inactiva.'
      };
    }

    try {
      setToken('mock-token-' + Date.now());
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
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
    if (token && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
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
    window.dispatchEvent(new CustomEvent('namaste:auth-changed', { detail: null }));
  };

  const registerNewMember = (name, email, planId, planName, options = {}) => {
    const cleanEmail = (email || 'alumno@namaste.com').trim().toLowerCase();
    const cleanName = (name || 'Practicante de Namasté').trim();
    const isAnnual = !!options.isAnnual;
    const amount = options.amount || 29;
    const paymentMethod = options.paymentMethod || 'Tarjeta Cifrada •••• 4242';

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
      existingUser.active = true;
      existingUser.isAnnual = isAnnual;
      existingUser.billedAmount = amount;
      existingUser.paymentMethod = paymentMethod;
      existingUser.nextBillingDate = nextBillingDate;
      saveUserRecord(existingUser);
      return existingUser;
    }

    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const planTag = planId.includes('santuario') ? 'SANTUARIO' : (planId.includes('sadhana') ? 'SADHANA' : 'ESENCIA');
    const newCode = `NAMASTE-${planTag}-${randomDigits}`;

    const newUser = {
      id: 'usr-' + Date.now(),
      name: cleanName,
      email: cleanEmail,
      accessCode: newCode,
      planId: planId,
      planName: planName,
      isAnnual: isAnnual,
      billedAmount: amount,
      paymentMethod: paymentMethod,
      memberSince: memberSince,
      nextBillingDate: nextBillingDate,
      active: true,
      streakDays: 1,
      totalMinutesPracticed: 0,
      completedClassesCount: 0,
      lastPracticeDate: null
    };

    saveUserRecord(newUser);
    return newUser;
  };

  const updateUserProfile = async (updatedData) => {
    const current = getCurrentUser();
    if (!current) return null;
    const merged = { ...current, ...updatedData };
    localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
    saveUserRecord(merged);

    // Sync with backend if membership or plan changed
    const token = getToken();
    if (token && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
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
    updateUserProfile,
    getStoredUsers,
    syncWithServer
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthService };
}
