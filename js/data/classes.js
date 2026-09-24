/**
 * NAMASTÉ - Base de Datos Oficial de Clases del Shala
 * Dirigido por Vale Manassero • +14 años de trayectoria | desde 2012
 * Lema: Cuerpo • Mente • Corazón
 *
 * Disciplinas oficiales:
 * - Yoga Suave
 * - Yoga Clásico
 * - Yoga Terapéutico
 * - Yoga Ashtanga
 * - Yoga Dinámico
 * - Yoga Relax
 */

const CLASSES_DATA = [
  // 1. YOGA SUAVE (7:00 AM)
  {
    id: "cls-suave-01",
    title: "Yoga Suave: Despertar Matutino & Movilidad Articular",
    category: "suave",
    categoryLabel: "Yoga Suave",
    duration: 35,
    level: "Todos los niveles",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté • +14 años de trayectoria (desde 2012)",
    thumbnail: "assets/images/shala.jpg",
    description: "Una práctica dulce y sin impacto para activar el cuerpo a primera hora de la mañana. Despertamos las articulaciones, estiramos la columna suavemente y oxigenamos los órganos a través de respiraciones amplias. Enfoque integral en Cuerpo • Mente • Corazón.",
    props: ["Esterilla", "1 Manta doblada"],
    intentions: ["Despertar corporal", "Movilidad articular", "Calma matutina"],
    isNew: false,
    featured: true,
    viewsCount: 520,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
    demoPoster: "assets/images/shala.jpg"
  },
  {
    id: "cls-suave-02",
    title: "Yoga Suave: Apertura de Pecho & Hombros Ligeros",
    category: "suave",
    categoryLabel: "Yoga Suave",
    duration: 30,
    level: "Principiante",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté • +14 años de trayectoria (desde 2012)",
    thumbnail: "assets/images/hero.jpg",
    description: "Movimientos fluidos a ritmo pausado guiados por Vale Manassero, enfocados en liberar la rigidez acumulada en la parte alta de la espalda, hombros y cuello, fomentando una respiración libre.",
    props: ["Esterilla", "1 Cojín o zafu"],
    intentions: ["Postura relajada", "Alivio de cuello", "Presencia serena"],
    isNew: true,
    featured: false,
    viewsCount: 310,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    demoPoster: "assets/images/hero.jpg"
  },

  // 2. YOGA CLÁSICO (8:00 AM / 17:45 PM)
  {
    id: "cls-clasico-01",
    title: "Yoga Clásico: Posturas Tradicionales & Alineación",
    category: "clasico",
    categoryLabel: "Yoga Clásico",
    duration: 50,
    level: "Principiante",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté • +14 años de trayectoria (desde 2012)",
    thumbnail: "assets/images/hatha.jpg",
    description: "Exploración de las asanas clásicas del yoga tradicional con énfasis en la alineación biomecánica correcta, el sostén consciente de la postura y el control de la respiración. Más de 14 años de método refinado en nuestro Shala.",
    props: ["Esterilla", "2 Bloques", "1 Cinto"],
    intentions: ["Alineación postural", "Fuerza estable", "Enfoque mental"],
    isNew: false,
    featured: true,
    viewsCount: 740,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    demoPoster: "assets/images/hatha.jpg"
  },
  {
    id: "cls-clasico-02",
    title: "Yoga Clásico de la Tarde: Equilibrio & Enraizamiento",
    category: "clasico",
    categoryLabel: "Yoga Clásico",
    duration: 45,
    level: "Multinivel",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté • +14 años de trayectoria (desde 2012)",
    thumbnail: "assets/images/shala.jpg",
    description: "Secuencia clásica vespertina guiada por Vale Manassero para reconectar con el centro de gravedad, fortalecer piernas y enraizar la energía tras las actividades del día.",
    props: ["Esterilla", "1 Bloque"],
    intentions: ["Equilibrio", "Enraizamiento", "Firmeza y paz"],
    isNew: true,
    featured: false,
    viewsCount: 430,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    demoPoster: "assets/images/shala.jpg"
  },

  // 3. YOGA TERAPÉUTICO (10:00 AM / 20:30 PM)
  {
    id: "cls-terapeutico-01",
    title: "Yoga Terapéutico: Cuidado de Columna & Zona Lumbar",
    category: "terapeutico",
    categoryLabel: "Yoga Terapéutico",
    duration: 45,
    level: "Todos los niveles",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté • Especialista en Yoga Terapéutico",
    thumbnail: "assets/images/yin.jpg",
    description: "Práctica especializada diseñada para descomprimir los discos vertebrales, aliviar dolores lumbares y corregir desequilibrios posturales. Desarrollada por Vale Manassero a lo largo de 14 años de acompañamiento terapéutico.",
    props: ["Esterilla", "Manta de yoga", "Cojín o bolster"],
    intentions: ["Espalda sana", "Alivio lumbar", "Movilidad sin dolor"],
    isNew: false,
    featured: true,
    viewsCount: 890,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
    demoPoster: "assets/images/yin.jpg"
  },
  {
    id: "cls-terapeutico-02",
    title: "Yoga Terapéutico: Liberación de Ciática & Caderas",
    category: "terapeutico",
    categoryLabel: "Yoga Terapéutico",
    duration: 40,
    level: "Principiante",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté • +14 años de trayectoria",
    thumbnail: "assets/images/meditation.jpg",
    description: "Estiramientos profundos y biomecánica segura para liberar la compresión del nervio ciático y devolver la libertad de movimiento a la pelvis y las caderas.",
    props: ["Esterilla", "1 Cinto", "1 Bloque"],
    intentions: ["Alivio ciático", "Flexibilidad pélvica", "Descompresión"],
    isNew: true,
    featured: false,
    viewsCount: 615,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    demoPoster: "assets/images/meditation.jpg"
  },

  // 4. YOGA ASHTANGA (15:00 PM)
  {
    id: "cls-ashtanga-01",
    title: "Yoga Ashtanga: Serie Primaria & Saludos al Sol",
    category: "ashtanga",
    categoryLabel: "Yoga Ashtanga",
    duration: 55,
    level: "Intermedio",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté • +14 años de trayectoria (desde 2012)",
    thumbnail: "assets/images/vinyasa.jpg",
    description: "La tradición clásica adaptada con precisión. Sincronización exacta de respiración Ujjayi, posturas de pie y cierres corporales (Bandhas) para generar calor purificador interno.",
    props: ["Esterilla con buen agarre"],
    intentions: ["Fuerza y resistencia", "Disciplina", "Purificación interna"],
    isNew: false,
    featured: true,
    viewsCount: 460,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    demoPoster: "assets/images/vinyasa.jpg"
  },
  {
    id: "cls-ashtanga-02",
    title: "Yoga Ashtanga: Fuerza de Core & Posturas Sentadas",
    category: "ashtanga",
    categoryLabel: "Yoga Ashtanga",
    duration: 60,
    level: "Intermedio / Avanzado",
    instructor: "Vale Manassero",
    instructorRole: "Docente de Ashtanga & Alineación",
    thumbnail: "assets/images/hero.jpg",
    description: "Profundización en las asanas en el suelo de la primera serie de Ashtanga Yoga: flexiones hacia adelante, torsiones y apertura de cadera con transiciones conscientes.",
    props: ["Esterilla", "Toalla de práctica"],
    intentions: ["Potencia muscular", "Flexibilidad activa", "Enfoque Drishthi"],
    isNew: true,
    featured: false,
    viewsCount: 380,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    demoPoster: "assets/images/hero.jpg"
  },

  // 5. YOGA DINÁMICO (19:00 PM - Todos los días)
  {
    id: "cls-dinamico-01",
    title: "Yoga Dinámico: Fluidez, Vitalidad & Movimiento Continuo",
    category: "dinamico",
    categoryLabel: "Yoga Dinámico",
    duration: 45,
    level: "Multinivel",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté • +14 años de trayectoria",
    thumbnail: "assets/images/vinyasa.jpg",
    description: "Nuestra clase central de las 19:00 hs. Transiciones fluidas y creativas guiadas por la respiración que encienden la vitalidad del cuerpo y limpian la mente tras el día. Tríada Cuerpo • Mente • Corazón en acción.",
    props: ["Esterilla", "2 Bloques (opcional)"],
    intentions: ["Vitalidad y sudoración", "Fluidez corporal", "Desconexión mental"],
    isNew: true,
    featured: true,
    viewsCount: 940,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
    demoPoster: "assets/images/vinyasa.jpg"
  },
  {
    id: "cls-dinamico-02",
    title: "Yoga Dinámico: Fuerza, Apertura de Caderas & Corazón",
    category: "dinamico",
    categoryLabel: "Yoga Dinámico",
    duration: 50,
    level: "Intermedio",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté",
    thumbnail: "assets/images/hero.jpg",
    description: "Secuencia progresiva que combina posturas de fuerza sobre brazos, aperturas torácicas expansivas y extensiones de cadera con ritmo ágil y armonioso.",
    props: ["Esterilla"],
    intentions: ["Expansión de pecho", "Fuerza integral", "Energía renovada"],
    isNew: false,
    featured: false,
    viewsCount: 580,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    demoPoster: "assets/images/hero.jpg"
  },

  // 6. YOGA RELAX (20:15 PM)
  {
    id: "cls-relax-01",
    title: "Yoga Relax: Descompresión del Sistema Nervioso & Calma",
    category: "relax",
    categoryLabel: "Yoga Relax",
    duration: 35,
    level: "Todos los niveles",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté • +14 años de trayectoria (desde 2012)",
    thumbnail: "assets/images/yin.jpg",
    description: "La práctica ideal para las 20:15 hs. Posturas pasivas en el suelo sostenidas con ayuda de soportes, respiración suave y atenuación de estímulos para inducir un descanso reparador y calmar el corazón.",
    props: ["Esterilla", "Bolster o almohadón firme", "Manta tibia"],
    intentions: ["Relajación nerviosa", "Liberación de tensiones", "Sosiego mental"],
    isNew: false,
    featured: true,
    viewsCount: 810,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    demoPoster: "assets/images/yin.jpg"
  },
  {
    id: "cls-relax-02",
    title: "Yoga Relax: El Arte del Savasana & Relajación Guiada",
    category: "relax",
    categoryLabel: "Yoga Relax",
    duration: 30,
    level: "Todos los niveles",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté",
    thumbnail: "assets/images/meditation.jpg",
    description: "Una sesión de quietud total y relajación consciente guiada por la voz serena de Vale Manassero para soltar cualquier carga residual del día antes de acostarte.",
    props: ["Manta suave", "Almohadita para los ojos"],
    intentions: ["Sueño profundo", "Paz interior", "Descanso fascial"],
    isNew: true,
    featured: false,
    viewsCount: 720,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
    demoPoster: "assets/images/meditation.jpg"
  },

  // 7. MEDITACIÓN & RESPIRACIÓN CONSCIENTE
  {
    id: "cls-med-01",
    title: "Meditación Guiada: Presencia Plena & Silencio Interior",
    category: "meditacion",
    categoryLabel: "Mindfulness",
    duration: 15,
    level: "Principiante",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté • Guía de Meditación Consciente",
    thumbnail: "assets/images/meditation.jpg",
    description: "Una práctica breve y transformadora para silenciar el ruido mental. Anclamos la atención en el flujo natural de la respiración, cultivando serenidad y espacio interior en cualquier momento del día.",
    props: ["Cojín de meditación o silla cómoda"],
    intentions: ["Silencio mental", "Paz inmediata", "Claridad"],
    isNew: true,
    featured: true,
    viewsCount: 980,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
    demoPoster: "assets/images/meditation.jpg"
  },
  {
    id: "cls-med-02",
    title: "Pranayama Consciente: Respiración Nadi Shodhana & Calma",
    category: "meditacion",
    categoryLabel: "Pranayama",
    duration: 20,
    level: "Todos los niveles",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté",
    thumbnail: "assets/images/pranayama.jpg",
    description: "Técnica milenaria de respiración alternada por fosas nasales para equilibrar los hemisferios cerebrales, reducir la ansiedad y purificar los canales de energía sutil del cuerpo.",
    props: ["Espacio tranquilo", "Postura sentada erguida"],
    intentions: ["Equilibrio sutil", "Alivio de ansiedad", "Oxigenación profunda"],
    isNew: false,
    featured: true,
    viewsCount: 840,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    demoPoster: "assets/images/pranayama.jpg"
  },
  {
    id: "cls-med-03",
    title: "Yoga Nidra Nocturno: Sueño Profundo & Restauración",
    category: "meditacion",
    categoryLabel: "Yoga Nidra",
    duration: 30,
    level: "Todos los niveles",
    instructor: "Vale Manassero",
    instructorRole: "Docente de Yoga Terapéutico & Restaurativo",
    thumbnail: "assets/images/yin.jpg",
    description: "El sueño yóguico consciente. Acuéstate cómodamente y deja que la voz de Vale te guíe a través de una rotación de conciencia que induce ondas alfa y regeneración celular profunda.",
    props: ["Cama o esterilla", "Manta abrigada", "Almohada baja"],
    intentions: ["Reposo celular", "Sueño profundo", "Sanación interior"],
    isNew: true,
    featured: false,
    viewsCount: 1120,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    demoPoster: "assets/images/yin.jpg"
  },
  {
    id: "cls-med-04",
    title: "Meditación Antiestrés: Liberación de Cargas Mentales",
    category: "meditacion",
    categoryLabel: "Sosiego Mental",
    duration: 18,
    level: "Todos los niveles",
    instructor: "Vale Manassero",
    instructorRole: "Fundadora de Namasté",
    thumbnail: "assets/images/shala.jpg",
    description: "Pausa consciente para soltar las tensiones de la jornada laboral. Ejercicios suaves de exhalación prolongada y visualización del espacio sagrado del Shala para reencontrar el centro.",
    props: ["Lugar sereno"],
    intentions: ["Descompresión", "Claridad emocional", "Regreso al centro"],
    isNew: false,
    featured: false,
    viewsCount: 670,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    demoPoster: "assets/images/shala.jpg"
  }
];

// Horario Oficial del Shala
const SCHEDULE_DATA = [
  { time: "07:00 AM", monday: "Yoga Suave", tuesday: "", wednesday: "Yoga Suave", thursday: "", friday: "Yoga Suave" },
  { time: "08:00 AM", monday: "", tuesday: "Yoga Clásico", wednesday: "", thursday: "Yoga Clásico", friday: "" },
  { time: "10:00 AM", monday: "", tuesday: "Yoga Terapéutico", wednesday: "", thursday: "Yoga Terapéutico", friday: "" },
  { time: "15:00 PM", monday: "", tuesday: "Yoga Ashtanga", wednesday: "", thursday: "Yoga Ashtanga", friday: "" },
  { time: "17:30 PM", monday: "", tuesday: "Yoga Niños", wednesday: "", thursday: "Yoga Niños", friday: "" },
  { time: "17:45 PM", monday: "Yoga Clásico", tuesday: "", wednesday: "Yoga Clásico", thursday: "", friday: "Yoga Clásico" },
  { time: "19:00 PM", monday: "Yoga Dinámico", tuesday: "Yoga Dinámico", wednesday: "Yoga Dinámico", thursday: "Yoga Dinámico", friday: "Yoga Dinámico" },
  { time: "20:15 PM", monday: "Yoga Relax", tuesday: "", wednesday: "Yoga Relax", thursday: "", friday: "Yoga Relax" },
  { time: "20:30 PM", monday: "", tuesday: "Yoga Terapéutico", wednesday: "", thursday: "Yoga Terapéutico", friday: "" }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CLASSES_DATA, SCHEDULE_DATA };
}
