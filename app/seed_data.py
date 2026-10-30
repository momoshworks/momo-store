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
    if existing and len(existing) >= 5:
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
        "downloads_count": 1450,
        "rating": 5.0,
        "rating_count": 92,
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
        "name": "MOMO store APK",
        "short_description": "التطبيق الرسمي لمتجر MOMO store لتحميل وتثبيت وتحديث برامج وتطبيقات الهاتف الذكية بنقرة واحدة وبأمان تام.",
        "description": "تطبيق متجر MOMO store الرسمي للهواتف الذكية بنظام أندرويد. يتيح لك استعراض وتحميل أفضل برامج الهاتف مثل تطبيق DUMU وإدارة التحميلات عبر مدير التنزيلات المدمج، مع فحص الأمان الرقمي SHA-256 وفاحص التحديثات الذكي، والتبديل السلس بين الثيمين الفاتح والداكن.",
        "category": "برامج الهاتف",
        "icon_url": "./static/icons/logo.svg",
        "version_name": "1.0.0",
        "version_code": 1,
        "min_android_version": "Android 5.0 (Lollipop) أو أحدث",
        "file_size_bytes": 1665595,
        "file_size_formatted": "1.59 MB",
        "download_url": "https://github.com/momoshworks/momo-store/releases/download/v1.0.0/momo-store.apk",
        "storage_type": "github_release",
        "sha256": "ec3eff138566abfb9c8b1df6741ac5b13efd9b6c89768f52936935c27680d270",
        "changelog": "• الإطلاق الرسمي لتطبيق MOMO store على الأندرويد\n• مدير تنزيلات مدمج للتطبيقات والـ APKs\n• دعم كامل للوضعين الفاتح والداكن\n• فاحص ذكي للتحديثات التلقائية والتحقق الأمني",
        "screenshots": [
            "./static/images/screenshots/dumu-screen-1.png",
            "./static/images/screenshots/dumu-screen-2.png"
        ],
        "developer": "MOMO Team",
        "github_repo": "https://github.com/momoshworks/momo-store",
        "featured": True,
        "downloads_count": 3820,
        "rating": 5.0,
        "rating_count": 164,
        "item_type": "app",
        "price": 0.0,
        "old_price": 0.0,
        "discount_percent": 0
    }
    if not get_app_by_id("momo-store-app"):
        create_app(momo_app)

    # Product 3: MOMO Pods Pro
    earbuds = {
        "id": "momo-pods-pro",
        "package_name": "sku.momo.pods.pro",
        "name": "سماعات MOMO Pods Pro اللاسلكية",
        "short_description": "عزل ضوضاء نشط ANC فائق، صوت ستيريو مكاني محيطي، وبطارية تدوم حتى 36 ساعة مع الشحن اللاسلكي.",
        "description": "استمتع بتجربة صوتية مذهلة مع سماعات MOMO Pods Pro. مزودة بمحركات صوتية تيتانيوم 11mm تقدم صوت بيس عميق ووضوح كريستالي في المكالمات بفضل 6 ميكروفونات ذكية لعزل الضوضاء المحيطة بنسبة 98%، مع مقاومة الماء والتعرق IPX5.",
        "category": "إلكترونيات وأجهزة",
        "icon_url": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",
        "screenshots": [
            "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&auto=format&fit=crop&q=80"
        ],
        "developer": "MOMO Hardware Labs",
        "featured": True,
        "downloads_count": 420,
        "rating": 4.9,
        "rating_count": 88,
        "item_type": "product",
        "price": 750.0,
        "old_price": 1200.0,
        "discount_percent": 38,
        "colors": ["أسود كربوني", "أبيض ناصع", "أزرق كحلي"],
        "sizes": ["إصدار ANC عزل الضوضاء", "الإصدار القياسي"],
        "stock": 45
    }
    if not get_app_by_id("momo-pods-pro"):
        create_app(earbuds)

    # Product 4: MOMO Power Bank 20000mAh
    powerbank = {
        "id": "momo-power-bank-20k",
        "package_name": "sku.momo.power.20k",
        "name": "باور بانك MOMO Power 20,000mAh فائق السرعة",
        "short_description": "شحن سريع بقدرة 65W يدعم اللابتوب والهواتف، شاشة ديجيتال ذكية، ويشحن 3 أجهزة معاً.",
        "description": "الرفيق المثالي ليومك وسفرك. باور بانك بقوة 20,000 مللي أمبير مع منفذي Type-C PD 65W ومنفذ USB-A، يشحن هاتفك من 0% إلى 60% في 25 دقيقة فقط، مع دارة أمان ذكية للحماية من ارتفاع الحرارة وتذبذب التيار.",
        "category": "إلكترونيات وأجهزة",
        "icon_url": "https://images.unsplash.com/photo-1609592426508-cc0272b15654?w=600&auto=format&fit=crop&q=80",
        "screenshots": [
            "https://images.unsplash.com/photo-1609592426508-cc0272b15654?w=800&auto=format&fit=crop&q=80"
        ],
        "developer": "MOMO Hardware Labs",
        "featured": True,
        "downloads_count": 310,
        "rating": 4.8,
        "rating_count": 65,
        "item_type": "product",
        "price": 890.0,
        "old_price": 1350.0,
        "discount_percent": 34,
        "colors": ["رمادي فلكي", "أسود مات"],
        "sizes": ["20,000 mAh", "30,000 mAh"],
        "stock": 30
    }
    if not get_app_by_id("momo-power-bank-20k"):
        create_app(powerbank)

    # Product 5: MOMO GamePad X
    gamepad = {
        "id": "momo-gamepad-x",
        "package_name": "sku.momo.gamepad.x",
        "name": "يد تحكم ألعاب الهاتف MOMO GamePad X",
        "short_description": "أزرار Hall Effect لمنع الانحراف، استجابة سريعة Zero Latency، ومتوافق مع جميع ألعاب الأندرويد والآيفون.",
        "description": "حول هاتفك إلى منصة ألعاب احترافية (مثل نينتندو سويتش وبلايستيشن). تدعم PUBG Mobile و COD و Genshin Impact والمحاكيات مع تبريد صامت ومقابض مريحة مانعة للانزلاق لجلسات لعب تدوم لساعات.",
        "category": "ألعاب",
        "icon_url": "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80",
        "screenshots": [
            "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80"
        ],
        "developer": "MOMO Gaming Tech",
        "featured": False,
        "downloads_count": 580,
        "rating": 4.9,
        "rating_count": 112,
        "item_type": "product",
        "price": 620.0,
        "old_price": 950.0,
        "discount_percent": 35,
        "colors": ["سايبربانك أرجواني", "أسود نيون"],
        "sizes": ["بلوتوث 5.3 للأندرويد والآيفون"],
        "stock": 25
    }
    if not get_app_by_id("momo-gamepad-x"):
        create_app(gamepad)

    # Product 6: GaN 65W Fast Charger
    charger = {
        "id": "momo-gan-65w-charger",
        "package_name": "sku.momo.gan.65w",
        "name": "رأس شاحن سريع GaN ثلاثي المنافذ 65W",
        "short_description": "تقنية نيتريد الغاليوم GaN فائقة الكفاءة وصغيرة الحجم، 3 مخارج لشحن اللابتوب والموبايل والسماعة معاً.",
        "description": "شاحن واحد يكفيك لجميع أجهزتك. بحجم أصغر بنسبة 50% من الشواحن التقليدية، يدعم تقنيات Power Delivery 3.0 و Quick Charge 4+ مع حماية ذكية للأجهزة المتصلة.",
        "category": "إكسسوارات",
        "icon_url": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80",
        "screenshots": [
            "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop&q=80"
        ],
        "developer": "MOMO Hardware Labs",
        "featured": False,
        "downloads_count": 690,
        "rating": 4.9,
        "rating_count": 140,
        "item_type": "product",
        "price": 420.0,
        "old_price": 600.0,
        "discount_percent": 30,
        "colors": ["أبيض سيراميك", "أسود كلاسيك"],
        "sizes": ["65W ثلاثي المنافذ (2x Type-C + 1x USB-A)"],
        "stock": 60
    }
    if not get_app_by_id("momo-gan-65w-charger"):
        create_app(charger)
