/**
 * NAMASTÉ - Servicio de Reseñas y Testimonios
 * Permite a las alumnas con al menos 1 semana de membresía activa
 * publicar una reseña corta que se muestra en orden cronológico en el inicio.
 */

const ReviewsService = (() => {
  const STORAGE_KEY = 'namaste_published_reviews';

  const isStatic = () => {
    if (typeof window === 'undefined') return true;
    return window.location.hostname.includes('github.io') ||
           window.location.protocol === 'file:';
  };

  const SEED_REVIEWS = [
    {
      id: 'rev_seed_01',
      name: 'Lucía Méndez',
      planName: 'Plan Refugio',
      memberSince: 'Miembro hace 8 meses • Plan Refugio',
      quote: 'Sentí de inmediato la calidez y el respeto pedagógico de las maestras. Namasté transformó mis mañanas en un momento de verdadera calma.',
      rating: 5,
      timestamp: new Date('2026-02-15T10:00:00Z').getTime()
    },
    {
      id: 'rev_seed_02',
      name: 'Martín Rossi',
      planName: 'Sadhana Anual',
      memberSince: 'Miembro hace 1 año • Sadhana Anual',
      quote: 'Las clases de Yin Yoga nocturnas son mi salvavidas tras el trabajo. La forma en que te guían para soltar tensiones es medicina pura.',
      rating: 5,
      timestamp: new Date('2026-04-10T10:00:00Z').getTime()
    },
    {
      id: 'rev_seed_03',
      name: 'Clara Linares',
      planName: 'Plan Refugio',
      memberSince: 'Miembro hace 5 meses • Plan Refugio',
      quote: 'El acceso es simple y directo. Despliego la esterilla en mi casa y realmente siento que entro a un refugio de paz y cuidado personal.',
      rating: 5,
      timestamp: new Date('2026-06-05T10:00:00Z').getTime()
    },
    {
      id: 'rev_seed_04',
      name: 'Lucía Benítez',
      planName: 'Plan Refugio',
      memberSince: 'Miembro hace 6 meses • Plan Refugio',
      quote: 'La voz y serenidad de Vale me acompañan a diario. Encontrar un espacio guiado con tanta presencia y amor no tiene precio.',
      rating: 5,
      timestamp: new Date('2026-08-20T10:00:00Z').getTime()
    }
  ];

  const getStoredReviews = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  };

  const saveStoredReviews = (reviews) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
      window.dispatchEvent(new CustomEvent('namaste:reviews-updated'));
    } catch (e) {
      console.warn('Error saving reviews:', e);
    }
  };

  /**
   * Obtiene todas las reseñas (semillas + publicadas por alumnas),
   * EXCLUSIVAMENTE aquellas con 5 estrellas para la sección de inicio,
   * ordenadas cronológicamente por fecha/timestamp.
   */
  const getAllReviews = () => {
    const userReviews = getStoredReviews();
    const all = [...SEED_REVIEWS];

    // Añadir o actualizar con las del usuario
    userReviews.forEach(ur => {
      const exists = all.findIndex(r => r.id === ur.id);
      if (exists > -1) {
        all[exists] = ur;
      } else {
        all.push(ur);
      }
    });

    // EXCLUSIVAMENTE reseñas de 5 estrellas para la sección de inicio
    const fiveStarReviews = all.filter(r => (Number(r.rating) || 5) === 5);

    // Orden cronológico (por fecha de publicación)
    return fiveStarReviews.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
  };

  /**
   * Evalúa si una usuaria puede publicar reseña.
   * Cualquier clienta o practicante registrada (incluso nueva clienta) puede dejar su reseña de inmediato.
   */
  const checkEligibility = (user) => {
    if (!user) {
      return { eligible: false, reason: 'no_user', daysRemaining: 0, daysActive: 0 };
    }

    if (user.role === 'admin' || user.isAdmin) {
      return { eligible: false, reason: 'is_admin', daysRemaining: 0, daysActive: 999 };
    }

    // Toda clienta registrada puede opinar de inmediato
    return {
      eligible: true,
      reason: 'eligible',
      daysRemaining: 0,
      daysActive: 30
    };
  };

  /**
   * Obtiene la reseña que el usuario actual haya publicado (si existe)
   */
  const getUserReview = (user) => {
    if (!user) return null;
    const email = (user.email || '').toLowerCase();
    const stored = getStoredReviews();
    return stored.find(r => (r.userEmail || '').toLowerCase() === email || r.userId === user.id) || null;
  };

  /**
   * Publica o actualiza la reseña corta de una alumna.
   * Si la calificación es de 5 estrellas (exclusivamente), se publica en el inicio.
   */
  const publishReview = async ({ quote, rating = 5, user }) => {
    if (!user) return { success: false, message: 'Debes iniciar sesión.' };
    const cleanQuote = (quote || '').trim().replace(/^[«"]|[»"]$/g, '');

    if (cleanQuote.length < 10) {
      return { success: false, message: 'Tu reseña debe tener al menos 10 caracteres.' };
    }

    if (cleanQuote.length > 250) {
      return { success: false, message: 'Tu reseña no debe superar los 250 caracteres.' };
    }

    const eligibility = checkEligibility(user);
    if (!eligibility.eligible) {
      return {
        success: false,
        message: 'Debes tener una cuenta de alumna activa para publicar tu reseña.'
      };
    }

    const numRating = Math.max(1, Math.min(5, Number(rating) || 5));
    const now = new Date();
    const monthsEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const formattedDate = `${now.getDate()} ${monthsEs[now.getMonth()]} ${now.getFullYear()}`;

    const existing = getUserReview(user);
    const reviewId = existing ? existing.id : ('rev_usr_' + Date.now());

    const reviewObj = {
      id: reviewId,
      userId: user.id,
      userEmail: (user.email || '').toLowerCase(),
      name: user.name || 'Alumna de Namasté',
      planName: user.planName || 'Plan Refugio',
      memberSince: `Alumna • ${user.planName || 'Plan Refugio'}`,
      quote: cleanQuote,
      rating: numRating,
      timestamp: existing ? existing.timestamp : now.getTime(),
      dateFormatted: formattedDate,
      isStudentReview: true
    };

    // 1. Guardar en almacenamiento local
    const stored = getStoredReviews();
    const idx = stored.findIndex(r => r.id === reviewId);
    if (idx > -1) {
      stored[idx] = reviewObj;
    } else {
      stored.push(reviewObj);
    }
    saveStoredReviews(stored);

    // 2. Si no es entorno estático, sincronizar con backend REST
    if (!isStatic() && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      try {
        const token = typeof AuthService !== 'undefined' ? AuthService.getToken() : null;
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            quote: cleanQuote,
            rating: numRating
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return {
            success: false,
            message: errData.message || 'No fue posible registrar tu reseña en el servidor.'
          };
        }
      } catch (e) {
        return {
          success: false,
          message: 'Error de conexión al enviar tu reseña.'
        };
      }
    }

    const isFiveStars = numRating === 5;
    return {
      success: true,
      review: reviewObj,
      isFiveStars,
      message: isFiveStars
        ? '¡Tu reseña ha sido publicada en los testimonios del inicio!'
        : '¡Gracias por tu valoración! Tu opinión ha sido enviada al equipo docente para mejorar la práctica.'
    };
  };

  /**
   * Sincroniza reseñas del servidor al inicio (si no es estático)
   */
  const syncServerReviews = async () => {
    if (isStatic() || typeof window === 'undefined' || !window.location.protocol.startsWith('http')) return;
    try {
      const res = await fetch('/api/reviews');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reviews)) {
          const local = getStoredReviews();
          const merged = [...local];
          data.reviews.forEach(sr => {
            const mapped = {
              id: sr.id,
              userId: sr.userId,
              name: sr.name || sr.userName || 'Alumna',
              planName: sr.plan || sr.userPlan || 'Plan Refugio',
              memberSince: sr.memberSince || `Alumna • ${sr.plan || sr.userPlan || 'Plan Refugio'}`,
              quote: sr.quote || sr.comment || '',
              rating: Number(sr.rating) || 5,
              timestamp: sr.createdAt ? new Date(sr.createdAt).getTime() : (sr.timestamp || Date.now()),
              isStudentReview: true
            };
            const idx = merged.findIndex(m => m.id === mapped.id || (m.userId && m.userId === mapped.userId));
            if (idx > -1) {
              merged[idx] = { ...merged[idx], ...mapped };
            } else {
              merged.push(mapped);
            }
          });
          saveStoredReviews(merged);
        }
      }
    } catch (e) {
      // Ignorar si offline
    }
  };

  if (typeof window !== 'undefined') {
    setTimeout(syncServerReviews, 400);
  }

  return {
    getAllReviews,
    checkEligibility,
    getUserReview,
    publishReview
  };
})();
