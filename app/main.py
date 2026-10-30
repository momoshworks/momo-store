import os
import hashlib
import shutil
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Form, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

from .config import (
    BASE_DIR, UPLOADS_DIR, APKS_DIR, IMAGES_DIR, STATIC_DIR,
    ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SECRET_KEY, CATALOG_JSON_PATH
)
from .database import (
    init_db, get_apps, get_app_by_id, get_app_by_package,
    create_app, update_app, delete_app, increment_download,
    add_rating, get_stats, export_catalog_json
)
from .models import (
    AppCreate, AppUpdate, RateRequest, UpdateCheckRequest,
    UpdateCheckResponse, AdminLoginRequest, AdminLoginResponse
)
from .seed_data import seed_database_if_empty

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    seed_database_if_empty()
    export_catalog_json()
    yield
    # Shutdown

app = FastAPI(
    title="MOMO store API & Web Platform",
    description="متجر MOMO store الرسمي لتحميل برامج الهاتف وAPK Direct Hub",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for flexible integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth helper
def verify_admin_token(authorization: Optional[str] = Header(None)) -> bool:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="المصادقة مطلوبة (Missing Authorization header)")
    token = authorization.replace("Bearer ", "").strip()
    # Simple secure static signature for MVP dashboard
    expected_token = hashlib.sha256(f"{ADMIN_USERNAME}:{ADMIN_PASSWORD}:{ADMIN_SECRET_KEY}".encode()).hexdigest()
    if token != expected_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="رمز المصادقة غير صحيح أو منتهي الصلاحية")
    return True

# --- Public API Routes ---

@app.get("/api/apps", summary="عرض وتصفية التطبيقات")
def list_apps(
    category: Optional[str] = Query(None, description="تصنيف التطبيق"),
    search: Optional[str] = Query(None, description="بحث بالاسم أو الكلمات المفتاحية"),
    sort_by: str = Query("popular", description="الترتيب: popular, newest, rating, name")
):
    apps = get_apps(category=category, search=search, sort_by=sort_by)
    return {"status": "success", "count": len(apps), "apps": apps}

@app.get("/api/apps/{app_id}", summary="تفاصيل تطبيق معين")
def get_app(app_id: str):
    app_data = get_app_by_id(app_id)
    if not app_data:
        raise HTTPException(status_code=404, detail="التطبيق غير موجود")
    return {"status": "success", "app": app_data}

@app.post("/api/apps/{app_id}/download", summary="تسجيل تحميل التطبيق واسترجاع رابط التنزيل")
def download_app(app_id: str):
    app_data = get_app_by_id(app_id)
    if not app_data:
        raise HTTPException(status_code=404, detail="التطبيق غير موجود")
    
    new_count = increment_download(app_id)
    return {
        "status": "success",
        "downloads_count": new_count,
        "download_url": app_data["download_url"],
        "package_name": app_data["package_name"],
        "sha256": app_data["sha256"]
    }

@app.post("/api/apps/{app_id}/rate", summary="تقييم التطبيق من 1 إلى 5")
def rate_app(app_id: str, req: RateRequest):
    result = add_rating(app_id, req.rating)
    if not result:
        raise HTTPException(status_code=404, detail="التطبيق غير موجود")
    return {"status": "success", "rating": result["rating"], "rating_count": result["rating_count"]}

@app.post("/api/check-update", summary="فحص التحديثات الذكي للتطبيق")
def check_update(req: UpdateCheckRequest):
    app_data = get_app_by_package(req.package_name)
    if not app_data:
        raise HTTPException(status_code=404, detail="التطبيق غير مسجل في المتجر")
    
    latest_code = app_data["version_code"]
    has_update = latest_code > req.installed_version_code
    
    return UpdateCheckResponse(
        update_available=has_update,
        latest_version_name=app_data["version_name"],
        latest_version_code=latest_code,
        changelog=app_data["changelog"],
        download_url=app_data["download_url"],
        sha256=app_data["sha256"],
        file_size_formatted=app_data["file_size_formatted"]
    )

@app.get("/api/stats", summary="إحصائيات المتجر")
def stats():
    return {"status": "success", "stats": get_stats()}

@app.get("/api/catalog.json", summary="تصدير ملف الفهرس الكامل بصيغة JSON")
def get_catalog():
    if CATALOG_JSON_PATH.exists():
        return FileResponse(CATALOG_JSON_PATH, media_type="application/json")
    export_catalog_json()
    return FileResponse(CATALOG_JSON_PATH, media_type="application/json")

# --- Admin Authentication & Management ---

@app.post("/api/admin/login", summary="تسجيل دخول المطور / الأدمن")
def admin_login(creds: AdminLoginRequest):
    if creds.username == ADMIN_USERNAME and creds.password == ADMIN_PASSWORD:
        token = hashlib.sha256(f"{ADMIN_USERNAME}:{ADMIN_PASSWORD}:{ADMIN_SECRET_KEY}".encode()).hexdigest()
        return AdminLoginResponse(success=True, token=token, message="تم تسجيل الدخول بنجاح")
    raise HTTPException(status_code=401, detail="اسم المستخدم أو كلمة المرور غير صحيحة")

@app.post("/api/admin/upload-apk", summary="رفع ملف APK وحساب بصمة SHA-256 وحجمه تلقائياً")
async def upload_apk(file: UploadFile = File(...), authorized: bool = Depends(verify_admin_token)):
    if not file.filename.lower().endswith(".apk"):
        raise HTTPException(status_code=400, detail="يجب أن يكون الملف بصيغة APK")
    
    dest_path = APKS_DIR / file.filename
    hasher = hashlib.sha256()
    size = 0
    
    with open(dest_path, "wb") as f:
        while chunk := await file.read(1024 * 1024): # 1MB chunks
            size += len(chunk)
            hasher.update(chunk)
            f.write(chunk)
            
    sha256_hash = hasher.hexdigest()
    size_formatted = f"{round(size / (1024 * 1024), 2)} MB" if size >= 1024 * 1024 else f"{round(size / 1024, 1)} KB"
    
    return {
        "status": "success",
        "filename": file.filename,
        "download_url": f"/uploads/apks/{file.filename}",
        "file_size_bytes": size,
        "file_size_formatted": size_formatted,
        "sha256": sha256_hash
    }

@app.post("/api/admin/apps", summary="إضافة تطبيق جديد")
def create_new_app(app_in: AppCreate, authorized: bool = Depends(verify_admin_token)):
    existing = get_app_by_id(app_in.id)
    if existing:
        raise HTTPException(status_code=400, detail="معرف التطبيق (ID) موجود مسبقاً")
    pkg_existing = get_app_by_package(app_in.package_name)
    if pkg_existing:
        raise HTTPException(status_code=400, detail="اسم الحزمة (Package Name) مستخدم لتطبيق آخر")
        
    created = create_app(app_in.model_dump())
    return {"status": "success", "message": "تمت إضافة التطبيق بنجاح", "app": created}

@app.put("/api/admin/apps/{app_id}", summary="تعديل بيانات تطبيق أو رفع تحديث جديد")
def update_existing_app(app_id: str, updates: AppUpdate, authorized: bool = Depends(verify_admin_token)):
    data_dict = {k: v for k, v in updates.model_dump().items() if v is not None}
    updated = update_app(app_id, data_dict)
    if not updated:
        raise HTTPException(status_code=404, detail="التطبيق غير موجود")
    return {"status": "success", "message": "تم تحديث بيانات التطبيق بنجاح", "app": updated}

@app.delete("/api/admin/apps/{app_id}", summary="حذف تطبيق من المتجر")
def delete_existing_app(app_id: str, authorized: bool = Depends(verify_admin_token)):
    deleted = delete_app(app_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="التطبيق غير موجود")
    return {"status": "success", "message": "تم حذف التطبيق بنجاح"}

# --- Static Files & Web Interface ---

# Mount uploads directory
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Mount static frontend directory
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
def serve_index():
    index_file = BASE_DIR / "index.html"
    if not index_file.exists():
        index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "MOMO store index.html"}

@app.get("/manifest.json")
def serve_manifest():
    manifest_file = STATIC_DIR / "manifest.json"
    if manifest_file.exists():
        return FileResponse(manifest_file, media_type="application/manifest+json")
    return JSONResponse({})

@app.get("/sw.js")
def serve_sw():
    sw_file = STATIC_DIR / "sw.js"
    if sw_file.exists():
        return FileResponse(sw_file, media_type="application/javascript")
    return JSONResponse({})
