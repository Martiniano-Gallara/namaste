/**
 * NAMASTÉ - Servicio de Progreso, Favoritos e Historial de Práctica
 */

const ProgressService = (() => {
  const PROGRESS_KEY = 'namaste_user_progress';

  const getProgressState = () => {
    try {
      const data = localStorage.getItem(PROGRESS_KEY);
      return data ? JSON.parse(data) : {
        favorites: ['cls-dinamico-01', 'cls-terapeutico-01'],
        completed: ['cls-suave-01'],
        lastPlayed: {
          classId: 'cls-dinamico-01',
          progressSeconds: 1200, // 20 minutos
          date: new Date().toISOString()
        }
      };
    } catch (e) {
      return { favorites: [], completed: [], lastPlayed: null };
    }
  };

  const saveProgressState = (state) => {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
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

      // Actualiza estadísticas del usuario actual
      const user = AuthService.getCurrentUser();
      if (user) {
        AuthService.updateUserProfile({
          totalMinutesPracticed: (user.totalMinutesPracticed || 0) + durationMinutes,
          completedClassesCount: (user.completedClassesCount || 0) + 1,
          streakDays: Math.min(30, (user.streakDays || 1) + 1)
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
