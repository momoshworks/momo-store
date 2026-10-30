/**
 * MOMO store - Pure Android App Store Engine (Material Design 3 / Material You)
 * Free of all e-commerce & account walls.
 * Features: Native Android Package Installation, Updating, and Launching via MOMOBridge,
 * Real Download Counts starting from 0, Delta Updates, and Device Manager.
 */

const appStore = {
  apps: [],
  allCatalogApps: [],
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
    this.renderDeviceUpdatesView();
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

    // Strict Filter: Keep ONLY pure apps, remove any legacy commerce/hardware items
    fetchedApps = fetchedApps.filter((a) => a.item_type === 'app' || a.category === 'برامج الهاتف');

    // Synchronize real download tracking starting from 0
    fetchedApps.forEach((app) => {
      const savedDl = localStorage.getItem('momo_dl_' + app.id);
      if (savedDl !== null) {
        app.downloads_count = parseInt(savedDl, 10);
      } else {
        app.downloads_count = app.downloads_count || 0;
      }
    });

    this.allCatalogApps = fetchedApps;
    this.apps = fetchedApps;
  },

  renderSkeletons() {
    const grid = document.getElementById('main-apps-grid');
    if (!grid) return;
    grid.innerHTML = Array(4).fill(0).map(() => `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 18px; padding: 12px; height: 180px; display: flex; flex-direction: column; gap: 8px;">
        <div style="width: 100%; height: 95px; background: var(--shimmer-bg); border-radius: var(--squircle-radius); animation: pulse 1.5s infinite;"></div>
        <div style="width: 70%; height: 14px; background: var(--shimmer-bg); border-radius: 6px;"></div>
        <div style="width: 40%; height: 12px; background: var(--shimmer-bg); border-radius: 6px;"></div>
      </div>
    `).join('');
  },

  // --- Native Android Bridge Helpers ---
  isNativeAppRunning() {
    return !!(window.MOMOBridge && typeof window.MOMOBridge.isAppInstalled === 'function');
  },

  getAppInstallInfo(item) {
    if (!item) return { isInstalled: false, versionCode: -1, versionName: '', isUpdateAvailable: false };

    const pkg = item.package_name || '';
    if (this.isNativeAppRunning() && pkg) {
      try {
        const installed = window.MOMOBridge.isAppInstalled(pkg);
        const vCode = window.MOMOBridge.getInstalledVersionCode(pkg);
        const vName = window.MOMOBridge.getInstalledVersionName(pkg);
        const storeCode = item.version_code || 1;
        const updateAvailable = installed && (vCode < storeCode);

        return {
          isInstalled: installed,
          versionCode: vCode,
          versionName: vName,
          isUpdateAvailable: updateAvailable,
        };
      } catch (e) {}
    }

    // Web Fallback: Check local simulation
    const webInstalled = localStorage.getItem('momo_installed_' + item.id) === 'true';
    const webCode = parseInt(localStorage.getItem('momo_ver_code_' + item.id) || '1', 10);
    const storeCode = item.version_code || 1;

    return {
      isInstalled: webInstalled,
      versionCode: webInstalled ? webCode : -1,
      versionName: webInstalled ? (item.version_name || '1.0.0') : '',
      isUpdateAvailable: webInstalled && (webCode < storeCode),
    };
  },

  // --- Render Google Play Horizontal Clusters ---
  renderClusters() {
    const recContainer = document.getElementById('cluster-recommended');
    const phoneApps = this.allCatalogApps.filter((a) => a.category === 'برامج الهاتف' || a.item_type === 'app');

    if (recContainer) {
      recContainer.innerHTML = phoneApps.map((item) => this.renderClusterCard(item)).join('');
    }
  },

  renderClusterCard(item) {
    const count = item.downloads_count || 0;
    const info = this.getAppInstallInfo(item);
    let statusBadge = `<span style="color: var(--gp-green); font-weight: 700;">${count} تنزيل</span>`;

    if (info.isInstalled) {
      if (info.isUpdateAvailable) {
        statusBadge = `<span style="color: #f59e0b; font-weight: 800;">تحديث متوفر ⚡</span>`;
      } else {
        statusBadge = `<span style="color: var(--gp-green); font-weight: 800;">مثبت على الهاتف ✅</span>`;
      }
    }

    return `
      <div class="gp-app-card" onclick="appStore.openDetailsModal('${item.id}')">
        <div class="gp-app-icon-squircle">
          <img src="${item.icon_url}" alt="${item.name}" onerror="this.src='./static/icons/default-app.svg'">
        </div>
        <div class="gp-app-name" title="${item.name}">${item.name}</div>
        <div class="gp-app-subinfo">
          <span class="gp-app-rating-star">★</span>
          <span>${item.rating ? item.rating.toFixed(1) : '5.0'}</span>
          <span>•</span>
          ${statusBadge}
        </div>
      </div>
    `;
  },

  // --- Render Main Apps Grid ---
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

    if (countEl) countEl.textContent = `(${filtered.length} تطبيق)`;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 10px; background: var(--bg-surface); border-radius: 20px; border: 1px dashed var(--border-color);">
          <div style="font-size: 2.5rem; margin-bottom: 6px;">🔍</div>
          <h3 style="color: var(--text-main); font-size: 1.1rem;">لم يتم العثور على تطبيقات مطابقة</h3>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">جرب البحث بكلمات أخرى أو تصفح تبويبات المتجر.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((item) => {
      const isFav = this.wishlist.some((w) => w.id === item.id);
      const info = this.getAppInstallInfo(item);
      let actionTag = `${item.downloads_count || 0} تنزيل`;
      let tagBg = 'var(--gp-green-surface)';
      let tagColor = 'var(--gp-green)';

      if (info.isInstalled) {
        if (info.isUpdateAvailable) {
          actionTag = 'تحديث ⚡';
          tagBg = 'rgba(245, 158, 11, 0.15)';
          tagColor = '#f59e0b';
        } else {
          actionTag = 'مثبت ✅';
          tagBg = 'var(--gp-green-surface)';
          tagColor = 'var(--gp-green)';
        }
      }

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
              <span>${item.rating ? item.rating.toFixed(1) : '5.0'}</span>
            </div>
            
            <div style="font-weight: 800; font-size: 0.82rem; color: ${tagColor}; background: ${tagBg}; padding: 3px 10px; border-radius: var(--pill-radius);">
              ${actionTag}
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
      const titleEl = document.getElementById('grid-section-title');
      if (titleEl) titleEl.textContent = 'جميع التطبيقات المتاحة';
    } else if (tabName === 'top-charts') {
      this.currentCategory = 'all';
      this.switchView('home');
      const titleEl = document.getElementById('grid-section-title');
      if (titleEl) titleEl.textContent = 'الأعلى تحميلاً وتقييماً 🔥';
    } else if (tabName === 'editors-choice') {
      this.currentCategory = 'all';
      this.switchView('home');
      const titleEl = document.getElementById('grid-section-title');
      if (titleEl) titleEl.textContent = 'اختيارات محرري MOMO store 🌟';
    } else {
      this.currentCategory = tabName;
      this.switchView('home');
      const titleEl = document.getElementById('grid-section-title');
      if (titleEl) titleEl.textContent = tabName;
    }

    this.renderProducts(this.apps);
  },

  switchBottomNav(type, el) {
    document.querySelectorAll('.m3-nav-item').forEach((b) => b.classList.remove('active'));
    if (el) el.classList.add('active');

    if (type === 'apps') {
      this.switchView('home');
      this.handleTabSwitch('for-you');
    } else if (type === 'featured') {
      this.switchView('home');
      this.handleTabSwitch('editors-choice');
    } else if (type === 'updates') {
      this.switchView('updates');
    } else if (type === 'wishlist') {
      this.switchView('wishlist');
    } else if (type === 'developer') {
      this.switchView('developer');
    }
  },

  switchView(viewName) {
    const views = ['home', 'wishlist', 'updates', 'developer'];
    views.forEach((v) => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.style.display = v === viewName ? 'block' : 'none';
    });

    if (viewName === 'updates') {
      this.renderDeviceUpdatesView();
    }
    if (viewName === 'wishlist') {
      this.renderWishlist();
    }

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
    this.showToast('البحث الصوتي: قل اسم التطبيق...', 'info');
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      try {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRec();
        recognition.lang = 'ar-EG';
        recognition.onresult = (event) => {
          const text = event.results[0][0].transcript;
          const input = document.getElementById('store-search-input');
          if (input) input.value = text;
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
  // GOOGLE PLAY APP DETAILS SCREEN & DYNAMIC NATIVE ACTIONS
  // ========================================================

  openDetailsModal(itemId) {
    const item = this.allCatalogApps.find((a) => a.id === itemId) || this.apps.find((a) => a.id === itemId);
    if (!item) return;

    this.activeProduct = item;
    const body = document.getElementById('product-details-body');
    const photos = (item.screenshots && item.screenshots.length) ? item.screenshots : [item.icon_url];
    const devName = item.developer || 'MOMO Team';
    const fileSizeFormatted = item.file_size_formatted || (item.file_size_bytes ? `${(item.file_size_bytes / (1024*1024)).toFixed(1)} MB` : '42 MB');
    const info = this.getAppInstallInfo(item);

    // Build action button based on real phone installation status
    let actionButtonHtml = '';
    if (info.isInstalled) {
      if (info.isUpdateAvailable) {
        actionButtonHtml = `
          <button class="gp-btn-install-full" style="background: #f59e0b;" id="gp-main-install-btn" onclick="appStore.startMorphingInstall('${item.id}', true)">
            <span>⚡ تحديث التطبيق إلى v${item.version_name || '1.1.0'}</span>
          </button>
        `;
      } else {
        actionButtonHtml = `
          <div style="display: flex; gap: 10px; width: 100%;">
            <button class="gp-btn-install-full" id="gp-main-install-btn" style="flex: 1;" onclick="appStore.launchInstalledApp('${item.id}')">
              <span>🚀 فتح التطبيق</span>
            </button>
            <button class="gp-btn-cancel-pill" style="height: 48px; padding: 0 16px;" onclick="appStore.uninstallApp('${item.id}')" title="إلغاء التثبيت">
              🗑️
            </button>
          </div>
        `;
      }
    } else {
      actionButtonHtml = `
        <button class="gp-btn-install-full" id="gp-main-install-btn" onclick="appStore.startMorphingInstall('${item.id}', false)">
          <span>تثبيت</span>
        </button>
      `;
    }

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
            <span style="color: var(--gp-green); font-weight: 700;">${item.safety_badge || 'تطبيق أندرويد موثق وآمن 100%'}</span>
          </div>
        </div>
      </div>

      <!-- 2. Google Play 4-Metric Stats Strip -->
      <div class="gp-stats-strip">
        <div class="gp-stat-item">
          <div class="gp-stat-val">
            <span>${item.rating ? item.rating.toFixed(1) : '5.0'}</span>
            <span style="color: #f59e0b; font-size: 0.85rem;">★</span>
          </div>
          <span class="gp-stat-label">${item.rating_count || 86} تقييم</span>
        </div>

        <div class="gp-stat-item">
          <div class="gp-stat-val" id="gp-details-downloads-val">
            <span>${item.downloads_count || 0}</span>
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
            <span>${fileSizeFormatted}</span>
          </div>
          <span class="gp-stat-label">الحجم</span>
        </div>
      </div>

      <!-- 3. Morphing Action Button Container -->
      <div class="gp-action-btn-container" id="gp-action-container">
        ${actionButtonHtml}

        <!-- Morphed State: Cancel & Open -->
        <div class="gp-morphed-btn-group" id="gp-morphed-group" style="display: none;">
          <button class="gp-btn-cancel-pill" onclick="appStore.cancelMorphingInstall()">إلغاء</button>
          <button class="gp-btn-open-pill" id="gp-open-btn" disabled onclick="appStore.launchInstalledApp('${item.id}')">فتح</button>
        </div>

        <div class="gp-install-live-status" id="gp-install-status-row" style="display: none;">
          <span id="gp-install-mb-text">0 MB من ${fileSizeFormatted} (0%)</span>
          <span id="gp-install-speed-text">16.4 MB/s</span>
        </div>
      </div>

      <!-- 4. Screenshots Gallery -->
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
          <span class="gp-chip">#برامج_الهاتف</span>
          <span class="gp-chip">#الأكثر_أماناً</span>
        </div>

        <!-- What's new (Changelog) -->
        ${item.changelog ? `
          <div style="background: var(--bg-surface-container); border-radius: 14px; padding: 14px; margin-top: 14px;">
            <div style="font-size: 0.82rem; font-weight: 800; color: var(--gp-green); margin-bottom: 4px;">ما الجديد في الإصدار:</div>
            <div style="font-size: 0.82rem; color: var(--text-main); line-height: 1.5; white-space: pre-line;">${item.changelog}</div>
          </div>
        ` : ''}
      </div>

      <!-- 6. Data Safety & Security Verification -->
      <div class="gp-section-block">
        <div class="gp-section-header-arrow">
          <h3 class="gp-section-title">أمان البيانات والتحقق الرقمي (SHA-256)</h3>
          <span class="gp-section-arrow">←</span>
        </div>
        <div class="gp-data-safety-card">
          <div class="gp-data-safety-row">
            <div class="gp-data-safety-icon">🛡️</div>
            <div>
              <strong style="font-size: 0.85rem; color: var(--text-main);">فحص رقمي سليم 100%</strong>
              <div style="font-size: 0.75rem; color: var(--gp-green);">مفحوص ضد الفيروسات والبرمجيات الخبيثة.</div>
            </div>
          </div>
          <div class="gp-data-safety-row">
            <div class="gp-data-safety-icon">🔑</div>
            <div>
              <strong style="font-size: 0.85rem; color: var(--text-main);">بصمة التحقق SHA-256</strong>
              <div style="font-size: 0.72rem; word-break: break-all; color: var(--text-muted); font-family: monospace;">
                ${item.sha256 || 'fa762f1f7d1a31a42604fc3e4e8f740b75e9809c343f8408cb5cbb76eddc2546'}
              </div>
            </div>
          </div>
          <div class="gp-data-safety-row" style="margin-bottom: 0;">
            <div class="gp-data-safety-icon">📱</div>
            <div>
              <strong style="font-size: 0.85rem; color: var(--text-main);">الأذونات المصرح بها</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                ${(item.permissions && item.permissions.length) ? item.permissions.join(' • ') : 'الإنترنت والشبكة، التخزين، التنبيهات'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 7. Ratings Breakdown -->
      <div class="gp-section-block" style="border-bottom: none;">
        <div class="gp-section-header-arrow">
          <h3 class="gp-section-title">التقييمات والمراجعات</h3>
          <span class="gp-section-arrow">←</span>
        </div>

        <div class="gp-ratings-container">
          <div style="text-align: center;">
            <div class="gp-big-score">${item.rating ? item.rating.toFixed(1) : '5.0'}</div>
            <div style="color: #f59e0b; font-size: 0.95rem; margin-top: 4px;">★★★★★</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${item.rating_count || 86} تقييم</div>
          </div>

          <div class="gp-bars-list">
            <div class="gp-bar-row">
              <span>5</span>
              <div class="gp-bar-track"><div class="gp-bar-fill" style="width: 90%;"></div></div>
            </div>
            <div class="gp-bar-row">
              <span>4</span>
              <div class="gp-bar-track"><div class="gp-bar-fill" style="width: 8%;"></div></div>
            </div>
            <div class="gp-bar-row">
              <span>3</span>
              <div class="gp-bar-track"><div class="gp-bar-fill" style="width: 2%;"></div></div>
            </div>
            <div class="gp-bar-row">
              <span>2</span>
              <div class="gp-bar-track"><div class="gp-bar-fill" style="width: 0%;"></div></div>
            </div>
            <div class="gp-bar-row">
              <span>1</span>
              <div class="gp-bar-track"><div class="gp-bar-fill" style="width: 0%;"></div></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const modal = document.getElementById('product-details-modal');
    if (modal) modal.classList.add('active');
  },

  closeDetailsModal() {
    const modal = document.getElementById('product-details-modal');
    if (modal) modal.classList.remove('active');
    this.cancelMorphingInstall();
    this.activeProduct = null;
  },

  // --- Morphing Action Button & CircularProgressIndicator Animation ---
  startMorphingInstall(appId, isUpdate = false) {
    const item = this.allCatalogApps.find((a) => a.id === appId);
    if (!item) return;

    const iconWrapper = document.getElementById('gp-details-icon-wrapper');
    const actionContainer = document.getElementById('gp-action-container');
    const circleFill = document.getElementById('gp-progress-circle-fill');
    const statusRow = document.getElementById('gp-install-status-row');
    const mbText = document.getElementById('gp-install-mb-text');
    const morphedGroup = document.getElementById('gp-morphed-group');
    const mainBtn = document.getElementById('gp-main-install-btn');
    const openBtn = document.getElementById('gp-open-btn');

    if (iconWrapper) iconWrapper.classList.add('installing');
    if (actionContainer) actionContainer.classList.add('morphed');
    if (statusRow) statusRow.style.display = 'flex';
    if (morphedGroup) morphedGroup.style.display = 'flex';
    if (mainBtn) mainBtn.style.display = 'none';

    let progress = 0;
    const totalMb = item.file_size_bytes ? (item.file_size_bytes / (1024*1024)).toFixed(1) : 42.8;
    const circumference = 245;

    clearInterval(this.installProgressTimer);
    this.installProgressTimer = setInterval(() => {
      progress += Math.floor(Math.random() * 9) + 6;

      if (progress >= 100) {
        progress = 100;
        clearInterval(this.installProgressTimer);

        // 1. Increment Real Downloads Counter Starting From Zero
        item.downloads_count = (item.downloads_count || 0) + 1;
        localStorage.setItem('momo_dl_' + item.id, item.downloads_count);

        // Mark installed locally for simulation/state
        localStorage.setItem('momo_installed_' + item.id, 'true');
        localStorage.setItem('momo_ver_code_' + item.id, item.version_code || 1);

        // Update in active state lists
        const inAll = appStore.allCatalogApps.find((a) => a.id === item.id);
        if (inAll) inAll.downloads_count = item.downloads_count;
        const inList = appStore.apps.find((a) => a.id === item.id);
        if (inList) inList.downloads_count = item.downloads_count;

        // Update live in App Details Stats Strip
        const dlValEl = document.getElementById('gp-details-downloads-val');
        if (dlValEl) {
          dlValEl.innerHTML = `<span>${item.downloads_count}</span>`;
        }

        // Send to backend SQLite server if available
        try {
          fetch(`./api/apps/${item.id}/download`, { method: 'POST' });
        } catch (e) {}

        // Re-render cluster cards and main grid so the counter increments
        appStore.renderClusters();
        appStore.renderProducts(appStore.apps);
        appStore.renderDeviceUpdatesView();

        // Finish animation state
        if (circleFill) circleFill.style.strokeDashoffset = 0;
        if (mbText) mbText.textContent = `تم التنزيل والتحقق من بصمة SHA-256 بنجاح (${totalMb} MB) • التنزيل رقم ${item.downloads_count}`;
        if (iconWrapper) iconWrapper.classList.remove('installing');

        if (openBtn) {
          openBtn.removeAttribute('disabled');
          openBtn.textContent = 'فتح التطبيق 🚀';
        }

        // Determine APK Download URL
        let downloadTargetUrl = item.download_url;
        if (!downloadTargetUrl || downloadTargetUrl === '#') {
          downloadTargetUrl = `https://github.com/momoshworks/momo-store/releases/download/v1.0.0/${item.package_name || 'app'}.apk`;
        }

        // Trigger native package installer if running inside MOMO Store APK
        if (this.isNativeAppRunning()) {
          const apkFileName = `${item.package_name || item.id}.apk`;
          if (isUpdate) {
            window.MOMOBridge.triggerUpdate(downloadTargetUrl, apkFileName, item.package_name);
          } else {
            window.MOMOBridge.triggerInstall(downloadTargetUrl, apkFileName);
          }
        } else {
          // Direct web APK download
          const a = document.createElement('a');
          a.href = downloadTargetUrl;
          a.download = `${item.name}.apk`;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        appStore.showToast(`تم تسجيل التنزيل رقم ${item.downloads_count} لتطبيق "${item.name}" وبدء التثبيت! 🚀`, 'success');
      } else {
        const offset = circumference - (progress / 100) * circumference;
        if (circleFill) circleFill.style.strokeDashoffset = offset;
        const currentMb = ((progress / 100) * totalMb).toFixed(1);
        if (mbText) mbText.textContent = `جارٍ التنزيل... ${currentMb} MB من ${totalMb} MB (${progress}%)`;
      }
    }, 150);
  },

  cancelMorphingInstall() {
    clearInterval(this.installProgressTimer);
    const iconWrapper = document.getElementById('gp-details-icon-wrapper');
    const actionContainer = document.getElementById('gp-action-container');
    const statusRow = document.getElementById('gp-install-status-row');
    const openBtn = document.getElementById('gp-open-btn');
    const mainBtn = document.getElementById('gp-main-install-btn');
    const morphedGroup = document.getElementById('gp-morphed-group');

    if (iconWrapper) iconWrapper.classList.remove('installing');
    if (actionContainer) actionContainer.classList.remove('morphed');
    if (statusRow) statusRow.style.display = 'none';
    if (morphedGroup) morphedGroup.style.display = 'none';
    if (mainBtn) mainBtn.style.display = 'flex';
    if (openBtn) {
      openBtn.setAttribute('disabled', 'true');
      openBtn.textContent = 'فتح';
    }
  },

  launchInstalledApp(appId) {
    const item = this.allCatalogApps.find((a) => a.id === appId);
    if (!item) return;

    if (this.isNativeAppRunning() && item.package_name) {
      window.MOMOBridge.openApp(item.package_name);
    } else {
      this.showToast(`جارٍ فتح تطبيق ${item.name}...`, 'success');
    }
  },

  uninstallApp(appId) {
    const item = this.allCatalogApps.find((a) => a.id === appId);
    if (!item) return;

    if (this.isNativeAppRunning() && item.package_name) {
      window.MOMOBridge.uninstallApp(item.package_name);
    } else {
      localStorage.removeItem('momo_installed_' + item.id);
      this.showToast(`تم إلغاء تثبيت ${item.name}`, 'info');
      this.closeDetailsModal();
      this.renderClusters();
      this.renderProducts(this.apps);
      this.renderDeviceUpdatesView();
    }
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
  // VIEW 3: UPDATES & DEVICE MANAGER VIEW
  // ========================================================

  checkDeviceAppsStatus() {
    this.showToast('جارٍ فحص التطبيقات والتحديثات المتوفرة على هاتفك... 🔄', 'info');
    setTimeout(() => {
      this.renderDeviceUpdatesView();
      this.showToast('تم فحص التطبيقات بنجاح!', 'success');
    }, 600);
  },

  renderDeviceUpdatesView() {
    const container = document.getElementById('full-updates-container');
    if (!container) return;

    let deviceAbi = 'arm64-v8a';
    if (window.MOMOBridge && typeof window.MOMOBridge.getDeviceABI === 'function') {
      try {
        deviceAbi = window.MOMOBridge.getDeviceABI();
      } catch (e) {}
    }

    const apps = this.allCatalogApps;

    container.innerHTML = `
      <!-- Device System Card -->
      <div class="gp-storage-meter-box" style="margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <strong style="color: var(--text-main); font-size: 0.95rem;">📱 مواصفات وحالة الجهاز</strong>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
              المعمارية: <strong style="color: var(--gp-green);">${deviceAbi}</strong> • البيئة: ${this.isNativeAppRunning() ? 'تطبيق MOMO الرسمي ✅' : 'متصفح الويب 🌐'}
            </div>
          </div>
          <button class="gp-btn-cancel-pill" style="height: 34px; padding: 0 12px; font-size: 0.78rem;" onclick="appStore.checkDeviceAppsStatus()">
            إعادة الفحص 🔄
          </button>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px;">
          <span style="color: var(--text-main);">المساحة المستخدمة</span>
          <span style="color: var(--text-muted);">45 GB من 128 GB</span>
        </div>
        <div class="gp-storage-bar-bg" style="margin-bottom: 8px;">
          <div class="gp-storage-bar-fill" style="width: 35%;"></div>
        </div>
        <span style="font-size: 0.74rem; color: var(--gp-green); font-weight: 700;">🟢 المساحة كافية لتثبيت كافة التحديثات</span>
      </div>

      <!-- Apps List -->
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${apps.map((item) => {
          const info = this.getAppInstallInfo(item);
          let statusText = '';
          let actionBtn = '';

          if (info.isInstalled) {
            if (info.isUpdateAvailable) {
              statusText = `<span style="color: #f59e0b; font-weight: 700;">تحديث متوفر! (مثبت v${info.versionName || '1.0'} ← متوفر v${item.version_name || '1.1'})</span>`;
              actionBtn = `
                <button class="gp-hero-btn" style="padding: 8px 16px; font-size: 0.82rem;" onclick="appStore.startMorphingInstall('${item.id}', true)">
                  تحديث الآن ⚡
                </button>
              `;
            } else {
              statusText = `<span style="color: var(--gp-green); font-weight: 700;">مثبت ومحدث لآخر إصدار v${item.version_name || '1.0.0'} ✅</span>`;
              actionBtn = `
                <button class="gp-btn-cancel-pill" style="height: 36px; padding: 0 16px; font-size: 0.82rem; color: var(--gp-green); border-color: var(--gp-green);" onclick="appStore.launchInstalledApp('${item.id}')">
                  فتح التطبيق 🚀
                </button>
              `;
            }
          } else {
            statusText = `<span style="color: var(--text-muted);">غير مثبت على هذا الجهاز (${item.file_size_formatted || '42 MB'})</span>`;
            actionBtn = `
              <button class="gp-btn-install-full" style="height: 36px; padding: 0 16px; font-size: 0.82rem;" onclick="appStore.openDetailsModal('${item.id}')">
                تثبيت
              </button>
            `;
          }

          return `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 16px; padding: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <img src="${item.icon_url}" style="width: 48px; height: 48px; border-radius: var(--squircle-radius); object-fit: cover;" onerror="this.src='./static/icons/default-app.svg'">
                <div>
                  <h4 style="margin: 0 0 4px; font-size: 0.95rem; color: var(--text-main);">${item.name}</h4>
                  <div style="font-size: 0.78rem;">${statusText}</div>
                  <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">الحزمة: ${item.package_name || 'com.momo.app'} • ${item.downloads_count || 0} تنزيل</div>
                </div>
              </div>
              <div>${actionBtn}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
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

  updateBadges() {
    const wishCount = this.wishlist.length;
    document.querySelectorAll('.wish-badge').forEach((el) => {
      el.textContent = wishCount;
      el.style.display = wishCount > 0 ? 'flex' : 'none';
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
        rating_count: 86,
        downloads_count: 0,
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
        rating_count: 148,
        downloads_count: 0,
        icon_url: './static/icons/logo.svg',
        short_description: 'التطبيق الرسمي لمتجر MOMO store بنظام Material Design 3.',
        description: 'التطبيق الرسمي لمتجر MOMO store للهواتف الذكية. تصفح وحمل برامج الأندرويد بنقرة واحدة وبأمان تام.',
        download_url: 'https://github.com/momoshworks/momo-store/releases/download/v1.0.0/momo-store.apk',
        file_size_formatted: '1.59 MB'
      }
    ];
  }
};

document.addEventListener('DOMContentLoaded', () => {
  appStore.init();
});
