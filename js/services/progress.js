/**
 * NAMASTÉ - Servicio de Progreso, Favoritos e Historial de Práctica
 */

const ProgressService = (() => {
  const getUserKey = () => {
    try {
      const user = typeof AuthService !== 'undefined' ? AuthService.getCurrentUser() : null;
      if (!user) return 'guest';
      return (user.email || user.accessCode || 'guest').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    } catch (e) {
      return 'guest';
    }
  };

  const getProgressStorageKey = () => {
    return 'namaste_user_progress_' + getUserKey();
  };

  const getProgressState = () => {
    const key = getProgressStorageKey();
    const user = typeof AuthService !== 'undefined' ? AuthService.getCurrentUser() : null;
    try {
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);

      // Si es la cuenta semilla demo pre-configurada (Sofía Varela)
      if (user && (user.accessCode === 'NAMASTE-ALUMNO' || user.email === 'sofia.varela@ejemplo.com')) {
        return {
          favorites: ['cls-dinamico-01', 'cls-terapeutico-01'],
          completed: ['cls-suave-01'],
          lastPlayed: {
            classId: 'cls-dinamico-01',
            progressSeconds: 1200,
            date: new Date().toISOString()
          }
        };
      }

      // Para cualquier nuevo alumno registrado, iniciar vacío
      return { favorites: [], completed: [], lastPlayed: null };
    } catch (e) {
      return { favorites: [], completed: [], lastPlayed: null };
    }
  };

  const saveProgressState = (state) => {
    try {
      const key = getProgressStorageKey();
      localStorage.setItem(key, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent('namaste:progress-changed', { detail: state }));
    } catch (e) {
      console.warn('Error saving progress state', e);
    }
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
    saveProgressState(state);
    return state.favorites.includes(classId);
  };

  const isCompleted = (classId) => {
    const state = getProgressState();
    return state.completed.includes(classId);
  };

  const markCompleted = (classId, durationMinutes = 30) => {
    const state = getProgressState();
    if (!state.completed.includes(classId)) {
      state.completed.push(classId);
      saveProgressState(state);

      // Actualiza estadísticas del usuario actual con cálculo diario real
      const user = AuthService.getCurrentUser();
      if (user) {
        const today = new Date().toISOString().split('T')[0];
        let newStreak = user.streakDays || 1;
        const lastDate = user.lastPracticeDate;

        if (!lastDate) {
          newStreak = user.streakDays || 1;
        } else if (lastDate === today) {
          // Ya practicó hoy: no sumar racha repetidamente en el mismo día
          newStreak = user.streakDays || 1;
        } else {
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          if (lastDate === yesterday) {
            newStreak = Math.min(365, (user.streakDays || 1) + 1);
          } else {
            newStreak = 1;
          }
        }

        AuthService.updateUserProfile({
          totalMinutesPracticed: (user.totalMinutesPracticed || 0) + Number(durationMinutes || 0),
          completedClassesCount: (user.completedClassesCount || 0) + 1,
          streakDays: newStreak,
          lastPracticeDate: today
        });
      }
    }
    return true;
  };

  const recordPlayProgress = (classId, progressSeconds) => {
    const state = getProgressState();
    state.lastPlayed = {
      classId,
      progressSeconds,
      date: new Date().toISOString()
    };
    saveProgressState(state);
  };

  const getLastPlayed = () => {
    const state = getProgressState();
    if (!state.lastPlayed || !state.lastPlayed.classId) return null;
    const foundClass = CLASSES_DATA.find(c => c.id === state.lastPlayed.classId);
    if (!foundClass) return null;
    return {
      ...foundClass,
      progressSeconds: state.lastPlayed.progressSeconds
    };
  };

  return {
    getProgressState,
    isFavorite,
    toggleFavorite,
    isCompleted,
    markCompleted,
    recordPlayProgress,
    getLastPlayed
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ProgressService };
}
