/**
 * MOMO store - Client Logic
 * Supports Full-Stack FastAPI API + Automatic Static GitHub Pages Fallback
 */

const appStore = {
  apps: [],
  allCatalogApps: [],
  currentCategory: 'all',
  currentSearch: '',
  currentSort: 'popular',
  activeApp: null,
  deferredPrompt: null,
  currentTheme: localStorage.getItem('momo_theme') || 'dark',

  async init() {
    this.initTheme();
    this.registerServiceWorker();
    this.initPWAInstall();
    await this.fetchApps();
    this.populateCheckerDropdown();
  },

  initTheme() {
    this.setTheme(this.currentTheme);
  },

  setTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('momo_theme', theme);

    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    if (icon && text) {
      if (theme === 'light') {
        icon.textContent = '🌙';
        text.textContent = 'داكن';
      } else {
        icon.textContent = '☀️';
        text.textContent = 'فاتح';
      }
    }
  },

  toggleTheme() {
    const nextTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
    this.showToast(`تم التبديل إلى المظهر ${nextTheme === 'light' ? 'الفاتح ☀️' : 'الداكن 🌙'}`, 'info');
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./static/sw.js').catch((err) => {
        console.log('SW Registration skipped: ', err);
      });
    }
  },

  initPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const btn = document.getElementById('pwa-install-btn');
      if (btn) btn.style.display = 'inline-flex';
    });
  },

  async installPWA() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.showToast('تم تثبيت MOMO store بنجاح على هاتفك!', 'success');
      }
      this.deferredPrompt = null;
      document.getElementById('pwa-install-btn').style.display = 'none';
    }
  },

  switchView(viewName) {
    const views = ['store', 'checker', 'admin'];
    views.forEach((v) => {
      const el = document.getElementById(`view-${v}`);
      const tab = document.getElementById(`tab-${v}`);
      if (el) el.style.display = (v === viewName) ? 'block' : 'none';
      if (tab) {
        if (v === viewName) tab.classList.add('active');
        else tab.classList.remove('active');
      }
    });

    if (viewName === 'admin') {
      adminPanel.checkAuthStatus();
    } else if (viewName === 'store') {
      this.fetchApps();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  async fetchApps() {
    try {
      let isApiAvailable = true;
      let url = `./api/apps?sort_by=${this.currentSort}`;
      if (this.currentCategory !== 'all') {
        url += `&category=${encodeURIComponent(this.currentCategory)}`;
      }
      if (this.currentSearch.trim()) {
        url += `&search=${encodeURIComponent(this.currentSearch.trim())}`;
      }

      let res = await fetch(url).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          this.apps = data.apps;
          this.allCatalogApps = data.apps;
          this.renderApps(this.apps);
          return;
        }
      }

      // Static GitHub Pages fallback: read catalog.json
      const catRes = await fetch('./catalog.json');
      if (catRes.ok) {
        const catData = await catRes.json();
        let list = catData.apps || [];
        this.allCatalogApps = list;

        // Apply filters in memory
        if (this.currentCategory !== 'all') {
          list = list.filter((a) => a.category === this.currentCategory);
        }
        if (this.currentSearch.trim()) {
          const q = this.currentSearch.trim().toLowerCase();
          list = list.filter((a) =>
            a.name.toLowerCase().includes(q) ||
            a.short_description.toLowerCase().includes(q) ||
            a.package_name.toLowerCase().includes(q)
          );
        }

        // Apply sorting
        if (this.currentSort === 'newest') {
          list.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
        } else if (this.currentSort === 'rating') {
          list.sort((a, b) => b.rating - a.rating);
        } else if (this.currentSort === 'name') {
          list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        } else {
          list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.downloads_count - a.downloads_count);
        }

        this.apps = list;
        this.renderApps(this.apps);
      }
    } catch (err) {
      console.error('Error fetching apps:', err);
      this.showToast('حدث خطأ أثناء تحميل التطبيقات', 'error');
    }
  },

  renderApps(apps) {
    const grid = document.getElementById('apps-grid');
    const badge = document.getElementById('apps-count-badge');
    if (!grid) return;

    if (badge) badge.textContent = `${apps.length} تطبيق`;

    if (apps.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: rgba(125,125,125,0.04); border-radius: 20px; border: 1px dashed var(--border-color);">
          <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
          <h3 style="font-size: 1.3rem; color: var(--text-main);">لم يتم العثور على أي تطبيقات مطابقة</h3>
          <p style="color: var(--text-muted); margin-top: 6px;">جرب تغيير كلمات البحث أو اختيار قسم آخر من MOMO store.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = apps.map((app) => `
      <div class="app-card" onclick="appStore.openDetailsModal('${app.id}')">
        <div>
          <div class="app-card-top">
            <img src="${app.icon_url}" alt="${app.name}" class="app-card-icon" onerror="this.src='./static/icons/default-app.svg'">
            <div class="app-card-info">
              <h3 class="app-card-title" title="${app.name}">${app.name}</h3>
              <p class="app-card-developer">${app.developer}</p>
              <div class="app-card-tags">
                <span class="tag-category">${app.category}</span>
                ${app.featured ? '<span class="tag-featured">⭐ مميز</span>' : ''}
              </div>
            </div>
          </div>
          
          <p class="app-card-desc">${app.short_description}</p>
        </div>

        <div>
          <div class="app-card-meta">
            <div class="meta-item">
              <span class="meta-rating">★ ${app.rating.toFixed(1)}</span>
              <span>(${app.rating_count})</span>
            </div>
            <div class="meta-item">
              <span>📥</span>
              <span>${app.downloads_count.toLocaleString('ar-EG')} تحميل</span>
            </div>
            <div class="meta-item">
              <span>📦</span>
              <span>${app.file_size_formatted}</span>
            </div>
          </div>

          <div class="app-card-actions" onclick="event.stopPropagation()">
            <button class="btn-primary" onclick="appStore.downloadApp('${app.id}')">
              <span>⬇️</span> تحميل APK
            </button>
            <button class="btn-secondary" onclick="appStore.openDetailsModal('${app.id}')">
              <span>تفاصيل</span>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  handleCategory(cat) {
    this.currentCategory = cat;
    document.querySelectorAll('.category-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-category') === cat);
    });
    this.fetchApps();
  },

  handleSearch: (() => {
    let timeout;
    return function (query) {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        appStore.currentSearch = query;
        appStore.fetchApps();
      }, 250);
    };
  })(),

  handleSort(sortBy) {
    this.currentSort = sortBy;
    this.fetchApps();
  },

  async openDetailsModal(appId) {
    try {
      let app = this.apps.find((a) => a.id === appId) || this.allCatalogApps.find((a) => a.id === appId);

      // If backend available, get fresh data
      try {
        const res = await fetch(`./api/apps/${appId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success') app = data.app;
        }
      } catch (e) {}

      if (!app) return;
      this.activeApp = app;

      const body = document.getElementById('app-details-body');
      body.innerHTML = `
        <div class="details-top">
          <img src="${app.icon_url}" class="details-icon" onerror="this.src='./static/icons/default-app.svg'">
          <div class="details-headline">
            <h2>${app.name}</h2>
            <p>${app.developer} • <span style="color: var(--accent-purple); font-weight: 700;">${app.category}</span></p>
            <div class="details-actions-bar">
              <button class="btn-primary" style="padding: 12px 24px; font-size: 1rem;" onclick="appStore.downloadApp('${app.id}')">
                <span>⬇️</span> تحميل ملف APK (${app.file_size_formatted})
              </button>
              <button class="btn-secondary" onclick="appStore.showQRCode('${app.id}')">
                <span>📲</span> فتح بالهاتف عبر QR
              </button>
            </div>
          </div>
        </div>

        <!-- Security SHA-256 Box -->
        <div class="security-box">
          <div class="security-icon">🛡️</div>
          <div class="security-content">
            <div class="security-title">التحقق من سلامة وأمان التطبيق (SHA-256 Verified)</div>
            <p style="font-size: 0.85rem; color: var(--text-muted);">
              هذا الملف موثق في MOMO store. يمكنك مقارنة بصمة الملف بعد تحميله لضمان عدم حدوث أي تعديل:
            </p>
            <div class="sha256-code-wrapper">
              <span class="sha256-code" id="sha256-text">${app.sha256}</span>
              <button class="btn-copy" onclick="appStore.copySha256('${app.sha256}')">
                <span>📋 نسخ البصمة</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Info Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 20px 0;">
          <div style="background: rgba(125,125,125,0.05); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border-color);">
            <div style="font-size: 0.8rem; color: var(--text-dim);">رقم الإصدار</div>
            <div style="font-weight: 800; color: var(--text-main); font-size: 1rem;">v${app.version_name} (Code: ${app.version_code})</div>
          </div>
          <div style="background: rgba(125,125,125,0.05); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border-color);">
            <div style="font-size: 0.8rem; color: var(--text-dim);">نظام التشغيل المطلوب</div>
            <div style="font-weight: 800; color: var(--text-main); font-size: 1rem;">${app.min_android_version}</div>
          </div>
          <div style="background: rgba(125,125,125,0.05); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border-color);">
            <div style="font-size: 0.8rem; color: var(--text-dim);">حجم الملف</div>
            <div style="font-weight: 800; color: var(--text-main); font-size: 1rem;">${app.file_size_formatted}</div>
          </div>
          <div style="background: rgba(125,125,125,0.05); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border-color);">
            <div style="font-size: 0.8rem; color: var(--text-dim);">القسم</div>
            <div style="font-weight: 800; color: var(--accent-purple); font-size: 1rem;">${app.category}</div>
          </div>
        </div>

        <!-- Screenshots Gallery -->
        ${app.screenshots && app.screenshots.length > 0 ? `
          <div class="gallery-section">
            <h4 style="font-size: 1rem; font-weight: 800; margin-bottom: 10px; color: var(--text-main);">📸 لقطات من داخل التطبيق:</h4>
            <div class="gallery-scroll">
              ${app.screenshots.map((s) => `<img src="${s}" class="gallery-img" alt="لقطة شاشة" onclick="window.open('${s}', '_blank')">`).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Changelog Section -->
        <div class="changelog-box">
          <div class="changelog-title">
            <span>✨</span> ما الجديد في التحديث الأخير (v${app.version_name}):
          </div>
          <div class="changelog-content">${app.changelog}</div>
        </div>

        <!-- Description Section -->
        <div style="margin: 24px 0;">
          <h4 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 8px; color: var(--text-main);">عن هذا التطبيق:</h4>
          <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.8; white-space: pre-line;">${app.description}</p>
        </div>

        <!-- Interactive Rating Widget -->
        <div class="rating-section">
          <div>
            <div style="font-weight: 800; color: var(--text-main);">تقييمك لتطبيق ${app.name}:</div>
            <p style="font-size: 0.85rem; color: var(--text-muted);">
              التقييم الحالي: <strong style="color: #f59e0b;">★ ${app.rating.toFixed(1)}</strong> (${app.rating_count} صوت)
            </p>
          </div>
          <div class="stars-selector">
            ${[1, 2, 3, 4, 5].map((s) => `
              <button class="star-btn" data-star="${s}" onclick="appStore.submitRating('${app.id}', ${s})">★</button>
            `).join('')}
          </div>
        </div>
      `;

      document.getElementById('app-details-modal').classList.add('active');
    } catch (err) {
      console.error(err);
      this.showToast('تعذر عرض تفاصيل التطبيق', 'error');
    }
  },

  closeDetailsModal() {
    document.getElementById('app-details-modal').classList.remove('active');
    this.activeApp = null;
  },

  closeModalOnOutsideClick(e) {
    if (e.target.id === 'app-details-modal') {
      this.closeDetailsModal();
    }
  },

  async downloadApp(appId) {
    try {
      this.showToast('جارٍ بدء تحميل ملف الـ APK...', 'success');
      const app = this.apps.find((a) => a.id === appId) || this.activeApp;

      // Try server tracking if available
      try {
        const res = await fetch(`./api/apps/${appId}/download`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.downloads_count && app) {
            app.downloads_count = data.downloads_count;
            this.renderApps(this.apps);
          }
        }
      } catch (e) {}

      if (app && app.download_url) {
        const a = document.createElement('a');
        a.href = app.download_url;
        a.download = '';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error(err);
      this.showToast('فشل بدء التحميل', 'error');
    }
  },

  async submitRating(appId, score) {
    try {
      const res = await fetch(`./api/apps/${appId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: score }),
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        this.showToast(`شكراً لتقييمك! التقييم الجديد: ★ ${data.rating}`, 'success');
        await this.fetchApps();
        if (this.activeApp && this.activeApp.id === appId) {
          this.openDetailsModal(appId);
        }
      } else {
        // Fallback for static GitHub Pages: local simulated rating
        const app = this.apps.find((a) => a.id === appId);
        if (app) {
          app.rating_count += 1;
          app.rating = round(((app.rating * (app.rating_count - 1)) + score) / app.rating_count, 1);
          this.showToast(`شكراً لتقييمك! التقييم: ★ ${app.rating}`, 'success');
          this.renderApps(this.apps);
        }
      }
    } catch (err) {
      console.error(err);
      this.showToast('تعذر تسجيل التقييم', 'error');
    }
  },

  copySha256(hash) {
    navigator.clipboard.writeText(hash).then(() => {
      this.showToast('تم نسخ بصمة SHA-256 بنجاح إلى الحافظة!', 'success');
    }).catch(() => {
      this.showToast('تعذر النسخ، يرجى النسخ يدوياً', 'error');
    });
  },

  showQRCode(appId) {
    const app = this.apps.find((a) => a.id === appId) || this.activeApp;
    if (!app) return;

    const qrModal = document.getElementById('qr-modal');
    const qrCanvas = document.getElementById('qr-canvas');
    const qrName = document.getElementById('qr-app-name');

    qrName.textContent = app.name;
    const downloadFullUrl = app.download_url.startsWith('http')
      ? app.download_url
      : `${window.location.origin}${app.download_url.startsWith('/') ? '' : '/'}${app.download_url}`;

    QRCode.toCanvas(qrCanvas, downloadFullUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    }, (error) => {
      if (error) console.error(error);
    });

    qrModal.classList.add('active');
  },

  populateCheckerDropdown() {
    const sel = document.getElementById('checker-app-select');
    if (!sel) return;
    const list = this.allCatalogApps.length ? this.allCatalogApps : this.apps;
    sel.innerHTML = '<option value="">-- اختر تطبيق من القائمة لتعبئة البيانات تلقائياً --</option>' +
      list.map((a) => `<option value="${a.id}">${a.name} (${a.package_name})</option>`).join('');
  },

  syncCheckerPackage(appId) {
    if (!appId) return;
    const app = this.apps.find((a) => a.id === appId) || this.allCatalogApps.find((a) => a.id === appId);
    if (app) {
      document.getElementById('checker-pkg-input').value = app.package_name;
      document.getElementById('checker-version-input').value = Math.max(1, app.version_code - 1);
    }
  },

  async runUpdateCheck(e) {
    e.preventDefault();
    const pkg = document.getElementById('checker-pkg-input').value.trim();
    const installedCode = parseInt(document.getElementById('checker-version-input').value, 10);
    const resultBox = document.getElementById('update-result');

    if (!pkg || isNaN(installedCode)) {
      this.showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }

    try {
      let updateData = null;
      const res = await fetch('./api/check-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_name: pkg, installed_version_code: installedCode }),
      }).catch(() => null);

      if (res && res.ok) {
        updateData = await res.json();
      } else {
        // Fallback for static deployment
        const target = (this.allCatalogApps.length ? this.allCatalogApps : this.apps).find((a) => a.package_name === pkg);
        if (target) {
          updateData = {
            update_available: target.version_code > installedCode,
            latest_version_name: target.version_name,
            latest_version_code: target.version_code,
            changelog: target.changelog,
            download_url: target.download_url,
            sha256: target.sha256,
            file_size_formatted: target.file_size_formatted,
          };
        }
      }

      if (!updateData) {
        resultBox.className = 'update-result-card';
        resultBox.style.display = 'block';
        resultBox.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px; color: #ef4444;">
            <span style="font-size: 1.5rem;">⚠️</span>
            <div>
              <strong>تطبيق غير مسجل في MOMO store:</strong>
              <p style="font-size: 0.85rem; color: #fca5a5;">لم يتم العثور على اسم الحزمة ${pkg} في فهرس المتجر.</p>
            </div>
          </div>
        `;
        return;
      }

      resultBox.style.display = 'block';

      if (updateData.update_available) {
        resultBox.className = 'update-result-card has-update';
        resultBox.innerHTML = `
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); font-weight: 700; font-size: 0.85rem; margin-bottom: 8px;">
                <span>🚀</span> يتوفر تحديث جديد على MOMO store!
              </div>
              <h3 style="color: var(--text-main); font-size: 1.25rem;">إصدار أحدث متوفر: v${updateData.latest_version_name} (Code: ${updateData.latest_version_code})</h3>
              <p style="color: var(--text-muted); font-size: 0.88rem; margin-top: 4px;">
                الإصدار المثبت لديك: <code>versionCode ${installedCode}</code> ← الإصدار المتوفر: <code>versionCode ${updateData.latest_version_code}</code> (${updateData.file_size_formatted})
              </p>
            </div>
            <div>
              <a href="${updateData.download_url}" target="_blank" class="btn-primary" style="padding: 12px 20px; text-decoration: none;">
                <span>⬇️</span> تنزيل التحديث الآن
              </a>
            </div>
          </div>

          <div style="margin-top: 16px; background: rgba(125,125,125,0.06); border-radius: 12px; padding: 14px;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--accent-emerald); margin-bottom: 6px;">سجل التغييرات (What's New):</div>
            <p style="font-size: 0.85rem; color: var(--text-muted); white-space: pre-line;">${updateData.changelog}</p>
          </div>
        `;
      } else {
        resultBox.className = 'update-result-card no-update';
        resultBox.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.8rem;">🎉</span>
            <div>
              <h3 style="color: var(--text-main); font-size: 1.15rem;">تطبيقك محدث بأحدث إصدار!</h3>
              <p style="color: var(--text-muted); font-size: 0.88rem;">
                أنت تستخدم بالفعل أحدث إصدار متاح على MOMO store (v${updateData.latest_version_name}). لا توجد أي تحديثات جديدة حالياً.
              </p>
            </div>
          </div>
        `;
      }
    } catch (err) {
      console.error(err);
      this.showToast('تعذر فحص التحديثات', 'error');
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },
};

document.addEventListener('DOMContentLoaded', () => {
  appStore.init();
});
