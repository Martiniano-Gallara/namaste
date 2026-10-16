/**
 * NAMASTÉ - Definición de Membresías y Planes
 * 2 Niveles Conscientes: Esencia y Refugio (Completo)
 * Versión Anual con 2 Meses de Regalo (se facturan 10 meses por 12 meses de acceso)
 */

const PLANS_DATA = [
  {
    id: "plan-esencia",
    tier: "inicial",
    levelName: "Inicial",
    name: "Plan Esencia",
    badge: "Inicial",
    priceMonthly: 29000,
    priceAnnualTotal: 290000,
    priceAnnualMonthly: 24167,
    pricePeriod: "mes",
    currency: "ARS",
    currencySymbol: "$",
    description: "Clases de Hatha Yoga Clásico, Kinésico Terapéutico y meditaciones guiadas.",
    allowedCategories: ["suave", "clasico", "terapeutico", "relax", "meditacion"],
    features: [
      "Clases de Hatha Yoga Clásico",
      "Hatha Yoga Kinésico Terapéutico",
      "Meditaciones guiadas",
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
    tier: "completo",
    levelName: "Completo",
    name: "Plan Refugio",
    badge: "Más Elegido",
    priceMonthly: 39000,
    priceAnnualTotal: 390000,
    priceAnnualMonthly: 32500,
    pricePeriod: "mes",
    currency: "ARS",
    currencySymbol: "$",
    description: "Acceso total a todas las disciplinas, series dinámicas y masterclasses exclusivas.",
    allowedCategories: ["*"],
    features: [
      "Clases de Hatha Yoga Clásico",
      "Hatha Yoga Kinésico Terapéutico",
      "Hatha Yoga Dinámico",
      "Vinyasa Flow",
      "Ashtanga",
      "Meditaciones guiadas",
      "Masterclasses exclusivas"
    ],
    recommended: true,
    ctaText: "Unirme al Refugio",
    codePrefix: "REFUGIO",
    mercadopagoUrl: "https://www.mercadopago.com.ar",
    mercadopagoUrlAnnual: "https://www.mercadopago.com.ar"
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PLANS_DATA };
}
