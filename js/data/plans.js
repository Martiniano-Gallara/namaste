/**
 * NAMASTÉ - Definición de Membresías y Planes
 * 3 Niveles Conscientes: Inicial (Esencia), Intermedio (Refugio) y Premium (Sadhana)
 * Versión Anual con 2 Meses de Regalo (se facturan 10 meses por 12 meses de acceso)
 */

const PLANS_DATA = [
  {
    id: "plan-esencia",
    tier: "inicial",
    levelName: "Inicial",
    name: "Plan Esencia",
    badge: "Inicial",
    priceMonthly: 19000,
    priceAnnualTotal: 190000,
    priceAnnualMonthly: 15833,
    pricePeriod: "mes",
    currency: "ARS",
    currencySymbol: "$",
    description: "Para quienes inician y desean pausas de presencia con Yoga Suave y Clásico.",
    allowedCategories: ["suave", "clasico", "relax", "meditacion"],
    features: [
      "Acceso a +40 clases de Yoga Suave y Clásico",
      "Meditaciones guiadas y Yoga Relax nocturno",
      "2 clases nuevas añadidas cada mes",
      "Acceso en móvil, tablet y computadora"
    ],
    recommended: false,
    ctaText: "Elegir Plan Esencia",
    codePrefix: "ESENCIA",
    mercadopagoUrl: "https://www.mercadopago.com.ar",
    mercadopagoUrlAnnual: "https://www.mercadopago.com.ar"
  },
  {
    id: "plan-refugio",
    tier: "intermedio",
    levelName: "Intermedio",
    name: "Plan Refugio",
    badge: "Más Elegido",
    priceMonthly: 29000,
    priceAnnualTotal: 290000,
    priceAnnualMonthly: 24167,
    pricePeriod: "mes",
    currency: "ARS",
    currencySymbol: "$",
    description: "La experiencia completa del Shala. Acceso total a todas las disciplinas.",
    allowedCategories: ["*"],
    features: [
      "Acceso ilimitado a todo el catálogo (+140 clases)",
      "Todos los estilos: Vinyasa, Hatha, Yin Yoga y Pranayama",
      "Nuevas clases grabadas cada semana",
      "Encuentros mensuales en vivo por Zoom (Satsang)"
    ],
    recommended: true,
    ctaText: "Unirme al Refugio",
    codePrefix: "REFUGIO",
    mercadopagoUrl: "https://www.mercadopago.com.ar",
    mercadopagoUrlAnnual: "https://www.mercadopago.com.ar"
  },
  {
    id: "plan-sadhana",
    tier: "premium",
    levelName: "Premium",
    name: "Plan Sadhana",
    badge: "Premium",
    priceMonthly: 39000,
    priceAnnualTotal: 390000,
    priceAnnualMonthly: 32500,
    pricePeriod: "mes",
    currency: "ARS",
    currencySymbol: "$",
    description: "Inmersión profunda. Práctica avanzada, masterclasses y mentoría personal.",
    allowedCategories: ["*"],
    features: [
      "Todo lo de Plan Refugio sin restricciones",
      "Sesión individual de bienvenida de 30 min por Zoom",
      "Masterclasses y series de meditación avanzada",
      "Cuaderno digital de Sadhana y soporte directo"
    ],
    recommended: false,
    ctaText: "Elegir Plan Sadhana",
    codePrefix: "SADHANA",
    mercadopagoUrl: "https://www.mercadopago.com.ar",
    mercadopagoUrlAnnual: "https://www.mercadopago.com.ar"
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PLANS_DATA };
}
