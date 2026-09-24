/**
 * NAMASTÉ - Servicio de Autenticación por Código Único de Alumno
 */

const AuthService = (() => {
  const SESSION_KEY = 'namaste_current_user';
  const CODES_STORAGE_KEY = 'namaste_registered_codes';

  // Alumnos semilla pre-configurados para demostración inmediata
  const DEFAULT_USERS = {
    'NAMASTE-ALUMNO': {
      name: 'Sofía Varela',
      email: 'sofia.varela@ejemplo.com',
      accessCode: 'NAMASTE-ALUMNO',
      planId: 'plan-santuario',
      planName: 'Plan Santuario',
      memberSince: 'Marzo 2026',
      nextBillingDate: '22 Octubre 2026',
      active: true,
      streakDays: 8,
      totalMinutesPracticed: 245,
      completedClassesCount: 7
    },
    'NAMASTE-DEMO': {
      name: 'Yogui Invitado',
      email: 'invitado@namaste.com',
      accessCode: 'NAMASTE-DEMO',
      planId: 'plan-esencia',
      planName: 'Plan Esencia',
      memberSince: 'Septiembre 2026',
      nextBillingDate: '22 Octubre 2026',
      active: true,
      streakDays: 3,
      totalMinutesPracticed: 80,
      completedClassesCount: 3
    }
  };

  const getStoredUsers = () => {
    try {
      const stored = localStorage.getItem(CODES_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      return { ...DEFAULT_USERS, ...parsed };
    } catch (e) {
      console.warn('Error reading stored users:', e);
      return { ...DEFAULT_USERS };
    }
  };

  const saveUserRecord = (user) => {
    try {
      const allUsers = getStoredUsers();
      allUsers[user.accessCode.toUpperCase()] = user;
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

  const login = (identifier) => {
    if (!identifier || typeof identifier !== 'string') {
      return { success: false, message: 'Por favor ingresa tu correo electrónico o datos de acceso.' };
    }

    const clean = identifier.trim().toLowerCase();
    const allUsers = getStoredUsers();

    // 1. Buscar coincidencia por email registrado
    let user = Object.values(allUsers).find(u => (u.email || '').toLowerCase() === clean);

    // 2. O por código de acceso para compatibilidad
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
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      window.dispatchEvent(new CustomEvent('namaste:auth-changed', { detail: user }));
      return { success: true, user };
    } catch (e) {
      return { success: false, message: 'Error al iniciar sesión local.' };
    }
  };

  const loginUser = (user) => {
    if (!user) return { success: false };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      window.dispatchEvent(new CustomEvent('namaste:auth-changed', { detail: user }));
      return { success: true, user };
    } catch (e) {
      return { success: false, message: 'Error al iniciar sesión.' };
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new CustomEvent('namaste:auth-changed', { detail: null }));
  };

  const registerNewMember = (name, email, planId, planName) => {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const planTag = planId.includes('santuario') ? 'SANTUARIO' : (planId.includes('sadhana') ? 'SADHANA' : 'ESENCIA');
    const newCode = `NAMASTE-${planTag}-${randomDigits}`;

    const newUser = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      accessCode: newCode,
      planId: planId,
      planName: planName,
      memberSince: 'Septiembre 2026',
      nextBillingDate: '22 Octubre 2026',
      active: true,
      streakDays: 1,
      totalMinutesPracticed: 0,
      completedClassesCount: 0
    };

    saveUserRecord(newUser);
    return newUser;
  };

  const updateUserProfile = (updatedData) => {
    const current = getCurrentUser();
    if (!current) return null;
    const merged = { ...current, ...updatedData };
    localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
    saveUserRecord(merged);
    window.dispatchEvent(new CustomEvent('namaste:auth-changed', { detail: merged }));
    return merged;
  };

  return {
    getCurrentUser,
    isAuthenticated,
    login,
    loginWithCode: login,
    loginUser,
    logout,
    registerNewMember,
    updateUserProfile,
    getStoredUsers
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthService };
}
