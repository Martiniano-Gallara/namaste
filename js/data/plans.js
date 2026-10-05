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
    description: "1 clase semanal de Yoga Clásico con meditaciones guiadas.",
    allowedCategories: ["suave", "clasico", "relax", "meditacion"],
    features: [
      "1 clase semanal de Yoga Clásico",
      "Meditaciones guiadas y relajación",
      "Acceso en móvil, tablet y computadora",
      "Comunidad consciente del Shala"
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
    description: "2 clases semanales de Yoga Clásico y Dinámico + meditación.",
    allowedCategories: ["*"],
    features: [
      "2 clases semanales (Yoga Clásico y Yoga Dinámico)",
      "Prácticas de meditación y pranayama",
      "Acceso completo a grabaciones del Shala",
      "Encuentros mensuales en comunidad"
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
    description: "3 clases semanales, meditaciones, clases en vivo y masterclasses.",
    allowedCategories: ["*"],
    features: [
      "3 clases semanales de práctica integral",
      "Meditaciones profundas guiadas",
      "Acceso a clases online en vivo",
      "Masterclasses exclusivas en vivo"
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
