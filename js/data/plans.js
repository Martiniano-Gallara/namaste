/**
 * NAMASTÉ - Definición de Membresías y Planes
 * 3 Niveles Conscientes: Inicial (Esencia), Intermedio (Santuario) y Premium (Sadhana)
 * Versión Anual con 2 Meses de Regalo (se facturan 10 meses por 12 meses de acceso)
 */

const PLANS_DATA = [
  {
    id: "plan-esencia",
    tier: "inicial",
    levelName: "Inicial",
    name: "Plan Esencia",
    badge: "Inicial",
    priceMonthly: 19,
    priceAnnualTotal: 190,
    priceAnnualMonthly: 15.80,
    pricePeriod: "mes",
    currency: "USD",
    currencySymbol: "$",
    description: "Para quienes inician y desean pausas de presencia con Yoga Suave y Clásico.",
    features: [
      "Acceso a +40 clases de Yoga Suave y Clásico",
      "Meditaciones guiadas y Yoga Relax nocturno",
      "2 clases nuevas añadidas cada mes",
      "Acceso en móvil, tablet y computadora"
    ],
    recommended: false,
    ctaText: "Elegir Plan Esencia",
    codePrefix: "ESENCIA"
  },
  {
    id: "plan-santuario",
    tier: "intermedio",
    levelName: "Intermedio",
    name: "Plan Santuario",
    badge: "Más Elegido",
    priceMonthly: 29,
    priceAnnualTotal: 290,
    priceAnnualMonthly: 24.15,
    pricePeriod: "mes",
    currency: "USD",
    currencySymbol: "$",
    description: "La experiencia completa del Shala. Acceso total a todas las disciplinas.",
    features: [
      "Acceso ilimitado a todo el catálogo (+140 clases)",
      "Todos los estilos: Vinyasa, Hatha, Yin Yoga y Pranayama",
      "Nuevas clases grabadas cada semana",
      "Encuentros mensuales en vivo por Zoom (Satsang)"
    ],
    recommended: true,
    ctaText: "Unirme al Santuario",
    codePrefix: "SANTUARIO"
  },
  {
    id: "plan-sadhana",
    tier: "premium",
    levelName: "Premium",
    name: "Plan Sadhana",
    badge: "Premium",
    priceMonthly: 39,
    priceAnnualTotal: 390,
    priceAnnualMonthly: 32.50,
    pricePeriod: "mes",
    currency: "USD",
    currencySymbol: "$",
    description: "Inmersión profunda. Práctica avanzada, masterclasses y mentoría personal.",
    features: [
      "Todo lo de Plan Santuario sin restricciones",
      "Sesión individual de bienvenida de 30 min por Zoom",
      "Masterclasses y series de meditación avanzada",
      "Cuaderno digital de Sadhana y soporte directo"
    ],
    recommended: false,
    ctaText: "Elegir Plan Sadhana",
    codePrefix: "SADHANA"
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PLANS_DATA };
}
