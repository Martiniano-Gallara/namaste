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
   * Inicia el proceso de suscripción (cuenta inactiva hasta completar pago en Mercado Pago)
   */
  const processCheckout = async (checkoutData) => {
    const { name, email, password, planId, paymentMethod, isAnnual, amount } = checkoutData;

    const selectedPlan = PLANS_DATA.find(p => p.id === planId) || PLANS_DATA[1];
    const planDisplayName = `${selectedPlan.name} (${isAnnual ? 'Anual • 2 meses gratis' : 'Mensual'})`;
    const finalAmount = amount || (isAnnual ? (selectedPlan.priceAnnualTotal || selectedPlan.priceMonthly * 10) : selectedPlan.priceMonthly);
    const chosenMethod = paymentMethod || 'MercadoPago';
    const cleanEmail = (email || 'alumno@namaste.com').trim().toLowerCase();
    const cleanName = (name || 'Practicante de Namasté').trim();

    // Guardar referencia de pago pendiente en el navegador
    try {
      localStorage.setItem('namaste_pending_payment', JSON.stringify({
        email: cleanEmail,
        name: cleanName,
        planId: selectedPlan.id,
        planName: planDisplayName,
        amount: finalAmount,
        isAnnual: !!isAnnual,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Could not store pending payment metadata', e);
    }

    // 1. Intentar registrar en API REST del servidor (solo si no es estático)
    if (!isStatic() && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      try {
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            email: cleanEmail,
            password: password || '',
            planId: selectedPlan.id,
            isAnnual: !!isAnnual,
            paymentMethod: chosenMethod
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            // Nota: La cuenta queda inactiva hasta confirmar el pago en Mercado Pago
            return {
              success: true,
              pending: true,
              active: false,
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
    await new Promise(resolve => setTimeout(resolve, 300));

    // Se registra con active: false (inactiva)
    const newMember = AuthService.registerNewMember(
      cleanName,
      cleanEmail,
      selectedPlan.id,
      planDisplayName,
      { isAnnual: !!isAnnual, amount: finalAmount, paymentMethod: chosenMethod, password: password || '', active: false, paymentStatus: 'pending' }
    );

    const transaction = {
      id: 'tx_' + Math.random().toString(36).substring(2, 9),
      receiptNumber: 'REC-2026-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toISOString(),
      amount: finalAmount,
      isAnnual: !!isAnnual,
      planId: selectedPlan.id,
      planName: planDisplayName,
      paymentMethod: chosenMethod,
      userEmail: newMember.email,
      accessCode: newMember.accessCode,
      status: 'pending' // Pendiente de pago
    };

    try {
      const history = JSON.parse(localStorage.getItem('namaste_transactions') || '[]');
      history.push(transaction);
      localStorage.setItem('namaste_transactions', JSON.stringify(history));
    } catch (e) {
      console.warn('Could not save transaction history', e);
    }

    // NO loguear al usuario aquí: debe abonar primero en Mercado Pago
    return {
      success: true,
      pending: true,
      active: false,
      transaction,
      member: newMember,
      plan: selectedPlan
    };
  };

  /**
   * Confirma o cancela el pago retornando desde Mercado Pago
   * @param {string} email
   * @param {'approved'|'cancelled'|'rejected'} status
   */
  const confirmPayment = async (email, status = 'approved', options = {}) => {
    const isApproved = (status === 'approved' || status === 'success' || status === 'succeeded');
    const cleanEmail = (email || '').trim().toLowerCase();

    // 1. Intentar confirmación en el servidor
    if (!isStatic() && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      try {
        const response = await fetch('/api/checkout/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            status: isApproved ? 'approved' : 'cancelled',
            paymentId: options.paymentId || null
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            if (isApproved && data.token) {
              AuthService.loginUser(data.user, data.token);
            } else {
              AuthService.logout();
            }
            try { localStorage.removeItem('namaste_pending_payment'); } catch (e) {}
            return {
              success: isApproved,
              active: isApproved,
              user: data.user,
              message: data.message
            };
          }
        }
      } catch (e) {
        // Fallback local
      }
    }

    // 2. Fallback local / offline
    const updatedUser = AuthService.activateMemberPayment(cleanEmail, isApproved);

    // Actualizar historial local de transacciones
    try {
      const history = JSON.parse(localStorage.getItem('namaste_transactions') || '[]');
      const lastTx = [...history].reverse().find(t => (t.userEmail || '').toLowerCase() === cleanEmail);
      if (lastTx) {
        lastTx.status = isApproved ? 'succeeded' : 'cancelled';
        localStorage.setItem('namaste_transactions', JSON.stringify(history));
      }
      localStorage.removeItem('namaste_pending_payment');
    } catch (e) {}

    return {
      success: isApproved,
      active: isApproved,
      user: updatedUser,
      message: isApproved
        ? '¡Pago aprobado! Tu membresía ha sido activada exitosamente.'
        : 'El pago fue cancelado. La cuenta permanece inactiva.'
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
    confirmPayment,
    toggleMembershipPause
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MembershipService };
}
