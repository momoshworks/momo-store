/**
 * MOMO store - Smart Admin Dashboard Logic
 * Supports both Full-Stack FastAPI Server mode AND Static GitHub Pages Serverless mode!
 */

const adminPanel = {
  token: localStorage.getItem('momo_admin_token') || null,
  isServerMode: false,
  localApps: [],
  uploadedApkData: null,

  async checkServerConnection() {
    try {
      const res = await fetch('./api/stats', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          this.isServerMode = true;
          return true;
        }
      }
    } catch (e) {}
    this.isServerMode = false;
    return false;
  },

  async checkAuthStatus() {
    await this.checkServerConnection();
    const loginCard = document.getElementById('admin-login-card');
    const dashboardView = document.getElementById('admin-dashboard-view');

    this.updateServerStatusBadge();

    if (this.token) {
      if (loginCard) loginCard.style.display = 'none';
      if (dashboardView) dashboardView.style.display = 'block';
      this.loadDashboardData();
    } else {
      if (loginCard) loginCard.style.display = 'block';
      if (dashboardView) dashboardView.style.display = 'none';
    }
  },

  updateServerStatusBadge() {
    let badge = document.getElementById('server-mode-indicator');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'server-mode-indicator';
      const container = document.querySelector('.admin-container');
      if (container) container.insertBefore(badge, container.firstChild);
    }

    if (this.isServerMode) {
      badge.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.2rem;">🟢</span>
            <strong style="color: var(--accent-emerald);">متصل بالخادم المحلي (Full-Stack Mode)</strong>
            <span style="font-size: 0.85rem; color: var(--text-muted);">- يتم الحفظ في قاعدة بيانات SQLite مباشرة.</span>
          </div>
        </div>
      `;
    } else {
      badge.innerHTML = `
        <div style="background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.2rem;">🌐</span>
            <strong style="color: var(--accent-purple);">الوضع السحابي المباشر (GitHub Pages Serverless)</strong>
            <span style="font-size: 0.85rem; color: var(--text-muted);">- تعمل لوحة التحكم سحابياً بدون سيرفر مدفوع مع دعم تحديث ملف catalog.json.</span>
          </div>
          <div>
            <a href="http://localhost:8000" target="_blank" class="btn-secondary" style="padding: 6px 12px; font-size: 0.82rem;">
              <span>🖥️</span> فتح السيرفر المحلي (localhost:8000)
            </a>
          </div>
        </div>
      `;
    }
  },

  async login(e) {
    e.preventDefault();
    const username = document.getElementById('admin-user-input').value.trim();
    const password = document.getElementById('admin-pass-input').value.trim();

    // 1. Try server login if API is reachable
    if (this.isServerMode) {
      try {
        const res = await fetch('./api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          this.token = data.token;
          localStorage.setItem('momo_admin_token', this.token);
          appStore.showToast('تم تسجيل الدخول إلى خادم MOMO store بنجاح!', 'success');
          this.checkAuthStatus();
          return;
        } else {
          appStore.showToast(data.detail || 'بيانات الدخول غير صحيحة', 'error');
          return;
        }
      } catch (err) {
        console.warn('Server login failed, trying fallback...', err);
      }
    }

    // 2. Client-Side Serverless Login (for GitHub Pages / Static Hosting)
    if (username === 'admin' && password === 'admin123') {
      this.token = 'momo_session_' + Date.now();
      localStorage.setItem('momo_admin_token', this.token);
      appStore.showToast('تم تسجيل الدخول بنجاح في وضع إدارة المتجر!', 'success');
      this.checkAuthStatus();
    } else {
      appStore.showToast('اسم المستخدم أو كلمة المرور غير صحيحة (الافتراضي: admin / admin123)', 'error');
    }
  },

  logout() {
    this.token = null;
    localStorage.removeItem('momo_admin_token');
    appStore.showToast('تم تسجيل الخروج', 'info');
    this.checkAuthStatus();
  },

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
    };
  },

  async loadDashboardData() {
    await Promise.all([this.loadStats(), this.loadAdminApps()]);
  },

  async loadStats() {
    try {
      if (this.isServerMode) {
        const res = await fetch('./api/stats');
        const data = await res.json();
        if (data.status === 'success') {
          const s = data.stats;
          document.getElementById('stat-total-apps').textContent = s.total_apps;
          document.getElementById('stat-total-downloads').textContent = s.total_downloads.toLocaleString('ar-EG');
          document.getElementById('stat-avg-rating').textContent = s.average_rating.toFixed(1);
          document.getElementById('stat-categories-count').textContent = s.categories.length;
          return;
        }
      }
    } catch (e) {}

    // Serverless fallback calculation
    const apps = this.getAppsList();
    const totalApps = apps.length;
    const totalDownloads = apps.reduce((sum, a) => sum + (a.downloads_count || 0), 0);
    const avgRating = totalApps ? (apps.reduce((sum, a) => sum + (a.rating || 5), 0) / totalApps).toFixed(1) : '5.0';
    const categories = new Set(apps.map((a) => a.category));

    document.getElementById('stat-total-apps').textContent = totalApps;
    document.getElementById('stat-total-downloads').textContent = totalDownloads.toLocaleString('ar-EG');
    document.getElementById('stat-avg-rating').textContent = avgRating;
    document.getElementById('stat-categories-count').textContent = categories.size;
  },

  getAppsList() {
    const stored = localStorage.getItem('momo_custom_catalog');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    return appStore.allCatalogApps.length ? appStore.allCatalogApps : appStore.apps;
  },

  saveAppsList(apps) {
    this.localApps = apps;
    localStorage.setItem('momo_custom_catalog', JSON.stringify(apps));
    appStore.allCatalogApps = apps;
    appStore.apps = apps;
    appStore.renderApps(apps);
    appStore.populateCheckerDropdown();
  },

  async loadAdminApps() {
    let apps = [];
    if (this.isServerMode) {
      try {
        const res = await fetch('./api/apps?sort_by=newest');
        const data = await res.json();
        if (data.status === 'success') apps = data.apps;
      } catch (e) {}
    }

    if (!apps.length) {
      apps = this.getAppsList();
    }

    const tbody = document.getElementById('admin-apps-tbody');
    tbody.innerHTML = apps.map((app) => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${app.icon_url}" style="width: 38px; height: 38px; border-radius: 8px; object-fit: cover;" onerror="this.src='./static/icons/default-app.svg'">
            <div>
              <strong style="color: var(--text-main);">${app.name}</strong>
              ${app.featured ? '<span class="tag-featured" style="margin-right: 6px;">مميز</span>' : ''}
            </div>
          </div>
        </td>
        <td><code style="font-size: 0.8rem; color: var(--accent-purple);">${app.package_name}</code></td>
        <td><span class="tag-category">${app.category}</span></td>
        <td>v${app.version_name} <span style="color: var(--text-dim);">(${app.version_code})</span></td>
        <td>${app.file_size_formatted}</td>
        <td>${app.downloads_count.toLocaleString('ar-EG')}</td>
        <td><span style="color: #f59e0b; font-weight: 800;">★ ${app.rating.toFixed(1)}</span></td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn-secondary" style="padding: 6px 10px; font-size: 0.8rem;" onclick="adminPanel.openEditModal('${app.id}')">
              <span>✏️</span> تعديل
            </button>
            <button class="btn-secondary" style="padding: 6px 10px; font-size: 0.8rem; border-color: rgba(239,68,68,0.3); color: #ef4444;" onclick="adminPanel.deleteApp('${app.id}', '${app.name}')">
              <span>🗑️</span> حذف
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  toggleUploadMode(mode) {
    const githubBox = document.getElementById('mode-github-box');
    const fileBox = document.getElementById('mode-file-box');

    if (mode === 'github') {
      githubBox.style.display = 'block';
      fileBox.style.display = 'none';
    } else {
      githubBox.style.display = 'none';
      fileBox.style.display = 'block';
    }
  },

  async handleApkFileSelection(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const statusText = document.getElementById('apk-upload-status');

    if (!this.isServerMode) {
      statusText.innerHTML = `⚠️ رفع الملفات المباشر من الكمبيوتر يتطلب فتح السيرفر المحلي: <a href="http://localhost:8000" target="_blank" style="color: var(--accent-purple);">http://localhost:8000</a>.<br>في وضع GitHub Pages، يفضل استخدام خيار <strong>رابط مباشر أو GitHub Releases</strong>.`;
      return;
    }

    statusText.textContent = `⏳ جارٍ رفع وتحليل ملف APK (${file.name})...`;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('./api/admin/upload-apk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        this.uploadedApkData = data;
        document.getElementById('form-download-url').value = data.download_url;
        document.getElementById('form-sha256').value = data.sha256;
        document.getElementById('form-size-formatted').value = data.file_size_formatted;

        statusText.innerHTML = `✅ تم رفع الملف وحساب البصمة: <code>${data.sha256.substring(0, 16)}...</code> | الحجم: ${data.file_size_formatted}`;
        appStore.showToast('تم رفع ملف الـ APK وحساب بصمة SHA-256 بنجاح!', 'success');
      } else {
        statusText.textContent = `❌ فشل الرفع: ${data.detail || 'خطأ غير معروف'}`;
        appStore.showToast(data.detail || 'فشل رفع الملف', 'error');
      }
    } catch (err) {
      console.error(err);
      statusText.textContent = '❌ تعذر رفع الملف إلى السيرفر';
      appStore.showToast('حدث خطأ أثناء رفع ملف الـ APK', 'error');
    }
  },

  openCreateModal() {
    document.getElementById('admin-modal-title').textContent = 'نشر تطبيق جديد في MOMO store';
    document.getElementById('form-is-edit').value = 'false';
    document.getElementById('form-id').disabled = false;
    document.getElementById('form-package').disabled = false;
    document.getElementById('admin-app-form').reset();
    document.getElementById('apk-upload-status').textContent = '';
    this.toggleUploadMode('github');

    document.getElementById('admin-app-modal').classList.add('active');
  },

  async openEditModal(appId) {
    try {
      let app = null;
      if (this.isServerMode) {
        try {
          const res = await fetch(`./api/apps/${appId}`);
          const data = await res.json();
          if (data.status === 'success') app = data.app;
        } catch (e) {}
      }

      if (!app) {
        app = this.getAppsList().find((a) => a.id === appId);
      }

      if (!app) return;

      document.getElementById('admin-modal-title').textContent = `تعديل التطبيق: ${app.name}`;
      document.getElementById('form-is-edit').value = 'true';

      const idField = document.getElementById('form-id');
      idField.value = app.id;
      idField.disabled = true;

      const pkgField = document.getElementById('form-package');
      pkgField.value = app.package_name;
      pkgField.disabled = true;

      document.getElementById('form-name').value = app.name;
      document.getElementById('form-short-desc').value = app.short_description;
      document.getElementById('form-desc').value = app.description;
      document.getElementById('form-category').value = app.category;
      document.getElementById('form-version-name').value = app.version_name;
      document.getElementById('form-version-code').value = app.version_code;
      document.getElementById('form-download-url').value = app.download_url;
      document.getElementById('form-sha256').value = app.sha256;
      document.getElementById('form-size-formatted').value = app.file_size_formatted;
      document.getElementById('form-changelog').value = app.changelog;
      document.getElementById('form-icon-url').value = app.icon_url;
      document.getElementById('form-developer').value = app.developer;
      document.getElementById('form-screenshots').value = (app.screenshots || []).join('\n');
      document.getElementById('form-featured').checked = app.featured;

      this.toggleUploadMode(app.storage_type === 'local_server' ? 'file' : 'github');
      document.getElementById('admin-app-modal').classList.add('active');
    } catch (err) {
      console.error(err);
      appStore.showToast('تعذر جلب بيانات التطبيق للتعديل', 'error');
    }
  },

  closeAppModal() {
    document.getElementById('admin-app-modal').classList.remove('active');
  },

  async saveApp(e) {
    e.preventDefault();
    const isEdit = document.getElementById('form-is-edit').value === 'true';
    const appId = document.getElementById('form-id').value.trim();
    const packageName = document.getElementById('form-package').value.trim();
    const name = document.getElementById('form-name').value.trim();
    const shortDesc = document.getElementById('form-short-desc').value.trim();
    const desc = document.getElementById('form-desc').value.trim();
    const category = document.getElementById('form-category').value;
    const versionName = document.getElementById('form-version-name').value.trim();
    const versionCode = parseInt(document.getElementById('form-version-code').value, 10);
    const downloadUrl = document.getElementById('form-download-url').value.trim();
    const sha256 = document.getElementById('form-sha256').value.trim() || '0d3852dc6fbfae4517e60e66fbd67983cdaf8bc784a75578fd96945250d7349b';
    const sizeFormatted = document.getElementById('form-size-formatted').value.trim() || '10 MB';
    const changelog = document.getElementById('form-changelog').value.trim() || 'إطلاق التحديث الجديد';
    const iconUrl = document.getElementById('form-icon-url').value.trim() || './static/icons/default-app.svg';
    const developer = document.getElementById('form-developer').value.trim() || 'MOMO Team';
    const featured = document.getElementById('form-featured').checked;

    const screensText = document.getElementById('form-screenshots').value.trim();
    const screenshots = screensText ? screensText.split('\n').map((s) => s.trim()).filter((s) => s.length > 0) : [];

    const storageType = downloadUrl.startsWith('/uploads/') || downloadUrl.startsWith('./uploads/') ? 'local_server' : 'github_release';

    const payload = {
      id: appId,
      package_name: packageName,
      name,
      short_description: shortDesc,
      description: desc,
      category,
      version_name: versionName,
      version_code: versionCode,
      download_url: downloadUrl,
      sha256,
      file_size_formatted: sizeFormatted,
      changelog,
      icon_url: iconUrl,
      developer,
      screenshots,
      featured,
      storage_type: storageType,
      downloads_count: 100,
      rating: 5.0,
      rating_count: 10,
    };

    // If server mode
    if (this.isServerMode) {
      try {
        let res;
        if (isEdit) {
          res = await fetch(`./api/admin/apps/${appId}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
          });
        } else {
          res = await fetch('./api/admin/apps', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
          });
        }

        const data = await res.json();
        if (res.ok && data.status === 'success') {
          appStore.showToast(data.message, 'success');
          this.closeAppModal();
          this.loadDashboardData();
          appStore.fetchApps();
          appStore.populateCheckerDropdown();
          return;
        } else {
          appStore.showToast(data.detail || 'حدث خطأ أثناء الحفظ', 'error');
          return;
        }
      } catch (err) {
        console.warn('Server save failed, saving to local catalog...', err);
      }
    }

    // Serverless mode save
    let list = [...this.getAppsList()];
    if (isEdit) {
      const idx = list.findIndex((a) => a.id === appId);
      if (idx !== -1) list[idx] = { ...list[idx], ...payload };
    } else {
      list.push(payload);
    }

    this.saveAppsList(list);
    appStore.showToast('تم نشر وتحديث التطبيق في المتجر بنجاح!', 'success');
    this.closeAppModal();
    this.loadDashboardData();
  },

  async deleteApp(appId, appName) {
    if (!confirm(`هل أنت متأكد من حذف تطبيق "${appName}" من MOMO store؟`)) {
      return;
    }

    if (this.isServerMode) {
      try {
        const res = await fetch(`./api/admin/apps/${appId}`, {
          method: 'DELETE',
          headers: this.getHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          appStore.showToast(`تم حذف تطبيق "${appName}" بنجاح`, 'success');
          this.loadDashboardData();
          appStore.fetchApps();
          appStore.populateCheckerDropdown();
          return;
        }
      } catch (e) {}
    }

    // Serverless mode delete
    let list = this.getAppsList().filter((a) => a.id !== appId);
    this.saveAppsList(list);
    appStore.showToast(`تم حذف تطبيق "${appName}" من المتجر`, 'info');
    this.loadDashboardData();
  },

  exportCatalogFile() {
    const apps = this.getAppsList();
    const catalogData = {
      catalog_version: '1.0.0',
      generated_at: new Date().toISOString(),
      apps_count: apps.length,
      apps: apps,
    };

    const blob = new Blob([JSON.stringify(catalogData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'catalog.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    appStore.showToast('تم تحميل ملف catalog.json المحدث بنجاح!', 'success');
  },
};
