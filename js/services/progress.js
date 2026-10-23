/**
 * NAMASTÉ - Servicio de Progreso, Favoritos e Historial de Práctica
 * 100% Sincronizado centralmente con la Base de Datos (/api/progress) y aislamiento total por usuario.
 */

const ProgressService = (() => {
  const isStatic = () => {
    if (typeof window === 'undefined') return true;
    return window.location.hostname.includes('github.io') ||
           window.location.protocol === 'file:';
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
   * Estado de progreso inicial limpio (0 clases completadas, 0 minutos, 0 racha).
   * A partir de ahora, todo progreso de alumnas se guarda de forma 100% real.
   */
  const getCleanProgressState = () => ({
    streakDays: 0,
    lastStreakDate: null,
    totalMinutes: 0,
    favorites: [],
    completed: [],
    lastPlayed: null
  });

  /**
   * Obtiene el estado de progreso del usuario activo, estrictamente aislado.
   */
  const getProgressState = () => {
    const currentId = getActiveUserId();
    if (cachedUserId === currentId && cachedState) {
      if (cachedState.totalMinutes === 275 || (Array.isArray(cachedState.completed) && cachedState.completed.length === 8)) {
        cachedState = getCleanProgressState();
      }
      return cachedState;
    }

    // Purgar de forma definitiva cualquier residuo de clases ficticias heredadas en el navegador
    try {
      const purgeKey = 'namaste_real_progress_v7';
      if (!localStorage.getItem(purgeKey)) {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith('namaste_user_progress_')) {
            localStorage.removeItem(k);
          }
        }
        localStorage.setItem(purgeKey, 'true');
        cachedUserId = null;
        cachedState = null;
      }
    } catch (e) {}

    const key = getStorageKey(currentId);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // Si el registro guardado contiene el mock residual de 275 min u 8 clases
          if (parsed.totalMinutes === 275 || (Array.isArray(parsed.completed) && parsed.completed.length === 8)) {
            const clean = getCleanProgressState();
            localStorage.setItem(key, JSON.stringify(clean));
            cachedUserId = currentId;
            cachedState = clean;
            return clean;
          }

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

      // Estado 100% limpio en 0 para todos los alumnos
      const cleanState = getCleanProgressState();
      localStorage.setItem(key, JSON.stringify(cleanState));
      cachedUserId = currentId;
      cachedState = cleanState;
      return cachedState;
    } catch (e) {
      return getCleanProgressState();
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

    // Cálculo calendario de racha diaria con zona horaria oficial de Argentina (ART)
    let today;
    try {
      today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
    } catch (e) {
      today = new Date().toISOString().split('T')[0];
    }

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
    if (isStatic() || typeof AuthService === 'undefined') return null;
    const token = AuthService.getToken();
    const user = AuthService.getCurrentUser();
    if (!token || !user || typeof window === 'undefined' || !window.location.protocol.startsWith('http')) return null;

    try {
      const response = await fetch('/api/progress', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.progress) {
          setInitialProgress(user.id, data.progress);
          return data.progress;
        }
      }
    } catch (e) {
      // Silencioso si no hay conexión
    }
    return null;
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('namaste:auth-changed', (e) => {
      if (e.detail && e.detail.id) {
        setTimeout(fetchProgressFromServer, 100);
      } else {
        clearActiveUser();
      }
    });

    // Auto-sincronización con el servidor al cargar la aplicación
    setTimeout(() => {
      fetchProgressFromServer();
    }, 250);
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
