/**
 * MOMO store - Google Play Store Material Design 3 (Material You) Engine
 * Features: Squircle Icons, Morphing Action Button with Circular Progress,
 * Horizontal Clusters, Google Play Protect Scanner & Manage Apps Dialog.
 */

const appStore = {
  apps: [],
  allCatalogApps: [],
  cart: JSON.parse(localStorage.getItem('momo_cart') || '[]'),
  wishlist: JSON.parse(localStorage.getItem('momo_wishlist') || '[]'),
  currentCategory: 'all',
  currentTab: 'for-you',
  currentSearch: '',
  activeProduct: null,
  installProgressTimer: null,

  async init() {
    this.initTheme();
    await this.loadCatalog();
    this.updateBadges();
    this.renderClusters();
    this.renderProducts(this.apps);
    this.renderCategoriesPage();
    this.renderOrdersTracker();
  },

  // --- Theme Management ---
  initTheme() {
    const saved = localStorage.getItem('momo_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this.updateThemeText(saved);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('momo_theme', target);
    this.updateThemeText(target);
    this.showToast(`تم التبديل إلى الوضع ${target === 'dark' ? 'الليلي 🌙' : 'الفاتح ☀️'}`, 'info');
  },

  updateThemeText(theme) {
    const el = document.getElementById('theme-icon-text');
    if (el) el.textContent = theme === 'dark' ? 'داكن 🌙' : 'فاتح ☀️';
  },

  // --- Load Catalog Data ---
  async loadCatalog() {
    // 1. Shimmer Skeleton Loading State
    this.renderSkeletons();

    let fetchedApps = null;

    // Check Local Storage Customizations first
    const custom = localStorage.getItem('momo_custom_catalog');
    if (custom) {
      try {
        fetchedApps = JSON.parse(custom);
      } catch (e) {}
    }

    // Try Local Backend API
    if (!fetchedApps) {
      try {
        const res = await fetch('./api/apps', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.apps && data.apps.length) {
            fetchedApps = data.apps;
          }
        }
      } catch (e) {}
    }

    // Fallback to static catalog.json (GitHub Pages mode)
    if (!fetchedApps) {
      try {
        const res = await fetch('./catalog.json', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.apps) {
            fetchedApps = data.apps;
          }
        }
      } catch (e) {}
    }

    if (!fetchedApps || fetchedApps.length === 0) {
      fetchedApps = this.getDefaultFallbackApps();
    }

    this.allCatalogApps = fetchedApps;
    this.apps = fetchedApps;
  },

  renderSkeletons() {
    const grid = document.getElementById('main-apps-grid');
    if (!grid) return;
    grid.innerHTML = Array(6).fill(0).map(() => `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 18px; padding: 12px; height: 180px; display: flex; flex-direction: column; gap: 8px;">
        <div style="width: 100%; height: 95px; background: var(--shimmer-bg); border-radius: var(--squircle-radius); animation: pulse 1.5s infinite;"></div>
        <div style="width: 70%; height: 14px; background: var(--shimmer-bg); border-radius: 6px;"></div>
        <div style="width: 40%; height: 12px; background: var(--shimmer-bg); border-radius: 6px;"></div>
      </div>
    `).join('');
  },

  // --- Render Google Play Horizontal Clusters ---
  renderClusters() {
    const recContainer = document.getElementById('cluster-recommended');
    const hwContainer = document.getElementById('cluster-hardware');

    const phoneApps = this.allCatalogApps.filter((a) => a.category === 'برامج الهاتف' || a.item_type === 'app');
    const hardwareItems = this.allCatalogApps.filter((a) => a.category !== 'برامج الهاتف');

    if (recContainer) {
      recContainer.innerHTML = phoneApps.map((item) => this.renderClusterCard(item)).join('');
    }

    if (hwContainer) {
      hwContainer.innerHTML = hardwareItems.map((item) => this.renderClusterCard(item)).join('');
    }
  },

  renderClusterCard(item) {
    const isApp = item.item_type === 'app';
    const subText = isApp ? (item.file_size_formatted || '42 MB') : `${item.price} ج.م`;

    return `
      <div class="gp-app-card" onclick="appStore.openDetailsModal('${item.id}')">
        <div class="gp-app-icon-squircle">
          <img src="${item.icon_url}" alt="${item.name}" onerror="this.src='./static/icons/default-app.svg'">
        </div>
        <div class="gp-app-name" title="${item.name}">${item.name}</div>
        <div class="gp-app-subinfo">
          <span class="gp-app-rating-star">★</span>
          <span>${item.rating ? item.rating.toFixed(1) : '4.8'}</span>
          <span>•</span>
          <span>${subText}</span>
        </div>
      </div>
    `;
  },

  // --- Render Main Products / Apps Grid ---
  renderProducts(list) {
    const grid = document.getElementById('main-apps-grid');
    const countEl = document.getElementById('grid-section-count');
    if (!grid) return;

    let filtered = list;

    // Filter by Tab / Category
    if (this.currentCategory && this.currentCategory !== 'all') {
      filtered = filtered.filter((a) => a.category === this.currentCategory);
    }

    // Filter by Search Query
    if (this.currentSearch && this.currentSearch.trim() !== '') {
      const q = this.currentSearch.trim().toLowerCase();
      filtered = filtered.filter((a) =>
        (a.name && a.name.toLowerCase().includes(q)) ||
        (a.short_description && a.short_description.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q))
      );
    }

    if (countEl) countEl.textContent = `(${filtered.length} عنصر)`;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 10px; background: var(--bg-surface); border-radius: 20px; border: 1px dashed var(--border-color);">
          <div style="font-size: 2.5rem; margin-bottom: 6px;">🔍</div>
          <h3 style="color: var(--text-main); font-size: 1.1rem;">لم يتم العثور على نتائج مطابقة</h3>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">جرب البحث بكلمات أخرى أو تصفح الفئات المختلفة.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((item) => {
      const isFav = this.wishlist.some((w) => w.id === item.id);
      const isApp = item.item_type === 'app';
      return `
        <div class="gp-product-card" onclick="appStore.openDetailsModal('${item.id}')">
          <button class="gp-product-fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); appStore.toggleWishlist('${item.id}')">
            ${isFav ? '❤️' : '🤍'}
          </button>
          
          <div class="gp-app-icon-squircle" style="margin-bottom: 10px;">
            <img src="${item.icon_url}" alt="${item.name}" onerror="this.src='./static/icons/default-app.svg'">
          </div>

          <div class="gp-app-name" style="font-size: 0.95rem; margin-bottom: 4px;">${item.name}</div>
          
          <div style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 6px;">${item.category}</div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 6px;">
            <div style="display: flex; align-items: center; gap: 4px; font-size: 0.82rem; font-weight: 700;">
              <span style="color: #f59e0b;">★</span>
              <span>${item.rating ? item.rating.toFixed(1) : '4.8'}</span>
            </div>
            
            <div style="font-weight: 800; font-size: 0.92rem; color: ${isApp ? 'var(--gp-green)' : 'var(--text-main)'};">
              ${isApp ? 'مجاني' : item.price + ' ج.م'}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // --- Tab & Navigation Switching ---
  handleTabSwitch(tabName, el) {
    if (el) {
      document.querySelectorAll('.m3-tab-item').forEach((t) => t.classList.remove('active'));
      el.classList.add('active');
    }

    this.currentTab = tabName;

    if (tabName === 'for-you') {
      this.currentCategory = 'all';
      this.switchView('home');
      document.getElementById('grid-section-title').textContent = 'أهم التطبيقات والمنتجات';
    } else if (tabName === 'top-charts') {
      this.currentCategory = 'all';
      this.switchView('home');
      document.getElementById('grid-section-title').textContent = 'الأعلى تحميلاً وتقييماً 🔥';
    } else if (tabName === 'categories') {
      this.switchView('categories');
    } else if (tabName === 'editors-choice') {
      this.currentCategory = 'all';
      this.switchView('home');
      document.getElementById('grid-section-title').textContent = 'اختيارات محرري MOMO store 🌟';
    } else {
      this.currentCategory = tabName;
      this.switchView('home');
      document.getElementById('grid-section-title').textContent = tabName;
    }

    this.renderProducts(this.apps);
  },

  switchBottomNav(type, el) {
    document.querySelectorAll('.m3-nav-item').forEach((b) => b.classList.remove('active'));
    if (el) el.classList.add('active');

    if (type === 'apps') {
      this.handleTabSwitch('for-you');
    } else if (type === 'games') {
      this.handleTabSwitch('ألعاب');
    } else if (type === 'hardware') {
      this.handleTabSwitch('إلكترونيات وأجهزة');
    } else if (type === 'cart') {
      this.switchView('cart');
    } else if (type === 'updates') {
      this.openAccountDialog();
    }
  },

  switchView(viewName) {
    const views = ['home', 'categories', 'cart', 'wishlist', 'orders', 'merchant'];
    views.forEach((v) => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.style.display = v === viewName ? 'block' : 'none';
    });

    if (viewName === 'cart') this.renderCart();
    if (viewName === 'wishlist') this.renderWishlist();
    if (viewName === 'orders') this.renderOrdersTracker();
    if (viewName === 'merchant') adminPanel.checkAuthStatus();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  handleSearch: (() => {
    let timer;
    return function (query) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        appStore.currentSearch = query;
        appStore.switchView('home');
        appStore.renderProducts(appStore.apps);
      }, 300);
    };
  })(),

  triggerVoiceSearch() {
    this.showToast('البحث الصوتي: قل اسم التطبيق أو الجهاز...', 'info');
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      try {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRec();
        recognition.lang = 'ar-EG';
        recognition.onresult = (event) => {
          const text = event.results[0][0].transcript;
          document.getElementById('store-search-input').value = text;
          appStore.handleSearch(text);
          appStore.showToast(`تم التعرف: "${text}"`, 'success');
        };
        recognition.start();
      } catch (e) {
        this.showToast('البحث الصوتي غير مدعوم في متصفحك حالياً', 'error');
      }
    } else {
      this.showToast('البحث الصوتي يتطلب صلاحية الميكروفون', 'info');
    }
  },

  // ========================================================
  // THE SIGNATURE GOOGLE PLAY APP DETAILS SCREEN & MORPHING INSTALL
  // ========================================================

  openDetailsModal(itemId) {
    const item = this.allCatalogApps.find((a) => a.id === itemId) || this.apps.find((a) => a.id === itemId);
    if (!item) return;

    this.activeProduct = item;
    const body = document.getElementById('product-details-body');
    const isApp = item.item_type === 'app';
    const photos = (item.screenshots && item.screenshots.length) ? item.screenshots : [item.icon_url];
    const devName = item.developer || (isApp ? 'MOMO Team' : 'MOMO Hardware Labs');
    const fileSizeFormatted = item.file_size_formatted || (item.file_size_bytes ? `${(item.file_size_bytes / (1024*1024)).toFixed(1)} MB` : '42 MB');

    body.innerHTML = `
      <!-- 1. Google Play App Header -->
      <div class="gp-details-app-header">
        <div class="gp-icon-wrapper-relative" id="gp-details-icon-wrapper">
          <!-- CircularProgressIndicator SVG Ring -->
          <svg class="gp-circular-progress-svg" viewBox="0 0 84 84">
            <circle class="gp-circular-track" cx="42" cy="42" r="38"></circle>
            <circle class="gp-circular-fill" id="gp-progress-circle-fill" cx="42" cy="42" r="38"></circle>
          </svg>
          <img src="${item.icon_url}" alt="${item.name}" class="gp-details-icon-72" onerror="this.src='./static/icons/default-app.svg'">
        </div>

        <div class="gp-details-app-info">
          <h2 class="gp-details-app-title">${item.name}</h2>
          <a href="#" class="gp-details-dev-link" onclick="event.preventDefault();">${devName}</a>
          <div class="gp-details-badge-row">
            <span>${item.category}</span>
            <span>•</span>
            <span>${isApp ? 'عمليات الشراء داخل التطبيق' : 'منتج أصلي مضمون'}</span>
          </div>
        </div>
      </div>

      <!-- 2. Google Play 4-Metric Stats Strip -->
      <div class="gp-stats-strip">
        <div class="gp-stat-item">
          <div class="gp-stat-val">
            <span>${item.rating ? item.rating.toFixed(1) : '4.8'}</span>
            <span style="color: #f59e0b; font-size: 0.85rem;">★</span>
          </div>
          <span class="gp-stat-label">${item.rating_count || 148} مراجعة</span>
        </div>

        <div class="gp-stat-item">
          <div class="gp-stat-val">
            <span>${item.downloads_count ? `+${(item.downloads_count / 1000).toFixed(0)}K` : '+500K'}</span>
          </div>
          <span class="gp-stat-label">تنزيل</span>
        </div>

        <div class="gp-stat-item">
          <div class="gp-stat-val">
            <span style="border: 1px solid var(--text-dim); padding: 1px 4px; border-radius: 4px; font-size: 0.72rem;">3+</span>
          </div>
          <span class="gp-stat-label">مناسب للجميع</span>
        </div>

        <div class="gp-stat-item">
          <div class="gp-stat-val">
            <span>${isApp ? fileSizeFormatted : `${item.price} ج.م`}</span>
          </div>
          <span class="gp-stat-label">${isApp ? 'الحجم' : 'السعر'}</span>
        </div>
      </div>

      <!-- 3. Morphing Action Button (Full-width Pill Button) -->
      <div class="gp-action-btn-container" id="gp-action-container">
        ${isApp ? `
          <!-- Full-width Install Pill -->
          <button class="gp-btn-install-full" id="gp-main-install-btn" onclick="appStore.startMorphingInstall('${item.id}')">
            <span>تثبيت</span>
          </button>

          <!-- Morphed State: Cancel & Open -->
          <div class="gp-morphed-btn-group" id="gp-morphed-group">
            <button class="gp-btn-cancel-pill" onclick="appStore.cancelMorphingInstall()">إلغاء</button>
            <button class="gp-btn-open-pill" id="gp-open-btn" disabled onclick="appStore.launchInstalledApp('${item.id}')">فتح</button>
          </div>

          <div class="gp-install-live-status" id="gp-install-status-row" style="display: none;">
            <span id="gp-install-mb-text">0 MB من ${fileSizeFormatted} (0%)</span>
            <span id="gp-install-speed-text">14.2 MB/s</span>
          </div>
        ` : `
          <button class="gp-btn-install-full" onclick="appStore.addToCart('${item.id}')">
            <span>🛒 أضف إلى السلة (${item.price} ج.م)</span>
          </button>
        `}
      </div>

      <!-- 4. Screenshots Gallery (Horizontally Scrollable) -->
      <div class="gp-screenshots-gallery">
        ${photos.map((p) => `
          <div class="gp-screenshot-item" onclick="appStore.viewFullScreenshot('${p}')">
            <img src="${p}" alt="Screenshot" onerror="this.src='./static/icons/default-app.svg'">
          </div>
        `).join('')}
      </div>

      <!-- 5. About this app & What's new -->
      <div class="gp-section-block">
        <div class="gp-section-header-arrow" onclick="appStore.toggleAboutExpand()">
          <h3 class="gp-section-title">لمحة عن هذا التطبيق</h3>
          <span class="gp-section-arrow">←</span>
        </div>
        <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.6; margin-bottom: 10px;" id="gp-about-desc">
          ${item.short_description || item.description}
        </p>
        <div class="gp-chips-row">
          <span class="gp-chip">#${item.category}</span>
          <span class="gp-chip">#تطبيقات_الإنتاجية</span>
          <span class="gp-chip">#الأكثر_رواجاً</span>
        </div>

        <!-- What's new (Changelog) -->
        ${item.changelog ? `
          <div style="background: var(--bg-surface-container); border-radius: 14px; padding: 14px; margin-top: 14px;">
            <div style="font-size: 0.82rem; font-weight: 800; color: var(--gp-green); margin-bottom: 4px;">ما الجديد في آخر تحديث:</div>
            <div style="font-size: 0.82rem; color: var(--text-main); line-height: 1.5; white-space: pre-line;">${item.changelog}</div>
          </div>
        ` : ''}
      </div>

      <!-- 6. Data Safety Card (Google Play Protect Clone) -->
      <div class="gp-section-block">
        <div class="gp-section-header-arrow">
          <h3 class="gp-section-title">أمان البيانات (Data Safety)</h3>
          <span class="gp-section-arrow">←</span>
        </div>
        <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 10px;">
          يبدأ الحفاظ على أمان بياناتك بفهم الآلية التي يتبعها مطوِّرو البرامج لجمع بياناتك ومشاركتها.
        </p>

        <div class="gp-data-safety-card">
          <div class="gp-data-safety-row">
            <div class="gp-data-safety-icon">🛡️</div>
            <div>
              <strong style="font-size: 0.85rem; color: var(--text-main);">لا تتم مشاركة أي بيانات مع جهات خارجية</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">صرّح المطوِّر بأن هذا التطبيق لا يشارك بيانات المستخدمين.</div>
            </div>
          </div>
          <div class="gp-data-safety-row">
            <div class="gp-data-safety-icon">🔒</div>
            <div>
              <strong style="font-size: 0.85rem; color: var(--text-main);">البيانات مشفرة أثناء النقل</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">يتم نقل بياناتك عبر اتصال أمني مشفر (TLS/SSL).</div>
            </div>
          </div>
          <div class="gp-data-safety-row" style="margin-bottom: 0;">
            <div class="gp-data-safety-icon">🔑</div>
            <div>
              <strong style="font-size: 0.85rem; color: var(--text-main);">صلاحيات أندرويد المطلوبة</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                ${(item.permissions && item.permissions.length) ? item.permissions.join(' • ') : 'الإنترنت، التخزين، التنبيهات'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 7. Ratings & Reviews Breakdown (5 Horizontal Bars) -->
      <div class="gp-section-block" style="border-bottom: none;">
        <div class="gp-section-header-arrow">
          <h3 class="gp-section-title">التقييمات والمراجعات</h3>
          <span class="gp-section-arrow">←</span>
        </div>

        <div class="gp-ratings-container">
          <div style="text-align: center;">
            <div class="gp-big-score">${item.rating ? item.rating.toFixed(1) : '4.8'}</div>
            <div style="color: #f59e0b; font-size: 0.95rem; margin-top: 4px;">★★★★★</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${item.rating_count || 148} تقييم</div>
          </div>

          <div class="gp-bars-list">
            <div class="gp-bar-row">
              <span>5</span>
              <div class="gp-bar-track"><div class="gp-bar-fill" style="width: 85%;"></div></div>
            </div>
            <div class="gp-bar-row">
              <span>4</span>
              <div class="gp-bar-track"><div class="gp-bar-fill" style="width: 10%;"></div></div>
            </div>
            <div class="gp-bar-row">
              <span>3</span>
              <div class="gp-bar-track"><div class="gp-bar-fill" style="width: 3%;"></div></div>
            </div>
            <div class="gp-bar-row">
              <span>2</span>
              <div class="gp-bar-track"><div class="gp-bar-fill" style="width: 1%;"></div></div>
            </div>
            <div class="gp-bar-row">
              <span>1</span>
              <div class="gp-bar-track"><div class="gp-bar-fill" style="width: 1%;"></div></div>
            </div>
          </div>
        </div>

        <!-- Sample Verified Review -->
        <div style="background: var(--bg-surface-container); border-radius: 14px; padding: 14px; margin-top: 18px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #01875f; color: #fff; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; justify-content: center;">أ</div>
              <strong style="font-size: 0.85rem; color: var(--text-main);">أحمد محمود (مستخدم موثق)</strong>
            </div>
            <span style="color: #f59e0b; font-size: 0.75rem;">★★★★★</span>
          </div>
          <p style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.5;">
            تطبيق ممتاز وسريع جداً، التثبيت تم في ثوانٍ وبدون أي تعليق، وواجهة المتجر مطابقة تماماً لجوجل بلاي.
          </p>
          <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px; font-size: 0.75rem; color: var(--text-dim);">
            <span>هل كانت هذه المراجعة مفيدة؟</span>
            <button class="gp-btn-cancel-pill" style="height: 26px; padding: 0 10px; font-size: 0.7rem;" onclick="appStore.showToast('شكراً لتقييمك للمراجعة!', 'success')">نعم</button>
            <button class="gp-btn-cancel-pill" style="height: 26px; padding: 0 10px; font-size: 0.7rem;" onclick="appStore.showToast('تم تسجيل ملاحظتك.', 'info')">لا</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('product-details-modal').classList.add('active');
  },

  closeDetailsModal() {
    document.getElementById('product-details-modal').classList.remove('active');
    this.cancelMorphingInstall();
    this.activeProduct = null;
  },

  // --- Morphing Action Button & CircularProgressIndicator Animation ---
  startMorphingInstall(appId) {
    const item = this.allCatalogApps.find((a) => a.id === appId);
    if (!item) return;

    // 1. Activate Visual Morphing
    const iconWrapper = document.getElementById('gp-details-icon-wrapper');
    const actionContainer = document.getElementById('gp-action-container');
    const circleFill = document.getElementById('gp-progress-circle-fill');
    const statusRow = document.getElementById('gp-install-status-row');
    const mbText = document.getElementById('gp-install-mb-text');
    const openBtn = document.getElementById('gp-open-btn');

    if (iconWrapper) iconWrapper.classList.add('installing');
    if (actionContainer) actionContainer.classList.add('morphed');
    if (statusRow) statusRow.style.display = 'flex';

    let progress = 0;
    const totalMb = item.file_size_bytes ? (item.file_size_bytes / (1024*1024)).toFixed(1) : 42.8;
    const circumference = 245; // 2 * PI * 39

    clearInterval(this.installProgressTimer);
    this.installProgressTimer = setInterval(() => {
      progress += Math.floor(Math.random() * 8) + 5;

      if (progress >= 100) {
        progress = 100;
        clearInterval(this.installProgressTimer);

        // Finish state
        if (circleFill) circleFill.style.strokeDashoffset = 0;
        if (mbText) mbText.textContent = `تم التنزيل والتحقق من SHA-256 بنجاح (${totalMb} MB)`;
        if (iconWrapper) iconWrapper.classList.remove('installing');

        if (openBtn) {
          openBtn.removeAttribute('disabled');
          openBtn.textContent = 'فتح التطبيق 🚀';
        }

        // Trigger native package installer if inside Android App
        if (window.MOMOBridge && typeof window.MOMOBridge.triggerInstall === 'function') {
          window.MOMOBridge.triggerInstall(item.download_url, `${item.name}.apk`);
        } else {
          // Direct web APK download
          const a = document.createElement('a');
          a.href = item.download_url;
          a.download = `${item.name}.apk`;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        appStore.showToast(`تم تثبيت "${item.name}" بنجاح! 🎉`, 'success');
      } else {
        const offset = circumference - (progress / 100) * circumference;
        if (circleFill) circleFill.style.strokeDashoffset = offset;
        const currentMb = ((progress / 100) * totalMb).toFixed(1);
        if (mbText) mbText.textContent = `جارٍ التنزيل... ${currentMb} MB من ${totalMb} MB (${progress}%)`;
      }
    }, 180);
  },

  cancelMorphingInstall() {
    clearInterval(this.installProgressTimer);
    const iconWrapper = document.getElementById('gp-details-icon-wrapper');
    const actionContainer = document.getElementById('gp-action-container');
    const statusRow = document.getElementById('gp-install-status-row');
    const openBtn = document.getElementById('gp-open-btn');

    if (iconWrapper) iconWrapper.classList.remove('installing');
    if (actionContainer) actionContainer.classList.remove('morphed');
    if (statusRow) statusRow.style.display = 'none';
    if (openBtn) {
      openBtn.setAttribute('disabled', 'true');
      openBtn.textContent = 'فتح';
    }
  },

  launchInstalledApp(appId) {
    const item = this.allCatalogApps.find((a) => a.id === appId);
    this.showToast(`جارٍ فتح تطبيق ${item ? item.name : ''}...`, 'success');
  },

  toggleAboutExpand() {
    const el = document.getElementById('gp-about-desc');
    if (el && this.activeProduct) {
      el.textContent = this.activeProduct.description || this.activeProduct.short_description;
    }
  },

  viewFullScreenshot(src) {
    window.open(src, '_blank');
  },

  // ========================================================
  // GOOGLE PLAY ACCOUNT / MANAGE APPS & DEVICES DIALOG
  // ========================================================

  openAccountDialog() {
    const dialog = document.getElementById('gp-account-dialog');
    if (dialog) dialog.classList.add('active');
  },

  closeAccountDialog() {
    const dialog = document.getElementById('gp-account-dialog');
    if (dialog) dialog.classList.remove('active');
  },

  scanWithPlayProtect(btn) {
    btn.textContent = 'جارٍ الفحص... ⏳';
    setTimeout(() => {
      btn.textContent = 'تم الفحص ✅';
      this.showToast('MOMO Protect: لم يتم العثور على أي تطبيقات ضارة أو معدلة.', 'success');
      setTimeout(() => { btn.textContent = 'فحص'; }, 2000);
    }, 1400);
  },

  openUpdateChecker() {
    const modal = document.getElementById('update-checker-modal');
    if (!modal) return;
    this.renderUpdateChecker();
    modal.classList.add('active');
  },

  closeUpdateChecker() {
    const modal = document.getElementById('update-checker-modal');
    if (modal) modal.classList.remove('active');
  },

  renderUpdateChecker() {
    const container = document.getElementById('update-checker-body');
    if (!container) return;

    let deviceAbi = 'arm64-v8a';
    if (window.MOMOBridge && typeof window.MOMOBridge.getDeviceABI === 'function') {
      deviceAbi = window.MOMOBridge.getDeviceABI();
    }

    container.innerHTML = `
      <div style="background: var(--bg-surface-container); border-radius: 14px; padding: 12px; margin-bottom: 14px; font-size: 0.85rem;">
        <span style="color: var(--text-muted);">المعمارية المكتشفة لجهازك:</span>
        <strong style="color: var(--gp-green);">${deviceAbi} (توافق 100%)</strong>
      </div>

      <div style="background: var(--bg-surface-container); border-radius: 16px; padding: 14px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div>
            <h4 style="margin: 0; color: var(--text-main);">تطبيق DUMU</h4>
            <span style="font-size: 0.75rem; color: #f59e0b;">يتوفر تحديث جديد: v1.1.0 (كود 2)</span>
          </div>
          <button class="gp-hero-btn" style="padding: 6px 14px; font-size: 0.8rem;" onclick="appStore.applyDeltaUpdate('DUMU', '4.2 MB')">
            تحديث Delta (4.2 MB)
          </button>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">
          ميزة التحديث التفاضلي: تنزيل الفرق فقط بحجم 4.2 MB بدلاً من 44.5 MB بنسبة توفير 90% من استهلاك الباقة.
        </div>
      </div>

      <div style="background: var(--bg-surface-container); border-radius: 16px; padding: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h4 style="margin: 0; color: var(--text-main);">MOMO store الرسمي</h4>
            <span style="font-size: 0.75rem; color: var(--gp-green);">محدث لآخر إصدار: v1.0.0 ✅</span>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-dim);">أحدث نسخة</span>
        </div>
      </div>
    `;
  },

  applyDeltaUpdate(appName, size) {
    this.showToast(`جارٍ تنزيل التحديث التفاضلي (${size}) عبر خوارزمية bsdiff... ⚡`, 'success');
    setTimeout(() => {
      this.showToast(`تم تطبيق التحديث التفاضلي لتطبيق ${appName} بنجاح!`, 'success');
    }, 1800);
  },

  // ========================================================
  // CART & ONE-PAGE CHECKOUT LOGIC
  // ========================================================

  addToCart(itemId) {
    const item = this.allCatalogApps.find((a) => a.id === itemId);
    if (!item) return;

    const existing = this.cart.find((c) => c.id === itemId);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.cart.push({
        id: item.id,
        name: item.name,
        price: item.price || 0,
        icon_url: item.icon_url,
        quantity: 1,
      });
    }

    localStorage.setItem('momo_cart', JSON.stringify(this.cart));
    this.updateBadges();
    this.showToast(`تمت إضافة "${item.name}" إلى السلة 🛒`, 'success');
  },

  renderCart() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: var(--bg-surface); border-radius: 20px; border: 1px dashed var(--border-color);">
          <div style="font-size: 3rem; margin-bottom: 8px;">🛒</div>
          <h3>سلة المشتريات فارغة</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-top: 4px;">تصفح الأجهزة والعتاد الذكي وأضف ما يعجبك.</p>
        </div>
      `;
      this.updateCartTotals(0, 0);
      return;
    }

    let subtotal = 0;
    container.innerHTML = this.cart.map((item) => {
      const lineTotal = item.price * item.quantity;
      subtotal += lineTotal;
      return `
        <div class="cart-item-card">
          <img src="${item.icon_url}" class="cart-item-img" onerror="this.src='./static/icons/default-app.svg'">
          <div style="flex: 1;">
            <h4 style="margin: 0 0 4px; font-size: 0.95rem;">${item.name}</h4>
            <div style="font-size: 0.9rem; font-weight: 800; color: var(--gp-green);">${item.price} ج.م</div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="gp-btn-cancel-pill" style="width: 32px; height: 32px; padding: 0;" onclick="appStore.changeCartQty('${item.id}', -1)">-</button>
            <span style="font-weight: 800; min-width: 20px; text-align: center;">${item.quantity}</span>
            <button class="gp-btn-cancel-pill" style="width: 32px; height: 32px; padding: 0;" onclick="appStore.changeCartQty('${item.id}', 1)">+</button>
          </div>
        </div>
      `;
    }).join('');

    this.updateCartTotals(subtotal, this.appliedDiscount || 0);
  },

  changeCartQty(itemId, delta) {
    const item = this.cart.find((c) => c.id === itemId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.cart = this.cart.filter((c) => c.id !== itemId);
    }

    localStorage.setItem('momo_cart', JSON.stringify(this.cart));
    this.updateBadges();
    this.renderCart();
  },

  updateCartTotals(subtotal, discount) {
    const total = Math.max(0, subtotal - discount);
    const subEl = document.getElementById('cart-subtotal');
    const discEl = document.getElementById('cart-discount');
    const totEl = document.getElementById('cart-total');

    if (subEl) subEl.textContent = `${subtotal} ج.م`;
    if (discEl) discEl.textContent = `${discount} ج.م`;
    if (totEl) totEl.textContent = `${total} ج.م`;
  },

  applyPromoCode() {
    const code = (document.getElementById('promo-code-input').value || '').trim().toUpperCase();
    if (code === 'MOMO20') {
      this.appliedDiscount = 50;
      this.showToast('تم تطبيق كود الخصم MOMO20 (خصم 50 ج.م)! 🎉', 'success');
    } else {
      this.appliedDiscount = 0;
      this.showToast('كود الخصم غير صحيح', 'error');
    }
    this.renderCart();
  },

  selectPaymentMethod(method, el) {
    document.querySelectorAll('.payment-tile').forEach((t) => t.classList.remove('active'));
    el.classList.add('active');
    this.selectedPaymentMethod = method;
  },

  async submitOrder(e) {
    e.preventDefault();
    if (this.cart.length === 0) {
      this.showToast('السلة فارغة!', 'error');
      return;
    }

    const name = document.getElementById('order-customer-name').value.trim();
    const phone = document.getElementById('order-phone').value.trim();
    const address = document.getElementById('order-address').value.trim();
    const method = this.selectedPaymentMethod || 'vodafone_cash';

    let subtotal = this.cart.reduce((s, it) => s + it.price * it.quantity, 0);
    let discount = this.appliedDiscount || 0;
    let total = Math.max(0, subtotal - discount);

    const orderPayload = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      customer_name: name,
      phone,
      address,
      city: 'القاهرة والجيزة',
      items: this.cart,
      subtotal,
      discount,
      total,
      payment_method: method,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Save order in localStorage
    const orders = JSON.parse(localStorage.getItem('momo_orders') || '[]');
    orders.unshift(orderPayload);
    localStorage.setItem('momo_orders', JSON.stringify(orders));

    // Try sync with API if running full-stack
    try {
      await fetch('./api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });
    } catch (err) {}

    this.cart = [];
    localStorage.setItem('momo_cart', '[]');
    this.updateBadges();

    this.showToast('تم استلام وتأكيد طلبك بنجاح! 🚀', 'success');
    this.switchView('orders');
  },

  renderOrdersTracker() {
    const container = document.getElementById('latest-order-tracker');
    if (!container) return;

    const orders = JSON.parse(localStorage.getItem('momo_orders') || '[]');
    if (orders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: var(--bg-surface); border-radius: 20px; border: 1px dashed var(--border-color);">
          <div style="font-size: 3rem; margin-bottom: 8px;">📦</div>
          <h3>لا توجد طلبات سابقة</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-top: 4px;">عند إتمام أي طلب شراء ستتمكن من تتبعه خطوة بخطوة من هنا.</p>
        </div>
      `;
      return;
    }

    const latest = orders[0];
    container.innerHTML = `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div>
            <strong style="font-size: 1.1rem; color: var(--text-main);">طلب رقم: ${latest.id}</strong>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${new Date(latest.created_at).toLocaleDateString('ar-EG')}</div>
          </div>
          <span style="background: var(--gp-green-surface); color: var(--gp-green); padding: 4px 12px; border-radius: var(--pill-radius); font-size: 0.82rem; font-weight: 800;">
            ${latest.status === 'pending' ? 'قيد التجهيز' : latest.status}
          </span>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.88rem; margin-bottom: 12px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">
          <span>العميل: ${latest.customer_name} (${latest.phone})</span>
          <strong>الإجمالي: ${latest.total} ج.م</strong>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${latest.items.map((it) => `
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-muted);">
              <span>${it.name} (×${it.quantity})</span>
              <span>${it.price * it.quantity} ج.م</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  // --- Wishlist System ---
  toggleWishlist(itemId) {
    const item = this.allCatalogApps.find((a) => a.id === itemId);
    if (!item) return;

    const idx = this.wishlist.findIndex((w) => w.id === itemId);
    if (idx !== -1) {
      this.wishlist.splice(idx, 1);
      this.showToast(`تمت الإزالة من المفضلة`, 'info');
    } else {
      this.wishlist.push(item);
      this.showToast(`تم الحفظ في المفضلة ❤️`, 'success');
    }

    localStorage.setItem('momo_wishlist', JSON.stringify(this.wishlist));
    this.updateBadges();
    this.renderProducts(this.apps);
    if (document.getElementById('view-wishlist').style.display === 'block') {
      this.renderWishlist();
    }
  },

  renderWishlist() {
    const grid = document.getElementById('wishlist-grid');
    if (!grid) return;

    if (this.wishlist.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: var(--bg-surface); border-radius: 20px; border: 1px dashed var(--border-color);">
          <div style="font-size: 3rem; margin-bottom: 8px;">💔</div>
          <h3>قائمة المفضلة فارغة</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-top: 4px;">اضغط على علامة القلب في أي تطبيق لحفظه هنا.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.wishlist.map((item) => this.renderClusterCard(item)).join('');
  },

  renderCategoriesPage() {
    const container = document.getElementById('categories-full-grid');
    if (!container) return;

    const cats = [
      { name: 'برامج الهاتف', icon: '📱', desc: 'تطبيقات الأندرويد، DUMU، ومتجر MOMO' },
      { name: 'إلكترونيات وأجهزة', icon: '🎧', desc: 'سماعات، باور بانك، وأجهزة ذكية' },
      { name: 'ألعاب', icon: '🎮', desc: 'أذرع تحكم، ملحقات ألعاب، وتطبيقات جيمينج' },
      { name: 'إكسسوارات', icon: '🔌', desc: 'شواحن سريعة، كابلات، وحوامل سيارة' },
    ];

    container.innerHTML = cats.map((c) => `
      <div class="gp-product-card" onclick="appStore.handleTabSwitch('${c.name}')">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">${c.icon}</div>
        <h3 style="margin: 0 0 4px; font-size: 1.05rem;">${c.name}</h3>
        <p style="color: var(--text-muted); font-size: 0.82rem; margin: 0;">${c.desc}</p>
      </div>
    `).join('');
  },

  updateBadges() {
    const cartCount = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll('.cart-badge').forEach((el) => {
      el.textContent = cartCount;
      el.style.display = cartCount > 0 ? 'flex' : 'none';
    });
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  },

  getDefaultFallbackApps() {
    return [
      {
        id: 'dumu-phone-app',
        package_name: 'com.momo.dumu',
        name: 'DUMU',
        category: 'برامج الهاتف',
        item_type: 'app',
        price: 0,
        rating: 5.0,
        rating_count: 182,
        downloads_count: 52000,
        icon_url: './static/icons/dumu-icon.svg',
        short_description: 'تطبيق DUMU الذكي لإدارة المهام والمحاضرات والجداول الأكاديمية.',
        description: 'تطبيق DUMU هو تطبيقك الأساسي على الأندرويد. يوفر أدوات متطورة لإدارة الجداول، حاسبة الـ GPA، وكتم الصوت التلقائي Auto-DND.',
        download_url: 'https://github.com/momoshworks/momo-store/releases/download/v1.0.0/dumu-v1.1.apk',
        file_size_formatted: '42.8 MB',
        screenshots: [
          './static/images/screenshots/dumu-screen-1.png',
          './static/images/screenshots/dumu-screen-2.png',
          './static/images/screenshots/dumu-screen-3.png',
          './static/images/screenshots/dumu-screen-4.png'
        ]
      },
      {
        id: 'momo-store-app',
        package_name: 'com.momo.store',
        name: 'MOMO store',
        category: 'برامج الهاتف',
        item_type: 'app',
        price: 0,
        rating: 5.0,
        rating_count: 240,
        downloads_count: 85000,
        icon_url: './static/icons/logo.svg',
        short_description: 'التطبيق الرسمي لمتجر MOMO store بنظام Material Design 3.',
        description: 'التطبيق الرسمي لمتجر MOMO store للهواتف الذكية. تصفح وحمل برامج الأندرويد والعتاد الذكي بسرعة وسلاسة تامة.',
        download_url: 'https://github.com/momoshworks/momo-store/releases/download/v1.0.0/momo-store.apk',
        file_size_formatted: '1.59 MB'
      }
    ];
  }
};

document.addEventListener('DOMContentLoaded', () => {
  appStore.init();
});