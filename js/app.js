/**
 * NAMASTÉ - Controlador Principal de la Aplicación & Santuario Virtual
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Estado Global ---
  const state = {
    currentView: 'landing', // 'landing' | 'platform'
    selectedPlanForCheckout: null,
    activeCategoryFilter: 'all',
    activeDurationFilter: 'all',
    activeLevelFilter: 'all',
    searchQuery: '',
    onlyFavorites: false,
    onlyNew: false,
    activePlayingClass: null
  };

  // --- Elementos del DOM ---
  const views = {
    landing: document.getElementById('view-landing'),
    platform: document.getElementById('view-platform')
  };

  const modals = {
    login: document.getElementById('modal-login'),
    checkout: document.getElementById('modal-checkout'),
    player: document.getElementById('modal-player'),
    profileDrawer: document.getElementById('profile-drawer-backdrop'),
    liveSession: document.getElementById('modal-live-session'),
    changePlan: document.getElementById('modal-change-plan'),
    progressDetails: document.getElementById('modal-progress-details'),
    receipt: document.getElementById('modal-receipt')
  };

  // Helper para generar iniciales del alumno
  function getUserInitials(name) {
    if (!name) return 'SV';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Sistema de Notificaciones Toast serenas
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `namaste-toast namaste-toast-${type}`;
    toast.innerHTML = `
      <svg class="namaste-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Citas diarias inspiracionales de yoga y presencia
  const DAILY_QUOTES = [
    "«El yoga no se trata de tocarte los dedos de los pies, sino de lo que aprendes en el camino hacia abajo.»",
    "«La quietud no es la ausencia de movimiento, sino el perfecto equilibrio en el centro.»",
    "«Respira y recuerda que este instante es el único lugar donde la vida sucede.»",
    "«Tu práctica es un santuario personal de regreso a casa, a tu cuerpo y a tu paz.»"
  ];

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

    // Si ya existe sesión activa previa, podemos ofrecer ingresar directo o inicializar estado
    const currentUser = AuthService.getCurrentUser();
    if (currentUser) {
      updateNavForLoggedInUser(currentUser);
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
   * Configura la Cita del Día con rotación automática cada 24 horas
   * Se muestra tanto en la landing como en la parte superior del panel del alumno
   */
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
  }

  // ========================================================================
  // NAVEGACIÓN Y VISTAS
  // ========================================================================
  function switchView(viewName) {
    state.currentView = viewName;

    if (viewName === 'platform') {
      const user = AuthService.getCurrentUser();
      if (!user) {
        openModal(modals.login);
        return;
      }
      views.landing.style.display = 'none';
      views.platform.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      renderPlatformDashboard();
    } else {
      views.platform.style.display = 'none';
      views.landing.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateMobileNavState();
  }

  function setupNavigation() {
    // Botón de Acceso Alumnos en Header y enlaces de login
    document.querySelectorAll('.btn-access-login').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const user = AuthService.getCurrentUser();
        if (user) {
          switchView('platform');
        } else {
          openModal(modals.login);
        }
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
            const user = AuthService.getCurrentUser();
            if (user) {
              switchView('platform');
            } else {
              openModal(modals.login);
            }
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
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('active');
    document.body.style.overflow = '';
  }

  function setupModals() {
    // Cerrar modales con clic en backdrop o botón .modal-close-btn
    document.querySelectorAll('.modal-backdrop, .profile-drawer-backdrop, .player-modal-backdrop').forEach(backdrop => {
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
        const modal = btn.closest('.modal-backdrop, .profile-drawer-backdrop, .player-modal-backdrop');
        if (modal) {
          closeModal(modal);
          if (modal === modals.player) {
            pauseActiveVideo();
          }
        }
      });
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
    const feedback = document.getElementById('login-feedback');
    const demoBtn = document.getElementById('btn-use-demo-code');

    if (input) {
      input.addEventListener('input', () => {
        feedback.style.display = 'none';
      });
    }

    if (demoBtn && input) {
      demoBtn.addEventListener('click', () => {
        input.value = 'sofia.varela@ejemplo.com';
        feedback.style.display = 'none';
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const identifier = input.value;
        const result = AuthService.login(identifier);

        if (result.success) {
          feedback.className = 'modal-feedback success';
          feedback.textContent = `¡Bienvenido/a de regreso, ${result.user.name}! Abriendo tu Santuario...`;
          feedback.style.display = 'block';

          setTimeout(() => {
            closeModal(modals.login);
            input.value = '';
            feedback.style.display = 'none';
            switchView('platform');
          }, 600);
        } else {
          feedback.className = 'modal-feedback error';
          feedback.textContent = result.message;
          feedback.style.display = 'block';
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
    const loginNavBtn = document.querySelector('.btn-access-login');
    if (loginNavBtn) {
      if (user) {
        loginNavBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          Mi Santuario (${user.name.split(' ')[0]})
        `;
        loginNavBtn.classList.add('btn-olive');
      } else {
        loginNavBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Acceso Alumnos
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

    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = checkoutForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <svg class="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          </svg>
          Preparando tu espacio...
        `;

        const name = document.getElementById('checkout-name').value;
        const email = document.getElementById('checkout-email').value;
        const planId = state.selectedPlanForCheckout ? state.selectedPlanForCheckout.id : 'plan-santuario';
        const isAnnual = state.selectedPlanForCheckout ? state.selectedPlanForCheckout.isAnnual : false;
        const amount = state.selectedPlanForCheckout ? state.selectedPlanForCheckout.billedAmount : 29;

        const result = await MembershipService.processCheckout({
          name,
          email,
          planId,
          isAnnual,
          amount
        });

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;

        if (result.success) {
          AuthService.loginUser(result.member);
          showCheckoutSuccessScreen(result.member, result.plan);
        }
      });
    }

    // Botón de acceso inmediato desde la pantalla de éxito
    const btnEnterPlatformDirect = document.getElementById('btn-enter-platform-direct');
    if (btnEnterPlatformDirect) {
      btnEnterPlatformDirect.addEventListener('click', () => {
        closeModal(modals.checkout);
        switchView('platform');
        showToast('¡Bienvenido/a a tu Santuario!', 'success');
      });
    }
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
            subnoteEl.textContent = cycle === 'annual'
              ? subnoteEl.getAttribute('data-note-annual')
              : subnoteEl.getAttribute('data-note-monthly');
            subnoteEl.style.opacity = '1';
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
    document.getElementById('checkout-plan-name').textContent = `${plan.name} (${isAnnual ? 'Anual • 2 meses de regalo' : 'Mensual'})`;
    document.getElementById('checkout-plan-price').textContent = isAnnual
      ? `${plan.currencySymbol}${plan.priceAnnualTotal}/año (${plan.currencySymbol}${plan.priceAnnualMonthly}/mes)`
      : `${plan.currencySymbol}${plan.priceMonthly}/${plan.pricePeriod}`;
    
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

    const filtered = category === 'all'
      ? CLASSES_DATA.slice(0, 6)
      : CLASSES_DATA.filter(c => c.category === category);

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
          <p class="class-card-desc">${c.description}</p>
          <div class="class-card-footer">
            <div class="instructor-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>${c.instructor}</span>
            </div>
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
  // PLATAFORMA PRIVADA (DASHBOARD & SANTUARIO DE PRÁCTICA)
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

    // Inspiración Diaria
    const phraseTextEl = document.getElementById('platform-quote-phrase-text');
    const phraseAuthorEl = document.getElementById('platform-quote-phrase-author');
    if (phraseTextEl && phraseAuthorEl) {
      const quoteIndex = new Date().getDate() % DAILY_QUOTES_DATA.length;
      const todayQuote = DAILY_QUOTES_DATA[quoteIndex];
      phraseTextEl.textContent = todayQuote.text;
      phraseAuthorEl.textContent = todayQuote.author.startsWith('—') ? todayQuote.author : `— ${todayQuote.author}`;
    }

    // Métricas Reales del Alumno
    const streakEl = document.getElementById('stat-streak-days');
    if (streakEl) streakEl.textContent = user.streakDays || 1;

    const minutesEl = document.getElementById('stat-minutes-practiced');
    if (minutesEl) minutesEl.textContent = user.totalMinutesPracticed || 0;

    const completedEl = document.getElementById('stat-classes-completed');
    if (completedEl) completedEl.textContent = user.completedClassesCount || 0;

    const streakBadgeEl = document.getElementById('header-streak-count');
    if (streakBadgeEl) streakBadgeEl.textContent = `${user.streakDays || 1} días`;

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
      liveCardLabel.textContent = isAttending ? '✓ Agendado' : 'Agendar';
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
    const progressPct = Math.min(100, Math.max(8, Math.round((progressSeconds / durationSeconds) * 100)));
    const remainingMinutes = Math.max(1, Math.round((durationSeconds - progressSeconds) / 60));

    resumeContainer.style.display = 'block';
    resumeContainer.innerHTML = `
      <div class="resume-card">
        <div class="resume-left">
          <img src="${lastPlayed.thumbnail}" alt="${lastPlayed.title}" class="resume-thumb" />
          <div style="flex: 1; min-width: 0;">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--terracotta); font-weight:600; letter-spacing:0.06em;">
              Continuar práctica
            </div>
            <div class="resume-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${lastPlayed.title}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">
              ${lastPlayed.instructor} • Restan ${remainingMinutes} min (${progressPct}% completado)
            </div>
            <div class="resume-progress-bar">
              <div class="resume-progress-fill" style="width: ${progressPct}%;"></div>
            </div>
          </div>
        </div>
        <div class="resume-right">
          <button class="btn btn-primary btn-play-resume" data-class-id="${lastPlayed.id}" type="button">
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
          renderPlatformClasses();
        });
      });
    }
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

    let filtered = CLASSES_DATA.filter(c => {
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

      return `
        <article class="class-card class-card-platform" data-class-id="${c.id}">
          <div class="class-card-thumbnail">
            <img src="${c.thumbnail}" alt="${c.title}" loading="lazy" />
            ${c.isNew ? '<span class="badge-tag badge-new">Nueva</span>' : ''}
            <span class="class-duration-badge">${c.duration} min</span>
            
            <button class="favorite-btn ${isFav ? 'active' : ''}" data-favorite-id="${c.id}" title="${isFav ? 'Quitar de favoritas' : 'Guardar en favoritas'}" aria-label="Favorito">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>

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
            <p class="class-card-desc">${c.description}</p>
            
            <div class="class-card-footer">
              <div class="instructor-info">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>${c.instructor}</span>
              </div>

              ${isDone ? `
                <span class="completed-check-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Completada
                </span>
              ` : ''}
            </div>
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
          const classObj = CLASSES_DATA.find(c => c.id === classId);
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
    state.activePlayingClass = classObj;
    ProgressService.recordPlayProgress(classObj.id, seekSeconds);

    const videoEl = document.getElementById('player-video-element');
    if (videoEl) {
      videoEl.src = classObj.videoUrl;
      videoEl.poster = classObj.thumbnail;
      videoEl.playbackRate = state.videoPlaybackRate || 1.0;

      const onMetadataLoaded = () => {
        if (seekSeconds > 0 && seekSeconds < videoEl.duration) {
          videoEl.currentTime = seekSeconds;
        }
        videoEl.play().catch(e => {
          console.log('Video autoplay prevented, listo para reproducir manual.', e);
        });
        updatePlayerTimeDisplay();
      };

      videoEl.addEventListener('loadedmetadata', onMetadataLoaded, { once: true });
    }

    // Datos de la clase
    document.getElementById('player-class-title').textContent = classObj.title;
    document.getElementById('player-class-category').textContent = classObj.categoryLabel;
    document.getElementById('player-class-duration').textContent = `${classObj.duration} min`;
    document.getElementById('player-class-level').textContent = classObj.level;
    document.getElementById('player-class-instructor').textContent = classObj.instructor;
    document.getElementById('player-class-instructor-role').textContent = classObj.instructorRole;
    document.getElementById('player-class-description').textContent = classObj.description;

    // Resetear botón de velocidad a 1.0x
    const speedBtn = document.getElementById('btn-player-speed');
    if (speedBtn) speedBtn.textContent = `${state.videoPlaybackRate || 1.0}x`;

    // Props / Accesorios
    const propsListEl = document.getElementById('player-class-props');
    if (propsListEl) {
      propsListEl.innerHTML = classObj.props.map(prop => `
        <li class="player-prop-chip">✓ ${prop}</li>
      `).join('');
    }

    // Intenciones
    const intentionsEl = document.getElementById('player-class-intentions');
    if (intentionsEl) {
      intentionsEl.innerHTML = classObj.intentions.map(int => `
        <span class="badge-tag">${int}</span>
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
      // Seguimiento en tiempo real del progreso del video
      let lastSaveTime = 0;
      videoEl.addEventListener('timeupdate', () => {
        updatePlayerTimeDisplay();
        const now = Math.floor(videoEl.currentTime);
        if (state.activePlayingClass && now - lastSaveTime >= 3) {
          lastSaveTime = now;
          ProgressService.recordPlayProgress(state.activePlayingClass.id, now);
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
      markCompleteBtn.className = 'btn btn-olive btn-complete-practice';
      markCompleteBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Práctica completada ✓</span>
      `;
    } else {
      markCompleteBtn.className = 'btn btn-primary btn-complete-practice';
      markCompleteBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 14 14"></polyline>
        </svg>
        <span>Marcar práctica como completada</span>
      `;
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
    const navSanctuary = document.getElementById('platform-nav-sanctuary');
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

    // 3. Botón de refrescar inspiración diaria
    const btnRefreshQuote = document.getElementById('btn-refresh-quote');
    if (btnRefreshQuote) {
      btnRefreshQuote.addEventListener('click', () => {
        const phraseTextEl = document.getElementById('platform-quote-phrase-text');
        const phraseAuthorEl = document.getElementById('platform-quote-phrase-author');
        if (!phraseTextEl || !phraseAuthorEl) return;

        const currentText = phraseTextEl.textContent;
        const availableQuotes = DAILY_QUOTES_DATA.filter(q => q.text !== currentText);
        const randomQuote = availableQuotes[Math.floor(Math.random() * availableQuotes.length)] || DAILY_QUOTES_DATA[0];

        phraseTextEl.style.opacity = '0';
        phraseAuthorEl.style.opacity = '0';

        setTimeout(() => {
          phraseTextEl.textContent = randomQuote.text;
          phraseAuthorEl.textContent = randomQuote.author.startsWith('—') ? randomQuote.author : `— ${randomQuote.author}`;
          phraseTextEl.style.opacity = '1';
          phraseAuthorEl.style.opacity = '1';
          showToast(`Inspiración: ${randomQuote.author}`);
        }, 150);
      });
    }

    // 4. Modal de Progreso del Alumno (Racha, Minutos, Clases)
    const openProgressModal = () => {
      const user = AuthService.getCurrentUser();
      if (!user) return;

      const progress = ProgressService.getProgressState();
      const completedClasses = CLASSES_DATA.filter(c => progress.completed.includes(c.id));

      const streakEl = document.getElementById('modal-metric-streak');
      const minEl = document.getElementById('modal-metric-minutes');
      const countEl = document.getElementById('modal-metric-classes');
      const badgeCountEl = document.getElementById('modal-completed-count-badge');
      const listContainer = document.getElementById('modal-completed-classes-list');

      if (streakEl) streakEl.textContent = user.streakDays || 1;
      if (minEl) minEl.textContent = user.totalMinutesPracticed || 0;
      if (countEl) countEl.textContent = user.completedClassesCount || 0;
      if (badgeCountEl) badgeCountEl.textContent = `${completedClasses.length} ${completedClasses.length === 1 ? 'clase' : 'clases'}`;

      if (listContainer) {
        if (completedClasses.length === 0) {
          listContainer.innerHTML = `
            <div style="text-align: center; padding: 1.5rem 1rem; color: var(--text-muted); font-size: 0.88rem;">
              Aún no has completado ninguna sesión. ¡Elige una práctica del catálogo para iniciar tu registro!
            </div>
          `;
        } else {
          listContainer.innerHTML = completedClasses.map(c => `
            <div class="completed-class-row">
              <div class="completed-class-row-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--olive-dark)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>${c.title} (${c.duration} min)</span>
              </div>
              <button type="button" class="btn-repeat-practice" data-class-id="${c.id}">
                Repetir práctica →
              </button>
            </div>
          `).join('');

          listContainer.querySelectorAll('.btn-repeat-practice').forEach(btn => {
            btn.addEventListener('click', () => {
              const classId = btn.getAttribute('data-class-id');
              const classObj = CLASSES_DATA.find(c => c.id === classId);
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

      if (attendText) {
        attendText.textContent = isAttending ? '✓ Asistencia Confirmada (Click para cancelar)' : 'Confirmar mi Asistencia';
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
          attendText.textContent = newAttendingState ? '✓ Asistencia Confirmada (Click para cancelar)' : 'Confirmar mi Asistencia';
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
        const zoomText = 'Encuentro Namasté: https://zoom.us/j/84920119283 (ID: 849 2011 9283 • Clave: NAMASTE)';
        navigator.clipboard.writeText(zoomText).then(() => {
          btnCopyZoom.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>¡Copiado!</span>
          `;
          showToast('Enlace y clave de Zoom copiados al portapapeles', 'success');
          setTimeout(() => {
            btnCopyZoom.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copiar Enlace Zoom</span>
            `;
          }, 2000);
        });
      });
    }

    // 6. Modal de Cambio de Plan en el Santuario
    const openChangePlanModal = () => {
      const user = AuthService.getCurrentUser();
      if (!user) return;

      const container = document.getElementById('plan-change-options');
      if (container) {
        container.innerHTML = PLANS_DATA.map(plan => {
          const isCurrent = (user.planId === plan.id) || (user.planName && user.planName.toLowerCase().includes(plan.name.toLowerCase()));
          return `
            <div class="plan-change-item ${isCurrent ? 'current' : ''}">
              <div class="plan-change-item-info">
                <h4>
                  ${plan.name}
                  ${isCurrent ? '<span class="status-badge-active" style="font-size:0.7rem; padding:0.15rem 0.5rem;">Tu Plan Actual</span>' : ''}
                </h4>
                <p class="plan-change-item-desc">${plan.description}</p>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.25rem;">
                  ${plan.features[0]} • ${plan.features[1]}
                </div>
              </div>
              <div style="text-align: right; flex-shrink: 0;">
                <div class="plan-change-price">$${plan.priceMonthly}/mes</div>
                ${isCurrent ? `
                  <button type="button" class="btn btn-secondary btn-sm" disabled style="opacity: 0.6; cursor: default; margin-top: 0.35rem;">
                    Activo
                  </button>
                ` : `
                  <button type="button" class="btn btn-primary btn-sm btn-select-new-plan" data-plan-id="${plan.id}" data-plan-name="${plan.name}" style="margin-top: 0.35rem;">
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
            AuthService.updateUserProfile({
              planId: newPlanId,
              planName: newPlanName
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

        const contentArea = document.getElementById('receipt-content-area');
        if (contentArea) {
          contentArea.innerHTML = `
            <div style="background-color: var(--sand-50); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem; font-size: 0.88rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; border-bottom:1px solid var(--border-subtle); padding-bottom:0.75rem;">
                <div>
                  <strong style="font-family:var(--font-serif); font-size:1.15rem; color:var(--text-primary);">Namasté Escuela de Yoga</strong>
                  <div style="font-size:0.78rem; color:var(--text-muted);">Santuario Consciente Online</div>
                </div>
                <span class="status-badge-active">● Pagado</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; margin-bottom:1rem;">
                <div><span style="color:var(--text-muted); font-size:0.78rem;">Alumno:</span><br><strong>${user.name}</strong></div>
                <div><span style="color:var(--text-muted); font-size:0.78rem;">Código:</span><br><code>${user.accessCode}</code></div>
                <div><span style="color:var(--text-muted); font-size:0.78rem;">Plan:</span><br><strong>${user.planName || 'Plan Santuario'}</strong></div>
                <div><span style="color:var(--text-muted); font-size:0.78rem;">Renovación:</span><br><strong>${user.nextBillingDate || '22 Octubre 2026'}</strong></div>
              </div>
              <div style="border-top:1px dashed var(--border-medium); padding-top:0.75rem; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.82rem; color:var(--text-muted);">Método: Visa •••• 4242</span>
                <strong style="font-size:1.1rem; color:var(--terracotta);">$29.00 USD</strong>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem; margin-top:1.25rem;">
              <button type="button" class="btn btn-secondary" onclick="window.print()" style="flex:1; justify-content:center; font-size:0.84rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                <span>Imprimir / Guardar PDF</span>
              </button>
            </div>
          `;
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

    // Copiar código de acceso del alumno
    const btnCopyDrawerCode = document.getElementById('btn-copy-drawer-code');
    if (btnCopyDrawerCode) {
      btnCopyDrawerCode.addEventListener('click', () => {
        const codeEl = document.getElementById('drawer-access-code');
        const code = codeEl ? codeEl.textContent : 'NAMASTE-ALUMNO';
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

    // Limpiar filtros cuando no hay resultados
    const btnClearFilters = document.getElementById('btn-clear-platform-filters');
    if (btnClearFilters) {
      btnClearFilters.addEventListener('click', () => {
        state.searchQuery = '';
        state.onlyFavorites = false;
        state.activeCategoryFilter = 'all';

        const searchInput = document.getElementById('platform-search-input');
        if (searchInput) searchInput.value = '';

        const favToggle = document.getElementById('filter-toggle-favorites');
        if (favToggle) favToggle.checked = false;

        const chipsContainer = document.getElementById('platform-filter-chips');
        if (chipsContainer) {
          chipsContainer.querySelectorAll('.filter-chip').forEach(c => {
            if (c.getAttribute('data-category') === 'all') c.classList.add('active');
            else c.classList.remove('active');
          });
        }

        renderPlatformClasses();
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
    if (codeEl) codeEl.textContent = user.email || user.accessCode;

    const planNameEl = document.getElementById('drawer-plan-name');
    if (planNameEl) planNameEl.textContent = user.planName || 'Plan Santuario';

    const nextBillingEl = document.getElementById('drawer-next-billing');
    if (nextBillingEl) nextBillingEl.textContent = user.nextBillingDate || '22 Octubre 2026';

    const statusBadge = document.getElementById('drawer-membership-status');
    const pauseBtn = document.getElementById('btn-toggle-pause-membership');

    if (user.active) {
      if (statusBadge) {
        statusBadge.className = 'status-badge-active';
        statusBadge.style.backgroundColor = '';
        statusBadge.style.color = '';
        statusBadge.textContent = '● Membresía Activa';
      }
      if (pauseBtn) {
        pauseBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
          <span>Pausar o Cancelar Membresía</span>
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span>Reactivar mi membresía</span>
        `;
      }
    }
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

  // Arrancar aplicación
  init();
});
