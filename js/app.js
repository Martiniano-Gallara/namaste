/**
 * NAMASTÉ - Controlador Principal de la Aplicación & Refugio Virtual
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Estado Global ---
  const state = {
    currentView: 'landing', // 'landing' | 'platform' | 'admin'
    selectedPlanForCheckout: null,
    activeCategoryFilter: 'all',
    activeDurationFilter: 'all',
    activeLevelFilter: 'all',
    searchQuery: '',
    onlyFavorites: false,
    onlyNew: false,
    activePlayingClass: null,
    adminUsersCache: [],
    adminUserFilterStatus: 'all',
    adminUserSearchQuery: '',
    adminClassesCache: [],
    adminClassFilterFormat: 'all',
    adminClassSearchQuery: '',
    adminActiveTab: 'tab-classes',
    adminPlansCache: null
  };

  // --- Elementos del DOM ---
  const views = {
    landing: document.getElementById('view-landing'),
    platform: document.getElementById('view-platform'),
    admin: document.getElementById('view-admin')
  };

  const modals = {
    login: document.getElementById('modal-login'),
    checkout: document.getElementById('modal-checkout'),
    player: document.getElementById('modal-player'),
    profileDrawer: document.getElementById('profile-drawer-backdrop'),
    liveSession: document.getElementById('modal-live-session'),
    changePlan: document.getElementById('modal-change-plan'),
    progressDetails: document.getElementById('modal-progress-details'),
    receipt: document.getElementById('modal-receipt'),
    legal: document.getElementById('modal-legal'),
    adminCreateUser: document.getElementById('modal-admin-create-user'),
    adminEditPlan: document.getElementById('modal-admin-edit-plan'),
    adminClass: document.getElementById('modal-admin-class')
  };

  // Helper para obtener todas las clases activas (sincronizadas entre Admin y Alumnas)
  function getActiveClasses() {
    if (typeof ClassesService !== 'undefined') {
      return ClassesService.getAllClasses();
    }
    return typeof CLASSES_DATA !== 'undefined' ? CLASSES_DATA : [];
  }

  // Función para escapar HTML y prevenir vulnerabilidades de DOM XSS
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper para generar iniciales del alumno
  function getUserInitials(name) {
    if (!name) return 'SV';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Sistema de Notificaciones Toast serenas
  // Toast rate-limiting: max 3 simultaneous, deduplication por 2s
  const _toastState = { queue: [], active: 0, MAX: 3, recentMsgs: new Map() };

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Deduplicar: ignorar si el mismo mensaje ya se mostró en los últimos 2s
    const now = Date.now();
    const lastShown = _toastState.recentMsgs.get(message);
    if (lastShown && now - lastShown < 2000) return;
    _toastState.recentMsgs.set(message, now);
    // Limpiar mensajes viejos del mapa de deduplicación
    for (const [k, t] of _toastState.recentMsgs) {
      if (now - t > 4000) _toastState.recentMsgs.delete(k);
    }

    // Si ya hay 3 activos, encolar
    if (_toastState.active >= _toastState.MAX) {
      _toastState.queue.push({ message, type });
      return;
    }

    _showToastNow(container, message, type);
  }

  function _showToastNow(container, message, type) {
    _toastState.active++;
    const toast = document.createElement('div');
    toast.className = `namaste-toast namaste-toast-${type}`;
    toast.innerHTML = `
      <svg class="namaste-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span class="namaste-toast-text"></span>
    `;
    const span = toast.querySelector('.namaste-toast-text');
    if (span) span.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
        _toastState.active--;
        // Despachar siguiente de la cola si hay
        if (_toastState.queue.length > 0) {
          const next = _toastState.queue.shift();
          _showToastNow(container, next.message, next.type);
        }
      }, 300);
    }, 3200);
  }

  // Helper para calcular la fecha dinámica del próximo Satsang en vivo
  function getNextSatsangEvent() {
    const now = new Date();
    const nextSunday = new Date(now);
    const dayOfWeek = now.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? (now.getHours() >= 19 ? 7 : 0) : (7 - dayOfWeek);
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(19, 0, 0, 0);

    const endSunday = new Date(nextSunday);
    endSunday.setHours(20, 0, 0, 0);

    const monthsEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const formatted = `Domingo ${nextSunday.getDate()} de ${monthsEs[nextSunday.getMonth()]} ${nextSunday.getFullYear()}, 19:00 hs (Arg / 00:00 Esp)`;

    const toGCalString = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const gCalDates = `${toGCalString(nextSunday)}/${toGCalString(endSunday)}`;

    return {
      dateText: formatted,
      gCalDates
    };
  }

  // ========================================================================
  // INICIALIZACIÓN
  // ========================================================================
  function init() {
    setupNavigation();
    setupModals();
    setupAuthListeners();
    setupLandingCatalog();
    setupFAQAccordion();
    setupCheckoutForm();
    setupLoginForm();
    setupPlatformFilters();
    setupPlayerControls();
    setupProfileDrawer();
    setupPlatformFeatures();
    setupMobileNav();
    setupDailyQuote();
    setupHorizontalSliders();
    setupBillingSwitcher();
    setupScrollSpy();
    setupAdminDashboard();
    syncPublicPlansFromDatabase();
    renderTestimonialsSlider();
    window.addEventListener('namaste:reviews-updated', () => {
      renderTestimonialsSlider();
    });

    // Enrutamiento directo por hash (#auditoria, #refugio, #inicio)
    handleHashRouting();
    window.addEventListener('hashchange', handleHashRouting);

    // Si ya existe sesión previa, asegurar que no sea una cuenta inactiva / pendiente
    const currentUser = AuthService.getCurrentUser();
    if (currentUser) {
      if (currentUser.active === false) {
        AuthService.logout();
      } else {
        updateNavForLoggedInUser(currentUser);
      }
    }

    // Verificar si el usuario retorna desde Mercado Pago con estado de pago
    checkMercadoPagoPaymentReturn();
  }

  function handleHashRouting() {
    const hash = (window.location.hash || '').toLowerCase();
    if (hash === '#auditoria' || hash === '#admin' || hash === '#backoffice') {
      switchView('admin');
    } else if (hash === '#refugio' || hash === '#plataforma') {
      switchView('platform');
    } else if (hash === '#login' || hash === '#ingreso' || hash === '#acceso') {
      switchView('landing');
      if (modals && modals.login) openModal(modals.login);
    } else if (hash === '#inicio' || hash === '#home') {
      switchView('landing');
    }
  }

  /**
   * Habilita arrastre fluido con mouse para los carruseles (testimonios, planes y clases) en escritorio
   */
  function setupHorizontalSliders() {
    ['testimonials-slider', 'benefits-slider', 'steps-slider', 'plans-slider', 'carousel-yoga', 'carousel-meditation'].forEach(id => {
      const slider = document.getElementById(id);
      if (!slider) return;

      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;

      slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.style.cursor = 'grabbing';
        slider.style.userSelect = 'none';
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
      });

      window.addEventListener('mouseup', () => {
        if (!isDown) return;
        isDown = false;
        slider.style.cursor = 'grab';
        slider.style.removeProperty('user-select');
      });

      slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.style.cursor = 'grab';
      });

      slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 1.4;
        slider.scrollLeft = scrollLeft - walk;
      });
    });
  }

  /**
   * Configura la Cita del Día con rotación automática a las 00:00 hs de cada nuevo día
   * Se muestra tanto en la landing como en la parte superior del panel del alumno
   */
  let midnightQuoteTimeout = null;

  function setupDailyQuote() {
    if (typeof getQuoteOfTheDay !== 'function') return;
    const quote = getQuoteOfTheDay();
    if (!quote) return;

    // Cita en Landing
    const textEl = document.getElementById('daily-quote-text');
    const authorEl = document.getElementById('daily-quote-author');
    if (textEl) textEl.textContent = quote.text;
    if (authorEl) authorEl.textContent = quote.author.startsWith('—') ? quote.author : `— ${quote.author}`;

    // Cita en Panel de Alumno (Arriba de todo)
    const platformTextEl = document.getElementById('platform-quote-phrase-text');
    const platformAuthorEl = document.getElementById('platform-quote-phrase-author');
    if (platformTextEl) platformTextEl.textContent = quote.text;
    if (platformAuthorEl) platformAuthorEl.textContent = quote.author.startsWith('—') ? quote.author : `— ${quote.author}`;

    // Programar actualización automática exactamente a las 00:00:00 hs
    scheduleMidnightQuoteUpdate();
  }

  function scheduleMidnightQuoteUpdate() {
    if (midnightQuoteTimeout) clearTimeout(midnightQuoteTimeout);

    const now = new Date();
    // Próxima medianoche 00:00:00 exacta local
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 50);
    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());

    midnightQuoteTimeout = setTimeout(() => {
      setupDailyQuote();
    }, msUntilMidnight);
  }

  // Actualizar automáticamente si el usuario regresa a la pestaña al día siguiente
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      setupDailyQuote();
    }
  });

  window.addEventListener('focus', () => {
    setupDailyQuote();
  });

  // ========================================================================
  // NAVEGACIÓN Y VISTAS
  // ========================================================================
  function switchView(viewName) {
    state.currentView = viewName;

    if (viewName === 'admin') {
      if (views.landing) views.landing.style.display = 'none';
      if (views.platform) views.platform.style.display = 'none';
      if (views.admin) views.admin.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.location.hash !== '#auditoria' && window.location.hash !== '#admin') {
        try { history.replaceState(null, '', '#auditoria'); } catch (e) {}
      }
      renderAdminDashboard();
    } else if (viewName === 'platform') {
      const user = AuthService.getCurrentUser();
      if (!user) {
        openModal(modals.login);
        return;
      }
      if (views.landing) views.landing.style.display = 'none';
      if (views.admin) views.admin.style.display = 'none';
      if (views.platform) views.platform.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.location.hash !== '#refugio') {
        try { history.replaceState(null, '', '#refugio'); } catch (e) {}
      }
      renderPlatformDashboard();
    } else {
      if (views.platform) views.platform.style.display = 'none';
      if (views.admin) views.admin.style.display = 'none';
      if (views.landing) views.landing.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.location.hash === '#auditoria' || window.location.hash === '#admin' || window.location.hash === '#refugio') {
        try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
      }
    }

    updateMobileNavState();
  }

  function setupNavigation() {
    // Botón de Acceso Alumnos en Header y enlaces de login
    document.querySelectorAll('.btn-access-login').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(modals.login);
      });
    });

    // Botones de Comenzar Ahora (scroll a planes)
    document.querySelectorAll('.btn-scroll-plans').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.currentView === 'platform') {
          switchView('landing');
        }
        const plansSection = document.getElementById('planes');
        if (plansSection) {
          const headerEl = document.querySelector('.site-header');
          const headerHeight = headerEl ? headerEl.offsetHeight : 64;
          const targetPos = plansSection.getBoundingClientRect().top + window.pageYOffset - (headerHeight + 10);
          window.scrollTo({ top: Math.max(0, targetPos), behavior: 'smooth' });
          updateActiveLinks('#planes');
        }
      });
    });

    // Botón Salir a Landing desde la plataforma
    const btnBackToHome = document.getElementById('btn-exit-to-landing');
    if (btnBackToHome) {
      btnBackToHome.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('landing');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        updateActiveLinks('#hero');
      });
    }

    // Botón Logo: ir al inicio y scroll suave arriba
    document.querySelectorAll('.brand-logo, #header-brand-logo').forEach(logo => {
      logo.addEventListener('click', (e) => {
        const href = logo.getAttribute('href');
        if (href === '#hero' || href === '#' || !href) {
          e.preventDefault();
          if (state.currentView === 'platform') {
            switchView('landing');
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
          updateActiveLinks('#hero');
        }
      });
    });

    // Enlaces de navegación de escritorio (.nav-links .nav-link)
    document.querySelectorAll('.site-header .nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          if (state.currentView === 'platform') {
            switchView('landing');
          }

          if (href === '#hero' || href === '#inicio') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            updateActiveLinks('#hero');
            return;
          }

          const target = document.querySelector(href);
          if (target) {
            const headerEl = document.querySelector('.site-header');
            const headerHeight = headerEl ? headerEl.offsetHeight : 64;
            const targetPos = target.getBoundingClientRect().top + window.pageYOffset - (headerHeight + 10);
            window.scrollTo({ top: Math.max(0, targetPos), behavior: 'smooth' });
            updateActiveLinks(href);
          }
        }
      });
    });

    setupMobileDrawer();
  }

  function setupMobileDrawer() {
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('mobile-drawer-overlay');
    const closeBtn = document.getElementById('mobile-drawer-close');

    if (!toggleBtn || !drawer || !overlay) return;

    function openDrawer() {
      drawer.classList.add('active');
      overlay.classList.add('active');
      document.body.classList.add('menu-open');
      document.body.style.overflow = 'hidden';
      toggleBtn.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
    }

    function closeDrawer() {
      drawer.classList.remove('active');
      overlay.classList.remove('active');
      document.body.classList.remove('menu-open');
      document.body.style.overflow = '';
      toggleBtn.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
    }

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (drawer.classList.contains('active')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDrawer();
      });
    }

    overlay.addEventListener('click', closeDrawer);

    // Al hacer clic en un enlace del menú móvil, cerrar y hacer scroll suave preciso
    drawer.querySelectorAll('.mobile-drawer-link, .mobile-drawer-cta, .mobile-drawer-brand').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');

        // Si es el botón de acceso login
        if (link.classList.contains('btn-access-login')) {
          e.preventDefault();
          closeDrawer();
          setTimeout(() => {
            openModal(modals.login);
          }, 120);
          return;
        }

        closeDrawer();

        if (href && href.startsWith('#')) {
          e.preventDefault();
          if (state.currentView === 'platform') {
            switchView('landing');
          }

          // Caso especial: Inicio / Top
          if (href === '#hero' || href === '#inicio') {
            setTimeout(() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 80);
            updateActiveLinks('#hero');
            return;
          }

          const targetSection = document.querySelector(href);
          if (targetSection) {
            setTimeout(() => {
              const headerEl = document.querySelector('.site-header');
              const headerHeight = headerEl ? headerEl.offsetHeight : 64;
              const targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset - (headerHeight + 10);
              window.scrollTo({
                top: Math.max(0, targetPosition),
                behavior: 'smooth'
              });
            }, 80);
            updateActiveLinks(href);
          }
        }
      });
    });
  }

  function updateActiveLinks(activeHref) {
    if (!activeHref) return;
    document.querySelectorAll('.mobile-drawer-link, .nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === activeHref) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  function setupScrollSpy() {
    const sections = ['#hero', '#filosofia', '#beneficios', '#como-funciona', '#planes', '#testimonios', '#faq'];
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (ticking || state.currentView !== 'landing') return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const scrollPos = window.pageYOffset + 140;
        let currentSection = '#hero';

        for (let i = sections.length - 1; i >= 0; i--) {
          const el = document.querySelector(sections[i]);
          if (el && el.offsetTop <= scrollPos) {
            currentSection = sections[i];
            break;
          }
        }

        updateActiveLinks(currentSection);
        ticking = false;
      });
    }, { passive: true });
  }

  // ========================================================================
  // MODALES (Apertura y Cierre)
  // ========================================================================
  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('active');
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('active');
    const anyActive = document.querySelector('.modal-backdrop.active, .profile-drawer-backdrop.active, .player-modal-backdrop.active, .admin-modal-backdrop.active, .admin-drawer-backdrop.active');
    if (!anyActive) {
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
  }

  function setupModals() {
    // Cerrar modales con clic en backdrop o botón .modal-close-btn
    document.querySelectorAll('.modal-backdrop, .profile-drawer-backdrop, .player-modal-backdrop, .admin-modal-backdrop, .admin-drawer-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          closeModal(backdrop);
          if (backdrop === modals.player) {
            pauseActiveVideo();
          }
        }
      });
    });

    document.querySelectorAll('.modal-close-btn, .player-close-floating, .drawer-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-backdrop, .profile-drawer-backdrop, .player-modal-backdrop, .admin-modal-backdrop, .admin-drawer-backdrop');
        if (modal) {
          closeModal(modal);
          if (modal === modals.player) {
            pauseActiveVideo();
          }
        }
      });
    });

    // Tabs del modal legal y navegación contextual
    const legalTabBtns = document.querySelectorAll('.legal-tab-btn');
    const legalTabPanes = document.querySelectorAll('.legal-tab-pane');

    function switchLegalTab(targetTab) {
      legalTabBtns.forEach(b => {
        const isCurrent = b.getAttribute('data-tab') === targetTab;
        b.classList.toggle('active', isCurrent);
        b.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
      });
      legalTabPanes.forEach(pane => {
        pane.classList.toggle('active', pane.getAttribute('id') === `tab-pane-${targetTab}`);
      });
    }

    legalTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        if (targetTab) switchLegalTab(targetTab);
      });
    });

    // Abrir modal legal desde el footer
    const legalLinkMap = {
      'link-open-terms': 'terms',
      'link-open-privacy': 'privacy',
      'link-open-refunds': 'cancellation'
    };

    Object.entries(legalLinkMap).forEach(([id, tabName]) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          switchLegalTab(tabName);
          openModal(modals.legal);
        });
      }
    });

    // Cerrar con Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        Object.values(modals).forEach(m => {
          if (m && m.classList.contains('active')) {
            closeModal(m);
            if (m === modals.player) pauseActiveVideo();
          }
        });
      }
    });
  }

  // ========================================================================
  // AUTENTICACIÓN & LOGIN POR CÓDIGO
  // ========================================================================
  function setupLoginForm() {
    const form = document.getElementById('login-form');
    const input = document.getElementById('access-code-input');
    const passwordInput = document.getElementById('login-password-input');
    const togglePwdVisBtn = document.getElementById('btn-toggle-login-pwd-vis');
    const toggleForgotBtn = document.getElementById('btn-toggle-forgot-password');
    const forgotPanel = document.getElementById('forgot-password-panel');
    const forgotCloseBtn = document.getElementById('btn-close-forgot-panel');
    const forgotEmailInput = document.getElementById('forgot-email-input');
    const sendWhatsappBtn = document.getElementById('btn-send-whatsapp-recovery');
    const feedback = document.getElementById('login-feedback');
    const demoBtn = document.getElementById('btn-use-demo-code');
    const adminBtn = document.getElementById('btn-use-admin-code');

    // Número oficial de WhatsApp de Valeria para soporte y recuperación
    const VALERIA_WHATSAPP_PHONE = '5491138859944';

    if (input) {
      input.addEventListener('input', () => {
        feedback.style.display = 'none';
      });
    }
    if (passwordInput) {
      passwordInput.addEventListener('input', () => {
        feedback.style.display = 'none';
      });
    }

    // Alternar visibilidad de contraseña
    if (togglePwdVisBtn && passwordInput) {
      togglePwdVisBtn.addEventListener('click', () => {
        const isPassword = passwordInput.getAttribute('type') === 'password';
        passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
        togglePwdVisBtn.innerHTML = isPassword ? `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        ` : `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        `;
      });
    }

    // Abrir/cerrar panel de "¿Olvidaste tu contraseña?"
    if (toggleForgotBtn && forgotPanel) {
      toggleForgotBtn.addEventListener('click', () => {
        const isShown = forgotPanel.style.display === 'block';
        forgotPanel.style.display = isShown ? 'none' : 'block';
        if (!isShown && forgotEmailInput) {
          if (!forgotEmailInput.value && input && input.value) {
            forgotEmailInput.value = input.value.trim();
          }
          forgotEmailInput.focus();
        }
      });
    }

    if (forgotCloseBtn && forgotPanel) {
      forgotCloseBtn.addEventListener('click', () => {
        forgotPanel.style.display = 'none';
      });
    }

    // Botón para enviar por WhatsApp directo a Valeria
    if (sendWhatsappBtn) {
      sendWhatsappBtn.addEventListener('click', () => {
        const email = (forgotEmailInput?.value || input?.value || '').trim();
        if (!email) {
          showToast('Por favor, ingresa tu correo para enviárselo a Valeria por WhatsApp.', 'warning');
          if (forgotEmailInput) forgotEmailInput.focus();
          return;
        }

        const msgText = `Hola Valeria, olvidé mi contraseña para acceder a la plataforma Namasté. Mi correo registrado es: ${email}. ¿Podrías ayudarme a restablecerla? ¡Muchas gracias!`;
        const waUrl = `https://wa.me/${VALERIA_WHATSAPP_PHONE}?text=${encodeURIComponent(msgText)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
        showToast('Abriendo WhatsApp directo de Valeria...', 'info', 4000);
      });
    }

    if (demoBtn && input) {
      demoBtn.addEventListener('click', () => {
        input.value = 'sofia.varela@ejemplo.com';
        if (passwordInput) passwordInput.value = 'namaste123';
        feedback.style.display = 'none';
        if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
      });
    }

    if (adminBtn && input) {
      adminBtn.addEventListener('click', () => {
        input.value = 'valeria.manassero@namaste.com';
        if (passwordInput) passwordInput.value = 'valeria2026';
        feedback.style.display = 'none';
        if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = (input.value || '').trim();
        const password = (passwordInput ? passwordInput.value : '').trim();
        if (!identifier) return;

        const submitBtn = document.getElementById('btn-submit-code-login');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Verificando...';
        }

        try {
          const result = await AuthService.login(identifier, password);

          if (result.success) {
            const user = result.user;
            const isAdmin = user.role === 'admin' || user.isAdmin;

            feedback.className = 'modal-feedback success';
            if (isAdmin) {
              feedback.textContent = `¡Bienvenida, Valeria! Abriendo el Panel de Administración...`;
            } else {
              feedback.textContent = `¡Bienvenida de regreso, ${user.name}! Abriendo tu Refugio...`;
            }
            feedback.style.display = 'block';

            setTimeout(() => {
              closeModal(modals.login);
              input.value = '';
              if (passwordInput) passwordInput.value = '';
              feedback.style.display = 'none';
              if (isAdmin) {
                switchView('admin');
              } else {
                switchView('platform');
              }
            }, 600);
          } else {
            feedback.className = 'modal-feedback error';
            feedback.textContent = result.message;
            feedback.style.display = 'block';
          }
        } catch (err) {
          feedback.className = 'modal-feedback error';
          feedback.textContent = 'Error al verificar credenciales. Intenta nuevamente.';
          feedback.style.display = 'block';
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Iniciar Sesión';
          }
        }
      });
    }
  }

  function setupAuthListeners() {
    window.addEventListener('namaste:auth-changed', (e) => {
      const user = e.detail;
      updateNavForLoggedInUser(user);
      if (user && state.currentView === 'platform') {
        renderPlatformDashboard();
      }
    });
  }

  function updateNavForLoggedInUser(user) {
    const loginNavBtn = document.querySelector('#nav-btn-login');
    if (loginNavBtn) {
      if (user) {
        const isAdmin = user.role === 'admin' || user.isAdmin;
        const firstName = escapeHtml((user.name || '').split(' ')[0] || (isAdmin ? 'Valeria' : 'Alumno'));
        if (isAdmin) {
          loginNavBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
            Panel Admin (${firstName})
          `;
          loginNavBtn.classList.add('btn-olive');
        } else {
          loginNavBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Mi Refugio (${firstName})
          `;
          loginNavBtn.classList.add('btn-olive');
        }
      } else {
        loginNavBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Acceso
        `;
        loginNavBtn.classList.remove('btn-olive');
      }
    }
  }

  // ========================================================================
  // CHECKOUT & GENERACIÓN DE CÓDIGOS
  // ========================================================================
  function setupCheckoutForm() {
    // Botones de "Elegir Plan" en la tabla de precios
    document.querySelectorAll('.btn-select-plan').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const planId = btn.getAttribute('data-plan-id');
        const plan = PLANS_DATA.find(p => p.id === planId) || PLANS_DATA[1];
        openCheckoutForPlan(plan);
      });
    });

    // Toggle para visualizar/ocultar la contraseña en el checkout
    const togglePwdBtn = document.getElementById('btn-toggle-checkout-pwd');
    const pwdInput = document.getElementById('checkout-password');
    if (togglePwdBtn && pwdInput) {
      togglePwdBtn.addEventListener('click', () => {
        const isPassword = pwdInput.type === 'password';
        pwdInput.type = isPassword ? 'text' : 'password';
        const iconShow = document.getElementById('pwd-icon-show');
        const iconHide = document.getElementById('pwd-icon-hide');
        if (iconShow && iconHide) {
          iconShow.style.display = isPassword ? 'none' : 'block';
          iconHide.style.display = isPassword ? 'block' : 'none';
        }
      });
    }

    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = checkoutForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <svg class="spin-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          </svg>
          <span>Conectando con Mercado Pago...</span>
        `;

        const name = (document.getElementById('checkout-name')?.value || '').trim();
        const email = (document.getElementById('checkout-email')?.value || '').trim();
        const password = (document.getElementById('checkout-password')?.value || '').trim();
        const planId = state.selectedPlanForCheckout ? state.selectedPlanForCheckout.id : 'plan-refugio';
        const isAnnual = state.selectedPlanForCheckout ? state.selectedPlanForCheckout.isAnnual : false;
        const amount = state.selectedPlanForCheckout ? state.selectedPlanForCheckout.billedAmount : 29000;

        const result = await MembershipService.processCheckout({
          name,
          email,
          password,
          planId,
          isAnnual,
          amount,
          paymentMethod: 'MercadoPago'
        });

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;

        if (result && result.success) {
          closeModal(modals.checkout);

          showToast(`Suscripción registrada para ${name}. Tu cuenta se activará automáticamente al abonar en Mercado Pago.`, 'info', 6000);

          // URL o deep-link para abonar en Mercado Pago
          const planData = PLANS_DATA.find(p => p.id === planId);
          const isAnnualPlan = state.selectedPlanForCheckout ? state.selectedPlanForCheckout.isAnnual : false;
          const mpUrl = (isAnnualPlan && planData && planData.mercadopagoUrlAnnual)
            ? planData.mercadopagoUrlAnnual
            : ((planData && planData.mercadopagoUrl) || (state.selectedPlanForCheckout && state.selectedPlanForCheckout.mercadopagoUrl) || 'https://www.mercadopago.com.ar');

          // Mostrar tarjeta flotante de simulación para desarrollo/pruebas locales
          renderPendingPaymentSimulator();

          setTimeout(() => {
            window.location.href = mpUrl;
          }, 850);
        } else {
          showToast((result && result.message) || 'Hubo un error al procesar tu suscripción.', 'error');
        }
      });
    }

    // Botón de acceso inmediato desde la pantalla de éxito
    const btnEnterPlatformDirect = document.getElementById('btn-enter-platform-direct');
    if (btnEnterPlatformDirect) {
      btnEnterPlatformDirect.addEventListener('click', () => {
        closeModal(modals.checkout);
        switchView('platform');
        showToast('¡Bienvenido/a a tu Refugio!', 'success');
      });
    }
  }

  /**
   * Verifica los parámetros de retorno de Mercado Pago al volver al sitio
   * Activa automáticamente la cuenta solo si el pago se completó con éxito.
   */
  async function checkMercadoPagoPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const payment = urlParams.get('payment') || urlParams.get('status') || urlParams.get('collection_status') || urlParams.get('payment_status');

    let pendingData = null;
    try {
      const raw = localStorage.getItem('namaste_pending_payment');
      if (raw) pendingData = JSON.parse(raw);
    } catch (e) {}

    if (!payment && !urlParams.has('collection_status') && !urlParams.has('payment_status')) {
      if (pendingData) renderPendingPaymentSimulator();
      return;
    }

    const email = urlParams.get('email') || urlParams.get('external_reference') || (pendingData ? pendingData.email : null);

    const isApproved = (
      payment === 'success' ||
      payment === 'approved' ||
      urlParams.get('collection_status') === 'approved' ||
      urlParams.get('status') === 'approved' ||
      urlParams.get('payment_status') === 'approved'
    );

    const isCancelled = (
      payment === 'cancelled' ||
      payment === 'failure' ||
      payment === 'rejected' ||
      payment === 'null' ||
      urlParams.get('collection_status') === 'null' ||
      urlParams.get('status') === 'cancelled' ||
      urlParams.get('status') === 'rejected'
    );

    if (isApproved && email) {
      // 1. ACTIVACIÓN AUTOMÁTICA: SOLO SI EL PAGO SE EJECUTA CORRECTAMENTE
      const result = await MembershipService.confirmPayment(email, 'approved', {
        paymentId: urlParams.get('payment_id') || urlParams.get('collection_id')
      });

      try {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      } catch (e) {}

      removePendingPaymentSimulator();

      if (result && result.active) {
        showToast('¡Pago confirmado en Mercado Pago! Tu cuenta ha sido activada automáticamente. ¡Bienvenida a tu Refugio!', 'success', 7000);
        switchView('platform');
      }
    } else if (isCancelled) {
      // 2. PAGO CANCELADO / RECHAZADO: NO SE DEBE ACTIVAR LA CUENTA
      if (email) {
        await MembershipService.confirmPayment(email, 'cancelled');
      }
      AuthService.logout();

      try {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      } catch (e) {}

      removePendingPaymentSimulator();

      showToast('El pago fue cancelado o no se completó en Mercado Pago. Tu cuenta NO ha sido activada.', 'error', 7000);
      switchView('landing');
    }
  }

  /**
   * Widget interactivo para facilitar pruebas de desarrollo y validación de cobro en Mercado Pago
   */
  function renderPendingPaymentSimulator() {
    let pending = null;
    try {
      const raw = localStorage.getItem('namaste_pending_payment');
      if (raw) pending = JSON.parse(raw);
    } catch (e) {}

    const existing = document.getElementById('mp-simulation-widget');
    if (!pending) {
      if (existing) existing.remove();
      return;
    }

    if (existing) return;

    const widget = document.createElement('div');
    widget.id = 'mp-simulation-widget';
    widget.className = 'mp-simulation-widget';
    widget.innerHTML = `
      <div class="mp-simulation-header">
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#009EE3" stroke-width="2.2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
          <strong style="font-size:0.84rem; color:var(--text-primary);">Mercado Pago • Verificación</strong>
        </div>
        <button type="button" class="mp-simulation-close" aria-label="Cerrar">&times;</button>
      </div>
      <p style="font-size:0.8rem; margin:0 0 0.65rem 0; color:var(--text-secondary); line-height: 1.35;">
        Suscripción para <strong>${pending.name || 'Alumna'}</strong> (${pending.email}) está <strong>inactiva</strong> hasta confirmar el cobro.
      </p>
      <div style="display:flex; gap:0.45rem;">
        <button type="button" class="btn btn-primary" id="btn-mp-sim-approve" style="padding:0.42rem 0.65rem; font-size:0.77rem; flex:1; background-color:#2E7D32; border-color:#2E7D32;">
          ✓ Abonar (Activar)
        </button>
        <button type="button" class="btn btn-secondary" id="btn-mp-sim-cancel" style="padding:0.42rem 0.65rem; font-size:0.77rem; flex:1; color:#C62828; border-color:rgba(198,40,40,0.35);">
          ✕ Cancelar Pago
        </button>
      </div>
    `;

    document.body.appendChild(widget);

    widget.querySelector('.mp-simulation-close')?.addEventListener('click', () => {
      widget.remove();
    });

    widget.querySelector('#btn-mp-sim-approve')?.addEventListener('click', async () => {
      const res = await MembershipService.confirmPayment(pending.email, 'approved');
      widget.remove();
      if (res && res.active) {
        showToast('¡Pago verificado con éxito! Cuenta activada automáticamente.', 'success', 6000);
        switchView('platform');
      }
    });

    widget.querySelector('#btn-mp-sim-cancel')?.addEventListener('click', async () => {
      await MembershipService.confirmPayment(pending.email, 'cancelled');
      widget.remove();
      AuthService.logout();
      showToast('Pago cancelado en Mercado Pago. La cuenta NO fue activada.', 'error', 6000);
      switchView('landing');
    });
  }

  function removePendingPaymentSimulator() {
    const existing = document.getElementById('mp-simulation-widget');
    if (existing) existing.remove();
  }

  /**
   * Controla el switcher superior de Facturación: Mensual / Anual (con 2 meses de regalo)
   */
  function setupBillingSwitcher() {
    const monthlyBtn = document.getElementById('btn-billing-monthly');
    const annualBtn = document.getElementById('btn-billing-annual');
    if (!monthlyBtn || !annualBtn) return;

    state.selectedBillingCycle = 'monthly';

    const setCycle = (cycle) => {
      state.selectedBillingCycle = cycle;

      if (cycle === 'annual') {
        monthlyBtn.classList.remove('active');
        monthlyBtn.setAttribute('aria-checked', 'false');
        annualBtn.classList.add('active');
        annualBtn.setAttribute('aria-checked', 'true');
      } else {
        annualBtn.classList.remove('active');
        annualBtn.setAttribute('aria-checked', 'false');
        monthlyBtn.classList.add('active');
        monthlyBtn.setAttribute('aria-checked', 'true');
      }

      // Animación suave de transición en montos y subtítulos
      document.querySelectorAll('.pricing-card').forEach(card => {
        const amountEl = card.querySelector('.pricing-amount');
        const subnoteEl = card.querySelector('.pricing-subnote');

        if (amountEl) {
          amountEl.style.opacity = '0';
          amountEl.style.transform = 'translateY(-3px)';
          setTimeout(() => {
            amountEl.textContent = cycle === 'annual'
              ? amountEl.getAttribute('data-price-annual')
              : amountEl.getAttribute('data-price-monthly');
            amountEl.style.opacity = '1';
            amountEl.style.transform = 'translateY(0)';
          }, 140);
        }

        if (subnoteEl) {
          subnoteEl.style.opacity = '0';
          setTimeout(() => {
            const noteText = cycle === 'annual'
              ? (subnoteEl.getAttribute('data-note-annual') || '')
              : (subnoteEl.getAttribute('data-note-monthly') || '');
            subnoteEl.textContent = noteText;
            if (!noteText || noteText.trim() === '') {
              subnoteEl.style.display = 'none';
            } else {
              subnoteEl.style.display = 'inline-block';
              subnoteEl.style.opacity = '1';
            }
          }, 140);
        }
      });
    };

    monthlyBtn.addEventListener('click', () => setCycle('monthly'));
    annualBtn.addEventListener('click', () => setCycle('annual'));
  }

  function openCheckoutForPlan(plan) {
    const isAnnual = state.selectedBillingCycle === 'annual';
    const planToCheckout = {
      ...plan,
      isAnnual,
      billedAmount: isAnnual ? (plan.priceAnnualTotal || (plan.priceMonthly * 10)) : plan.priceMonthly,
      displayPeriod: isAnnual ? 'año' : 'mes'
    };

    state.selectedPlanForCheckout = planToCheckout;
    document.getElementById('checkout-plan-name').textContent = `${plan.name} (${isAnnual ? 'Anual' : 'Mensual'})`;
    document.getElementById('checkout-plan-price').textContent = isAnnual
      ? `${plan.currencySymbol || '$'} ${Number(plan.priceAnnualTotal).toLocaleString('es-AR')} ARS/año`
      : `${plan.currencySymbol || '$'} ${Number(plan.priceMonthly).toLocaleString('es-AR')} ARS/${plan.pricePeriod || 'mes'}`;
    
    const subnoteEl = document.getElementById('checkout-plan-subnote');
    if (subnoteEl) {
      subnoteEl.textContent = isAnnual ? 'Facturación anual (2 meses bonificados)' : 'Renovación mensual flexible';
    }
    
    // Restaurar vista de formulario
    document.getElementById('checkout-form-container').style.display = 'block';
    document.getElementById('checkout-success-container').style.display = 'none';

    openModal(modals.checkout);
  }

  function showCheckoutSuccessScreen(member, plan) {
    state.lastCreatedUser = member;
    document.getElementById('checkout-form-container').style.display = 'none';
    document.getElementById('checkout-success-container').style.display = 'block';

    const userNameEl = document.getElementById('success-user-name');
    const planNameEl = document.getElementById('success-plan-name');
    const userEmailEl = document.getElementById('success-user-email');

    if (userNameEl) userNameEl.textContent = member.name;
    if (planNameEl) planNameEl.textContent = plan.name;
    if (userEmailEl) userEmailEl.textContent = member.email;
  }

  // ========================================================================
  // CATALOGO PUBLICO DE CLASES (LANDING)
  // ========================================================================
  function setupLandingCatalog() {
    const tabsContainer = document.getElementById('landing-classes-tabs');
    const catalogGrid = document.getElementById('landing-classes-grid');

    if (!tabsContainer || !catalogGrid) return;

    renderLandingClasses('all');

    tabsContainer.querySelectorAll('.class-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tabsContainer.querySelectorAll('.class-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const category = btn.getAttribute('data-category');
        renderLandingClasses(category);
      });
    });
  }

  function renderLandingClasses(category) {
    const grid = document.getElementById('landing-classes-grid');
    if (!grid) return;

    const allClasses = getActiveClasses();
    const filtered = category === 'all'
      ? allClasses.slice(0, 6)
      : allClasses.filter(c => c.category === category);

    grid.innerHTML = filtered.map(c => `
      <article class="class-card">
        <div class="class-card-thumbnail">
          <img src="${c.thumbnail}" alt="${c.title}" loading="lazy" />
          ${c.isNew ? '<span class="badge-tag badge-new">Nueva</span>' : ''}
          <span class="class-duration-badge">${c.duration} min</span>
        </div>
        <div class="class-card-body">
          <div class="class-meta-top">
            <span>${c.categoryLabel}</span>
            <span>• ${c.level}</span>
          </div>
          <h3 class="class-card-title">${c.title}</h3>
          <div class="class-card-footer" style="justify-content: flex-end;">
            <button class="btn-text btn-access-login" style="cursor:pointer; font-size: 0.85rem;">
              Ver práctica →
            </button>
          </div>
        </div>
      </article>
    `).join('');

    // Re-bind botones de la tarjeta
    grid.querySelectorAll('.btn-access-login').forEach(b => {
      b.addEventListener('click', (e) => {
        e.preventDefault();
        const user = AuthService.getCurrentUser();
        if (user) {
          switchView('platform');
        } else {
          openModal(modals.login);
        }
      });
    });
  }

  // ========================================================================
  // FAQ ACORDEÓN
  // ========================================================================
  function setupFAQAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const trigger = item.querySelector('.faq-trigger');
      if (trigger) {
        trigger.addEventListener('click', () => {
          const isOpen = item.classList.contains('open');
          // Cerrar otros para efecto acordeón limpio
          faqItems.forEach(other => other.classList.remove('open'));
          if (!isOpen) {
            item.classList.add('open');
          }
        });
      }
    });
  }

  // ========================================================================
  // PLATAFORMA PRIVADA (DASHBOARD & VIDEOTECA)
  // ========================================================================
  // PLATAFORMA PRIVADA (DASHBOARD & REFUGIO DE PRÁCTICA)
  // ========================================================================
  function renderPlatformDashboard() {
    const user = AuthService.getCurrentUser();
    if (!user) return;

    // Saludo y Nombres dinámicos
    const firstName = user.name ? user.name.split(' ')[0] : 'Alumno';
    const initials = getUserInitials(user.name);

    const userNameEl = document.getElementById('platform-user-greeting');
    if (userNameEl) userNameEl.textContent = firstName;

    const profileNameHeader = document.getElementById('header-profile-name');
    if (profileNameHeader) profileNameHeader.textContent = firstName;

    const headerAvatar = document.getElementById('header-user-avatar');
    if (headerAvatar) headerAvatar.textContent = initials;

    const drawerAvatar = document.getElementById('drawer-user-avatar');
    if (drawerAvatar) drawerAvatar.textContent = initials;

    // Inspiración Diaria consistente
    const phraseTextEl = document.getElementById('platform-quote-phrase-text');
    const phraseAuthorEl = document.getElementById('platform-quote-phrase-author');
    if (phraseTextEl && phraseAuthorEl) {
      const todayQuote = typeof getQuoteOfTheDay === 'function' ? getQuoteOfTheDay() : (typeof DAILY_QUOTES_DATA !== 'undefined' ? DAILY_QUOTES_DATA[0] : null);
      if (todayQuote) {
        phraseTextEl.textContent = todayQuote.text;
        phraseAuthorEl.textContent = todayQuote.author.startsWith('—') ? todayQuote.author : `— ${todayQuote.author}`;
      }
    }

    // Métricas Reales del Alumno sincronizadas con la Base de Datos
    const progress = (typeof ProgressService !== 'undefined') ? ProgressService.getProgressState() : { streakDays: 1, totalMinutes: 0, completed: [] };
    const streakEl = document.getElementById('stat-streak-days');
    if (streakEl) streakEl.textContent = progress.streakDays || 1;

    const minutesEl = document.getElementById('stat-minutes-practiced');
    if (minutesEl) minutesEl.textContent = progress.totalMinutes || 0;

    const completedEl = document.getElementById('stat-classes-completed');
    if (completedEl) completedEl.textContent = progress.completed ? progress.completed.length : 0;

    const streakBadgeEl = document.getElementById('header-streak-count');
    if (streakBadgeEl) streakBadgeEl.textContent = `${progress.streakDays || 1} días`;

    // Banner de Membresía Pausada
    const pausedBanner = document.getElementById('platform-paused-banner');
    if (pausedBanner) {
      pausedBanner.style.display = user.active === false ? 'block' : 'none';
    }

    // Estado del Encuentro en Vivo
    const liveCardLabel = document.getElementById('btn-live-card-label');
    const liveBtn = document.getElementById('btn-open-live-modal');
    const isAttending = localStorage.getItem('namaste_attending_live_' + (user.email || 'guest')) === 'true';
    if (liveCardLabel) {
      liveCardLabel.innerHTML = isAttending ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Agendado' : 'Agendar';
    }
    if (liveBtn) {
      if (isAttending) {
        liveBtn.classList.remove('btn-olive');
        liveBtn.classList.add('btn-secondary');
      } else {
        liveBtn.classList.remove('btn-secondary');
        liveBtn.classList.add('btn-olive');
      }
    }

    // Reanudación de última clase practicada
    renderResumeCard();

    // Filtros y catálogo de clases
    renderPlatformClasses();
  }

  function renderResumeCard() {
    const resumeContainer = document.getElementById('platform-resume-container');
    if (!resumeContainer) return;

    const lastPlayed = ProgressService.getLastPlayed();
    if (!lastPlayed) {
      resumeContainer.style.display = 'none';
      return;
    }

    const durationSeconds = (lastPlayed.duration || 30) * 60;
    const progressSeconds = lastPlayed.progressSeconds || 0;
    const progressPct = Math.min(100, Math.max(0, Math.round((progressSeconds / durationSeconds) * 100)));
    const remainingMinutes = Math.max(1, Math.round((durationSeconds - progressSeconds) / 60));

    resumeContainer.style.display = 'block';
    resumeContainer.innerHTML = `
      <div class="resume-card">
        <div class="resume-left">
          <img src="${escapeHtml(lastPlayed.thumbnail)}" alt="${escapeHtml(lastPlayed.title)}" class="resume-thumb" />
          <div style="flex: 1; min-width: 0;">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--terracotta); font-weight:600; letter-spacing:0.06em;">
              Continuar práctica
            </div>
            <div class="resume-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(lastPlayed.title)}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">
              Restan ${remainingMinutes} min (${progressPct}% completado)
            </div>
            <div class="resume-progress-bar">
              <div class="resume-progress-fill" style="width: ${progressPct}%;"></div>
            </div>
          </div>
        </div>
        <div class="resume-right">
          <button class="btn btn-primary btn-play-resume" data-class-id="${escapeHtml(lastPlayed.id)}" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>Reanudar sesión</span>
          </button>
        </div>
      </div>
    `;

    const resumeBtn = resumeContainer.querySelector('.btn-play-resume');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        openClassPlayer(lastPlayed, lastPlayed.progressSeconds || 0);
      });
    }
  }

  function updateFilterActiveIndicator() {
    const badge = document.getElementById('filter-active-badge');
    const triggerBtn = document.getElementById('btn-filter-trigger');
    let activeCount = 0;
    if (state.activeCategoryFilter && state.activeCategoryFilter !== 'all') activeCount++;
    if (state.onlyFavorites) activeCount++;

    if (badge) {
      if (activeCount > 0) {
        badge.textContent = activeCount;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
    if (triggerBtn) {
      if (activeCount > 0) {
        triggerBtn.classList.add('has-active-filters');
      } else {
        triggerBtn.classList.remove('has-active-filters');
      }
    }
  }

  function resetAllFilters() {
    state.activeCategoryFilter = 'all';
    state.onlyFavorites = false;

    const chipsContainer = document.getElementById('platform-filter-chips');
    if (chipsContainer) {
      chipsContainer.querySelectorAll('.filter-chip').forEach(c => {
        if (c.getAttribute('data-category') === 'all') c.classList.add('active');
        else c.classList.remove('active');
      });
    }

    const favToggle = document.getElementById('filter-toggle-favorites');
    if (favToggle) favToggle.checked = false;

    updateFilterActiveIndicator();
    renderPlatformClasses();
  }

  function updateFilterOptionsVisibility() {
    const progress = (typeof ProgressService !== 'undefined') ? ProgressService.getProgressState() : { favorites: [], completed: [] };
    const favCount = (progress.favorites || []).length;
    const completedCount = (progress.completed || []).length;

    // 1. Ocultar o mostrar chips de categorías según existencia real de prácticas
    const chips = document.querySelectorAll('#platform-filter-chips .filter-chip');
    chips.forEach(chip => {
      const cat = chip.getAttribute('data-category');
      if (cat === 'all') {
        chip.style.display = '';
        return;
      }

      if (cat === 'completed') {
        if (completedCount === 0) {
          chip.style.display = 'none';
          if (state.activeCategoryFilter === 'completed') {
            resetAllFilters();
          }
        } else {
          chip.style.display = '';
        }
        return;
      }

      let count = 0;
      const allClasses = getActiveClasses();
      if (cat === 'meditacion') {
        count = allClasses.filter(c => c.category === 'meditacion' || c.category === 'relax').length;
      } else {
        count = allClasses.filter(c => c.category === cat).length;
      }

      if (count === 0) {
        chip.style.display = 'none';
        if (state.activeCategoryFilter === cat) {
          resetAllFilters();
        }
      } else {
        chip.style.display = '';
      }
    });

    // 2. Ocultar bloque de Favoritas si el usuario no tiene ninguna favorita guardada
    const favSection = document.getElementById('filter-section-favorites');
    const favToggle = document.getElementById('filter-toggle-favorites');
    if (favSection) {
      if (favCount === 0) {
        favSection.style.display = 'none';
        if (state.onlyFavorites) {
          state.onlyFavorites = false;
          if (favToggle) favToggle.checked = false;
          renderPlatformClasses();
        }
      } else {
        favSection.style.display = '';
      }
    }

    updateFilterActiveIndicator();
  }

  function setupPlatformFilters() {
    // Buscador interactivo
    const searchInput = document.getElementById('platform-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        renderPlatformClasses();
      });
    }

    // Toggle Solo Favoritas
    const favToggle = document.getElementById('filter-toggle-favorites');
    if (favToggle) {
      favToggle.addEventListener('change', (e) => {
        state.onlyFavorites = e.target.checked;
        updateFilterActiveIndicator();
        renderPlatformClasses();
      });
    }

    // Chips de categorías rápidas
    const chipsContainer = document.getElementById('platform-filter-chips');
    if (chipsContainer) {
      chipsContainer.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          chipsContainer.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          state.activeCategoryFilter = chip.getAttribute('data-category') || 'all';
          updateFilterActiveIndicator();
          renderPlatformClasses();
        });
      });
    }

    // Control del botón desplegable y popover de filtros
    const filterWrapper = document.getElementById('filter-dropdown-wrapper');
    const filterTrigger = document.getElementById('btn-filter-trigger');
    const resetFiltersBtn = document.getElementById('btn-reset-filters');

    if (filterTrigger && filterWrapper) {
      filterTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = filterWrapper.classList.toggle('open');
        filterTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (isOpen) updateFilterOptionsVisibility();
      });

      document.addEventListener('click', (e) => {
        if (!filterWrapper.contains(e.target)) {
          filterWrapper.classList.remove('open');
          filterTrigger.setAttribute('aria-expanded', 'false');
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && filterWrapper.classList.contains('open')) {
          filterWrapper.classList.remove('open');
          filterTrigger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetAllFilters();
        showToast('Filtros restablecidos');
      });
    }

    // Sincronizar dinámicamente si cambian las clases completadas o favoritas
    window.addEventListener('namaste:progress-changed', () => {
      updateFilterOptionsVisibility();
    });

    // Evaluar visibilidad inicial
    updateFilterOptionsVisibility();
  }

  function renderPlatformClasses() {
    const yogaCarousel = document.getElementById('carousel-yoga');
    const medCarousel = document.getElementById('carousel-meditation');
    const yogaCountEl = document.getElementById('yoga-classes-count');
    const medCountEl = document.getElementById('meditation-classes-count');
    const emptyState = document.getElementById('platform-empty-state');
    const yogaGroup = document.getElementById('group-yoga');
    const medGroup = document.getElementById('group-meditation');

    if (!yogaCarousel || !medCarousel) return;

    let filtered = getActiveClasses().filter(c => {
      // 1. Filtro por Chip de Categoría
      if (state.activeCategoryFilter && state.activeCategoryFilter !== 'all') {
        if (state.activeCategoryFilter === 'completed') {
          if (!ProgressService.isCompleted(c.id)) return false;
        } else if (state.activeCategoryFilter === 'meditacion') {
          if (c.category !== 'meditacion' && c.category !== 'relax') return false;
        } else {
          if (c.category !== state.activeCategoryFilter) return false;
        }
      }

      // 2. Filtro Solo Favoritas
      if (state.onlyFavorites && !ProgressService.isFavorite(c.id)) {
        return false;
      }

      // 3. Búsqueda de texto en títulos, instructores, descripciones e intenciones
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        const matchTitle = (c.title || '').toLowerCase().includes(query);
        const matchInstructor = (c.instructor || '').toLowerCase().includes(query);
        const matchDesc = (c.description || '').toLowerCase().includes(query);
        const matchCat = (c.categoryLabel || '').toLowerCase().includes(query);
        const matchIntentions = (c.intentions || []).some(i => i.toLowerCase().includes(query));
        if (!matchTitle && !matchInstructor && !matchDesc && !matchCat && !matchIntentions) return false;
      }

      return true;
    });

    const isMeditation = (c) => c.category === 'meditacion' || c.category === 'relax';
    const yogaClasses = filtered.filter(c => !isMeditation(c));
    const medClasses = filtered.filter(c => isMeditation(c));

    if (yogaCountEl) {
      yogaCountEl.textContent = `${yogaClasses.length} ${yogaClasses.length === 1 ? 'práctica' : 'prácticas'}`;
    }
    if (medCountEl) {
      medCountEl.textContent = `${medClasses.length} ${medClasses.length === 1 ? 'práctica' : 'prácticas'}`;
    }

    if (filtered.length === 0) {
      if (yogaGroup) yogaGroup.style.display = 'none';
      if (medGroup) medGroup.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (yogaGroup) yogaGroup.style.display = yogaClasses.length > 0 ? 'block' : 'none';
    if (medGroup) medGroup.style.display = medClasses.length > 0 ? 'block' : 'none';

    function createCardHTML(c) {
      const isFav = ProgressService.isFavorite(c.id);
      const isDone = ProgressService.isCompleted(c.id);
      const isAudio = c.format === 'audio' || (!c.format && (c.category === 'meditacion' || c.category === 'relax'));

      const planHierarchy = { 'plan-esencia': 1, 'plan-refugio': 2, 'plan-santuario': 2, 'plan-sadhana': 3 };
      const user = typeof AuthService !== 'undefined' ? AuthService.getCurrentUser() : null;
      const userLevel = user ? (planHierarchy[user.planId] || 1) : 1;
      const requiredPlan = c.planRequired || (
        c.category === 'dinamico' || c.category === 'ashtanga' ? 'plan-sadhana' :
        (c.category === 'suave' ? 'plan-esencia' : 'plan-refugio')
      );
      const isLocked = Boolean(user && userLevel < (planHierarchy[requiredPlan] || 1));

      return `
        <article class="class-card class-card-platform" data-class-id="${c.id}">
          <div class="class-card-thumbnail">
            <img src="${c.thumbnail}" alt="${c.title}" loading="lazy" />
            ${c.isNew ? '<span class="badge-tag badge-new">Nueva</span>' : ''}
            <div class="card-top-right-group">
              ${isAudio ? '<span class="badge-tag badge-audio"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>Audio</span>' : ''}
              <button class="favorite-btn ${isFav ? 'active' : ''}" data-favorite-id="${c.id}" title="${isFav ? 'Quitar de favoritas' : 'Guardar en favoritas'}" aria-label="Favorito">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </button>
            </div>
            ${isLocked ? `<span class="badge-tag" style="background: rgba(30, 25, 22, 0.88); color: #E8B982; left: 0.5rem; top: auto; bottom: 0.5rem; font-size: 0.65rem; padding: 2px 7px; border-radius: 999px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>${requiredPlan === 'plan-sadhana' ? 'Sadhana' : 'Refugio'}</span>` : ''}
            <span class="class-duration-badge">${c.duration} min</span>

            <div class="play-overlay-btn">
              <div class="play-circle-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </div>
            </div>
          </div>

          <div class="class-card-body">
            <div class="class-meta-top">
              <span>${c.categoryLabel}</span>
              <span>• ${c.level}</span>
            </div>
            <h3 class="class-card-title">${c.title}</h3>
            
            ${isDone ? `
              <div class="class-card-footer" style="justify-content: flex-end;">
                <span class="completed-check-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Completada
                </span>
              </div>
            ` : ''}
          </div>
        </article>
      `;
    }

    yogaCarousel.innerHTML = yogaClasses.map(createCardHTML).join('');
    medCarousel.innerHTML = medClasses.map(createCardHTML).join('');

    // Eventos de apertura de reproductor y de favoritos en ambos carruseles
    [yogaCarousel, medCarousel].forEach(carousel => {
      carousel.querySelectorAll('.class-card-platform').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.favorite-btn')) return;
          const classId = card.getAttribute('data-class-id');
          const classObj = getActiveClasses().find(c => c.id === classId);
          if (classObj) openClassPlayer(classObj);
        });
      });

      carousel.querySelectorAll('.favorite-btn').forEach(favBtn => {
        favBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const classId = favBtn.getAttribute('data-favorite-id');
          const isNowFav = ProgressService.toggleFavorite(classId);
          favBtn.classList.toggle('active', isNowFav);
          const svg = favBtn.querySelector('svg');
          if (svg) {
            svg.setAttribute('fill', isNowFav ? 'currentColor' : 'none');
          }
          showToast(isNowFav ? 'Práctica guardada en tus favoritas' : 'Práctica eliminada de tus favoritas');
          if (state.onlyFavorites) {
            renderPlatformClasses();
          }
        });
      });
    });
  }

  // ========================================================================
  // REPRODUCTOR INMERSIVO DE VIDEO
  // ========================================================================
  function openClassPlayer(classObj, seekSeconds = 0) {
    const user = AuthService.getCurrentUser();

    // 1. Bloqueo si la membresía está pausada (NAM-008, NAM-011)
    if (user && user.active === false) {
      showToast('Tu membresía se encuentra en pausa. Reactívala desde tu perfil o el aviso superior para disfrutar de esta práctica.', 'warning');
      return;
    }

    // 2. Control de acceso según membresía (Plan Esencia, Plan Refugio, Plan Sadhana)
    if (user) {
      const planHierarchy = { 'plan-esencia': 1, 'plan-refugio': 2, 'plan-santuario': 2, 'plan-sadhana': 3 };
      const userLevel = planHierarchy[user.planId] || 1;
      const requiredPlan = classObj.planRequired || (
        classObj.category === 'dinamico' || classObj.category === 'ashtanga' ? 'plan-sadhana' :
        (classObj.category === 'suave' ? 'plan-esencia' : 'plan-refugio')
      );
      const requiredLevel = planHierarchy[requiredPlan] || 1;

      if (userLevel < requiredLevel) {
        const planName = requiredPlan === 'plan-sadhana' ? 'Plan Sadhana' : 'Plan Refugio';
        showToast(`La práctica "${classObj.title}" requiere ${planName}. Puedes mejorar tu membresía desde tu perfil.`, 'warning');
        return;
      }
    }

    state.activePlayingClass = classObj;
    state.lastSaveTime = seekSeconds;
    ProgressService.recordPlayProgress(classObj.id, seekSeconds);

    const videoEl = document.getElementById('player-video-element');
    if (videoEl) {
      videoEl.poster = classObj.thumbnail;
      videoEl.playbackRate = state.videoPlaybackRate || 1.0;

      // Cargar stream protegido desde API o stream directo verificado
      ClassesService.getClassStreamUrl(classObj.id).then(streamUrl => {
        if (!streamUrl) return;
        videoEl.src = streamUrl;

        const onMetadataLoaded = () => {
          let seek = seekSeconds;
          if (classObj.videoTrim && classObj.videoTrim.start > 0 && seek < classObj.videoTrim.start) {
            seek = classObj.videoTrim.start;
          }
          if (seek > 0 && seek < videoEl.duration) {
            videoEl.currentTime = seek;
          }
          videoEl.play().catch(e => {
            console.log('Video autoplay prevented, listo para reproducir manual.', e);
          });
          updatePlayerTimeDisplay();
        };

        videoEl.addEventListener('loadedmetadata', onMetadataLoaded, { once: true });

        // Aplicar ajustes visuales y recorte del editor
        if (classObj.videoFilters) {
          const b = classObj.videoFilters.brightness || 100;
          const c = classObj.videoFilters.contrast || 100;
          const warm = classObj.videoFilters.preset === 'calido' ? ' sepia(18%) saturate(110%)' : '';
          videoEl.style.filter = `brightness(${b}%) contrast(${c}%)${warm}`;
        } else {
          videoEl.style.filter = '';
        }

        if (classObj.videoTrim && classObj.videoTrim.end > classObj.videoTrim.start) {
          videoEl.ontimeupdate = () => {
            if (videoEl.currentTime >= classObj.videoTrim.end) {
              videoEl.currentTime = classObj.videoTrim.start;
            }
            updatePlayerTimeDisplay();
          };
        } else {
          videoEl.ontimeupdate = null;
        }
      }).catch(err => {
        showToast(err.message || 'Membresía inactiva o nivel insuficiente para esta práctica.', 'warning');
      });
    }

    // Datos de la clase
    const titleEl = document.getElementById('player-class-title');
    if (titleEl) titleEl.textContent = classObj.title;
    const catEl = document.getElementById('player-class-category');
    if (catEl) {
      const isAudio = classObj.format === 'audio' || (!classObj.format && (classObj.category === 'meditacion' || classObj.category === 'relax'));
      catEl.innerHTML = isAudio ? `${escapeHtml(classObj.categoryLabel)} • <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>Audio Práctica` : escapeHtml(classObj.categoryLabel);
    }
    const durEl = document.getElementById('player-class-duration');
    if (durEl) durEl.textContent = `${classObj.duration} min`;
    const lvlEl = document.getElementById('player-class-level');
    if (lvlEl) lvlEl.textContent = classObj.level;
    const instEl = document.getElementById('player-class-instructor');
    if (instEl) instEl.textContent = classObj.instructor || '';
    const instRoleEl = document.getElementById('player-class-instructor-role');
    if (instRoleEl) instRoleEl.textContent = classObj.instructorRole || '';
    const descEl = document.getElementById('player-class-description');
    if (descEl) descEl.textContent = classObj.description;

    // Resetear botón de velocidad a 1.0x
    const speedBtn = document.getElementById('btn-player-speed');
    if (speedBtn) speedBtn.textContent = `${state.videoPlaybackRate || 1.0}x`;

    // Props / Accesorios
    const propsListEl = document.getElementById('player-class-props');
    if (propsListEl) {
      propsListEl.innerHTML = classObj.props.map(prop => `
        <li class="player-prop-chip"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><polyline points="20 6 9 17 4 12"></polyline></svg>${escapeHtml(prop)}</li>
      `).join('');
    }

    // Intenciones
    const intentionsEl = document.getElementById('player-class-intentions');
    if (intentionsEl) {
      intentionsEl.innerHTML = classObj.intentions.map(int => `
        <span class="badge-tag">${escapeHtml(int)}</span>
      `).join('');
    }

    // Estado de botón Completada
    const isDone = ProgressService.isCompleted(classObj.id);
    updateMarkCompletedButton(isDone);

    openModal(modals.player);
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function updatePlayerTimeDisplay() {
    const videoEl = document.getElementById('player-video-element');
    const indicator = document.getElementById('player-progress-indicator');
    if (!videoEl || !indicator) return;
    const cur = formatTime(videoEl.currentTime || 0);
    const dur = formatTime(videoEl.duration || (state.activePlayingClass ? state.activePlayingClass.duration * 60 : 0));
    indicator.textContent = `${cur} / ${dur}`;
  }

  function pauseActiveVideo() {
    const videoEl = document.getElementById('player-video-element');
    if (videoEl) {
      videoEl.pause();
    }
  }

  function setupPlayerControls() {
    const videoEl = document.getElementById('player-video-element');

    // Botón Marcar como completada
    const markCompleteBtn = document.getElementById('btn-mark-class-complete');
    if (markCompleteBtn) {
      markCompleteBtn.addEventListener('click', () => {
        if (!state.activePlayingClass) return;
        ProgressService.markCompleted(state.activePlayingClass.id, state.activePlayingClass.duration);
        updateMarkCompletedButton(true);
        renderPlatformDashboard();
        showToast('¡Felicitaciones! Has completado tu práctica consciente.', 'success');
      });
    }

    if (videoEl) {
      // Seguimiento en tiempo real del progreso del video por sesión
      videoEl.addEventListener('timeupdate', () => {
        updatePlayerTimeDisplay();
        const now = Math.floor(videoEl.currentTime);
        if (state.activePlayingClass) {
          const lastSave = state.lastSaveTime || 0;
          if (now - lastSave >= 3 || lastSave > now) {
            state.lastSaveTime = now;
            ProgressService.recordPlayProgress(state.activePlayingClass.id, now);
          }
        }
      });

      // Al finalizar el video, marcar automáticamente completada
      videoEl.addEventListener('ended', () => {
        if (state.activePlayingClass) {
          ProgressService.markCompleted(state.activePlayingClass.id, state.activePlayingClass.duration);
          updateMarkCompletedButton(true);
          renderPlatformDashboard();
          showToast('¡Práctica finalizada con éxito! Namasté.', 'success');
        }
      });
    }

    // Controles de salto y velocidad en el reproductor
    const skipBackBtn = document.getElementById('btn-player-skip-back');
    if (skipBackBtn && videoEl) {
      skipBackBtn.addEventListener('click', () => {
        videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
      });
    }

    const skipFwdBtn = document.getElementById('btn-player-skip-fwd');
    if (skipFwdBtn && videoEl) {
      skipFwdBtn.addEventListener('click', () => {
        videoEl.currentTime = Math.min(videoEl.duration || 9999, videoEl.currentTime + 10);
      });
    }

    const speedBtn = document.getElementById('btn-player-speed');
    const speeds = [1.0, 1.25, 0.85];
    if (speedBtn && videoEl) {
      speedBtn.addEventListener('click', () => {
        let currentIdx = speeds.indexOf(state.videoPlaybackRate || 1.0);
        currentIdx = (currentIdx + 1) % speeds.length;
        const newSpeed = speeds[currentIdx];
        state.videoPlaybackRate = newSpeed;
        videoEl.playbackRate = newSpeed;
        speedBtn.textContent = `${newSpeed}x`;
        showToast(`Velocidad de reproducción: ${newSpeed}x`);
      });
    }
  }

  function updateMarkCompletedButton(isDone) {
    const markCompleteBtn = document.getElementById('btn-mark-class-complete');
    if (!markCompleteBtn) return;
    if (isDone) {
      markCompleteBtn.className = 'btn btn-olive btn-complete-practice is-completed';
      markCompleteBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Completada</span>
      `;
      markCompleteBtn.title = 'Práctica completada';
    } else {
      markCompleteBtn.className = 'btn btn-primary btn-complete-practice';
      markCompleteBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 14 14"></polyline>
        </svg>
        <span>Marcar completada</span>
      `;
      markCompleteBtn.title = 'Marcar práctica como completada';
    }
  }

  // ========================================================================
  // AUDITORÍA Y MEJORAS 100% FUNCIONALES DEL PANEL DE ALUMNO
  // ========================================================================
  function setupPlatformFeatures() {
    // 1. Botón Logo para regresar al portal principal
    const btnExit = document.getElementById('btn-exit-to-landing');
    if (btnExit) {
      btnExit.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('landing');
        showToast('Has regresado a la portada principal.');
      });
    }

    // 2. Enlaces del Header de la plataforma
    const navSanctuary = document.getElementById('platform-nav-refugio') || document.getElementById('platform-nav-sanctuary');
    if (navSanctuary) {
      navSanctuary.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const navLibrary = document.getElementById('platform-nav-library');
    if (navLibrary) {
      navLibrary.addEventListener('click', () => {
        const anchor = document.getElementById('library-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
      });
    }


    // 4. Modal de Progreso del Alumno (Racha, Minutos, Clases)
    const openProgressModal = () => {
      const user = AuthService.getCurrentUser();
      if (!user) return;

      const progress = ProgressService.getProgressState();
      const completedClasses = getActiveClasses().filter(c => progress.completed.includes(c.id));

      const streakEl = document.getElementById('modal-metric-streak');
      const minEl = document.getElementById('modal-metric-minutes');
      const countEl = document.getElementById('modal-metric-classes');
      const badgeCountEl = document.getElementById('modal-completed-count-badge');
      const listContainer = document.getElementById('modal-completed-classes-list');

      const streak = progress.streakDays || 1;
      if (streakEl) streakEl.textContent = streak;
      if (minEl) minEl.textContent = progress.totalMinutes || 0;
      if (countEl) countEl.textContent = progress.completed ? progress.completed.length : 0;
      if (badgeCountEl) badgeCountEl.textContent = `${completedClasses.length} ${completedClasses.length === 1 ? 'clase' : 'clases'}`;

      // Mensaje consciente de racha
      const streakBannerText = document.getElementById('modal-streak-banner-text');
      if (streakBannerText) {
        if (streak >= 7) {
          streakBannerText.textContent = `¡Gran disciplina! Llevas ${streak} días consecutivos cultivando presencia.`;
        } else if (streak > 1) {
          streakBannerText.textContent = `¡Excelente camino! Sumas ${streak} días seguidos de práctica en el Shala.`;
        } else {
          streakBannerText.textContent = `Cada instante en el mat siembra serenidad y autoconocimiento.`;
        }
      }

      if (listContainer) {
        if (completedClasses.length === 0) {
          listContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.85rem; background: var(--sand-50); border-radius: var(--radius-md); border: 1px dashed var(--border-medium);">
              <div style="margin-bottom: 0.5rem; display: flex; justify-content: center; color: var(--color-terracotta, #b86240);">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="5" r="2"></circle>
                  <path d="M12 9v4"></path>
                  <path d="m8 13 4 3 4-3"></path>
                  <path d="m5 17 4-1 3 4 3-4 4 1"></path>
                </svg>
              </div>
              <strong style="display: block; color: var(--text-primary); margin-bottom: 0.25rem;">Aún no tienes prácticas registradas</strong>
              <span>Elige cualquier sesión del catálogo para iniciar tu camino hoy mismo.</span>
            </div>
          `;
        } else {
          listContainer.innerHTML = completedClasses.map(c => `
            <div class="completed-class-card">
              <div class="completed-class-card-main">
                <div class="completed-class-check-circle" title="Sesión completada">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div class="completed-class-info">
                  <h5 class="completed-class-name">${c.title}</h5>
                  <div class="completed-class-submeta">
                    <span class="completed-class-chip">${c.categoryLabel}</span>
                    <span>•</span>
                    <span>${c.duration} min</span>
                    <span>•</span>
                    <span>${c.level}</span>
                  </div>
                </div>
              </div>
              <button type="button" class="btn-repeat-practice" data-class-id="${c.id}" title="Volver a practicar esta clase">
                <span>Repetir</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
              </button>
            </div>
          `).join('');

          listContainer.querySelectorAll('.btn-repeat-practice').forEach(btn => {
            btn.addEventListener('click', () => {
              const classId = btn.getAttribute('data-class-id');
              const classObj = getActiveClasses().find(c => c.id === classId);
              if (classObj) {
                closeModal(modals.progressDetails);
                openClassPlayer(classObj, 0);
              }
            });
          });
        }
      }

      openModal(modals.progressDetails);
    };

    ['platform-header-streak', 'stat-card-streak', 'stat-card-minutes', 'stat-card-classes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', openProgressModal);
    });

    // 5. Modal de Encuentro en Vivo (Satsang & Zoom)
    const openLiveModal = (e) => {
      if (e) e.preventDefault();
      const user = AuthService.getCurrentUser();
      const attendBtn = document.getElementById('btn-live-attend-toggle');
      const attendText = document.getElementById('btn-live-attend-text');
      const isAttending = localStorage.getItem('namaste_attending_live_' + (user ? user.email : 'guest')) === 'true';

      const satsang = getNextSatsangEvent();
      const liveDateEl = document.getElementById('live-event-date-text');
      if (liveDateEl) {
        liveDateEl.innerHTML = `<strong>Fecha:</strong> ${satsang.dateText}`;
      }
      const gCalBtn = document.getElementById('btn-add-google-calendar');
      if (gCalBtn) {
        gCalBtn.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Satsang+%26+Meditaci%C3%B3n+-+Namast%C3%A9&dates=${satsang.gCalDates}&details=Encuentro+mensual+exclusivo+para+alumnos+de+Namast%C3%A9+por+Zoom.+Acceso+directo+desde+el+Refugio.&location=Zoom+Online`;
      }

      if (attendText) {
        attendText.innerHTML = isAttending ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Asistencia Confirmada (Click para cancelar)' : 'Confirmar mi Asistencia';
      }
      if (attendBtn) {
        if (isAttending) {
          attendBtn.classList.remove('btn-primary');
          attendBtn.classList.add('btn-secondary');
        } else {
          attendBtn.classList.remove('btn-secondary');
          attendBtn.classList.add('btn-primary');
        }
      }

      openModal(modals.liveSession);
    };

    const btnLiveCard = document.getElementById('btn-open-live-modal');
    if (btnLiveCard) btnLiveCard.addEventListener('click', openLiveModal);

    const shortcutLive = document.getElementById('shortcut-live-link');
    if (shortcutLive) {
      shortcutLive.addEventListener('click', (e) => {
        closeModal(modals.profileDrawer);
        openLiveModal(e);
      });
    }

    const btnAttendToggle = document.getElementById('btn-live-attend-toggle');
    if (btnAttendToggle) {
      btnAttendToggle.addEventListener('click', () => {
        const user = AuthService.getCurrentUser();
        const key = 'namaste_attending_live_' + (user ? user.email : 'guest');
        const currentlyAttending = localStorage.getItem(key) === 'true';
        const newAttendingState = !currentlyAttending;

        localStorage.setItem(key, newAttendingState.toString());

        const attendText = document.getElementById('btn-live-attend-text');
        if (attendText) {
          attendText.innerHTML = newAttendingState ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Asistencia Confirmada (Click para cancelar)' : 'Confirmar mi Asistencia';
        }

        if (newAttendingState) {
          btnAttendToggle.classList.remove('btn-primary');
          btnAttendToggle.classList.add('btn-secondary');
          showToast('¡Asistencia confirmada para el Satsang de Luna Llena!', 'success');
        } else {
          btnAttendToggle.classList.remove('btn-secondary');
          btnAttendToggle.classList.add('btn-primary');
          showToast('Has cancelado tu confirmación de asistencia.');
        }

        renderPlatformDashboard();
      });
    }

    // Copiar link de Zoom del encuentro
    const btnCopyZoom = document.getElementById('btn-copy-zoom-link');
    if (btnCopyZoom) {
      btnCopyZoom.addEventListener('click', () => {
        const satsang = getNextSatsangEvent();
        const zoomText = `Encuentro Namasté (${satsang.dateText}): https://zoom.us/j/demo-namaste-shala (Acceso exclusivo a alumnos verificados)`;
        navigator.clipboard.writeText(zoomText).then(() => {
          btnCopyZoom.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>¡Copiado!</span>
          `;
          showToast('Enlace del encuentro copiado al portapapeles', 'success');
          setTimeout(() => {
            btnCopyZoom.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copiar Enlace Zoom</span>
            `;
          }, 2000);
        });
      });
    }

    // 6. Modal de Cambio de Plan en el Refugio (Diseño Compacto & Estilizado)
    const openChangePlanModal = () => {
      const user = AuthService.getCurrentUser();
      if (!user) return;

      const container = document.getElementById('plan-change-options');
      if (container) {
        // Síntesis concisa para máxima elegancia y dimensiones compactas
        const planHighlights = {
          'plan-esencia': 'Yoga Suave, Clásico y Meditación (+40 clases)',
          'plan-refugio': 'Catálogo total (+140 clases) • Vinyasa, Hatha y Satsang en vivo',
          'plan-santuario': 'Catálogo total (+140 clases) • Vinyasa, Hatha y Satsang en vivo',
          'plan-sadhana': 'Práctica avanzada, masterclasses y mentoría personal'
        };

        container.innerHTML = PLANS_DATA.map(plan => {
          const isCurrent = (user.planId === plan.id) || (user.planName && user.planName.toLowerCase().includes(plan.name.toLowerCase()));
          const summary = planHighlights[plan.id] || plan.description;

          return `
            <div class="plan-change-item ${isCurrent ? 'current' : ''}">
              <div class="plan-change-info">
                <div class="plan-change-topline">
                  <h4 class="plan-change-name">${escapeHtml(plan.name)}</h4>
                  ${isCurrent
                    ? '<span class="plan-change-badge-active">● Tu Plan Actual</span>'
                    : (plan.recommended ? '<span class="plan-change-badge-rec">Recomendado</span>' : '')}
                </div>
                <p class="plan-change-summary">${escapeHtml(summary)}</p>
              </div>

              <div class="plan-change-action">
                <div class="plan-change-pricing">
                  <span class="plan-change-amount">$ ${Number(plan.priceMonthly).toLocaleString('es-AR')}</span>
                  <span class="plan-change-cadence">/mes</span>
                </div>
                ${isCurrent ? `
                  <button type="button" class="btn-plan-active-chip" disabled title="Membresía actual">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>Activo</span>
                  </button>
                ` : `
                  <button type="button" class="btn-plan-select-compact btn-select-new-plan" data-plan-id="${plan.id}" data-plan-name="${escapeHtml(plan.name)}" title="Cambiar a ${escapeHtml(plan.name)}">
                    Elegir plan
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('');

        container.querySelectorAll('.btn-select-new-plan').forEach(btn => {
          btn.addEventListener('click', () => {
            const newPlanId = btn.getAttribute('data-plan-id');
            const newPlanName = btn.getAttribute('data-plan-name');
            const planObj = PLANS_DATA.find(p => p.id === newPlanId);
            const currentUser = AuthService.getCurrentUser();
            const newAmount = currentUser && currentUser.isAnnual ? (planObj.priceAnnualTotal || planObj.priceMonthly * 10) : (planObj ? planObj.priceMonthly : 29000);
            AuthService.updateUserProfile({
              planId: newPlanId,
              planName: newPlanName,
              billedAmount: newAmount
            });
            closeModal(modals.changePlan);
            populateProfileDrawer();
            renderPlatformDashboard();
            showToast(`¡Tu membresía ha sido actualizada a ${newPlanName}!`, 'success');
          });
        });
      }

      openModal(modals.changePlan);
    };

    const btnDrawerChangePlan = document.getElementById('btn-drawer-change-plan');
    if (btnDrawerChangePlan) {
      btnDrawerChangePlan.addEventListener('click', () => {
        closeModal(modals.profileDrawer);
        openChangePlanModal();
      });
    }

    // 7. Banner de Reactivación de Membresía
    const btnBannerResume = document.getElementById('btn-banner-resume-membership');
    if (btnBannerResume) {
      btnBannerResume.addEventListener('click', () => {
        MembershipService.toggleMembershipPause();
        populateProfileDrawer();
        renderPlatformDashboard();
        showToast('¡Membresía reactivada con éxito! Bienvenido de nuevo a tu práctica.', 'success');
      });
    }

    // 8. Modal de Comprobante / Recibo de Membresía
    const btnReceipt = document.getElementById('btn-drawer-download-receipt');
    if (btnReceipt) {
      btnReceipt.addEventListener('click', () => {
        const user = AuthService.getCurrentUser();
        if (!user) return;

        let amount = user.billedAmount;
        let methodText = user.paymentMethod === 'mercadopago' ? 'MercadoPago' : 'Tarjeta Débito/Crédito';
        if (!amount) {
          try {
            const txs = JSON.parse(localStorage.getItem('namaste_transactions') || '[]');
            const userTx = [...txs].reverse().find(t => (t.userEmail && t.userEmail.toLowerCase() === (user.email || '').toLowerCase()) || t.accessCode === user.accessCode);
            if (userTx) {
              amount = userTx.amount;
              if (userTx.paymentMethod) {
                methodText = userTx.paymentMethod === 'mercadopago' ? 'MercadoPago' : 'Tarjeta Débito/Crédito';
              }
            }
          } catch (e) {}
        }
        if (!amount) {
          amount = user.planId === 'plan-esencia' ? 19000 : (user.planId === 'plan-sadhana' ? 39000 : 29000);
        }
        const formattedAmount = `$ ${Number(amount).toLocaleString('es-AR')} ARS`;

        const contentArea = document.getElementById('receipt-content-area');
        if (contentArea) {
          contentArea.innerHTML = `
            <div style="background-color: var(--sand-50); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem; font-size: 0.88rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; border-bottom:1px solid var(--border-subtle); padding-bottom:0.75rem;">
                <div>
                  <strong style="font-family:var(--font-serif); font-size:1.15rem; color:var(--text-primary);">Namasté Escuela de Yoga</strong>
                  <div style="font-size:0.78rem; color:var(--text-muted);">Refugio Consciente Online</div>
                </div>
                <span class="status-badge-active">● Pagado</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; margin-bottom:1rem;">
                <div><span style="color:var(--text-muted); font-size:0.78rem;">Alumno:</span><br><strong>${escapeHtml(user.name)}</strong></div>
                <div><span style="color:var(--text-muted); font-size:0.78rem;">Código:</span><br><code>${escapeHtml(user.accessCode)}</code></div>
                <div><span style="color:var(--text-muted); font-size:0.78rem;">Plan:</span><br><strong>${escapeHtml(user.planName || 'Plan Refugio')}</strong></div>
                <div><span style="color:var(--text-muted); font-size:0.78rem;">Renovación:</span><br><strong>${escapeHtml(user.nextBillingDate || 'Próximo mes')}</strong></div>
              </div>
              <div style="border-top:1px dashed var(--border-medium); padding-top:0.75rem; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.82rem; color:var(--text-muted);">Método: ${escapeHtml(methodText)}</span>
                <strong style="font-size:1.1rem; color:var(--terracotta);">${escapeHtml(formattedAmount)}</strong>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem; margin-top:1.25rem;">
              <button type="button" class="btn btn-secondary" id="btn-print-receipt" style="flex:1; justify-content:center; font-size:0.84rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                <span>Imprimir / Guardar PDF</span>
              </button>
            </div>
          `;
          const printBtn = document.getElementById('btn-print-receipt');
          if (printBtn) {
            printBtn.addEventListener('click', () => window.print());
          }
        }

        closeModal(modals.profileDrawer);
        openModal(modals.receipt);
      });
    }

    // 9. Flechas de navegación para carruseles horizontales
    document.querySelectorAll('.carousel-arrow').forEach(arrowBtn => {
      arrowBtn.addEventListener('click', () => {
        const targetId = arrowBtn.getAttribute('data-target');
        const carousel = document.getElementById(targetId);
        if (!carousel) return;
        const isNext = arrowBtn.classList.contains('next');
        const scrollAmount = 315;
        carousel.scrollBy({ left: isNext ? scrollAmount : -scrollAmount, behavior: 'smooth' });
      });
    });
  }

  // ========================================================================
  // PERFIL DEL ALUMNO & ESTADO DE MEMBRESÍA
  // ========================================================================
  function setupProfileDrawer() {
    // Abrir drawer desde botón de perfil en desktop
    const profileTrigger = document.getElementById('btn-open-user-profile');
    if (profileTrigger) {
      profileTrigger.addEventListener('click', () => {
        populateProfileDrawer();
        openModal(modals.profileDrawer);
      });
    }

    // Abrir drawer desde botón hamburguesa de la plataforma en móvil
    const platformMenuToggle = document.getElementById('platform-menu-toggle');
    if (platformMenuToggle) {
      platformMenuToggle.addEventListener('click', () => {
        populateProfileDrawer();
        openModal(modals.profileDrawer);
      });
    }

    // Cerrar sesión
    const btnLogout = document.getElementById('btn-profile-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        AuthService.logout();
        closeModal(modals.profileDrawer);
        switchView('landing');
        showToast('Sesión cerrada correctamente. ¡Hasta tu próxima práctica!');
      });
    }

    // Toggle para comprimir / expandir los detalles de la membresía
    const membershipToggle = document.getElementById('drawer-membership-toggle');
    const membershipCard = document.getElementById('drawer-membership-card');
    if (membershipToggle && membershipCard) {
      const handleToggle = () => {
        const isExpanded = membershipCard.classList.toggle('expanded');
        membershipToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      };
      membershipToggle.addEventListener('click', handleToggle);
      membershipToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      });
    }

    // Copiar código de acceso del alumno
    const btnCopyDrawerCode = document.getElementById('btn-copy-drawer-code');
    if (btnCopyDrawerCode) {
      btnCopyDrawerCode.addEventListener('click', () => {
        const user = AuthService.getCurrentUser();
        const code = (user && user.accessCode) || 'NAMASTE-ALUMNO';
        navigator.clipboard.writeText(code).then(() => {
          btnCopyDrawerCode.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>¡Copiado!</span>
          `;
          showToast('Código de alumno copiado al portapapeles', 'success');
          setTimeout(() => {
            btnCopyDrawerCode.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copiar código</span>
            `;
          }, 2000);
        });
      });
    }

    // Pausar / Reactivar membresía
    const btnTogglePause = document.getElementById('btn-toggle-pause-membership');
    if (btnTogglePause) {
      btnTogglePause.addEventListener('click', () => {
        const user = AuthService.getCurrentUser();
        if (user && user.active) {
          const confirmed = confirm('¿Deseas pausar temporalmente tu membresía? El acceso a las clases quedará suspendido hasta que decidas reactivarla.');
          if (!confirmed) return;
        }
        const isNowActive = MembershipService.toggleMembershipPause();
        populateProfileDrawer();
        renderPlatformDashboard();
        showToast(isNowActive ? '¡Membresía reactivada con éxito!' : 'Membresía pausada preventivamente.');
      });
    }

    // Botón volver a la página principal desde drawer
    const btnBackLanding = document.getElementById('btn-drawer-back-landing');
    if (btnBackLanding) {
      btnBackLanding.addEventListener('click', () => {
        closeModal(modals.profileDrawer);
        switchView('landing');
      });
    }

    // Accesos directos a carruseles desde el drawer
    const shortcutYoga = document.getElementById('shortcut-yoga-link');
    if (shortcutYoga) {
      shortcutYoga.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal(modals.profileDrawer);
        const el = document.getElementById('group-yoga');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const shortcutMed = document.getElementById('shortcut-meditation-link');
    if (shortcutMed) {
      shortcutMed.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal(modals.profileDrawer);
        const el = document.getElementById('group-meditation');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Limpiar filtros cuando no hay resultados (Empty state button)
    const btnClearFilters = document.getElementById('btn-clear-platform-filters');
    if (btnClearFilters) {
      btnClearFilters.addEventListener('click', () => {
        state.searchQuery = '';
        const searchInput = document.getElementById('platform-search-input');
        if (searchInput) searchInput.value = '';
        resetAllFilters();
        showToast('Filtros restablecidos');
      });
    }
  }

  function populateProfileDrawer() {
    const user = AuthService.getCurrentUser();
    if (!user) return;

    const nameEl = document.getElementById('drawer-user-name');
    if (nameEl) nameEl.textContent = user.name;

    const drawerAvatar = document.getElementById('drawer-user-avatar');
    if (drawerAvatar) drawerAvatar.textContent = getUserInitials(user.name);

    const emailEl = document.getElementById('drawer-user-email');
    if (emailEl) emailEl.textContent = user.email;

    const codeEl = document.getElementById('drawer-access-code');
    if (codeEl) codeEl.textContent = user.accessCode || user.email;

    const planNameEl = document.getElementById('drawer-plan-name');
    if (planNameEl) planNameEl.textContent = user.planName || 'Plan Refugio';

    const nextBillingEl = document.getElementById('drawer-next-billing');
    if (nextBillingEl) nextBillingEl.textContent = user.nextBillingDate || '28 Octubre 2026';

    const billingAmountEl = document.getElementById('drawer-billing-amount');
    if (billingAmountEl) {
      if (user.billedAmount) {
        const periodStr = user.isAnnual || user.billingCycle === 'annual' ? '/año' : '/mes';
        billingAmountEl.textContent = `($ ${Number(user.billedAmount).toLocaleString('es-AR')} ARS${periodStr})`;
      } else {
        billingAmountEl.textContent = '($ 29.000 ARS/mes)';
      }
    }

    const statusBadge = document.getElementById('drawer-membership-status');
    const pauseBtn = document.getElementById('btn-toggle-pause-membership');

    if (user.active) {
      if (statusBadge) {
        statusBadge.className = 'status-badge-active';
        statusBadge.style.backgroundColor = '';
        statusBadge.style.color = '';
        statusBadge.textContent = '● Activa';
      }
      if (pauseBtn) {
        pauseBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
          <span>Pausar Membresía</span>
        `;
      }
    } else {
      if (statusBadge) {
        statusBadge.className = 'status-badge-active';
        statusBadge.style.backgroundColor = '#F5ECE8';
        statusBadge.style.color = '#B93826';
        statusBadge.textContent = '● En Pausa';
      }
      if (pauseBtn) {
        pauseBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span>Reactivar Plan</span>
        `;
      }
    }

    // Iniciar con membresía comprimida por defecto
    const membershipCard = document.getElementById('drawer-membership-card');
    const membershipToggle = document.getElementById('drawer-membership-toggle');
    if (membershipCard) {
      membershipCard.classList.remove('expanded');
    }
    if (membershipToggle) {
      membershipToggle.setAttribute('aria-expanded', 'false');
    }

    // Renderizar sección de reseña corta con regla de elegibilidad (1 semana activa)
    renderDrawerReviewSection(user);
  }

  /**
   * Renderiza la sección de reseña dentro del Drawer "Mi Espacio & Membresía".
   * Se desbloquea exclusivamente tras 7 días (1 semana) de activación de membresía.
   */
  function renderDrawerReviewSection(user) {
    const container = document.getElementById('drawer-review-card');
    if (!container) return;

    if (!user || user.isAdmin || user.role === 'admin') {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';

    if (typeof ReviewsService === 'undefined') {
      container.innerHTML = '';
      return;
    }

    const eligibility = ReviewsService.checkEligibility(user);
    const existingReview = ReviewsService.getUserReview(user);

    // CASO 1: Bloqueado por antigüedad (< 7 días desde la activación de la membresía)
    if (!eligibility.eligible) {
      container.className = 'drawer-review-card locked';
      container.innerHTML = `
        <div class="drawer-review-header">
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <h4 class="drawer-review-title" style="font-size:0.95rem;">Tu Reseña de Práctica</h4>
          </div>
          <span class="drawer-review-badge badge-locked">En ${eligibility.daysRemaining} días</span>
        </div>
        <p class="drawer-review-locked-msg">
          Tu reseña se habilitará al completar tu <strong>primera semana de membresía</strong> (${eligibility.daysRemaining} ${eligibility.daysRemaining === 1 ? 'día restante' : 'días restantes'}). ¡Disfruta de tus primeras clases en el Refugio!
        </p>
      `;
      return;
    }

    // CASO 2: Ya publicó una reseña (Vista de lectura con opción a editar)
    if (existingReview && !container.dataset.editing) {
      container.className = 'drawer-review-card';
      const starsHtml = '★'.repeat(existingReview.rating || 5);
      container.innerHTML = `
        <div class="drawer-review-header">
          <div>
            <h4 class="drawer-review-title">Tu Reseña en el Inicio</h4>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.1rem;">Publicada en orden cronológico</div>
          </div>
          <span class="drawer-review-badge">Publicada</span>
        </div>
        <div class="drawer-review-published-box">
          <div style="color:#B65E42; font-size:0.95rem; letter-spacing:1px; line-height:1;">${starsHtml}</div>
          <p class="drawer-review-published-quote">«${escapeHtml(existingReview.quote)}»</p>
          <div class="drawer-review-published-meta">
            <span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Visible en testimonios de inicio</span>
            ${existingReview.dateFormatted ? `<span>• ${escapeHtml(existingReview.dateFormatted)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.2rem;">
          <button type="button" class="btn btn-secondary" id="btn-view-review-landing" style="padding:0.35rem 0.65rem; font-size:0.74rem;">
            <span>Ver en Inicio</span>
          </button>
          <button type="button" class="btn btn-secondary" id="btn-drawer-edit-review" style="padding:0.35rem 0.75rem; font-size:0.74rem;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            <span>Modificar reseña</span>
          </button>
        </div>
      `;

      const viewLandingBtn = document.getElementById('btn-view-review-landing');
      if (viewLandingBtn) {
        viewLandingBtn.addEventListener('click', () => {
          closeModal(modals.profileDrawer);
          switchView('landing');
          const testSec = document.getElementById('testimonios');
          if (testSec) testSec.scrollIntoView({ behavior: 'smooth' });
        });
      }

      const editBtn = document.getElementById('btn-drawer-edit-review');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          container.dataset.editing = 'true';
          renderDrawerReviewSection(user);
        });
      }
      return;
    }

    // CASO 3: Habilitada para escribir / editar reseña corta
    container.className = 'drawer-review-card';
    let currentRating = existingReview ? (existingReview.rating || 5) : 5;
    const initialText = existingReview ? existingReview.quote : '';

    container.innerHTML = `
      <div class="drawer-review-header">
        <div>
          <h4 class="drawer-review-title">${existingReview ? 'Modificar Tu Reseña' : 'Dejar una Reseña'}</h4>
          <div style="font-size:0.74rem; color:var(--text-muted); margin-top:0.1rem;">Se publicará en testimonios del inicio</div>
        </div>
        <div class="drawer-review-stars-wrap" id="drawer-review-stars" title="Calificación">
          ${[1, 2, 3, 4, 5].map(star => `
            <button type="button" class="review-star-btn ${star <= currentRating ? 'active' : ''}" data-val="${star}" aria-label="${star} estrellas">★</button>
          `).join('')}
        </div>
      </div>

      <div style="position:relative;">
        <textarea
          id="drawer-review-text"
          class="drawer-review-textarea"
          placeholder="Cuéntanos brevemente cómo te acompaña la práctica en tu día a día (máx. 250 caracteres)..."
          maxlength="250"
        >${escapeHtml(initialText)}</textarea>
      </div>

      <div class="drawer-review-footer">
        <span class="drawer-review-counter" id="drawer-review-counter">${initialText.length} / 250</span>
        <div style="display:flex; gap:0.4rem;">
          ${existingReview ? `
            <button type="button" class="btn btn-secondary" id="btn-cancel-edit-review" style="padding:0.45rem 0.65rem; font-size:0.78rem;">Cancelar</button>
          ` : ''}
          <button type="button" class="btn-drawer-review-submit" id="btn-submit-drawer-review">
            ${existingReview ? 'Actualizar' : 'Publicar Reseña'}
          </button>
        </div>
      </div>
    `;

    // Interacción con Estrellas
    const starBtns = container.querySelectorAll('.review-star-btn');
    starBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        currentRating = parseInt(btn.getAttribute('data-val'), 10) || 5;
        starBtns.forEach(b => {
          const val = parseInt(b.getAttribute('data-val'), 10);
          b.classList.toggle('active', val <= currentRating);
        });
      });
    });

    // Contador de Caracteres
    const textarea = document.getElementById('drawer-review-text');
    const counter = document.getElementById('drawer-review-counter');
    if (textarea && counter) {
      textarea.addEventListener('input', () => {
        counter.textContent = `${textarea.value.length} / 250`;
      });
    }

    // Cancelar edición
    const cancelBtn = document.getElementById('btn-cancel-edit-review');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        delete container.dataset.editing;
        renderDrawerReviewSection(user);
      });
    }

    // Enviar / Publicar
    const submitBtn = document.getElementById('btn-submit-drawer-review');
    if (submitBtn && textarea) {
      submitBtn.addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (text.length < 10) {
          showToast('Por favor escribe al menos 10 caracteres para tu reseña.', 'error');
          textarea.focus();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Publicando...';

        try {
          const res = await ReviewsService.publishReview({
            quote: text,
            rating: currentRating,
            user
          });

          if (res.success) {
            delete container.dataset.editing;
            renderDrawerReviewSection(user);
            renderTestimonialsSlider();
            showToast('¡Tu reseña ha sido publicada en la sección de inicio!', 'success');
          } else {
            showToast(res.message || 'No se pudo publicar la reseña.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = existingReview ? 'Actualizar' : 'Publicar Reseña';
          }
        } catch (err) {
          console.error('Error publicando reseña:', err);
          showToast('Ocurrió un error al guardar la reseña.', 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = existingReview ? 'Actualizar' : 'Publicar Reseña';
        }
      });
    }
  }

  /**
   * Renderiza el slider de testimonios de la página de inicio en estricto orden cronológico
   */
  function renderTestimonialsSlider() {
    const slider = document.getElementById('testimonials-slider');
    if (!slider) return;

    if (typeof ReviewsService === 'undefined') return;

    const reviews = ReviewsService.getAllReviews();
    if (!reviews || !reviews.length) return;

    slider.innerHTML = reviews.map(r => {
      const stars = '★'.repeat(r.rating || 5);
      const authorName = escapeHtml(r.name || r.authorName || 'Alumna');
      const authorMeta = escapeHtml(r.memberSince || r.meta || (r.planName ? `Alumna • ${r.planName}` : 'Alumna de Namasté'));
      const quote = escapeHtml(r.quote);
      const isStudent = r.isStudentReview ? ' student-verified' : '';

      return `
        <div class="testimonial-card${isStudent}">
          <div class="testimonial-stars" aria-hidden="true">${stars}</div>
          <p class="testimonial-quote">«${quote}»</p>
          <div class="testimonial-author">
            <div class="author-meta">
              <h4>${authorName}</h4>
              <span>${authorMeta}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ========================================================================
  // NAVEGACIÓN MÓVIL INFERIOR
  // ========================================================================
  function setupMobileNav() {
    const btnNavHome = document.getElementById('mobile-nav-home');
    const btnNavClasses = document.getElementById('mobile-nav-classes');
    const btnNavPlans = document.getElementById('mobile-nav-plans');
    const btnNavProfile = document.getElementById('mobile-nav-profile');

    if (btnNavHome) {
      btnNavHome.addEventListener('click', () => {
        switchView('landing');
      });
    }

    if (btnNavClasses) {
      btnNavClasses.addEventListener('click', () => {
        const user = AuthService.getCurrentUser();
        if (user) {
          switchView('platform');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          openModal(modals.login);
        }
      });
    }

    if (btnNavPlans) {
      btnNavPlans.addEventListener('click', (e) => {
        if (state.currentView === 'platform') {
          e.preventDefault();
          // Abrir modal de gestión de planes para alumno activo
          const changePlanBtn = document.getElementById('btn-drawer-change-plan');
          if (changePlanBtn) changePlanBtn.click();
        }
      });
    }

    if (btnNavProfile) {
      btnNavProfile.addEventListener('click', () => {
        const user = AuthService.getCurrentUser();
        if (user) {
          populateProfileDrawer();
          openModal(modals.profileDrawer);
        } else {
          openModal(modals.login);
        }
      });
    }
  }

  function updateMobileNavState() {
    const btnNavHome = document.getElementById('mobile-nav-home');
    const btnNavClasses = document.getElementById('mobile-nav-classes');

    if (state.currentView === 'landing') {
      btnNavHome?.classList.add('active');
      btnNavClasses?.classList.remove('active');
    } else {
      btnNavClasses?.classList.add('active');
      btnNavHome?.classList.remove('active');
    }
  }

  // ========================================================================
  // PANEL DE AUDITORÍA & CONTROL DE LA DUEÑA (VALERIA MANASSERO)
  // ========================================================================
  function setupAdminDashboard() {
    // 1. Navegación en Barra Ejecutiva
    const btnAdminToHome = document.getElementById('btn-admin-to-home');
    if (btnAdminToHome) {
      btnAdminToHome.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('landing');
      });
    }

    const brandLogos = document.querySelectorAll('.btn-admin-go-home');
    brandLogos.forEach(logo => {
      logo.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('landing');
      });
    });

    const btnAdminToPlatform = document.getElementById('btn-admin-to-platform');
    if (btnAdminToPlatform) {
      btnAdminToPlatform.addEventListener('click', (e) => {
        e.preventDefault();
        const user = AuthService.getCurrentUser();
        if (user) {
          switchView('platform');
        } else {
          // Si no hay sesión previa, autologuear con Sofía Varela para visualización de la plataforma
          AuthService.loginWithEmail('sofia.varela@ejemplo.com').then(() => {
            switchView('platform');
          });
        }
      });
    }

    // 2. Enlaces directos hacia Auditoría en Header y Footer
    document.querySelectorAll('#nav-btn-admin, #link-open-admin, .btn-access-admin').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('admin');
      });
    });

    // 3. Pestañas de Navegación del Panel
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    const txTabBtn = document.getElementById('admin-tab-btn-transactions');
    if (txTabBtn) {
      const span = txTabBtn.querySelector('span');
      if (span) span.textContent = 'Cobros';
    }
    const drawerTxBtn = document.querySelector('[data-admin-goto-tab="tab-transactions"]');
    if (drawerTxBtn) {
      const span = drawerTxBtn.querySelector('span');
      if (span) span.textContent = 'Cobros';
    }

    // 3.1 Menú Lateral / Admin Drawer
    const adminDrawerToggleBtn = document.getElementById('btn-admin-drawer-toggle');
    const adminDrawerBackdrop = document.getElementById('admin-drawer-backdrop');
    const adminDrawerCloseBtn = document.getElementById('btn-admin-drawer-close');

    function openAdminDrawer() {
      if (adminDrawerBackdrop) {
        openModal(adminDrawerBackdrop);
        if (adminDrawerToggleBtn) adminDrawerToggleBtn.setAttribute('aria-expanded', 'true');
      }
    }

    function closeAdminDrawer() {
      if (adminDrawerBackdrop) {
        closeModal(adminDrawerBackdrop);
        if (adminDrawerToggleBtn) adminDrawerToggleBtn.setAttribute('aria-expanded', 'false');
      }
    }

    if (adminDrawerToggleBtn) {
      adminDrawerToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (adminDrawerBackdrop && adminDrawerBackdrop.classList.contains('active')) {
          closeAdminDrawer();
        } else {
          openAdminDrawer();
        }
      });
    }

    if (adminDrawerCloseBtn) {
      adminDrawerCloseBtn.addEventListener('click', closeAdminDrawer);
    }

    if (adminDrawerBackdrop) {
      adminDrawerBackdrop.addEventListener('click', (e) => {
        if (e.target === adminDrawerBackdrop) {
          closeAdminDrawer();
        }
      });
    }

    document.querySelectorAll('[data-admin-goto-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-admin-goto-tab');
        closeAdminDrawer();
        const tabBtn = document.querySelector(`.admin-tab-btn[data-tab="${tab}"]`);
        if (tabBtn) tabBtn.click();
      });
    });

    const adminDrawerNewUser = document.getElementById('admin-drawer-action-new-user');
    if (adminDrawerNewUser) {
      adminDrawerNewUser.addEventListener('click', () => {
        closeAdminDrawer();
        if (modals.adminCreateUser) openModal(modals.adminCreateUser);
      });
    }

    const adminDrawerNewClass = document.getElementById('admin-drawer-action-new-class');
    if (adminDrawerNewClass) {
      adminDrawerNewClass.addEventListener('click', () => {
        closeAdminDrawer();
        const createClassBtn = document.getElementById('btn-admin-open-create-class');
        if (createClassBtn) createClassBtn.click();
      });
    }

    const adminDrawerGotoPlatform = document.getElementById('admin-drawer-goto-platform');
    if (adminDrawerGotoPlatform) {
      adminDrawerGotoPlatform.addEventListener('click', () => {
        closeAdminDrawer();
        switchView('platform');
      });
    }

    const adminDrawerGotoLanding = document.getElementById('admin-drawer-goto-landing');
    if (adminDrawerGotoLanding) {
      adminDrawerGotoLanding.addEventListener('click', () => {
        closeAdminDrawer();
        switchView('landing');
      });
    }

    const adminDrawerLogout = document.getElementById('admin-drawer-logout');
    if (adminDrawerLogout) {
      adminDrawerLogout.addEventListener('click', () => {
        closeAdminDrawer();
        AuthService.logout();
        switchView('landing');
        showToast('Sesión cerrada', 'info');
      });
    }
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        if (!targetTab) return;

        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.admin-tab-panel').forEach(panel => {
          panel.style.display = 'none';
        });

        const activePanel = document.getElementById(`panel-${targetTab}`);
        if (activePanel) {
          activePanel.style.display = 'block';
        }

        state.adminActiveTab = targetTab;

        document.querySelectorAll('.admin-drawer-nav-btn').forEach(dBtn => {
          if (dBtn.getAttribute('data-admin-goto-tab') === targetTab) {
            dBtn.classList.add('active');
          } else {
            dBtn.classList.remove('active');
          }
        });

        if (targetTab === 'tab-transactions') {
          AdminService.getTransactions().then(res => {
            if (res && res.success && res.transactions) {
              renderAdminTransactions(res.transactions);
            }
          });
        } else if (targetTab === 'tab-classes') {
          AdminService.getClasses().then(res => {
            if (res && res.success && res.classes) {
              state.adminClassesCache = res.classes;
              renderAdminClassesTable();
            }
          });
        } else if (targetTab === 'tab-users') {
          AdminService.getUsers().then(res => {
            if (res && res.success && res.users) {
              state.adminUsersCache = res.users;
              renderAdminUsersTable();
            }
          });
        } else if (targetTab === 'tab-plans') {
          loadAndRenderAdminPlans();
        }
      });
    });

    // 4. Búsqueda y Filtros de Alumnas
    const userSearchInput = document.getElementById('admin-user-search-input');
    if (userSearchInput) {
      userSearchInput.addEventListener('input', (e) => {
        state.adminUserSearchQuery = e.target.value.trim().toLowerCase();
        renderAdminUsersTable();
      });
    }

    const filterPills = document.querySelectorAll('.admin-filter-pill');
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.adminUserFilterStatus = pill.getAttribute('data-filter-status') || 'all';
        renderAdminUsersTable();
      });
    });

    // 5. Modal de Alta de Alumna (Registrar Nueva Alumna)
    const btnOpenCreateModal = document.getElementById('btn-admin-create-user-modal');
    if (btnOpenCreateModal) {
      btnOpenCreateModal.addEventListener('click', () => {
        if (modals.adminCreateUser) {
          openModal(modals.adminCreateUser);
        }
      });
    }

    const btnCloseCreateModal = document.getElementById('btn-close-create-user-modal');
    const btnCancelCreateModal = document.getElementById('btn-cancel-create-user');
    [btnCloseCreateModal, btnCancelCreateModal].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          if (modals.adminCreateUser) {
            closeModal(modals.adminCreateUser);
          }
        });
      }
    });

    if (modals.adminCreateUser) {
      modals.adminCreateUser.addEventListener('click', (e) => {
        if (e.target === modals.adminCreateUser) {
          closeModal(modals.adminCreateUser);
        }
      });
    }

    const formCreateUser = document.getElementById('admin-create-user-form');
    if (formCreateUser) {
      formCreateUser.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('create-user-name');
        const emailInput = document.getElementById('create-user-email');
        const planSelect = document.getElementById('create-user-plan');
        const annualCheck = document.getElementById('create-user-annual');
        const activeCheck = document.getElementById('create-user-active');

        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
        const planId = planSelect ? planSelect.value : 'plan-refugio';
        const isAnnual = annualCheck ? annualCheck.checked : false;
        const active = activeCheck ? activeCheck.checked : true;

        if (!name || !email) {
          showToast('Por favor completa todos los campos requeridos', 'warning');
          return;
        }

        try {
          const res = await AdminService.createUser({ name, email, planId, isAnnual, active });
          if (res && res.success) {
            showToast(`Alumna ${name} registrada exitosamente`, 'success');
            if (modals.adminCreateUser) closeModal(modals.adminCreateUser);
            formCreateUser.reset();
            renderAdminDashboard();
          } else {
            showToast(res.message || 'No se pudo registrar la alumna', 'warning');
          }
        } catch (err) {
          showToast('Error de conexión al registrar', 'warning');
        }
      });
    }

    // 7. Modal de Cambio de Plan para Alumna
    const btnCloseEditPlan = document.getElementById('btn-close-edit-plan-modal');
    const btnCancelEditPlan = document.getElementById('btn-cancel-edit-plan');
    [btnCloseEditPlan, btnCancelEditPlan].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          if (modals.adminEditPlan) {
            closeModal(modals.adminEditPlan);
          }
        });
      }
    });

    if (modals.adminEditPlan) {
      modals.adminEditPlan.addEventListener('click', (e) => {
        if (e.target === modals.adminEditPlan) {
          closeModal(modals.adminEditPlan);
        }
      });
    }

    const formEditPlan = document.getElementById('admin-edit-plan-form');
    if (formEditPlan) {
      formEditPlan.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('edit-plan-user-id')?.value;
        const planSelect = document.getElementById('edit-plan-select');
        const newPlanId = planSelect ? planSelect.value : 'plan-refugio';

        if (!userId) return;

        try {
          const res = await AdminService.updateUser(userId, { planId: newPlanId });
          if (res && res.success) {
            showToast('Plan de membresía actualizado correctamente', 'success');
            if (modals.adminEditPlan) closeModal(modals.adminEditPlan);
            renderAdminDashboard();
          } else {
            showToast(res.message || 'No se pudo actualizar el plan', 'warning');
          }
        } catch (err) {
          showToast('Error al actualizar plan', 'warning');
        }
      });
    }

    // 8. Event Delegation en la Tabla de Alumnas
    const tableBody = document.getElementById('admin-users-table-body');
    if (tableBody) {
      tableBody.addEventListener('click', async (e) => {
        // Toggle de fila "Más detalles" (flechita)
        const toggleDetailsBtn = e.target.closest('.btn-toggle-user-details');
        if (toggleDetailsBtn) {
          const userId = toggleDetailsBtn.getAttribute('data-user-id');
          const detailsRow = document.getElementById(`details-row-${userId}`);
          const mainRow = document.getElementById(`main-row-${userId}`);
          if (detailsRow) {
            const isHidden = detailsRow.style.display === 'none';
            detailsRow.style.display = isHidden ? 'table-row' : 'none';
            toggleDetailsBtn.classList.toggle('expanded', isHidden);
            if (mainRow) mainRow.classList.toggle('expanded', isHidden);
          }
          return;
        }

        // A) Copiar Código de Acceso
        const copyBtn = e.target.closest('.code-copy-btn, .code-copy-btn-mini');
        if (copyBtn) {
          const code = copyBtn.getAttribute('data-code');
          if (code) {
            try {
              await navigator.clipboard.writeText(code);
              showToast(`Código copiado: ${code}`, 'success');
            } catch (err) {
              showToast(`Código: ${code}`, 'info');
            }
          }
          return;
        }

        // B) Pausar / Reactivar Membresía en 1 Clic
        const toggleBtn = e.target.closest('.btn-pause-toggle');
        if (toggleBtn) {
          const userId = toggleBtn.getAttribute('data-user-id');
          const currentActive = toggleBtn.getAttribute('data-active') === 'true';
          const newActive = !currentActive;

          try {
            const res = await AdminService.updateUser(userId, { active: newActive });
            if (res && res.success) {
              showToast(newActive ? 'Membresía reactivada con éxito' : 'Membresía pausada en el Shala', 'info');
              renderAdminDashboard();
            }
          } catch (err) {
            showToast('Error al modificar estado', 'warning');
          }
          return;
        }

        // C) Modificar Plan
        const editPlanBtn = e.target.closest('.btn-edit-plan');
        if (editPlanBtn) {
          const userId = editPlanBtn.getAttribute('data-user-id');
          const userName = editPlanBtn.getAttribute('data-user-name');
          const planId = editPlanBtn.getAttribute('data-plan-id');

          const inputUserId = document.getElementById('edit-plan-user-id');
          const nameSpan = document.getElementById('edit-plan-user-name');
          const selectPlan = document.getElementById('edit-plan-select');

          if (inputUserId) inputUserId.value = userId;
          if (nameSpan) nameSpan.textContent = userName || 'Alumna';
          if (selectPlan && planId) selectPlan.value = planId;

          if (modals.adminEditPlan) {
            openModal(modals.adminEditPlan);
          }
          return;
        }

        // D) Probar como Alumna (Impersonación / Acceso rápido al Refugio)
        const loginAsBtn = e.target.closest('.btn-login-as');
        if (loginAsBtn) {
          const userEmail = loginAsBtn.getAttribute('data-user-email');
          const userName = loginAsBtn.getAttribute('data-user-name');
          if (userEmail) {
            showToast(`Ingresando al Refugio como ${userName}...`, 'info');
            await AuthService.loginWithEmail(userEmail);
            switchView('platform');
          }
          return;
        }

        // E) Eliminar Alumna
        const deleteBtn = e.target.closest('.btn-delete-user');
        if (deleteBtn) {
          const userId = deleteBtn.getAttribute('data-user-id');
          const userName = deleteBtn.getAttribute('data-user-name');
          if (confirm(`¿Estás segura de eliminar permanentemente a "${userName}" del registro de alumnas?`)) {
            try {
              const res = await AdminService.deleteUser(userId);
              if (res && res.success) {
                showToast(`Alumna "${userName}" eliminada`, 'info');
                renderAdminDashboard();
              }
            } catch (err) {
              showToast('Error al eliminar alumna', 'warning');
            }
          }
          return;
        }
      });
    }

    // 9. Event Delegation en la Tabla de Cobros & Recibos (Toggle Detalles + Imprimir Recibo)
    const txTableBody = document.getElementById('admin-transactions-table-body');
    if (txTableBody) {
      txTableBody.addEventListener('click', (e) => {
        // Imprimir recibo (si hace clic en el botón de recibo o comprobante)
        const printBtn = e.target.closest('.btn-print-tx-receipt');
        if (printBtn) {
          e.stopPropagation();
          const txId = printBtn.getAttribute('data-tx-id');
          const tx = (state.adminTxCache || []).find(t => (t.id || '') === txId);
          if (tx) printTxReceipt(tx);
          else showToast('No se pudo obtener los datos del cobro', 'warning');
          return;
        }

        // Toggle detalles al hacer clic en la fila
        const row = e.target.closest('.admin-user-row');
        if (row) {
          const txId = row.getAttribute('data-tx-id');
          const detailsRow = document.getElementById(`tx-details-row-${txId}`);
          if (detailsRow) {
            const isHidden = detailsRow.style.display === 'none';
            detailsRow.style.display = isHidden ? 'table-row' : 'none';
            row.classList.toggle('expanded', isHidden);
          }
        }
      });
    }

    // 9b. Buscador y Filtros de Cobros & Recibos
    const txSearchInput = document.getElementById('admin-tx-search-input');
    if (txSearchInput) {
      txSearchInput.addEventListener('input', (e) => {
        state.adminTxSearchQuery = e.target.value.trim().toLowerCase();
        renderAdminTransactions();
      });
    }
    const txPanel = document.getElementById('panel-tab-transactions');
    if (txPanel) {
      txPanel.addEventListener('click', (e) => {
        const pill = e.target.closest('[data-filter-tx]');
        if (!pill) return;
        txPanel.querySelectorAll('[data-filter-tx]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.adminTxPlanFilter = pill.getAttribute('data-filter-tx');
        renderAdminTransactions();
      });
    }

    // 10. Búsqueda y Filtros de Clases
    const classSearchInput = document.getElementById('admin-class-search-input');
    if (classSearchInput) {
      classSearchInput.addEventListener('input', (e) => {
        state.adminClassSearchQuery = e.target.value.trim().toLowerCase();
        renderAdminClassesTable();
      });
    }

    const classFilterPills = document.querySelectorAll('[data-filter-class]');
    classFilterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        classFilterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.adminClassFilterFormat = pill.getAttribute('data-filter-class') || 'all';
        renderAdminClassesTable();
      });
    });

    // 11. Modal de Subir / Editar Clase con Editor Mobile-First Integrado
    let _classMediaBlob = null;
    let _classThumbBlob = null;
    let _classMediaFormat = 'video';
    let _classMediaFileName = '';

    // Video Editor State
    let _videoTrim = { start: 0, end: 0, duration: 0 };
    let _videoFilters = { brightness: 100, contrast: 100, preset: 'normal' };

    // Audio Editor State
    let _audioSettings = {
      voiceVol: 100,
      ambient: 'none',
      ambientVol: 30,
      eq: { low: 0, mid: 0, high: 0, preset: 'flat' }
    };
    let _audioCtx = null;
    let _voiceGainNode = null;
    let _ambientGainNode = null;
    let _ambientSourceNode = null;
    let _ambientLfoNode = null;
    let _ambientFilterNode = null;
    let _eqLowNode = null;
    let _eqMidNode = null;
    let _eqHighNode = null;
    let _audioIsPlaying = false;

    function _initAudioContext() {
      if (!_audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          _audioCtx = new AudioContextClass();
        }
      }
      if (_audioCtx && _audioCtx.state === 'suspended') {
        _audioCtx.resume();
      }
    }

    function _setupAudioGraph(audioElement) {
      if (!_audioCtx) _initAudioContext();
      if (!_audioCtx) return;

      if (!_voiceGainNode && audioElement) {
        try {
          const source = _audioCtx.createMediaElementSource(audioElement);
          _voiceGainNode = _audioCtx.createGain();
          _voiceGainNode.gain.setValueAtTime((_audioSettings.voiceVol || 100) / 100, _audioCtx.currentTime);

          _eqLowNode = _audioCtx.createBiquadFilter();
          _eqLowNode.type = 'lowshelf';
          _eqLowNode.frequency.value = 200;
          _eqLowNode.gain.setValueAtTime(_audioSettings.eq.low || 0, _audioCtx.currentTime);

          _eqMidNode = _audioCtx.createBiquadFilter();
          _eqMidNode.type = 'peaking';
          _eqMidNode.frequency.value = 1200;
          _eqMidNode.Q.value = 1;
          _eqMidNode.gain.setValueAtTime(_audioSettings.eq.mid || 0, _audioCtx.currentTime);

          _eqHighNode = _audioCtx.createBiquadFilter();
          _eqHighNode.type = 'highshelf';
          _eqHighNode.frequency.value = 6000;
          _eqHighNode.gain.setValueAtTime(_audioSettings.eq.high || 0, _audioCtx.currentTime);

          source.connect(_voiceGainNode);
          _voiceGainNode.connect(_eqLowNode);
          _eqLowNode.connect(_eqMidNode);
          _eqMidNode.connect(_eqHighNode);
          _eqHighNode.connect(_audioCtx.destination);
        } catch (e) {
          console.warn('Audio graph setup notice:', e);
        }
      }
    }

    function _stopAmbientSound() {
      if (_ambientSourceNode) {
        try {
          _ambientSourceNode.stop();
          _ambientSourceNode.disconnect();
        } catch (e) {}
        _ambientSourceNode = null;
      }
      if (_ambientLfoNode) {
        try {
          _ambientLfoNode.stop();
          _ambientLfoNode.disconnect();
        } catch (e) {}
        _ambientLfoNode = null;
      }
      if (_ambientFilterNode) {
        try { _ambientFilterNode.disconnect(); } catch (e) {}
        _ambientFilterNode = null;
      }
    }

    function _playAmbientSound(type, volumePct) {
      _stopAmbientSound();
      if (type === 'none') return;
      if (!_audioCtx) _initAudioContext();
      if (!_audioCtx) return;

      if (!_ambientGainNode) {
        _ambientGainNode = _audioCtx.createGain();
        _ambientGainNode.connect(_audioCtx.destination);
      }
      _ambientGainNode.gain.setValueAtTime(((volumePct || 30) / 100) * 0.28, _audioCtx.currentTime);

      if (type === 'bowls') {
        // Cuencos tibetanos: tonos armónicos en 216Hz y 432Hz con respiración lenta
        const osc1 = _audioCtx.createOscillator();
        const osc2 = _audioCtx.createOscillator();
        const bowlGain = _audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 216;
        osc2.type = 'sine';
        osc2.frequency.value = 432;

        const lfo = _audioCtx.createOscillator();
        const lfoGain = _audioCtx.createGain();
        lfo.frequency.value = 0.18;
        lfoGain.gain.value = 3.5;
        lfo.connect(osc1.frequency);
        lfo.start();
        _ambientLfoNode = lfo;

        osc1.connect(bowlGain);
        osc2.connect(bowlGain);
        bowlGain.connect(_ambientGainNode);
        osc1.start();
        osc2.start();
        _ambientSourceNode = osc1;
      } else if (type === 'om') {
        // Tono OM (136.1 Hz frecuencia meditativa cósmica)
        const osc = _audioCtx.createOscillator();
        const sub = _audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 136.1;
        sub.type = 'sine';
        sub.frequency.value = 68.05;

        const omGain = _audioCtx.createGain();
        omGain.gain.value = 0.45;
        const filter = _audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        _ambientFilterNode = filter;

        osc.connect(filter);
        sub.connect(filter);
        filter.connect(omGain);
        omGain.connect(_ambientGainNode);
        osc.start();
        sub.start();
        _ambientSourceNode = osc;
      } else if (type === 'stream') {
        // Arroyo Zen: flujo de agua relajante generado sintéticamente
        const bufferSize = _audioCtx.sampleRate * 2;
        const noiseBuffer = _audioCtx.createBuffer(1, bufferSize, _audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 3.0;
        }

        const whiteNoise = _audioCtx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;
        const filter = _audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 750;
        filter.Q.value = 0.9;
        _ambientFilterNode = filter;

        whiteNoise.connect(filter);
        filter.connect(_ambientGainNode);
        whiteNoise.start();
        _ambientSourceNode = whiteNoise;
      }
    }

    function _formatTime(sec) {
      if (isNaN(sec) || sec < 0) sec = 0;
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function _applyVideoFilters() {
      const vid = document.getElementById('editor-video-preview');
      if (!vid) return;
      const b = _videoFilters.brightness;
      const c = _videoFilters.contrast;
      const warm = _videoFilters.preset === 'calido' ? ' sepia(18%) saturate(110%)' : '';
      vid.style.filter = `brightness(${b}%) contrast(${c}%)${warm}`;

      const valB = document.getElementById('val-video-brightness');
      const valC = document.getElementById('val-video-contrast');
      if (valB) valB.textContent = `${b}%`;
      if (valC) valC.textContent = `${c}%`;
    }

    function _updateVideoTrimUI() {
      const startEl = document.getElementById('video-trim-start');
      const endEl = document.getElementById('video-trim-end');
      const startVal = document.getElementById('trim-start-val');
      const endVal = document.getElementById('trim-end-val');
      const info = document.getElementById('video-trim-info');

      if (startEl) startEl.value = _videoTrim.start;
      if (endEl) endEl.value = _videoTrim.end;
      if (startVal) startVal.textContent = _formatTime(_videoTrim.start);
      if (endVal) endVal.textContent = _formatTime(_videoTrim.end);
      if (info) {
        const total = Math.max(0, _videoTrim.end - _videoTrim.start);
        info.textContent = `${_formatTime(_videoTrim.start)} - ${_formatTime(_videoTrim.end)} (${_formatTime(total)})`;
      }
    }

    function _applyEqGain() {
      if (_eqLowNode && _audioCtx) _eqLowNode.gain.setValueAtTime(_audioSettings.eq.low, _audioCtx.currentTime);
      if (_eqMidNode && _audioCtx) _eqMidNode.gain.setValueAtTime(_audioSettings.eq.mid, _audioCtx.currentTime);
      if (_eqHighNode && _audioCtx) _eqHighNode.gain.setValueAtTime(_audioSettings.eq.high, _audioCtx.currentTime);

      const lVal = document.getElementById('val-eq-low');
      const mVal = document.getElementById('val-eq-mid');
      const hVal = document.getElementById('val-eq-high');
      if (lVal) lVal.textContent = `${_audioSettings.eq.low > 0 ? '+' : ''}${_audioSettings.eq.low}dB`;
      if (mVal) mVal.textContent = `${_audioSettings.eq.mid > 0 ? '+' : ''}${_audioSettings.eq.mid}dB`;
      if (hVal) hVal.textContent = `${_audioSettings.eq.high > 0 ? '+' : ''}${_audioSettings.eq.high}dB`;

      const lIn = document.getElementById('audio-eq-low');
      const mIn = document.getElementById('audio-eq-mid');
      const hIn = document.getElementById('audio-eq-high');
      if (lIn) lIn.value = _audioSettings.eq.low;
      if (mIn) mIn.value = _audioSettings.eq.mid;
      if (hIn) hIn.value = _audioSettings.eq.high;
    }

    function _resetClassModal() {
      const form = document.getElementById('admin-class-form');
      if (form) form.reset();
      _classMediaBlob = null;
      _classThumbBlob = null;
      _classMediaFormat = 'video';
      _classMediaFileName = '';
      _videoTrim = { start: 0, end: 0, duration: 0 };
      _videoFilters = { brightness: 100, contrast: 100, preset: 'normal' };
      _audioSettings = { voiceVol: 100, ambient: 'none', ambientVol: 30, eq: { low: 0, mid: 0, high: 0, preset: 'flat' } };

      // Reset Video Editor Preview
      const vid = document.getElementById('editor-video-preview');
      if (vid) {
        vid.pause();
        vid.src = '';
        vid.style.filter = '';
      }

      // Reset Audio Editor Preview
      const aud = document.getElementById('editor-audio-element');
      if (aud) {
        aud.pause();
        aud.src = '';
      }
      _stopAmbientSound();
      _audioIsPlaying = false;
      const audioBar = document.getElementById('editor-audio-bar');
      if (audioBar) audioBar.classList.remove('playing');
      const playIcon = document.getElementById('audio-editor-play-icon');
      if (playIcon) playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';

      // Reset Video / Audio Dropzone vs Editor Container (Sin duplicados)
      const mediaZone = document.getElementById('media-file-zone');
      const mediaEditor = document.getElementById('media-editor-container');
      if (mediaZone) {
        mediaZone.style.display = 'flex';
        mediaZone.classList.remove('has-file');
      }
      if (mediaEditor) mediaEditor.style.display = 'none';

      // Reset Portada Dropzone vs Tarjeta Unificada (Sin duplicados)
      const thumbZone = document.getElementById('thumb-file-zone');
      const thumbCard = document.getElementById('thumb-unified-card');
      const thumbImg = document.getElementById('thumb-preview-img');
      if (thumbZone) {
        thumbZone.style.display = 'flex';
        thumbZone.classList.remove('has-file');
      }
      if (thumbCard) thumbCard.style.display = 'none';
      if (thumbImg) thumbImg.src = '';

      // Reset Pills & Sliders
      document.querySelectorAll('[data-vpreset]').forEach(b => b.classList.toggle('active', b.getAttribute('data-vpreset') === 'normal'));
      document.querySelectorAll('[data-ambient]').forEach(b => b.classList.toggle('active', b.getAttribute('data-ambient') === 'none'));
      document.querySelectorAll('[data-eqpreset]').forEach(b => b.classList.toggle('active', b.getAttribute('data-eqpreset') === 'flat'));

      const vBrightEl = document.getElementById('video-param-brightness');
      const vContrastEl = document.getElementById('video-param-contrast');
      if (vBrightEl) vBrightEl.value = 100;
      if (vContrastEl) vContrastEl.value = 100;
      _applyVideoFilters();

      const voiceVolEl = document.getElementById('audio-param-voice-vol');
      const voiceValEl = document.getElementById('val-audio-voice-vol');
      if (voiceVolEl) voiceVolEl.value = 100;
      if (voiceValEl) voiceValEl.textContent = '100%';

      const bgVolContainer = document.getElementById('audio-bg-vol-container');
      if (bgVolContainer) bgVolContainer.style.display = 'none';
      const bgName = document.getElementById('audio-bg-current-name');
      if (bgName) bgName.textContent = 'Sin música';
      const bgVolEl = document.getElementById('audio-param-bg-vol');
      const bgValEl = document.getElementById('val-audio-bg-vol');
      if (bgVolEl) bgVolEl.value = 30;
      if (bgValEl) bgValEl.textContent = '30%';

      _applyEqGain();
    }

    const btnOpenCreateClassModal = document.getElementById('btn-admin-open-create-class');
    if (btnOpenCreateClassModal) {
      btnOpenCreateClassModal.addEventListener('click', () => {
        _resetClassModal();
        const heading = document.getElementById('modal-class-heading');
        if (heading) heading.textContent = 'Subir Nueva Práctica';
        const idInput = document.getElementById('form-class-id');
        if (idInput) idInput.value = '';
        if (modals.adminClass) openModal(modals.adminClass);
      });
    }

    const btnCloseClassModal = document.getElementById('btn-close-class-modal');
    const btnCancelClassModal = document.getElementById('btn-cancel-class-modal');
    [btnCloseClassModal, btnCancelClassModal].forEach(btn => {
      if (btn) btn.addEventListener('click', () => {
        _resetClassModal();
        if (modals.adminClass) closeModal(modals.adminClass);
      });
    });

    if (modals.adminClass) {
      modals.adminClass.addEventListener('click', (e) => {
        if (e.target === modals.adminClass) {
          _resetClassModal();
          closeModal(modals.adminClass);
        }
      });
    }

    // File picker: Video / Audio
    const mediaFileInput = document.getElementById('form-class-media-file');
    if (mediaFileInput) {
      mediaFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        _classMediaBlob = URL.createObjectURL(file);
        _classMediaFileName = file.name;
        _classMediaFormat = file.type.startsWith('audio') ? 'audio' : 'video';

        // Ocultar zona de selección, mostrar panel editor integrado (Sin duplicados)
        const mediaZone = document.getElementById('media-file-zone');
        const mediaEditor = document.getElementById('media-editor-container');
        if (mediaZone) mediaZone.style.display = 'none';
        if (mediaEditor) mediaEditor.style.display = 'flex';

        // Actualizar barra de archivo
        const nameEl = document.getElementById('editor-file-name');
        const badgeEl = document.getElementById('editor-format-badge');
        const iconEl = document.getElementById('editor-format-icon');
        if (nameEl) nameEl.textContent = file.name;
        if (badgeEl) badgeEl.textContent = _classMediaFormat === 'audio' ? 'Audio' : 'Video';
        if (iconEl) {
          iconEl.innerHTML = _classMediaFormat === 'audio'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';
        }

        const videoPanel = document.getElementById('video-editor-panel');
        const audioPanel = document.getElementById('audio-editor-panel');

        if (_classMediaFormat === 'video') {
          if (audioPanel) audioPanel.style.display = 'none';
          if (videoPanel) videoPanel.style.display = 'flex';
          const vid = document.getElementById('editor-video-preview');
          if (vid) {
            vid.src = _classMediaBlob;
            vid.onloadedmetadata = () => {
              const dur = Math.round(vid.duration) || 60;
              _videoTrim.duration = dur;
              _videoTrim.start = 0;
              _videoTrim.end = dur;
              const sEl = document.getElementById('video-trim-start');
              const eEl = document.getElementById('video-trim-end');
              if (sEl) { sEl.max = dur; sEl.value = 0; }
              if (eEl) { eEl.max = dur; eEl.value = dur; }
              _updateVideoTrimUI();
            };
          }
        } else {
          if (videoPanel) videoPanel.style.display = 'none';
          if (audioPanel) audioPanel.style.display = 'flex';
          const aud = document.getElementById('editor-audio-element');
          if (aud) {
            aud.src = _classMediaBlob;
            aud.onloadedmetadata = () => {
              const tEl = document.getElementById('audio-editor-time');
              if (tEl) tEl.textContent = `00:00 / ${_formatTime(aud.duration || 0)}`;
            };
          }
        }
      });
    }

    const btnChangeMediaFile = document.getElementById('btn-change-media-file');
    if (btnChangeMediaFile) {
      btnChangeMediaFile.addEventListener('click', () => {
        if (mediaFileInput) mediaFileInput.click();
      });
    }

    // Controles del Editor de Video (Recorte y Ajustes)
    const trimStartEl = document.getElementById('video-trim-start');
    const trimEndEl = document.getElementById('video-trim-end');
    const editorVid = document.getElementById('editor-video-preview');

    if (trimStartEl) {
      trimStartEl.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10) || 0;
        if (val >= _videoTrim.end) {
          val = Math.max(0, _videoTrim.end - 1);
          e.target.value = val;
        }
        _videoTrim.start = val;
        if (editorVid) editorVid.currentTime = val;
        _updateVideoTrimUI();
      });
    }

    if (trimEndEl) {
      trimEndEl.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10) || 0;
        if (val <= _videoTrim.start) {
          val = Math.min(_videoTrim.duration, _videoTrim.start + 1);
          e.target.value = val;
        }
        _videoTrim.end = val;
        if (editorVid) editorVid.currentTime = val;
        _updateVideoTrimUI();
      });
    }

    if (editorVid) {
      editorVid.addEventListener('timeupdate', () => {
        if (_videoTrim.end > 0 && editorVid.currentTime >= _videoTrim.end) {
          editorVid.currentTime = _videoTrim.start;
        }
      });
    }

    const vBrightEl = document.getElementById('video-param-brightness');
    const vContrastEl = document.getElementById('video-param-contrast');
    if (vBrightEl) {
      vBrightEl.addEventListener('input', (e) => {
        _videoFilters.brightness = parseInt(e.target.value, 10);
        _applyVideoFilters();
      });
    }
    if (vContrastEl) {
      vContrastEl.addEventListener('input', (e) => {
        _videoFilters.contrast = parseInt(e.target.value, 10);
        _applyVideoFilters();
      });
    }

    document.querySelectorAll('[data-vpreset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-vpreset');
        document.querySelectorAll('[data-vpreset]').forEach(b => b.classList.toggle('active', b === btn));
        _videoFilters.preset = preset;
        if (preset === 'normal') {
          _videoFilters.brightness = 100;
          _videoFilters.contrast = 100;
        } else if (preset === 'calido') {
          _videoFilters.brightness = 106;
          _videoFilters.contrast = 96;
        } else if (preset === 'suave') {
          _videoFilters.brightness = 110;
          _videoFilters.contrast = 90;
        }
        if (vBrightEl) vBrightEl.value = _videoFilters.brightness;
        if (vContrastEl) vContrastEl.value = _videoFilters.contrast;
        _applyVideoFilters();
      });
    });

    // Controles del Editor de Audio
    const btnAudioPlay = document.getElementById('btn-audio-editor-play');
    const editorAudio = document.getElementById('editor-audio-element');
    const audioBar = document.getElementById('editor-audio-bar');
    const audioPlayIcon = document.getElementById('audio-editor-play-icon');

    if (btnAudioPlay && editorAudio) {
      btnAudioPlay.addEventListener('click', () => {
        _initAudioContext();
        _setupAudioGraph(editorAudio);

        if (editorAudio.paused) {
          editorAudio.play().then(() => {
            _audioIsPlaying = true;
            if (audioBar) audioBar.classList.add('playing');
            if (audioPlayIcon) audioPlayIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
            if (_audioSettings.ambient !== 'none') {
              _playAmbientSound(_audioSettings.ambient, _audioSettings.ambientVol);
            }
          }).catch(err => console.log('Audio playback notice:', err));
        } else {
          editorAudio.pause();
          _audioIsPlaying = false;
          if (audioBar) audioBar.classList.remove('playing');
          if (audioPlayIcon) audioPlayIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
          _stopAmbientSound();
        }
      });

      editorAudio.addEventListener('timeupdate', () => {
        const tEl = document.getElementById('audio-editor-time');
        if (tEl) {
          tEl.textContent = `${_formatTime(editorAudio.currentTime || 0)} / ${_formatTime(editorAudio.duration || 0)}`;
        }
      });

      editorAudio.addEventListener('ended', () => {
        _audioIsPlaying = false;
        if (audioBar) audioBar.classList.remove('playing');
        if (audioPlayIcon) audioPlayIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
        _stopAmbientSound();
      });
    }

    const voiceVolEl = document.getElementById('audio-param-voice-vol');
    if (voiceVolEl) {
      voiceVolEl.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        _audioSettings.voiceVol = val;
        const valEl = document.getElementById('val-audio-voice-vol');
        if (valEl) valEl.textContent = `${val}%`;
        if (_voiceGainNode && _audioCtx) {
          _voiceGainNode.gain.setValueAtTime(val / 100, _audioCtx.currentTime);
        } else if (editorAudio) {
          editorAudio.volume = Math.min(1, val / 100);
        }
      });
    }

    const ambientLabels = {
      none: 'Sin música',
      bowls: 'Cuencos',
      stream: 'Arroyo Zen',
      om: 'Armónico OM'
    };

    document.querySelectorAll('[data-ambient]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ambient = btn.getAttribute('data-ambient');
        document.querySelectorAll('[data-ambient]').forEach(b => b.classList.toggle('active', b === btn));
        _audioSettings.ambient = ambient;
        const nameEl = document.getElementById('audio-bg-current-name');
        if (nameEl) nameEl.textContent = ambientLabels[ambient] || 'Sin música';

        const volContainer = document.getElementById('audio-bg-vol-container');
        if (volContainer) {
          volContainer.style.display = ambient === 'none' ? 'none' : 'block';
        }

        if (_audioIsPlaying) {
          if (ambient === 'none') {
            _stopAmbientSound();
          } else {
            _playAmbientSound(ambient, _audioSettings.ambientVol);
          }
        }
      });
    });

    const bgVolEl = document.getElementById('audio-param-bg-vol');
    if (bgVolEl) {
      bgVolEl.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        _audioSettings.ambientVol = val;
        const valEl = document.getElementById('val-audio-bg-vol');
        if (valEl) valEl.textContent = `${val}%`;
        if (_ambientGainNode && _audioCtx) {
          _ambientGainNode.gain.setValueAtTime((val / 100) * 0.28, _audioCtx.currentTime);
        }
      });
    }

    const eqLowEl = document.getElementById('audio-eq-low');
    const eqMidEl = document.getElementById('audio-eq-mid');
    const eqHighEl = document.getElementById('audio-eq-high');
    if (eqLowEl) {
      eqLowEl.addEventListener('input', (e) => {
        _audioSettings.eq.low = parseInt(e.target.value, 10);
        _applyEqGain();
      });
    }
    if (eqMidEl) {
      eqMidEl.addEventListener('input', (e) => {
        _audioSettings.eq.mid = parseInt(e.target.value, 10);
        _applyEqGain();
      });
    }
    if (eqHighEl) {
      eqHighEl.addEventListener('input', (e) => {
        _audioSettings.eq.high = parseInt(e.target.value, 10);
        _applyEqGain();
      });
    }

    document.querySelectorAll('[data-eqpreset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-eqpreset');
        document.querySelectorAll('[data-eqpreset]').forEach(b => b.classList.toggle('active', b === btn));
        _audioSettings.eq.preset = preset;
        if (preset === 'flat') {
          _audioSettings.eq.low = 0;
          _audioSettings.eq.mid = 0;
          _audioSettings.eq.high = 0;
        } else if (preset === 'voice') {
          _audioSettings.eq.low = 1;
          _audioSettings.eq.mid = 3;
          _audioSettings.eq.high = 2;
        } else if (preset === 'warm') {
          _audioSettings.eq.low = 3;
          _audioSettings.eq.mid = -1;
          _audioSettings.eq.high = -2;
        }
        _applyEqGain();
      });
    });

    // File picker: Imagen de Portada (Unificada)
    const thumbFileInput = document.getElementById('form-class-thumbnail-file');
    if (thumbFileInput) {
      thumbFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        _classThumbBlob = URL.createObjectURL(file);

        const thumbZone = document.getElementById('thumb-file-zone');
        const thumbCard = document.getElementById('thumb-unified-card');
        const thumbImg = document.getElementById('thumb-preview-img');
        const thumbName = document.getElementById('thumb-unified-name');

        if (thumbZone) thumbZone.style.display = 'none';
        if (thumbCard) thumbCard.style.display = 'flex';
        if (thumbImg) thumbImg.src = _classThumbBlob;
        if (thumbName) thumbName.textContent = file.name;
      });
    }

    const btnChangeThumb = document.getElementById('btn-change-thumb');
    if (btnChangeThumb) {
      btnChangeThumb.addEventListener('click', () => {
        if (thumbFileInput) thumbFileInput.click();
      });
    }

    const formClass = document.getElementById('admin-class-form');
    if (formClass) {
      formClass.addEventListener('submit', async (e) => {
        e.preventDefault();
        const classId = document.getElementById('form-class-id')?.value;
        const title = document.getElementById('form-class-title')?.value.trim();
        const planRequired = document.getElementById('form-class-plan')?.value || 'plan-esencia';
        const category = document.getElementById('form-class-category')?.value || 'suave';
        const description = document.getElementById('form-class-desc')?.value.trim() || '';

        // Media: blob local seleccionado o guardado previamente
        const mediaUrl = _classMediaBlob || '';
        const format = _classMediaFormat || 'video';

        // Thumbnail: blob local seleccionado o imagen por defecto
        const thumbnail = _classThumbBlob || 'assets/images/shala.jpg';

        if (!title) {
          showToast('Por favor escribe el título de la práctica', 'warning');
          return;
        }

        if (!mediaUrl) {
          showToast('Por favor selecciona un archivo de video o audio para la práctica', 'warning');
          return;
        }

        const categoryLabels = {
          suave: 'Yoga Suave', clasico: 'Yoga Clásico', terapeutico: 'Yoga Terapéutico',
          dinamico: 'Yoga Dinámico', ashtanga: 'Yoga Ashtanga', relax: 'Yoga Relax',
          meditacion: 'Meditación & Pranayama'
        };

        const calcDuration = _classMediaFormat === 'video' && _videoTrim.end > _videoTrim.start
          ? Math.max(1, Math.round((_videoTrim.end - _videoTrim.start) / 60))
          : 35;

        const classData = {
          id: classId || undefined,
          title,
          format,
          planRequired,
          category,
          categoryLabel: categoryLabels[category] || 'Práctica Holística',
          duration: calcDuration,
          videoUrl: mediaUrl,
          thumbnail,
          description,
          level: 'Todos los niveles',
          videoTrim: _classMediaFormat === 'video' ? _videoTrim : undefined,
          videoFilters: _classMediaFormat === 'video' ? _videoFilters : undefined,
          audioSettings: _classMediaFormat === 'audio' ? _audioSettings : undefined
        };

        try {
          const res = await AdminService.saveClass(classData);
          if (res && res.success) {
            showToast(classId ? 'Práctica actualizada exitosamente' : 'Nueva práctica subida y disponible para alumnas', 'success');
            _resetClassModal();
            if (modals.adminClass) closeModal(modals.adminClass);
            state.adminClassesCache = res.classes;
            renderAdminClassesTable();
            const badge = document.getElementById('tab-count-classes');
            if (badge) badge.textContent = res.classes.length;
            renderPlatformClasses();
          } else {
            showToast('No se pudo guardar la práctica', 'warning');
          }
        } catch (err) {
          showToast('Error al guardar la práctica', 'warning');
        }
      });
    }


    // 12. Event Delegation en la Tabla de Clases (Mobile First)
    const classTableBody = document.getElementById('admin-classes-table-body');
    if (classTableBody) {
      classTableBody.addEventListener('click', async (e) => {
        // A) Toggle flecha detalles
        const toggleBtn = e.target.closest('.btn-toggle-class-details');
        if (toggleBtn) {
          const classId = toggleBtn.getAttribute('data-class-id');
          const detailsRow = document.getElementById(`class-details-row-${classId}`);
          const mainRow = document.getElementById(`class-main-row-${classId}`);
          if (detailsRow) {
            const isHidden = detailsRow.style.display === 'none';
            detailsRow.style.display = isHidden ? 'table-row' : 'none';
            toggleBtn.classList.toggle('expanded', isHidden);
            if (mainRow) mainRow.classList.toggle('expanded', isHidden);
          }
          return;
        }

        // B) Probar práctica (reproducir como alumna)
        const previewBtn = e.target.closest('.btn-preview-class');
        if (previewBtn) {
          const classId = previewBtn.getAttribute('data-class-id');
          const classObj = getActiveClasses().find(c => c.id === classId);
          if (classObj) {
            openClassPlayer(classObj, 0);
          }
          return;
        }

        // C) Editar práctica
        const editBtn = e.target.closest('.btn-edit-class');
        if (editBtn) {
          const classId = editBtn.getAttribute('data-class-id');
          const classObj = (state.adminClassesCache || []).find(c => c.id === classId) || getActiveClasses().find(c => c.id === classId);
          if (classObj) {
            _resetClassModal();
            const heading = document.getElementById('modal-class-heading');
            if (heading) heading.textContent = 'Editar Práctica';
            const idInput = document.getElementById('form-class-id');
            if (idInput) idInput.value = classObj.id;
            const titleInput = document.getElementById('form-class-title');
            if (titleInput) titleInput.value = classObj.title || '';
            const planSelect = document.getElementById('form-class-plan');
            if (planSelect) planSelect.value = classObj.planRequired || 'plan-esencia';
            const catSelect = document.getElementById('form-class-category');
            if (catSelect) catSelect.value = classObj.category || 'suave';
            const descInput = document.getElementById('form-class-desc');
            if (descInput) descInput.value = classObj.description || '';

            // Formato y archivo existente
            _classMediaFormat = classObj.format || (classObj.category === 'meditacion' || classObj.category === 'relax' ? 'audio' : 'video');
            _classMediaBlob = classObj.videoUrl || '';
            _classMediaFileName = classObj.title || 'archivo';

            // Mostrar tarjeta de editor y ocultar dropzone inicial (Sin duplicados)
            const mediaZone = document.getElementById('media-file-zone');
            const mediaEditor = document.getElementById('media-editor-container');
            if (mediaZone) mediaZone.style.display = 'none';
            if (mediaEditor) mediaEditor.style.display = 'flex';

            const nameEl = document.getElementById('editor-file-name');
            const badgeEl = document.getElementById('editor-format-badge');
            const iconEl = document.getElementById('editor-format-icon');
            if (nameEl) nameEl.textContent = _classMediaFileName;
            if (badgeEl) badgeEl.textContent = _classMediaFormat === 'audio' ? 'Audio' : 'Video';
            if (iconEl) {
              iconEl.innerHTML = _classMediaFormat === 'audio'
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';
            }

            const videoPanel = document.getElementById('video-editor-panel');
            const audioPanel = document.getElementById('audio-editor-panel');

            if (_classMediaFormat === 'video') {
              if (audioPanel) audioPanel.style.display = 'none';
              if (videoPanel) videoPanel.style.display = 'flex';
              const vid = document.getElementById('editor-video-preview');
              if (vid && _classMediaBlob) {
                vid.src = _classMediaBlob;
                if (classObj.videoTrim) {
                  _videoTrim = { ...classObj.videoTrim };
                  _updateVideoTrimUI();
                } else {
                  vid.onloadedmetadata = () => {
                    const dur = Math.round(vid.duration) || 60;
                    _videoTrim = { start: 0, end: dur, duration: dur };
                    _updateVideoTrimUI();
                  };
                }
                if (classObj.videoFilters) {
                  _videoFilters = { ...classObj.videoFilters };
                  if (vBrightEl) vBrightEl.value = _videoFilters.brightness;
                  if (vContrastEl) vContrastEl.value = _videoFilters.contrast;
                  document.querySelectorAll('[data-vpreset]').forEach(b => b.classList.toggle('active', b.getAttribute('data-vpreset') === (_videoFilters.preset || 'normal')));
                  _applyVideoFilters();
                }
              }
            } else {
              if (videoPanel) videoPanel.style.display = 'none';
              if (audioPanel) audioPanel.style.display = 'flex';
              const aud = document.getElementById('editor-audio-element');
              if (aud && _classMediaBlob) {
                aud.src = _classMediaBlob;
                aud.onloadedmetadata = () => {
                  const tEl = document.getElementById('audio-editor-time');
                  if (tEl) tEl.textContent = `00:00 / ${_formatTime(aud.duration || 0)}`;
                };
              }
              if (classObj.audioSettings) {
                _audioSettings = { ...classObj.audioSettings };
                if (voiceVolEl) voiceVolEl.value = _audioSettings.voiceVol || 100;
                document.querySelectorAll('[data-ambient]').forEach(b => b.classList.toggle('active', b.getAttribute('data-ambient') === (_audioSettings.ambient || 'none')));
                const bgName = document.getElementById('audio-bg-current-name');
                if (bgName) bgName.textContent = ambientLabels[_audioSettings.ambient] || 'Sin música';
                const volContainer = document.getElementById('audio-bg-vol-container');
                if (volContainer) volContainer.style.display = _audioSettings.ambient === 'none' ? 'none' : 'block';
                if (bgVolEl) bgVolEl.value = _audioSettings.ambientVol || 30;
                _applyEqGain();
              }
            }

            // Mostrar thumbnail existente en tarjeta unificada (Sin duplicados)
            if (classObj.thumbnail) {
              _classThumbBlob = classObj.thumbnail;
              const thumbZone = document.getElementById('thumb-file-zone');
              const thumbCard = document.getElementById('thumb-unified-card');
              const thumbImg = document.getElementById('thumb-preview-img');
              const thumbName = document.getElementById('thumb-unified-name');
              if (thumbZone) thumbZone.style.display = 'none';
              if (thumbCard) thumbCard.style.display = 'flex';
              if (thumbImg) thumbImg.src = classObj.thumbnail;
              if (thumbName) thumbName.textContent = classObj.thumbnail.split('/').pop();
            }

            if (modals.adminClass) openModal(modals.adminClass);
          }
          return;
        }


        // D) Eliminar práctica
        const deleteBtn = e.target.closest('.btn-delete-class');
        if (deleteBtn) {
          const classId = deleteBtn.getAttribute('data-class-id');
          const classTitle = deleteBtn.getAttribute('data-class-title');
          if (confirm(`¿Estás segura de eliminar permanentemente la clase "${classTitle}" del Shala?`)) {
            try {
              const res = await AdminService.deleteClass(classId);
              if (res && res.success) {
                showToast(`Práctica "${classTitle}" eliminada`, 'info');
                state.adminClassesCache = res.classes;
                renderAdminClassesTable();
                const badge = document.getElementById('tab-count-classes');
                if (badge) badge.textContent = res.classes.length;
                renderPlatformClasses();
              }
            } catch (err) {
              showToast('Error al eliminar práctica', 'warning');
            }
          }
          return;
        }
      });
    }

    // 12. Gestión de Planes & Mercado Pago (Formulario y Sincronización)
    const adminPlansForm = document.getElementById('admin-plans-form');
    if (adminPlansForm) {
      adminPlansForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-admin-save-plans');
        const statusEl = document.getElementById('admin-plans-status-text');

        const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `
            <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="2" x2="12" y2="6"></line>
              <line x1="12" y1="18" x2="12" y2="22"></line>
            </svg>
            <span>Guardando en base de datos...</span>
          `;
        }

        const planKeys = ['plan-esencia', 'plan-refugio', 'plan-sadhana'];
        const updatedPlansPayload = {};

        planKeys.forEach(planId => {
          const card = document.querySelector(`.admin-plan-card[data-admin-plan-id="${planId}"]`);
          const pMonthly = Number(document.getElementById(`inp-price-monthly-${planId}`)?.value || 0);
          const pAnnual = Number(document.getElementById(`inp-price-annual-${planId}`)?.value || 0);
          const mpMonthly = document.getElementById(`inp-mp-monthly-${planId}`)?.value.trim() || 'https://www.mercadopago.com.ar';
          const mpAnnual = document.getElementById(`inp-mp-annual-${planId}`)?.value.trim() || mpMonthly;
          const desc = document.getElementById(`inp-desc-${planId}`)?.value.trim() || '';

          // Obtener los beneficios separados punto por punto desde los inputs individuales
          const featureInputs = card ? card.querySelectorAll('.plan-feature-input') : [];
          const features = Array.from(featureInputs)
            .map(inp => inp.value.trim())
            .filter(str => str.length > 0);

          const existing = (state.adminPlansCache && state.adminPlansCache[planId]) || PLANS_DATA.find(x => x.id === planId) || {};

          updatedPlansPayload[planId] = {
            ...existing,
            id: planId,
            priceMonthly: pMonthly,
            priceAnnualTotal: pAnnual,
            mercadopagoUrl: mpMonthly,
            mercadopagoUrlAnnual: mpAnnual,
            description: desc,
            features
          };
        });

        try {
          const saveRes = await AdminService.savePlans(updatedPlansPayload);
          if (saveRes && saveRes.success) {
            showToast('¡Planes y Mercado Pago guardados con éxito en la base de datos!', 'success', 5000);
            if (statusEl) {
              const now = new Date();
              statusEl.textContent = `Sincronizado con base de datos (${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} hs)`;
            }

            // Actualizar PLANS_DATA y DOM público inmediatamente sin recargar
            applyPlansToFrontend(Object.values(updatedPlansPayload));
            state.adminPlansCache = updatedPlansPayload;
          } else {
            showToast((saveRes && saveRes.message) || 'Error al guardar los planes en el servidor.', 'error');
          }
        } catch (err) {
          console.error('[AdminPlansSave]', err);
          showToast('Error de conexión al guardar los planes.', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml || `
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              <span>Guardar Configuración de Planes</span>
            `;
          }
        }
      });
    }

    // Botón "Ver Planes en Inicio"
    const btnPreviewLandingPlans = document.getElementById('btn-admin-preview-landing-plans');
    if (btnPreviewLandingPlans) {
      btnPreviewLandingPlans.addEventListener('click', () => {
        switchView('landing');
        const planesSection = document.getElementById('planes');
        if (planesSection) {
          planesSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  }

  /**
   * Carga y renderiza en vivo todas las métricas, cuentas y logs del panel
   */
  async function renderAdminDashboard() {
    const syncText = document.getElementById('admin-sync-text');
    if (syncText) syncText.textContent = 'Actualizando datos...';

    try {
      const [overviewRes, usersRes, classesRes] = await Promise.all([
        AdminService.getOverview(),
        AdminService.getUsers(),
        AdminService.getClasses()
      ]);

      if (overviewRes && overviewRes.success && overviewRes.stats) {
        const stats = overviewRes.stats;

        // KPI 1: Alumnas
        const kpiActiveUsers = document.getElementById('kpi-active-users');
        if (kpiActiveUsers) kpiActiveUsers.textContent = stats.activeUsers;

        const kpiTotalUsersSub = document.getElementById('kpi-total-users-sub');
        if (kpiTotalUsersSub) kpiTotalUsersSub.textContent = `de ${stats.totalUsers} registradas`;

        // KPI 2: MRR & ARR
        const kpiMrr = document.getElementById('kpi-mrr');
        if (kpiMrr) kpiMrr.textContent = `$ ${Number(stats.mrr).toLocaleString('es-AR')}`;

        const kpiArrSub = document.getElementById('kpi-arr-sub');
        if (kpiArrSub) kpiArrSub.textContent = `Proyección anual: $ ${Number(stats.arr).toLocaleString('es-AR')}`;

        // KPI 3: Horas y Minutos de Práctica
        const kpiTotalHours = document.getElementById('kpi-total-hours');
        const hrs = Math.floor(stats.totalPracticeMinutes / 60);
        const mins = stats.totalPracticeMinutes % 60;
        if (kpiTotalHours) kpiTotalHours.textContent = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

        const kpiTotalMinsSub = document.getElementById('kpi-total-mins-sub');
        if (kpiTotalMinsSub) kpiTotalMinsSub.textContent = `${stats.totalPracticeMinutes} min de yoga`;

        const kpiCompletedClassesSub = document.getElementById('kpi-completed-classes-sub');
        if (kpiCompletedClassesSub) kpiCompletedClassesSub.textContent = `${stats.totalCompletedClasses} clases`;

        // KPI 4: Facturación Histórica
        const kpiTotalRevenue = document.getElementById('kpi-total-revenue');
        if (kpiTotalRevenue) kpiTotalRevenue.textContent = `$ ${Number(stats.totalRevenue).toLocaleString('es-AR')}`;

        // Contadores en pestañas
        const tabCountUsers = document.getElementById('tab-count-users');
        if (tabCountUsers) tabCountUsers.textContent = stats.totalUsers;

        if (overviewRes.recentTransactions) {
          renderAdminTransactions(overviewRes.recentTransactions);
        }
      }

      if (usersRes && usersRes.success && usersRes.users) {
        state.adminUsersCache = usersRes.users;
        renderAdminUsersTable();
      }

      if (classesRes && classesRes.success && classesRes.classes) {
        state.adminClassesCache = classesRes.classes;
        const tabCountClasses = document.getElementById('tab-count-classes');
        if (tabCountClasses) tabCountClasses.textContent = classesRes.classes.length;
        if (state.adminActiveTab === 'tab-classes') {
          renderAdminClassesTable();
        }
      }

      if (state.adminActiveTab === 'tab-plans') {
        loadAndRenderAdminPlans();
      }

      if (syncText) syncText.textContent = 'Sincronizado con Base de Datos';
    } catch (err) {
      console.warn('[AdminDashboard] Error en renderizado:', err);
      if (syncText) syncText.textContent = 'Modo Resiliente Local';
    }
  }

  /**
   * Renderiza las filas de la tabla de alumnas con diseño ultra-compacto.
   * Solo muestra lo indispensable a simple vista: Nombre, Plan, Estado y botón "Más detalles".
   * Todos los datos secundarios y botones de acción se agrupan dentro de la fila expandible.
   */
  function renderAdminUsersTable() {
    const tableBody = document.getElementById('admin-users-table-body');
    if (!tableBody) return;

    let users = [...(state.adminUsersCache || [])];

    // Filtro por Estado (Todas / Activas / Pausadas)
    if (state.adminUserFilterStatus === 'active') {
      users = users.filter(u => u.active);
    } else if (state.adminUserFilterStatus === 'paused') {
      users = users.filter(u => !u.active);
    }

    // Filtro por Búsqueda (Nombre, Email, Código)
    if (state.adminUserSearchQuery) {
      const q = state.adminUserSearchQuery;
      users = users.filter(u =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.accessCode && u.accessCode.toLowerCase().includes(q))
      );
    }

    if (users.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
            No se encontraron alumnas que coincidan con la búsqueda o filtro aplicado.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = users.map(user => {
      const planClass = (user.planId === 'plan-santuario') ? 'plan-refugio' : (user.planId || 'plan-refugio');
      const rawPlan = user.planName || (user.planId === 'plan-esencia' ? 'Esencia' : user.planId === 'plan-sadhana' ? 'Sadhana' : 'Refugio');
      const planLabel = escapeHtml(rawPlan.replace(/^plan\s+/i, '').toUpperCase());
      const billingType = user.isAnnual ? 'Anual' : 'Mensual';
      const billingAmount = `$${user.billedAmount || 29}`;

      return `
        <tr id="main-row-${user.id}" class="admin-user-row">
          <td class="col-user-name">
            <span class="user-clean-name">${escapeHtml(user.name)}</span>
          </td>
          <td class="col-user-plan">
            <span class="plan-badge ${planClass}">${planLabel}</span>
          </td>
          <td class="col-user-status">
            <span class="status-badge ${user.active ? 'active' : 'paused'}">
              <span class="status-dot"></span>
              ${user.active ? 'Activa' : 'Pausada'}
            </span>
          </td>
          <td class="col-user-action" style="text-align: center;">
            <button type="button" class="btn-toggle-user-details btn-arrow-only" data-user-id="${user.id}" aria-label="Ver detalles" title="Detalles">
              <svg class="arrow-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </td>
        </tr>
        <tr id="details-row-${user.id}" class="admin-user-details-row" style="display: none;">
          <td colspan="4" style="padding: 0 0.5rem 0.5rem 0.5rem !important;">
            <div class="user-expanded-card-simplified">
              <div class="quick-details-grid">
                <div class="quick-detail-item">
                  <span class="qd-label">Email:</span>
                  <span class="qd-val">${escapeHtml(user.email)}</span>
                </div>
                <div class="quick-detail-item">
                  <span class="qd-label">Código:</span>
                  <button type="button" class="code-copy-btn-mini" data-code="${escapeHtml(user.accessCode)}" title="Copiar código">
                    <span>${escapeHtml(user.accessCode)}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
                <div class="quick-detail-item">
                  <span class="qd-label">Práctica:</span>
                  <span class="qd-val">${user.streakDays || 0}d racha • ${user.completedCount || 0} clases (${user.totalMinutes || 0}m)</span>
                </div>
                <div class="quick-detail-item">
                  <span class="qd-label">Cobro:</span>
                  <span class="qd-val">${billingAmount}/${user.isAnnual ? 'año' : 'mes'} • Próx: ${escapeHtml(user.nextBillingDate || '28 Oct')}</span>
                </div>
              </div>
              <div class="quick-actions-row">
                <button type="button" class="mini-btn btn-pause-toggle" data-user-id="${user.id}" data-active="${user.active}">
                  ${user.active ? 'Pausar' : 'Activar'}
                </button>
                <button type="button" class="mini-btn btn-edit-plan" data-user-id="${user.id}" data-user-name="${escapeHtml(user.name)}" data-plan-id="${user.planId}">
                  Plan
                </button>
                <button type="button" class="mini-btn btn-login-as" data-user-email="${escapeHtml(user.email)}" data-user-name="${escapeHtml(user.name)}" title="Ingresar como esta alumna">
                  Entrar
                </button>
                <button type="button" class="mini-btn btn-delete-user danger" data-user-id="${user.id}" data-user-name="${escapeHtml(user.name)}" title="Eliminar alumna">
                  Eliminar
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Renderiza el historial de transacciones y cobros con KPIs, búsqueda y recibos imprimibles
   */
  function renderAdminTransactions(transactions, searchQuery, planFilter) {
    const txBody = document.getElementById('admin-transactions-table-body');
    if (!txBody) return;

    // Guardar cache para filtros reactivos
    if (transactions) state.adminTxCache = transactions;
    const allTx = state.adminTxCache || [];

    // Actualizar KPIs con el total (sin filtrar)
    _updateTxKpis(allTx);

    // Aplicar filtros
    const q = (searchQuery || state.adminTxSearchQuery || '').toLowerCase();
    const plan = planFilter || state.adminTxPlanFilter || 'all';

    let filtered = allTx.filter(tx => {
      const nameMatch = !q || (tx.name || tx.email || '').toLowerCase().includes(q) || (tx.email || '').toLowerCase().includes(q);
      const planMatch = plan === 'all' || tx.planId === plan;
      return nameMatch && planMatch;
    });

    if (filtered.length === 0) {
      txBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No hay cobros que coincidan con la búsqueda.
          </td>
        </tr>
      `;
      return;
    }

    txBody.innerHTML = filtered.map(tx => {
      const planClass = (tx.planId === 'plan-santuario') ? 'plan-refugio' : (tx.planId || 'plan-refugio');
      const rawPlan = tx.planName || (tx.planId === 'plan-esencia' ? 'Esencia' : tx.planId === 'plan-sadhana' ? 'Sadhana' : 'Refugio');
      const planLabel = escapeHtml(rawPlan.replace(/^plan\s+/i, '').toUpperCase());
      const txId = tx.id || String(Math.random()).substring(2);

      // Obtener nombre real de la alumna (de tx.name o de adminUsersCache o formateado de email)
      let studentName = tx.name;
      if (!studentName && tx.email) {
        const found = (state.adminUsersCache || []).find(u => (u.email || '').toLowerCase() === tx.email.toLowerCase());
        if (found && found.name) {
          studentName = found.name;
        } else {
          const prefix = tx.email.split('@')[0];
          studentName = prefix.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
      }
      const displayName = escapeHtml(studentName || 'Alumna');
      const displayEmail = escapeHtml(tx.email || '');

      return `
        <tr id="tx-main-row-${txId}" class="admin-user-row" data-tx-id="${txId}">
          <td class="col-user-name" style="width: 36%;">
            <span class="user-clean-name" title="${displayName} (${displayEmail})">${displayName}</span>
          </td>
          <td class="col-user-plan" style="width: 22%; text-align: center;">
            <span class="plan-badge ${planClass}">${planLabel}</span>
          </td>
          <td class="col-tx-amount" style="width: 18%; text-align: center; white-space: nowrap;">
            <strong class="tx-amount-number">$ ${Number(tx.amount || 0).toLocaleString('es-AR')}</strong>
            <span class="tx-amount-freq">${tx.isAnnual ? '/año' : '/mes'}</span>
          </td>
          <td class="col-user-action" style="width: 24%; text-align: center;">
            <button type="button" class="btn-print-tx-receipt" data-tx-id="${txId}" title="Imprimir comprobante">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              <span>Recibo</span>
            </button>
          </td>
        </tr>
        <tr id="tx-details-row-${txId}" class="admin-user-details-row" style="display: none;">
          <td colspan="4" style="padding: 0 0.5rem 0.5rem 0.5rem !important;">
            <div class="user-expanded-card-simplified">
              <div class="quick-details-grid">
                <div class="quick-detail-item">
                  <span class="qd-label">Recibo N°:</span>
                  <code class="receipt-code-pill">${escapeHtml(tx.receiptNumber || txId)}</code>
                </div>
                <div class="quick-detail-item">
                  <span class="qd-label">Fecha:</span>
                  <span class="qd-val">${formatAuditTime(tx.timestamp)}</span>
                </div>
                <div class="quick-detail-item">
                  <span class="qd-label">Email:</span>
                  <span class="qd-val" style="word-break: break-all;">${displayEmail}</span>
                </div>
                <div class="quick-detail-item">
                  <span class="qd-label">Medio:</span>
                  <span class="qd-val">${escapeHtml(tx.paymentMethod || 'Tarjeta')}</span>
                </div>
              </div>
              <div class="quick-actions-row">
                <button type="button" class="mini-btn btn-print-tx-receipt" data-tx-id="${txId}" style="display:inline-flex; align-items:center; gap:0.4rem;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                  Imprimir Comprobante Oficial
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /** Actualiza los 3 KPI cards de Cobros */
  function _updateTxKpis(transactions) {
    const kpiTotal = document.getElementById('tx-kpi-total-amount');
    const kpiCount = document.getElementById('tx-kpi-count');
    const kpiMonthly = document.getElementById('tx-kpi-monthly');
    if (!kpiTotal || !kpiCount || !kpiMonthly) return;

    const total = transactions.reduce((s, tx) => s + Number(tx.amount || 0), 0);
    const count = transactions.length;

    const now = new Date();
    const thisMonth = transactions
      .filter(tx => {
        if (!tx.timestamp) return false;
        const d = new Date(tx.timestamp);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((s, tx) => s + Number(tx.amount || 0), 0);

    kpiTotal.textContent = `$ ${Math.round(total).toLocaleString('es-AR')}`;
    kpiCount.textContent = count;
    kpiMonthly.textContent = `$ ${Math.round(thisMonth).toLocaleString('es-AR')}`;
  }

  /** Abre una ventana de impresión con el recibo de un cobro específico */
  function printTxReceipt(tx) {
    if (!tx) return;
    const planLabel = (tx.planName || (tx.planId === 'plan-esencia' ? 'Plan Esencia' : tx.planId === 'plan-sadhana' ? 'Plan Sadhana' : 'Plan Refugio'));
    const amount = `$ ${Number(tx.amount || 0).toLocaleString('es-AR')} ARS`;
    const period = tx.isAnnual ? 'Anual' : 'Mensual';
    const method = tx.paymentMethod === 'mercadopago' ? 'MercadoPago' : 'Tarjeta Débito/Crédito';
    const dateStr = tx.timestamp ? new Date(tx.timestamp).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/D';
    const receiptNum = tx.receiptNumber || tx.id || 'N/D';
    const alumna = tx.name || tx.email || 'Alumna';
    const email = tx.email || '';

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <title>Recibo Namasté — ${escapeHtml(alumna)}</title>
      <style>
        body { font-family: Georgia, serif; color: #2d2522; max-width: 520px; margin: 2rem auto; padding: 2rem; }
        h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
        .sub { font-size: 0.85rem; color: #7a6a61; margin-bottom: 1.5rem; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
        td { padding: 0.45rem 0; border-bottom: 1px solid #e8e0d8; font-size: 0.92rem; }
        td:first-child { color: #7a6a61; width: 40%; }
        td:last-child { font-weight: 600; }
        .total-row td { font-size: 1.2rem; color: #c0714a; border-bottom: none; padding-top: 1rem; }
        .badge { display: inline-block; background: #fdf0e8; color: #c0714a; border-radius: 4px; padding: 2px 8px; font-size: 0.8rem; font-weight: 700; }
        .footer { font-size: 0.78rem; color: #a89585; margin-top: 2rem; border-top: 1px dashed #e0d6cc; padding-top: 1rem; text-align: center; }
        @media print { body { margin: 0; padding: 1rem; } }
      </style>
    </head><body>
      <h1><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: -3px; margin-right: 6px; color: #c0714a;" aria-hidden="true"><path d="M12 2C11 5 7 8 4 9c3 3 7 4 8 11 1-7 5-8 8-11-3-1-7-4-8-7z"/></svg>Namasté Escuela de Yoga</h1>
      <div class="sub">Refugio Consciente Online — Recibo de Pago</div>
      <table>
        <tr><td>N° Recibo</td><td><code>${escapeHtml(receiptNum)}</code></td></tr>
        <tr><td>Fecha</td><td>${escapeHtml(dateStr)}</td></tr>
        <tr><td>Alumna</td><td>${escapeHtml(alumna)}</td></tr>
        ${email ? `<tr><td>Email</td><td>${escapeHtml(email)}</td></tr>` : ''}
        <tr><td>Plan</td><td><span class="badge">${escapeHtml(planLabel)}</span></td></tr>
        <tr><td>Período</td><td>${escapeHtml(period)}</td></tr>
        <tr><td>Método de pago</td><td>${escapeHtml(method)}</td></tr>
        <tr class="total-row"><td>Total cobrado</td><td>${escapeHtml(amount)}</td></tr>
      </table>
      <div class="footer">Namasté — ${new Date().getFullYear()} · Este recibo es válido como comprobante de pago.</div>
      <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=600,height=750');
    if (w) { w.document.write(html); w.document.close(); }
  }

  /**
   * Renderiza la tabla de clases con diseño ultra-compacto y mobile first.
   * 4 Columnas sin scroll horizontal: Clase (44%), Formato (24%), Plan (22%), Flecha (10%).
   * Al pulsar la flecha se despliegan detalles, URL, duración y botones Probar / Editar / Eliminar.
   */
  function renderAdminClassesTable() {
    const tableBody = document.getElementById('admin-classes-table-body');
    if (!tableBody) return;

    let classes = [...(state.adminClassesCache && state.adminClassesCache.length > 0 ? state.adminClassesCache : getActiveClasses())];

    // Filtro por Formato (Todas / Video / Audio)
    if (state.adminClassFilterFormat === 'video') {
      classes = classes.filter(c => c.format === 'video' || (!c.format && c.category !== 'meditacion' && c.category !== 'relax'));
    } else if (state.adminClassFilterFormat === 'audio') {
      classes = classes.filter(c => c.format === 'audio' || (!c.format && (c.category === 'meditacion' || c.category === 'relax')));
    }

    // Filtro por Búsqueda (Título, Categoría)
    if (state.adminClassSearchQuery) {
      const q = state.adminClassSearchQuery;
      classes = classes.filter(c =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.categoryLabel && c.categoryLabel.toLowerCase().includes(q))
      );
    }

    if (classes.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
            No se encontraron clases con el filtro o búsqueda actual.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = classes.map(c => {
      const isAudio = c.format === 'audio' || (!c.format && (c.category === 'meditacion' || c.category === 'relax'));
      const planReq = c.planRequired || (c.category === 'dinamico' || c.category === 'ashtanga' ? 'plan-sadhana' : (c.category === 'suave' ? 'plan-esencia' : 'plan-refugio'));
      const planLabel = planReq === 'plan-sadhana' ? 'SADHANA' : (planReq === 'plan-esencia' ? 'ESENCIA' : 'REFUGIO');
      const planClass = planReq;

      return `
        <tr id="class-main-row-${c.id}" class="admin-user-row">
          <td class="col-user-name" style="width: 44%;">
            <span class="user-clean-name" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</span>
          </td>
          <td style="width: 24%; text-align: center;">
            <span class="format-badge ${isAudio ? 'audio' : 'video'}">
              ${isAudio
                ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>Audio'
                : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>Video'
              }
            </span>
          </td>
          <td style="width: 22%; text-align: center;">
            <span class="plan-badge ${planClass}">${planLabel}</span>
          </td>
          <td style="width: 10%; text-align: center;">
            <button type="button" class="btn-toggle-class-details btn-arrow-only" data-class-id="${c.id}" aria-label="Ver detalles" title="Detalles">
              <svg class="arrow-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </td>
        </tr>
        <tr id="class-details-row-${c.id}" class="admin-user-details-row" style="display: none;">
          <td colspan="4" style="padding: 0 0.5rem 0.5rem 0.5rem !important;">
            <div class="user-expanded-card-simplified">
              <div class="quick-details-grid">
                <div class="quick-detail-item">
                  <span class="qd-label">Duración:</span>
                  <span class="qd-val">${c.duration} min • ${escapeHtml(c.categoryLabel || c.category)}</span>
                </div>
                <div class="quick-detail-item">
                  <span class="qd-label">Portada:</span>
                  <span class="qd-val" title="${escapeHtml(c.thumbnail || '')}">${escapeHtml((c.thumbnail || '').split('/').pop())}</span>
                </div>
                ${c.description ? `
                <div class="quick-detail-item" style="grid-column: 1 / -1;">
                  <span class="qd-label">Detalle:</span>
                  <span class="qd-val" style="white-space: normal;">${escapeHtml(c.description)}</span>
                </div>` : ''}
              </div>
              <div class="quick-actions-row">
                <button type="button" class="mini-btn btn-preview-class" data-class-id="${c.id}" title="Reproducir como alumna">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: 0; margin-right: 3px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>Probar
                </button>
                <button type="button" class="mini-btn btn-edit-class" data-class-id="${c.id}" title="Editar práctica">
                  Editar
                </button>
                <button type="button" class="mini-btn btn-delete-class danger" data-class-id="${c.id}" data-class-title="${escapeHtml(c.title)}" title="Eliminar práctica">
                  Eliminar
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function formatAuditTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Hace instantes';
    if (diffSec < 3600) return `Hace ${Math.floor(diffSec / 60)} min`;
    if (diffSec < 86400) return `Hace ${Math.floor(diffSec / 3600)} h`;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins} hs`;
  }

  // ========================================================================
  // SINCRONIZACIÓN EN TIEMPO REAL: PLANES & MERCADO PAGO
  // ========================================================================

  /**
   * Sincroniza los planes desde la API pública (/api/plans) conectada a la base de datos
   */
  async function syncPublicPlansFromDatabase() {
    try {
      const res = await fetch('/api/plans');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.plans) && data.plans.length > 0) {
          applyPlansToFrontend(data.plans);
        }
      }
    } catch (err) {
      console.warn('[PlansSync] Usando datos locales de planes:', err);
    }
  }

  /**
   * Aplica la lista de planes a la landing page pública y al catálogo en memoria
   */
  function applyPlansToFrontend(plansList) {
    if (!Array.isArray(plansList)) return;

    plansList.forEach(serverPlan => {
      // 1. Actualizar catálogo global PLANS_DATA en memoria
      const localPlan = PLANS_DATA.find(p => p.id === serverPlan.id);
      if (localPlan) {
        Object.assign(localPlan, serverPlan);
      }

      // 2. Actualizar tarjetas del DOM en sección #planes
      const card = document.querySelector(`.pricing-card[data-plan="${serverPlan.id}"]`);
      if (card) {
        const amountEl = card.querySelector('.pricing-amount');
        const subnoteEl = card.querySelector('.pricing-subnote');
        const descEl = card.querySelector('.pricing-desc');
        const titleEl = card.querySelector('.pricing-plan-name');

        const monthly = Number(serverPlan.priceMonthly);
        const annualTotal = Number(serverPlan.priceAnnualTotal);
        const annualMonthly = Math.round(annualTotal / 12);

        const monthlyFormatted = monthly.toLocaleString('es-AR');
        const annualMonthlyFormatted = annualMonthly.toLocaleString('es-AR');
        const annualTotalFormatted = annualTotal.toLocaleString('es-AR');

        if (titleEl && serverPlan.name) titleEl.textContent = serverPlan.name;
        if (descEl && serverPlan.description) descEl.textContent = serverPlan.description;

        if (amountEl) {
          amountEl.setAttribute('data-price-monthly', monthlyFormatted);
          amountEl.setAttribute('data-price-annual', annualMonthlyFormatted);
          if (state.selectedBillingCycle === 'annual') {
            amountEl.textContent = annualMonthlyFormatted;
          } else {
            amountEl.textContent = monthlyFormatted;
          }
        }

        if (subnoteEl) {
          subnoteEl.setAttribute('data-note-monthly', '');
          subnoteEl.setAttribute('data-note-annual', `$ ${annualTotalFormatted} ARS/año • ¡2 meses de regalo!`);
          if (state.selectedBillingCycle === 'annual') {
            subnoteEl.textContent = `$ ${annualTotalFormatted} ARS/año • ¡2 meses de regalo!`;
            subnoteEl.style.display = 'inline-block';
          } else {
            subnoteEl.textContent = '';
            subnoteEl.style.display = 'none';
          }
        }

        // Actualizar lista de beneficios si viene especificada
        if (Array.isArray(serverPlan.features) && serverPlan.features.length > 0) {
          const featListEl = card.querySelector('.pricing-features-list');
          if (featListEl) {
            featListEl.innerHTML = serverPlan.features.map(f => `
              <li class="pricing-feature-item">
                <svg class="feature-check" width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>${escapeHtml(f)}</span>
              </li>
            `).join('');
          }
        }
      }
    });
  }

  /**
   * Carga los planes de la administración y renderiza las tarjetas de edición
   */
  async function loadAndRenderAdminPlans() {
    const grid = document.getElementById('admin-plans-grid');
    if (!grid) return;

    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1rem; color: #7A6C62;">
        <svg class="spin-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; margin-bottom: 0.5rem;">
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        </svg>
        <p style="margin: 0; font-size: 0.9rem; font-weight: 500;">Conectando con base de datos de planes...</p>
      </div>
    `;

    try {
      const res = await AdminService.getPlans();
      let plansMap = {};
      if (res && res.success && res.plans) {
        if (Array.isArray(res.plans)) {
          res.plans.forEach(p => { plansMap[p.id] = p; });
        } else {
          plansMap = res.plans;
        }
      } else {
        PLANS_DATA.forEach(p => { plansMap[p.id] = p; });
      }

      state.adminPlansCache = plansMap;
      renderAdminPlansCards(plansMap);
    } catch (err) {
      console.error('[AdminPlans] Error al cargar:', err);
      const fallbackMap = {};
      PLANS_DATA.forEach(p => { fallbackMap[p.id] = p; });
      renderAdminPlansCards(fallbackMap);
    }
  }

  /**
   * Renderiza las 3 tarjetas de configuración de planes en el panel de administración
   * Formato horizontal slide (1 / 2 / 3) y beneficios punto por punto separados
   */
  function renderAdminPlansCards(plansMap) {
    const grid = document.getElementById('admin-plans-grid');
    if (!grid) return;

    const planKeys = [
      { id: 'plan-esencia', num: 1, fallbackBadge: 'Inicial', fallbackMonthly: 19000 },
      { id: 'plan-refugio', num: 2, fallbackBadge: 'Más Elegido', fallbackMonthly: 29000 },
      { id: 'plan-sadhana', num: 3, fallbackBadge: 'Premium', fallbackMonthly: 39000 }
    ];

    grid.innerHTML = planKeys.map(({ id: planId, num, fallbackBadge, fallbackMonthly }) => {
      const p = plansMap[planId] || PLANS_DATA.find(x => x.id === planId) || {};
      const isRec = p.recommended || planId === 'plan-refugio';
      const badgeText = p.badge || fallbackBadge;
      const monthly = p.priceMonthly || fallbackMonthly;
      const annualTotal = p.priceAnnualTotal || (monthly * 10);
      const mpMonthly = p.mercadopagoUrl || 'https://www.mercadopago.com.ar';
      const mpAnnual = p.mercadopagoUrlAnnual || mpMonthly;
      const desc = p.description || '';
      const featuresArr = Array.isArray(p.features) && p.features.length > 0 
        ? p.features 
        : ['Acceso ilimitado a clases', 'Comunidad en vivo'];

      const featuresRowsHtml = featuresArr.map(feat => `
        <div class="admin-feature-point-row">
          <span class="feature-bullet-check">✓</span>
          <input type="text" class="plan-feature-input" value="${escapeHtml(feat)}" placeholder="Ej: Clases ilimitadas en vivo" required />
          <button type="button" class="btn-remove-feature-point" title="Eliminar este beneficio" aria-label="Eliminar punto">&times;</button>
        </div>
      `).join('');

      return `
        <div class="admin-plan-card ${isRec ? 'recommended' : ''}" data-admin-plan-id="${p.id || planId}">
          <div class="admin-plan-card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="admin-plan-step-num">${num}</span>
              <h3 class="admin-plan-name-tag">${escapeHtml(p.name || planId)}</h3>
            </div>
            <span class="admin-plan-badge-pill ${isRec ? 'popular' : ''}">${escapeHtml(badgeText)}</span>
          </div>

          <!-- Precios Mensual & Anual Total en ARS -->
          <div class="admin-plan-price-row">
            <div class="admin-plan-field">
              <label>PRECIO MENSUAL <span class="field-hint">(ARS)</span></label>
              <div class="admin-price-input-wrap">
                <span class="admin-price-prefix">$</span>
                <input type="number" min="100" max="9999999" step="100" required 
                  id="inp-price-monthly-${planId}" 
                  name="priceMonthly" 
                  value="${monthly}" 
                  data-plan-id="${planId}" />
              </div>
            </div>

            <div class="admin-plan-field">
              <label>PRECIO ANUAL <span class="field-hint">(ARS)</span></label>
              <div class="admin-price-input-wrap">
                <span class="admin-price-prefix">$</span>
                <input type="number" min="1000" max="99999999" step="1000" required 
                  id="inp-price-annual-${planId}" 
                  name="priceAnnualTotal" 
                  value="${annualTotal}" 
                  data-plan-id="${planId}" />
              </div>
            </div>
          </div>

          <!-- Enlace Mercado Pago Mensual -->
          <div class="admin-plan-field">
            <label>ENLACE MENSUAL <span class="field-hint">(Mercado Pago)</span></label>
            <div class="admin-mp-input-wrap">
              <input type="url" required 
                id="inp-mp-monthly-${planId}" 
                name="mercadopagoUrl" 
                placeholder="https://mpago.la/... o mercadopago.com" 
                value="${escapeHtml(mpMonthly)}" 
                data-plan-id="${planId}" />
              <button type="button" class="admin-btn-test-link btn-test-mp-link" data-input-target="inp-mp-monthly-${planId}" title="Abrir enlace mensual en nueva pestaña">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                Probar
              </button>
            </div>
          </div>

          <!-- Enlace Mercado Pago Anual -->
          <div class="admin-plan-field">
            <label>ENLACE ANUAL <span class="field-hint">(Mercado Pago)</span></label>
            <div class="admin-mp-input-wrap">
              <input type="url" required 
                id="inp-mp-annual-${planId}" 
                name="mercadopagoUrlAnnual" 
                placeholder="https://mpago.la/... o mercadopago.com" 
                value="${escapeHtml(mpAnnual)}" 
                data-plan-id="${planId}" />
              <button type="button" class="admin-btn-test-link btn-test-mp-link" data-input-target="inp-mp-annual-${planId}" title="Abrir enlace anual en nueva pestaña">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                Probar
              </button>
            </div>
          </div>

          <!-- Descripción Breve -->
          <div class="admin-plan-field">
            <label>DESCRIPCIÓN BREVE</label>
            <input type="text" name="description" id="inp-desc-${planId}" value="${escapeHtml(desc)}" placeholder="Resumen conciso del plan" data-plan-id="${planId}" />
          </div>

          <!-- Beneficios Separados Punto por Punto -->
          <div class="admin-plan-field">
            <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 0.15rem;">
              <label style="margin: 0;">BENEFICIOS <span class="field-hint">(Puntos individuales)</span></label>
              <button type="button" class="btn-add-feature-point" data-plan-id="${planId}">+ Agregar punto</button>
            </div>
            <div class="admin-features-list-points" id="features-list-${planId}">
              ${featuresRowsHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Conectar botones de prueba de links
    grid.querySelectorAll('.btn-test-mp-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-input-target');
        const input = document.getElementById(targetId);
        if (input && input.value) {
          let url = input.value.trim();
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }
          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          showToast('Por favor, ingresa primero una URL para probar el enlace.', 'warning');
        }
      });
    });

    // Conectar botón "+ Agregar punto" para cada plan
    grid.querySelectorAll('.btn-add-feature-point').forEach(addBtn => {
      addBtn.addEventListener('click', () => {
        const planId = addBtn.getAttribute('data-plan-id');
        const listContainer = document.getElementById(`features-list-${planId}`);
        if (!listContainer) return;

        const newRow = document.createElement('div');
        newRow.className = 'admin-feature-point-row';
        newRow.innerHTML = `
          <span class="feature-bullet-check">✓</span>
          <input type="text" class="plan-feature-input" value="" placeholder="Nuevo beneficio..." required />
          <button type="button" class="btn-remove-feature-point" title="Eliminar este beneficio" aria-label="Eliminar punto">&times;</button>
        `;
        listContainer.appendChild(newRow);

        const newInp = newRow.querySelector('.plan-feature-input');
        if (newInp) newInp.focus();
      });
    });

    // Delegación de eventos para eliminar puntos (botones &times;)
    grid.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.btn-remove-feature-point');
      if (removeBtn) {
        const row = removeBtn.closest('.admin-feature-point-row');
        const container = removeBtn.closest('.admin-features-list-points');
        if (row && container) {
          // Mantener al menos 1 punto
          if (container.querySelectorAll('.admin-feature-point-row').length > 1) {
            row.remove();
          } else {
            showToast('El plan debe tener al menos un beneficio.', 'warning');
          }
        }
      }
    });

    // Conectar atajos rápidos 1 / 2 / 3 de la barra superior
    setupAdminPlansSwitcher(grid);
  }

  /**
   * Atajo rápido para alternar entre los planes 1 / 2 / 3
   */
  function setupAdminPlansSwitcher(grid) {
    const pills = document.querySelectorAll('.admin-plan-switch-pill');
    if (!pills.length) return;

    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        const targetPlanId = pill.getAttribute('data-target-plan');
        const targetCard = grid.querySelector(`.admin-plan-card[data-admin-plan-id="${targetPlanId}"]`);

        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          targetCard.style.transition = 'outline 0.2s ease, box-shadow 0.2s ease';
          targetCard.style.outline = '2px solid var(--terracotta, #B65E42)';
          setTimeout(() => {
            targetCard.style.outline = 'none';
          }, 1200);
        }
      });
    });

    // Sincronizar pill activa si el usuario scrollea horizontalmente
    grid.addEventListener('scroll', () => {
      const cards = grid.querySelectorAll('.admin-plan-card');
      const gridRect = grid.getBoundingClientRect();
      const gridCenter = gridRect.left + gridRect.width / 2;

      let closestPlanId = null;
      let minDistance = Infinity;

      cards.forEach(card => {
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const dist = Math.abs(cardCenter - gridCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestPlanId = card.getAttribute('data-admin-plan-id');
        }
      });

      if (closestPlanId) {
        pills.forEach(pill => {
          if (pill.getAttribute('data-target-plan') === closestPlanId) {
            pill.classList.add('active');
          } else {
            pill.classList.remove('active');
          }
        });
      }
    }, { passive: true });
  }

  // Arrancar aplicación
  init();
});
