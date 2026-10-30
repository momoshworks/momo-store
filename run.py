import uvicorn
from app.config import HOST, PORT

if __name__ == "__main__":
    print(f"🚀 تشغيل متجر التطبيقات الذكي (Next-Gen App Store)...")
    print(f"🌐 المتجر متاح عبر المتصفح على: http://localhost:{PORT}")
    print(f"📄 توثيق الـ API التفاعلي (Swagger Docs): http://localhost:{PORT}/docs")
    print(f"📂 ملف الفهرس العام: http://localhost:{PORT}/api/catalog.json")
    print(f"👤 بيانات دخول الأدمن الافتراضية: admin / admin123")
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
