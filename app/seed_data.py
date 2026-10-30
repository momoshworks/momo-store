import hashlib
import zipfile
from pathlib import Path
from .config import APKS_DIR
from .database import get_app_by_id, create_app

def create_sample_mock_apk(filename: str, app_title: str) -> tuple[str, int, str]:
    apk_path = APKS_DIR / filename
    if not apk_path.exists():
        with zipfile.ZipFile(apk_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            manifest_content = f"""<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.momo.dumu"
    android:versionCode="1"
    android:versionName="1.0.0">
    <application android:label="{app_title}">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>"""
            zf.writestr("AndroidManifest.xml", manifest_content)
            zf.writestr("META-INF/MANIFEST.MF", f"Manifest-Version: 1.0\nCreated-By: MOMO Store Build Engine\nApplication: {app_title}\n")
            zf.writestr("classes.dex", b"\x64\x65\x78\x0a\x30\x33\x35\x00" + b"\x00" * 8192)
            zf.writestr("assets/app_info.json", f'{{"name": "{app_title}", "version": "1.0.0", "author": "MOMO Store"}}')
            
    file_bytes = apk_path.read_bytes()
    sha256 = hashlib.sha256(file_bytes).hexdigest()
    size = len(file_bytes)
    return f"/uploads/apks/{filename}", size, sha256

def seed_database_if_empty():
    from .database import get_apps
    existing = get_apps()
    if existing and len(existing) >= 2:
        return

    # App 1: DUMU
    dumu_apk_url, dumu_size, dumu_hash = create_sample_mock_apk("dumu-v1.0.apk", "DUMU")
    dumu_app = {
        "id": "dumu-phone-app",
        "package_name": "com.momo.dumu",
        "name": "DUMU",
        "short_description": "تطبيق DUMU الذكي والاحترافي لإدارة مهام الهاتف، تعزيز الأداء، وحماية الخصوصية بسرعة فائقة.",
        "description": "تطبيق DUMU هو التطبيق الأساسي لهاتفك الذكي في MOMO Store. يمنحك تجربة استخدام استثنائية من خلال أدوات متطورة لإدارة المحاضرات والجداول الدراسية، حاسبة GPA، تنظيف الملفات المؤقتة، مع الحفاظ الكامل على خصوصيتك بدون إعلانات.",
        "category": "برامج الهاتف",
        "icon_url": "./static/icons/dumu-icon.svg",
        "version_name": "1.0.0",
        "version_code": 1,
        "min_android_version": "Android 8.0 (Oreo) أو أحدث",
        "file_size_bytes": dumu_size,
        "file_size_formatted": f"{round(dumu_size / 1024, 1)} KB" if dumu_size < 1024*1024 else f"{round(dumu_size / (1024*1024), 2)} MB",
        "download_url": dumu_apk_url,
        "storage_type": "local_server",
        "sha256": dumu_hash,
        "changelog": "• الإطلاق الرسمي لتطبيق DUMU على متجر MOMO Store\n• واجهة عصرية وسلسة تدعم الوضعين الفاتح والداكن\n• إدارة ذكية للبطارية والذاكرة بدون استهلاك للموارد\n• حماية الخصوصية وتأمين الملفات الحساسة",
        "screenshots": [
            "./static/images/screenshots/dumu-screen-1.png",
            "./static/images/screenshots/dumu-screen-2.png",
            "./static/images/screenshots/dumu-screen-3.png",
            "./static/images/screenshots/dumu-screen-4.png"
        ],
        "developer": "MOMO Team",
        "github_repo": "https://github.com/momoshworks/momo-store",
        "featured": True,
        "downloads_count": 0,
        "rating": 5.0,
        "rating_count": 1,
        "item_type": "app",
        "price": 0.0,
        "old_price": 0.0,
        "discount_percent": 0
    }
    if not get_app_by_id("dumu-phone-app"):
        create_app(dumu_app)

    # App 2: MOMO store Official App
    momo_app = {
        "id": "momo-store-app",
        "package_name": "com.momo.store",
        "name": "MOMO store",
        "short_description": "التطبيق الرسمي لمتجر MOMO store لتحميل وتثبيت وتحديث برامج وتطبيقات الهاتف الذكية بنقرة واحدة وبأمان تام.",
        "description": "تطبيق متجر MOMO store الرسمي للهواتف الذكية بنظام أندرويد. يتيح لك استعراض وتحميل أفضل برامج الهاتف مثل تطبيق DUMU وإدارة التحميلات عبر مدير التنزيلات المدمج، مع فحص الأمان الرقمي SHA-256 وفاحص التحديثات الذكي، والتبديل السلس بين الثيمين الفاتح والداكن.",
        "category": "برامج الهاتف",
        "icon_url": "./static/icons/logo.svg",
        "version_name": "1.0.0",
        "version_code": 1,
        "min_android_version": "Android 5.0 (Lollipop) أو أحدث",
        "file_size_bytes": 1669691,
        "file_size_formatted": "1.59 MB",
        "download_url": "https://github.com/momoshworks/momo-store/releases/download/v1.0.0/momo-store.apk",
        "storage_type": "github_release",
        "sha256": "384a04561b08fb17b1cf98f2f27028ce8d2f7aeea61d18cce85524e5f1b1f71f",
        "changelog": "• الإطلاق الرسمي لتطبيق MOMO store على الأندرويد\n• مدير تنزيلات مدمج للتطبيقات والـ APKs\n• دعم كامل للوضعين الفاتح والداكن\n• فاحص ذكي للتحديثات التلقائية والتحقق الأمني",
        "screenshots": [
            "./static/images/screenshots/dumu-screen-1.png",
            "./static/images/screenshots/dumu-screen-2.png"
        ],
        "developer": "MOMO Team",
        "github_repo": "https://github.com/momoshworks/momo-store",
        "featured": True,
        "downloads_count": 0,
        "rating": 5.0,
        "rating_count": 1,
        "item_type": "app",
        "price": 0.0,
        "old_price": 0.0,
        "discount_percent": 0
    }
    if not get_app_by_id("momo-store-app"):
        create_app(momo_app)
