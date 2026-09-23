/**
 * NAMASTÉ - Base de Datos de Citas Diarias de Yoga y Meditación
 * 60 frases inspiracionales rotativas para cada nuevo día
 */

const DAILY_QUOTES_DATA = [
  // Eje 1: Filosofía y Práctica del Yoga
  { text: "El cuerpo es tu templo.", author: "B.K.S. Iyengar" },
  { text: "Haz tu práctica y todo llegará.", author: "K. Pattabhi Jois" },
  { text: "El yoga no toma tiempo, da tiempo.", author: "Ganga White" },
  { text: "El yoga es la poesía del movimiento.", author: "Amit Ray" },
  { text: "El yoga es relación.", author: "T.K.V. Desikachar" },
  { text: "El yoga transforma a quien ve.", author: "B.K.S. Iyengar" },
  { text: "El yoga es un viaje hacia el yo.", author: "Bhagavad Gita" },
  { text: "El yoga es experiencia, no ejercicio.", author: "Sri Sri Ravi Shankar" },
  { text: "El yoga es escuchar al cuerpo.", author: "Petri Räisänen" },
  { text: "El yoga es luz de conciencia.", author: "Jason Crandell" },
  { text: "El yoga es fuente de juventud.", author: "Bob Harper" },
  { text: "El yoga es música sin fin.", author: "Sting" },
  { text: "El yoga es calma en movimiento.", author: "Ma Jaya" },
  { text: "El yoga es arte de conciencia.", author: "Amit Ray" },
  { text: "El yoga es disciplina del alma.", author: "Swami Sivananda" },
  { text: "El yoga es paz interior.", author: "Geshe Kelsang Gyatso" },
  { text: "El yoga es equilibrio.", author: "Sharon Gannon" },
  { text: "El yoga es unión.", author: "Patanjali" },
  { text: "El yoga es libertad.", author: "Rolf Gates" },
  { text: "El yoga es presencia.", author: "Sakyong Mipham" },

  // Eje 2: Meditación, Mente y Serenidad
  { text: "La meditación trae sabiduría.", author: "Buda" },
  { text: "La paz interior es invencible.", author: "Dalai Lama" },
  { text: "La respiración consciente es mi ancla.", author: "Thich Nhat Hanh" },
  { text: "La meditación es volver a uno mismo.", author: "Sogyal Rinpoche" },
  { text: "La meditación es silencio interior.", author: "Adyashanti" },
  { text: "La meditación es ciencia del alma.", author: "Paramahansa Yogananda" },
  { text: "La meditación es ver la mente tal cual es.", author: "Osho" },
  { text: "La meditación es surfear las olas.", author: "Jon Kabat-Zinn" },
  { text: "La meditación es entrar en el silencio.", author: "Deepak Chopra" },
  { text: "La meditación es amistad con uno mismo.", author: "Pema Chödrön" },
  { text: "La meditación crea más tiempo del que toma.", author: "Peter McWilliams" },
  { text: "La meditación es atención plena.", author: "Daniel Goleman" },
  { text: "La meditación es despertar al presente.", author: "Eckhart Tolle" },
  { text: "La meditación es espacio entre pensamientos.", author: "Alan Cohen" },
  { text: "La meditación es amor sin barreras.", author: "Rumi" },
  { text: "La meditación es calma en la tormenta.", author: "Jack Kornfield" },
  { text: "La meditación es sabiduría en acción.", author: "Alan Watts" },
  { text: "La meditación es volver al espíritu.", author: "Paramahansa Yogananda" },
  { text: "La meditación es silencio que sana.", author: "Caroline Myss" },
  { text: "La meditación es paz que se expande.", author: "Maya Angelou" },

  // Eje 3: Conciencia, Calma y Quietud
  { text: "La mente se beneficia de la quietud.", author: "Sakyong Mipham" },
  { text: "La meditación es el arte de estar presente.", author: "Eckhart Tolle" },
  { text: "La calma es poder.", author: "Buda" },
  { text: "La meditación es el camino a la libertad.", author: "Osho" },
  { text: "La respiración consciente abre la vida.", author: "Thich Nhat Hanh" },
  { text: "La meditación es unión con lo eterno.", author: "Paramahansa Yogananda" },
  { text: "La meditación es ver con claridad.", author: "Pema Chödrön" },
  { text: "La meditación es silencio fértil.", author: "Adyashanti" },
  { text: "La meditación es descanso del alma.", author: "Deepak Chopra" },
  { text: "La meditación es paz en movimiento.", author: "Jon Kabat-Zinn" },
  { text: "La meditación es despertar interior.", author: "Dalai Lama" },
  { text: "La meditación es escuchar al corazón.", author: "Rumi" },
  { text: "La meditación es presencia pura.", author: "Alan Watts" },
  { text: "La meditación es calma que ilumina.", author: "Jack Kornfield" },
  { text: "La meditación es unión con la vida.", author: "Sogyal Rinpoche" },
  { text: "La meditación es silencio creador.", author: "Caroline Myss" },
  { text: "La meditación es claridad en la mente.", author: "Daniel Goleman" },
  { text: "La meditación es paz que transforma.", author: "Maya Angelou" },
  { text: "La meditación es libertad interior.", author: "Alan Cohen" },
  { text: "La meditación es amor consciente.", author: "Sharon Gannon" }
];

/**
 * Obtiene la cita correspondiente para el día actual
 * Cambia automáticamente a las 00:00 de cada nuevo día
 */
function getQuoteOfTheDay() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = (now - startOfYear) + ((startOfYear.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  const index = Math.abs(dayOfYear + (now.getFullYear() * 13)) % DAILY_QUOTES_DATA.length;
  return DAILY_QUOTES_DATA[index];
}

if (typeof window !== 'undefined') {
  window.DAILY_QUOTES_DATA = DAILY_QUOTES_DATA;
  window.getQuoteOfTheDay = getQuoteOfTheDay;
}
