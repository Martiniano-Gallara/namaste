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
    profileDrawer: document.getElementById('profile-drawer-backdrop')
  };

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
        input.value = input.value.toUpperCase();
        feedback.style.display = 'none';
      });
    }

    if (demoBtn && input) {
      demoBtn.addEventListener('click', () => {
        input.value = 'NAMASTE-ALUMNO';
        feedback.style.display = 'none';
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = input.value;
        const result = AuthService.loginWithCode(code);

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
          showCheckoutSuccessScreen(result.member, result.plan);
        }
      });
    }

    // Botón de acceso inmediato desde la pantalla de éxito
    const btnEnterPlatformDirect = document.getElementById('btn-enter-platform-direct');
    if (btnEnterPlatformDirect) {
      btnEnterPlatformDirect.addEventListener('click', () => {
        closeModal(modals.checkout);
        // Autenticar al usuario recién creado
        if (state.lastCreatedUser) {
          AuthService.loginWithCode(state.lastCreatedUser.accessCode);
        }
        switchView('platform');
      });
    }

    // Botón copiar código generado
    const btnCopyCode = document.getElementById('btn-copy-code');
    if (btnCopyCode) {
      btnCopyCode.addEventListener('click', () => {
        const codeText = document.getElementById('generated-access-code').textContent;
        navigator.clipboard.writeText(codeText).then(() => {
          const original = btnCopyCode.textContent;
          btnCopyCode.textContent = '¡Copiado!';
          setTimeout(() => { btnCopyCode.textContent = original; }, 2000);
        });
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

    document.getElementById('generated-access-code').textContent = member.accessCode;
    document.getElementById('success-user-name').textContent = member.name;
    document.getElementById('success-plan-name').textContent = plan.name;
    document.getElementById('success-user-email').textContent = member.email;
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
  function renderPlatformDashboard() {
    const user = AuthService.getCurrentUser();
    if (!user) return;

    // Saludo y Sutra
    const userNameEl = document.getElementById('platform-user-greeting');
    if (userNameEl) {
      userNameEl.textContent = user.name;
    }

    const dailyQuoteEl = document.getElementById('platform-daily-quote');
    if (dailyQuoteEl) {
      const quoteIndex = new Date().getDate() % DAILY_QUOTES.length;
      dailyQuoteEl.textContent = DAILY_QUOTES[quoteIndex];
    }

    // Métricas del Alumno
    const streakEl = document.getElementById('stat-streak-days');
    if (streakEl) streakEl.textContent = user.streakDays || 1;

    const minutesEl = document.getElementById('stat-minutes-practiced');
    if (minutesEl) minutesEl.textContent = user.totalMinutesPracticed || 0;

    const completedEl = document.getElementById('stat-classes-completed');
    if (completedEl) completedEl.textContent = user.completedClassesCount || 0;

    const streakBadgeEl = document.getElementById('header-streak-count');
    if (streakBadgeEl) streakBadgeEl.textContent = `${user.streakDays || 1} días racha`;

    const profileNameHeader = document.getElementById('header-profile-name');
    if (profileNameHeader) profileNameHeader.textContent = user.name.split(' ')[0];

    // Reanudación de última clase
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

    resumeContainer.style.display = 'block';
    resumeContainer.innerHTML = `
      <div class="resume-card">
        <div class="resume-left">
          <img src="${lastPlayed.thumbnail}" alt="${lastPlayed.title}" class="resume-thumb" />
          <div>
            <div style="font-size:0.78rem; text-transform:uppercase; color:var(--terracotta); font-weight:600; letter-spacing:0.06em;">
              Continuar práctica
            </div>
            <div class="resume-title">${lastPlayed.title}</div>
            <div style="font-size:0.82rem; color:var(--text-muted);">
              ${lastPlayed.instructor} • ${lastPlayed.duration} min
            </div>
            <div class="resume-progress-bar">
              <div class="resume-progress-fill" style="width: 55%;"></div>
            </div>
          </div>
        </div>
        <div class="resume-right">
          <button class="btn btn-primary btn-play-resume" data-class-id="${lastPlayed.id}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Reanudar sesión
          </button>
        </div>
      </div>
    `;

    const resumeBtn = resumeContainer.querySelector('.btn-play-resume');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        openClassPlayer(lastPlayed);
      });
    }
  }

  function setupPlatformFilters() {
    // Categorías Tabs
    const tabPills = document.querySelectorAll('.filter-tab-pill');
    tabPills.forEach(pill => {
      pill.addEventListener('click', () => {
        tabPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.activeCategoryFilter = pill.getAttribute('data-category');
        renderPlatformClasses();
      });
    });

    // Buscador
    const searchInput = document.getElementById('platform-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        renderPlatformClasses();
      });
    }

    // Duración
    const durationSelect = document.getElementById('filter-duration-select');
    if (durationSelect) {
      durationSelect.addEventListener('change', (e) => {
        state.activeDurationFilter = e.target.value;
        renderPlatformClasses();
      });
    }

    // Nivel
    const levelSelect = document.getElementById('filter-level-select');
    if (levelSelect) {
      levelSelect.addEventListener('change', (e) => {
        state.activeLevelFilter = e.target.value;
        renderPlatformClasses();
      });
    }

    // Checkbox Favoritas
    const favToggle = document.getElementById('filter-toggle-favorites');
    if (favToggle) {
      favToggle.addEventListener('change', (e) => {
        state.onlyFavorites = e.target.checked;
        renderPlatformClasses();
      });
    }

    // Checkbox Nuevas
    const newToggle = document.getElementById('filter-toggle-new');
    if (newToggle) {
      newToggle.addEventListener('change', (e) => {
        state.onlyNew = e.target.checked;
        renderPlatformClasses();
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
      // Filtro Solo Favoritas
      if (state.onlyFavorites && !ProgressService.isFavorite(c.id)) {
        return false;
      }

      // Búsqueda de texto
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
            
            <button class="favorite-btn ${isFav ? 'active' : ''}" data-favorite-id="${c.id}" title="Guardar en favoritas" aria-label="Favorito">
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
  function openClassPlayer(classObj) {
    state.activePlayingClass = classObj;
    ProgressService.recordPlayProgress(classObj.id, 0);

    const videoEl = document.getElementById('player-video-element');
    if (videoEl) {
      videoEl.src = classObj.videoUrl;
      videoEl.poster = classObj.thumbnail;
      videoEl.play().catch(e => {
        console.log('Video autoplay prevented, ready to play manually.', e);
      });
    }

    // Datos de la clase
    document.getElementById('player-class-title').textContent = classObj.title;
    document.getElementById('player-class-category').textContent = classObj.categoryLabel;
    document.getElementById('player-class-duration').textContent = `${classObj.duration} min`;
    document.getElementById('player-class-level').textContent = classObj.level;
    document.getElementById('player-class-instructor').textContent = classObj.instructor;
    document.getElementById('player-class-instructor-role').textContent = classObj.instructorRole;
    document.getElementById('player-class-description').textContent = classObj.description;

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
    const markCompleteBtn = document.getElementById('btn-mark-class-complete');
    if (markCompleteBtn) {
      const isDone = ProgressService.isCompleted(classObj.id);
      updateMarkCompletedButton(isDone);
    }

    openModal(modals.player);
  }

  function pauseActiveVideo() {
    const videoEl = document.getElementById('player-video-element');
    if (videoEl) {
      videoEl.pause();
    }
  }

  function setupPlayerControls() {
    const markCompleteBtn = document.getElementById('btn-mark-class-complete');
    if (markCompleteBtn) {
      markCompleteBtn.addEventListener('click', () => {
        if (!state.activePlayingClass) return;
        ProgressService.markCompleted(state.activePlayingClass.id, state.activePlayingClass.duration);
        updateMarkCompletedButton(true);
        renderPlatformDashboard();
      });
    }
  }

  function updateMarkCompletedButton(isDone) {
    const markCompleteBtn = document.getElementById('btn-mark-class-complete');
    if (!markCompleteBtn) return;
    if (isDone) {
      markCompleteBtn.className = 'btn btn-olive';
      markCompleteBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Práctica completada con éxito
      `;
    } else {
      markCompleteBtn.className = 'btn btn-primary';
      markCompleteBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 14 14"></polyline>
        </svg>
        Marcar práctica como completada
      `;
    }
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
        MembershipService.toggleMembershipPause();
        populateProfileDrawer();
      });
    }

    // Cambiar de plan / Ver opciones
    const btnChangePlan = document.getElementById('btn-drawer-change-plan');
    if (btnChangePlan) {
      btnChangePlan.addEventListener('click', () => {
        closeModal(modals.profileDrawer);
        switchView('landing');
        setTimeout(() => {
          const plansSection = document.getElementById('planes');
          if (plansSection) plansSection.scrollIntoView({ behavior: 'smooth' });
        }, 180);
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
        const searchInput = document.getElementById('platform-search-input');
        if (searchInput) searchInput.value = '';
        const favToggle = document.getElementById('filter-toggle-favorites');
        if (favToggle) favToggle.checked = false;
        renderPlatformClasses();
      });
    }
  }

  function populateProfileDrawer() {
    const user = AuthService.getCurrentUser();
    if (!user) return;

    const nameEl = document.getElementById('drawer-user-name');
    if (nameEl) nameEl.textContent = user.name;

    const emailEl = document.getElementById('drawer-user-email');
    if (emailEl) emailEl.textContent = user.email;

    const codeEl = document.getElementById('drawer-access-code');
    if (codeEl) codeEl.textContent = user.accessCode;

    const planNameEl = document.getElementById('drawer-plan-name');
    if (planNameEl) planNameEl.textContent = user.planName || 'Plan Santuario';

    const memberSinceEl = document.getElementById('drawer-member-since');
    if (memberSinceEl) memberSinceEl.textContent = user.memberSince || 'Marzo 2026';

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
        } else {
          openModal(modals.login);
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
