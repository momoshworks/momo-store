# 📱 MOMO store | متجر برامج وتطبيقات الهاتف الذكية

المتجر الرسمي لـ **MOMO store** المصمم بأحدث المعايير التقنية (Full-Stack + Static Serverless Fallback) لتحميل برامج الهاتف وتطبيقات الأندرويد بروابط مباشرة وسريعة، مع دعم التحقق الرقمي من أمان الملفات **SHA-256 Checksum** وتطبيق **DUMU** الأساسي.

🌐 **الموقع الحي المنشور على GitHub Pages**:
👉 [https://momoshworks.github.io/momo-store/](https://momoshworks.github.io/momo-store/)

---

## 🌟 مميزات MOMO store

1. **دعم الثيم الفاتح والداكن (Light & Dark Mode)**:
   - تبديل سلس للمظهر بضغطة زر ☀️ / 🌙 مع حفظ تفضيل المستخدم في المتصفح.

2. **تطبيق DUMU الرسمي في قسم "برامج الهاتف"**:
   - تطبيق متكامل مخصص للهواتف المحمولة لإدارة المهام والأداء وحماية الخصوصية.
   - يدعم التحميل المباشر مع فحص بصمة الأمان **SHA-256**.
   - توليد رمز **QR Code** فوري لمسحه بكاميرا الهاتف والتحميل مباشرة.

3. **لوحة تحكم المطور (Admin Dashboard)**:
   - جاهزة لنشر أي تطبيق أو تحديث جديد في أي وقت بضغطة زر.
   - دعم رفع ملفات الـ APK مباشرة (يحسب السيرفر الحجم والبصمة تلقائياً) أو الربط بروابط GitHub Releases.
   - حساب الأدمن الافتراضي: `admin` / `admin123`.

4. **نظام فاحص التحديثات الذكي (Smart Update Checker)**:
   - مقارنة رقم إصدار التطبيق المثبت لدى المستخدم برقم الإصدار المتاح على MOMO store وإظهار زر التحديث الفوري وسجل التغييرات.

5. **تطبيق ويب تقدمي (PWA)**:
   - يدعم التثبيت المباشر على شاشة الهاتف كأيقونة تطبيق مستقل (`Install App`).

---

## 🚀 التشغيل المحلي (Local Running)

```bash
# 1. تثبيت المتطلبات
pip install -r requirements.txt

# 2. تشغيل السيرفر
python run.py
```

- المتجر المحلي: [http://localhost:8000](http://localhost:8000)
- توثيق الـ API التفاعلي: [http://localhost:8000/docs](http://localhost:8000/docs)
- ملف الفهرس العام: [http://localhost:8000/api/catalog.json](http://localhost:8000/api/catalog.json)

---

## 🛠️ التقنيات المستخدمة
- **Backend**: Python 3 (FastAPI) + Uvicorn + SQLite
- **Frontend**: Modern Vanilla JS (ES6+) + CSS3 Glassmorphism + Responsive Light/Dark Engine
- **Hosting & Deploy**: GitHub Pages (Static Deployment) + FastAPI (Full-Stack Mode)
