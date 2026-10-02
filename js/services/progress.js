/**
 * NAMASTÉ - Servicio de Progreso, Favoritos e Historial de Práctica
 * 100% Sincronizado centralmente con la Base de Datos (/api/progress) y aislamiento total por usuario.
 */

const ProgressService = (() => {
  const isStatic = () => {
    if (typeof window === 'undefined') return true;
    return window.location.hostname.includes('github.io') ||
           window.location.protocol === 'file:' ||
           (!['localhost', '127.0.0.1'].includes(window.location.hostname) && !window.location.port);
  };

  let cachedUserId = null;
  let cachedState = null;

  /**
   * Obtiene el identificador único del usuario activo de forma infalible.
   */
  const getActiveUserId = () => {
    try {
      const user = typeof AuthService !== 'undefined' ? AuthService.getCurrentUser() : null;
      if (!user) return 'guest';
      return user.id || (user.email ? user.email.toLowerCase().replace(/[^a-z0-9_-]/g, '_') : 'guest');
    } catch (e) {
      return 'guest';
    }
  };

  const getStorageKey = (userId) => {
    const id = userId || getActiveUserId();
    return 'namaste_user_progress_' + id;
  };

  /**
   * Estado por defecto de la alumna demo oficial Sofía Varela (usr-sofia)
   * exactamente sincronizado con database.json (8 clases completadas, 275 min, 8 días racha).
   */
  const getSofiaDefaultProgress = () => ({
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
  });

  /**
   * Obtiene el estado de progreso del usuario activo, estrictamente aislado.
   */
  const getProgressState = () => {
    const currentId = getActiveUserId();
    if (cachedUserId === currentId && cachedState) {
      return cachedState;
    }

    const key = getStorageKey(currentId);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          cachedUserId = currentId;
          cachedState = {
            streakDays: Number(parsed.streakDays) || 0,
            lastStreakDate: parsed.lastStreakDate || null,
            totalMinutes: Number(parsed.totalMinutes) || 0,
            favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
            completed: Array.isArray(parsed.completed) ? parsed.completed : [],
            lastPlayed: parsed.lastPlayed || null
          };
          return cachedState;
        }
      }

      // Si es Sofía Varela y aún no tiene registro local, inicializar con el estado oficial sincronizado
      const user = typeof AuthService !== 'undefined' ? AuthService.getCurrentUser() : null;
      if (currentId === 'usr-sofia' || (user && (user.accessCode === 'NAMASTE-ALUMNO' || user.email === 'sofia.varela@ejemplo.com'))) {
        const sofiaProgress = getSofiaDefaultProgress();
        localStorage.setItem(key, JSON.stringify(sofiaProgress));
        cachedUserId = currentId;
        cachedState = sofiaProgress;
        return cachedState;
      }

      // Para cualquier otro alumno nuevo, iniciar en 0 sin mezclar datos de otros usuarios
      const cleanState = {
        streakDays: 0,
        lastStreakDate: null,
        totalMinutes: 0,
        favorites: [],
        completed: [],
        lastPlayed: null
      };
      cachedUserId = currentId;
      cachedState = cleanState;
      return cachedState;
    } catch (e) {
      return {
        streakDays: 0,
        lastStreakDate: null,
        totalMinutes: 0,
        favorites: [],
        completed: [],
        lastPlayed: null
      };
    }
  };

  /**
   * Guarda y sincroniza el estado tanto local como con la API REST (/api/progress).
   */
  const saveProgressState = (state, syncServer = true) => {
    const currentId = getActiveUserId();
    cachedUserId = currentId;
    cachedState = state;

    try {
      const key = getStorageKey(currentId);
      localStorage.setItem(key, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent('namaste:progress-changed', { detail: state }));

      // Sincronizar en el objeto de usuario de sesión activa para coherencia transversal
      const user = typeof AuthService !== 'undefined' ? AuthService.getCurrentUser() : null;
      if (user && user.id === currentId) {
        user.streakDays = state.streakDays;
        user.totalMinutesPracticed = state.totalMinutes;
        user.completedClassesCount = state.completed.length;
        localStorage.setItem('namaste_active_session', JSON.stringify(user));
      }

      // Sincronizar con backend si está disponible
      if (!isStatic() && syncServer && typeof AuthService !== 'undefined') {
        const token = AuthService.getToken();
        if (token && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
          fetch('/api/progress', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              favorites: state.favorites,
              completed: state.completed,
              lastPlayed: state.lastPlayed,
              totalMinutes: state.totalMinutes,
              streakDays: state.streakDays,
              lastStreakDate: state.lastStreakDate
            })
          }).catch(err => console.warn('Error sincronizando progreso:', err));
        }
      }
    } catch (e) {
      console.warn('Error guardando progreso:', e);
    }
  };

  /**
   * Carga inicial recibida al iniciar sesión o consultar /api/auth/me
   */
  const setInitialProgress = (userId, progressData) => {
    if (!userId || !progressData) return;
    const clean = {
      streakDays: Number(progressData.streakDays) || 0,
      lastStreakDate: progressData.lastStreakDate || null,
      totalMinutes: Number(progressData.totalMinutes) || 0,
      favorites: Array.isArray(progressData.favorites) ? progressData.favorites : [],
      completed: Array.isArray(progressData.completed) ? progressData.completed : [],
      lastPlayed: progressData.lastPlayed || null
    };

    const key = getStorageKey(userId);
    try {
      localStorage.setItem(key, JSON.stringify(clean));
    } catch (e) {}

    if (getActiveUserId() === userId) {
      cachedUserId = userId;
      cachedState = clean;
      window.dispatchEvent(new CustomEvent('namaste:progress-changed', { detail: clean }));
    }
  };

  /**
   * Limpia el estado en memoria al cerrar sesión para evitar contaminación cruzada
   */
  const clearActiveUser = () => {
    cachedUserId = null;
    cachedState = null;
  };

  const isFavorite = (classId) => {
    const state = getProgressState();
    return state.favorites.includes(classId);
  };

  const toggleFavorite = (classId) => {
    const state = getProgressState();
    const idx = state.favorites.indexOf(classId);
    if (idx > -1) {
      state.favorites.splice(idx, 1);
    } else {
      state.favorites.push(classId);
    }
    saveProgressState(state, true);
    return state.favorites.includes(classId);
  };

  const isCompleted = (classId) => {
    const state = getProgressState();
    return state.completed.includes(classId);
  };

  /**
   * Marca una práctica como completada con cálculo diario riguroso de racha y minutos.
   */
  const markCompleted = (classId, durationMinutes = 30) => {
    const state = getProgressState();
    const dur = Number(durationMinutes) || 30;

    if (!state.completed.includes(classId)) {
      state.completed.push(classId);
    }

    state.totalMinutes = (state.totalMinutes || 0) + dur;

    // Cálculo calendario de racha diaria
    const today = new Date().toISOString().split('T')[0];
    const lastDate = state.lastStreakDate;
    if (!lastDate) {
      state.streakDays = 1;
    } else if (lastDate === today) {
      // Misma jornada, mantiene racha activa
    } else {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (lastDate === yesterday) {
        state.streakDays = (state.streakDays || 0) + 1;
      } else {
        state.streakDays = 1;
      }
    }
    state.lastStreakDate = today;

    saveProgressState(state, true);
    return true;
  };

  const recordPlayProgress = (classId, progressSeconds) => {
    const state = getProgressState();
    state.lastPlayed = {
      classId,
      progressSeconds,
      timestamp: new Date().toISOString()
    };
    saveProgressState(state, true);
  };

  const getLastPlayed = () => {
    const state = getProgressState();
    if (!state.lastPlayed || !state.lastPlayed.classId) return null;
    const classes = typeof ClassesService !== 'undefined' ? ClassesService.getAllClasses() : (typeof CLASSES_DATA !== 'undefined' ? CLASSES_DATA : []);
    const foundClass = classes.find(c => c.id === state.lastPlayed.classId);
    if (!foundClass) return null;
    return {
      ...foundClass,
      progressSeconds: state.lastPlayed.progressSeconds
    };
  };

  const fetchProgressFromServer = async () => {
    if (isStatic() || typeof AuthService === 'undefined') return;
    const token = AuthService.getToken();
    const user = AuthService.getCurrentUser();
    if (!token || !user || typeof window === 'undefined' || !window.location.protocol.startsWith('http')) return;

    try {
      const response = await fetch('/api/progress', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.progress) {
          setInitialProgress(user.id, data.progress);
        }
      }
    } catch (e) {
      // Silencioso si no hay conexión
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('namaste:auth-changed', (e) => {
      if (e.detail && e.detail.id) {
        setTimeout(fetchProgressFromServer, 200);
      } else {
        clearActiveUser();
      }
    });
  }

  return {
    getProgressState,
    setInitialProgress,
    clearActiveUser,
    isFavorite,
    toggleFavorite,
    isCompleted,
    markCompleted,
    recordPlayProgress,
    getLastPlayed,
    fetchProgressFromServer
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ProgressService };
}
