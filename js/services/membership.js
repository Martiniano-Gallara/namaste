/**
 * NAMASTÉ - Servicio de Membresías, Checkout y Pasarela Simulada
 */

const MembershipService = (() => {
  /**
   * Simula el procesamiento de pago y generación de membresía
   * Diseñado para conectar directamente con Webhook de Stripe o MercadoPago en producción
   */
  const processCheckout = async (checkoutData) => {
    const { name, email, planId, paymentMethod, isAnnual, amount } = checkoutData;

    // Simula latencia de red segura (800ms)
    await new Promise(resolve => setTimeout(resolve, 850));

    const selectedPlan = PLANS_DATA.find(p => p.id === planId) || PLANS_DATA[1];
    const planDisplayName = `${selectedPlan.name} (${isAnnual ? 'Anual • 2 meses gratis' : 'Mensual'})`;

    // Registra al nuevo alumno en el sistema de autenticación
    const newMember = AuthService.registerNewMember(
      name || 'Practicante de Namasté',
      email || 'alumno@namaste.com',
      selectedPlan.id,
      planDisplayName
    );

    // Guarda evento de transacción simulada
    const transaction = {
      id: 'tx_' + Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString(),
      amount: amount || (isAnnual ? (selectedPlan.priceAnnualTotal || selectedPlan.priceMonthly * 10) : selectedPlan.priceMonthly),
      isAnnual: !!isAnnual,
      planId: selectedPlan.id,
      planName: planDisplayName,
      paymentMethod: paymentMethod || 'credit_card',
      userEmail: newMember.email,
      accessCode: newMember.accessCode,
      status: 'succeeded'
    };

    try {
      const history = JSON.parse(localStorage.getItem('namaste_transactions') || '[]');
      history.push(transaction);
      localStorage.setItem('namaste_transactions', JSON.stringify(history));
    } catch (e) {
      console.warn('Could not save transaction history', e);
    }

    return {
      success: true,
      transaction,
      member: newMember,
      plan: selectedPlan
    };
  };

  const toggleMembershipPause = () => {
    const user = AuthService.getCurrentUser();
    if (!user) return false;
    const updated = AuthService.updateUserProfile({
      active: !user.active
    });
    return updated.active;
  };

  return {
    processCheckout,
    toggleMembershipPause
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MembershipService };
}
