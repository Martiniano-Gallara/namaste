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

    // Orden cronológico (por fecha de publicación)
    return all.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
  };

  /**
   * Evalúa si una alumna puede publicar reseña.
   * Regla de negocio: Debe tener al menos 7 días (1 semana) desde que activó la membresía.
   */
  const checkEligibility = (user) => {
    if (!user) {
      return { eligible: false, reason: 'no_user', daysRemaining: 7, daysActive: 0 };
    }

    if (user.role === 'admin' || user.isAdmin) {
      return { eligible: false, reason: 'is_admin', daysRemaining: 0, daysActive: 999 };
    }

    // Cuenta histórica de Sofía o con memberSince en meses pasados
    if (user.accessCode === 'NAMASTE-ALUMNO' || (user.email || '').toLowerCase() === 'sofia.varela@ejemplo.com') {
      return { eligible: true, daysRemaining: 0, daysActive: 215 };
    }

    // Si memberSince especifica meses anteriores a Octubre 2026
    const pastMonths = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre'];
    const memberSinceLower = (user.memberSince || '').toLowerCase();
    if (pastMonths.some(m => memberSinceLower.includes(m))) {
      return { eligible: true, daysRemaining: 0, daysActive: 30 };
    }

    // Cálculo por timestamp de creación o activación
    let activationTime = null;
    if (user.createdAt) {
      activationTime = new Date(user.createdAt).getTime();
    } else if (user.activatedAt) {
      activationTime = new Date(user.activatedAt).getTime();
    }

    if (!activationTime || isNaN(activationTime)) {
      activationTime = Date.now();
    }

    const diffMs = Date.now() - activationTime;
    const daysActive = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(1, 7 - daysActive);

    return {
      eligible: daysActive >= 7,
      reason: daysActive >= 7 ? 'eligible' : 'too_new',
      daysRemaining,
      daysActive
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
   * Publica o actualiza la reseña corta de una alumna
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
        message: `Tu reseña se habilitará en ${eligibility.daysRemaining} días (tras completar tu primera semana de práctica).`
      };
    }

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
      rating: Math.max(1, Math.min(5, Number(rating) || 5)),
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
            rating: Math.max(1, Math.min(5, Number(rating) || 5))
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

    return {
      success: true,
      review: reviewObj,
      message: '¡Tu reseña ha sido publicada en el inicio con éxito!'
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
            if (!merged.some(m => m.id === sr.id)) {
              merged.push(sr);
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
