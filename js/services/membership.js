/**
 * NAMASTÉ - Servicio de Membresías, Checkout y Pasarela Cifrada
 * Se conecta con la API REST (/api/checkout) y mantiene persistencia centralizada.
 */

const MembershipService = (() => {
  const isStatic = () => {
    if (typeof window === 'undefined') return true;
    return window.location.hostname.includes('github.io') ||
           window.location.protocol === 'file:' ||
           (!['localhost', '127.0.0.1'].includes(window.location.hostname) && !window.location.port);
  };

  /**
   * Procesa el alta de membresía comunicándose con el backend
   */
  const processCheckout = async (checkoutData) => {
    const { name, email, planId, paymentMethod, isAnnual, amount } = checkoutData;

    const selectedPlan = PLANS_DATA.find(p => p.id === planId) || PLANS_DATA[1];
    const planDisplayName = `${selectedPlan.name} (${isAnnual ? 'Anual • 2 meses gratis' : 'Mensual'})`;
    const finalAmount = amount || (isAnnual ? (selectedPlan.priceAnnualTotal || selectedPlan.priceMonthly * 10) : selectedPlan.priceMonthly);

    // 1. Intentar registrar en API REST del servidor (solo si no es estático)
    if (!isStatic() && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      try {
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name || 'Practicante de Namasté',
            email: email || 'alumno@namaste.com',
            planId: selectedPlan.id,
            isAnnual: !!isAnnual,
            paymentMethod: paymentMethod || 'Tarjeta Cifrada •••• 4242'
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            AuthService.loginUser(data.user, data.token);
            return {
              success: true,
              transaction: data.transaction,
              member: data.user,
              plan: selectedPlan
            };
          }
        }
      } catch (e) {
        // Proceder con fallback local si el servidor no responde
      }
    }

    // 2. Fallback de demostración / offline
    await new Promise(resolve => setTimeout(resolve, 600));

    const newMember = AuthService.registerNewMember(
      name || 'Practicante de Namasté',
      email || 'alumno@namaste.com',
      selectedPlan.id,
      planDisplayName,
      { isAnnual: !!isAnnual, amount: finalAmount, paymentMethod: paymentMethod || 'Tarjeta Cifrada •••• 4242' }
    );

    const transaction = {
      id: 'tx_' + Math.random().toString(36).substring(2, 9),
      receiptNumber: 'REC-2026-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toISOString(),
      amount: finalAmount,
      isAnnual: !!isAnnual,
      planId: selectedPlan.id,
      planName: planDisplayName,
      paymentMethod: paymentMethod || 'Tarjeta Cifrada •••• 4242',
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

    AuthService.loginUser(newMember);

    return {
      success: true,
      transaction,
      member: newMember,
      plan: selectedPlan
    };
  };

  const toggleMembershipPause = async () => {
    const user = AuthService.getCurrentUser();
    if (!user) return false;
    const newStatus = !user.active;
    const updated = await AuthService.updateUserProfile({
      active: newStatus
    });
    return updated ? updated.active : newStatus;
  };

  return {
    processCheckout,
    toggleMembershipPause
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MembershipService };
}
