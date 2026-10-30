import sqlite3
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from .config import DATABASE_PATH, CATALOG_JSON_PATH

def get_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Apps and Products Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS apps (
        id TEXT PRIMARY KEY,
        package_name TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        short_description TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        icon_url TEXT NOT NULL,
        version_name TEXT NOT NULL,
        version_code INTEGER NOT NULL,
        min_android_version TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        file_size_formatted TEXT NOT NULL,
        download_url TEXT NOT NULL,
        storage_type TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        changelog TEXT NOT NULL,
        screenshots TEXT NOT NULL,
        developer TEXT NOT NULL,
        github_repo TEXT,
        featured INTEGER DEFAULT 0,
        downloads_count INTEGER DEFAULT 0,
        rating REAL DEFAULT 5.0,
        rating_count INTEGER DEFAULT 1,
        item_type TEXT DEFAULT 'app',
        price REAL DEFAULT 0.0,
        old_price REAL DEFAULT 0.0,
        discount_percent INTEGER DEFAULT 0,
        colors_json TEXT DEFAULT '[]',
        sizes_json TEXT DEFAULT '[]',
        stock INTEGER DEFAULT 100,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)
    
    # Orders Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        items_json TEXT NOT NULL,
        subtotal REAL NOT NULL,
        discount REAL NOT NULL,
        total REAL NOT NULL,
        payment_method TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    # App Versions Table (Multi-Version & Rollback & Delta Updates)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS app_versions (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        version_code INTEGER NOT NULL,
        version_name TEXT NOT NULL,
        apk_url TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        sha256_hash TEXT NOT NULL,
        min_sdk INTEGER DEFAULT 21,
        target_sdk INTEGER DEFAULT 34,
        changelog TEXT,
        abi TEXT DEFAULT 'Universal',
        permissions_json TEXT DEFAULT '[]',
        delta_patch_url TEXT,
        delta_patch_size INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (app_id) REFERENCES apps(id)
    )
    """)

    # App Screenshots Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS app_screenshots (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        caption TEXT,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (app_id) REFERENCES apps(id)
    )
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_category ON apps(category);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_package ON apps(package_name);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_versions_app ON app_versions(app_id);")

    # Upgrade schema if needed
    for col, typ, default in [
        ("item_type", "TEXT", "'app'"),
        ("price", "REAL", "0.0"),
        ("old_price", "REAL", "0.0"),
        ("discount_percent", "INTEGER", "0"),
        ("colors_json", "TEXT", "'[]'"),
        ("sizes_json", "TEXT", "'[]'"),
        ("stock", "INTEGER", "100"),
        ("safety_badge", "TEXT", "'آمن 100% مفحوص'"),
        ("virus_total_status", "TEXT", "'clean'"),
        ("signature_verified", "INTEGER", "1"),
        ("supported_abi", "TEXT", "'arm64-v8a, armeabi-v7a, Universal'"),
        ("permissions_json", "TEXT", "'[]'")
    ]:
        try:
            cursor.execute(f"ALTER TABLE apps ADD COLUMN {col} {typ} DEFAULT {default}")
        except Exception:
            pass

    conn.commit()
    conn.close()

def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    if "screenshots" in d and d["screenshots"]:
        try:
            d["screenshots"] = json.loads(d["screenshots"])
        except Exception:
            d["screenshots"] = []
    else:
        d["screenshots"] = []
        
    if "colors_json" in d and d["colors_json"]:
        try:
            d["colors"] = json.loads(d["colors_json"])
        except Exception:
            d["colors"] = []
    else:
        d["colors"] = []

    if "sizes_json" in d and d["sizes_json"]:
        try:
            d["sizes"] = json.loads(d["sizes_json"])
        except Exception:
            d["sizes"] = []
    else:
        d["sizes"] = []

    if "permissions_json" in d and d["permissions_json"]:
        try:
            d["permissions"] = json.loads(d["permissions_json"])
        except Exception:
            d["permissions"] = []
    else:
        d["permissions"] = []

    d["featured"] = bool(d.get("featured", 0))
    d["price"] = float(d.get("price", 0.0))
    d["old_price"] = float(d.get("old_price", 0.0))
    d["discount_percent"] = int(d.get("discount_percent", 0))
    d["item_type"] = d.get("item_type", "app")
    d["safety_badge"] = d.get("safety_badge", "آمن 100% مفحوص")
    d["virus_total_status"] = d.get("virus_total_status", "clean")
    d["signature_verified"] = bool(d.get("signature_verified", 1))
    d["supported_abi"] = d.get("supported_abi", "arm64-v8a, armeabi-v7a, Universal")
    return d

def get_app_versions(app_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM app_versions WHERE app_id = ? ORDER BY version_code DESC", (app_id,))
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        vd = dict(r)
        try:
            vd["permissions"] = json.loads(vd.get("permissions_json", "[]"))
        except Exception:
            vd["permissions"] = []
        result.append(vd)
    return result

def add_app_version(version_data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO app_versions (
        id, app_id, version_code, version_name, apk_url, file_size, sha256_hash,
        min_sdk, target_sdk, changelog, abi, permissions_json, delta_patch_url, delta_patch_size, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        version_data["id"],
        version_data["app_id"],
        version_data["version_code"],
        version_data["version_name"],
        version_data["apk_url"],
        version_data["file_size"],
        version_data["sha256_hash"],
        version_data.get("min_sdk", 21),
        version_data.get("target_sdk", 34),
        version_data.get("changelog", ""),
        version_data.get("abi", "Universal"),
        json.dumps(version_data.get("permissions", []), ensure_ascii=False),
        version_data.get("delta_patch_url", ""),
        version_data.get("delta_patch_size", 0),
        version_data.get("created_at", datetime.utcnow().isoformat() + "Z")
    ))
    conn.commit()
    conn.close()
    return version_data

def get_apps(category: Optional[str] = None, search: Optional[str] = None, sort_by: str = "popular") -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM apps WHERE 1=1"
    params = []
    
    if category and category != "all":
        query += " AND category = ?"
        params.append(category)
        
    if search:
        search_term = f"%{search.strip()}%"
        query += " AND (name LIKE ? OR short_description LIKE ? OR description LIKE ? OR package_name LIKE ? OR developer LIKE ?)"
        params.extend([search_term, search_term, search_term, search_term, search_term])
        
    if sort_by == "newest":
        query += " ORDER BY updated_at DESC"
    elif sort_by == "price_low":
        query += " ORDER BY price ASC"
    elif sort_by == "price_high":
        query += " ORDER BY price DESC"
    elif sort_by == "rating":
        query += " ORDER BY rating DESC, downloads_count DESC"
    elif sort_by == "name":
        query += " ORDER BY name ASC"
    else: # popular default
        query += " ORDER BY featured DESC, downloads_count DESC, rating DESC"
        
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]

def get_app_by_id(app_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM apps WHERE id = ?", (app_id,))
    row = cursor.fetchone()
    conn.close()
    return row_to_dict(row) if row else None

def get_app_by_package(package_name: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM apps WHERE package_name = ?", (package_name,))
    row = cursor.fetchone()
    conn.close()
    return row_to_dict(row) if row else None

def create_app(data: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.utcnow().isoformat() + "Z"
    screenshots_str = json.dumps(data.get("screenshots", []))
    colors_str = json.dumps(data.get("colors", []))
    sizes_str = json.dumps(data.get("sizes", []))
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO apps (
        id, package_name, name, short_description, description, category,
        icon_url, version_name, version_code, min_android_version,
        file_size_bytes, file_size_formatted, download_url, storage_type,
        sha256, changelog, screenshots, developer, github_repo,
        featured, downloads_count, rating, rating_count,
        item_type, price, old_price, discount_percent, colors_json, sizes_json, stock,
        created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data["id"],
        data["package_name"],
        data["name"],
        data["short_description"],
        data["description"],
        data["category"],
        data["icon_url"],
        data.get("version_name", "1.0.0"),
        data.get("version_code", 1),
        data.get("min_android_version", "Android 5.0+"),
        data.get("file_size_bytes", 0),
        data.get("file_size_formatted", "0 MB"),
        data.get("download_url", "#"),
        data.get("storage_type", "github_release"),
        data.get("sha256", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
        data.get("changelog", "الإصدار الأولي"),
        screenshots_str,
        data.get("developer", "MOMO Team"),
        data.get("github_repo"),
        1 if data.get("featured", False) else 0,
        data.get("downloads_count", 0),
        data.get("rating", 5.0),
        data.get("rating_count", 1),
        data.get("item_type", "app"),
        data.get("price", 0.0),
        data.get("old_price", 0.0),
        data.get("discount_percent", 0),
        colors_str,
        sizes_str,
        data.get("stock", 100),
        now,
        now
    ))
    conn.commit()
    conn.close()
    export_catalog_json()
    return get_app_by_id(data["id"])

def update_app(app_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    existing = get_app_by_id(app_id)
    if not existing:
        return None
        
    now = datetime.utcnow().isoformat() + "Z"
    fields = []
    params = []
    
    for key, val in updates.items():
        if key in ["downloads_count", "rating", "rating_count", "created_at"]:
            continue
        if key == "screenshots":
            fields.append("screenshots = ?")
            params.append(json.dumps(val))
        elif key == "colors":
            fields.append("colors_json = ?")
            params.append(json.dumps(val))
        elif key == "sizes":
            fields.append("sizes_json = ?")
            params.append(json.dumps(val))
        elif key == "featured":
            fields.append("featured = ?")
            params.append(1 if val else 0)
        else:
            fields.append(f"{key} = ?")
            params.append(val)
            
    fields.append("updated_at = ?")
    params.append(now)
    params.append(app_id)
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"UPDATE apps SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()
    conn.close()
    export_catalog_json()
    return get_app_by_id(app_id)

def delete_app(app_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM apps WHERE id = ?", (app_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    if deleted:
        export_catalog_json()
    return deleted

def increment_download(app_id: str) -> Optional[int]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE apps SET downloads_count = downloads_count + 1 WHERE id = ?", (app_id,))
    cursor.execute("SELECT downloads_count FROM apps WHERE id = ?", (app_id,))
    row = cursor.fetchone()
    conn.commit()
    conn.close()
    if row:
        export_catalog_json()
        return row[0]
    return None

def add_rating(app_id: str, score: int) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT rating, rating_count FROM apps WHERE id = ?", (app_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    cur_rating = row["rating"]
    cur_count = row["rating_count"]
    new_count = cur_count + 1
    new_rating = round(((cur_rating * cur_count) + score) / new_count, 1)
    
    cursor.execute("UPDATE apps SET rating = ?, rating_count = ? WHERE id = ?", (new_rating, new_count, app_id))
    conn.commit()
    conn.close()
    export_catalog_json()
    return {"rating": new_rating, "rating_count": new_count}

# --- Orders Management ---

def create_order(order_data: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.utcnow().isoformat() + "Z"
    items_str = json.dumps(order_data.get("items", []))
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO orders (
        id, customer_name, phone, address, city, items_json,
        subtotal, discount, total, payment_method, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        order_data["id"],
        order_data["customer_name"],
        order_data["phone"],
        order_data["address"],
        order_data.get("city", "القاهرة"),
        items_str,
        order_data.get("subtotal", 0.0),
        order_data.get("discount", 0.0),
        order_data["total"],
        order_data["payment_method"],
        order_data.get("status", "pending"),
        now,
        now
    ))
    conn.commit()
    conn.close()
    return get_order_by_id(order_data["id"])

def get_orders() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    orders = []
    for r in rows:
        d = dict(r)
        try:
            d["items"] = json.loads(d["items_json"])
        except Exception:
            d["items"] = []
        orders.append(d)
    return orders

def get_order_by_id(order_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    try:
        d["items"] = json.loads(d["items_json"])
    except Exception:
        d["items"] = []
    return d

def update_order_status(order_id: str, new_status: str) -> Optional[Dict[str, Any]]:
    now = datetime.utcnow().isoformat() + "Z"
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", (new_status, now, order_id))
    conn.commit()
    conn.close()
    return get_order_by_id(order_id)

def get_stats() -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*), SUM(downloads_count), AVG(rating) FROM apps")
    total_apps, total_downloads, avg_rating = cursor.fetchone()
    
    cursor.execute("SELECT category, COUNT(*) as cnt FROM apps GROUP BY category ORDER BY cnt DESC")
    categories = [{"name": r[0], "count": r[1]} for r in cursor.fetchall()]
    
    cursor.execute("SELECT COUNT(*), SUM(total) FROM orders")
    total_orders, total_revenue = cursor.fetchone()
    conn.close()
    
    return {
        "total_apps": total_apps or 0,
        "total_downloads": total_downloads or 0,
        "average_rating": round(avg_rating or 5.0, 1),
        "categories": categories,
        "total_orders": total_orders or 0,
        "total_revenue": round(total_revenue or 0.0, 2)
    }

def export_catalog_json() -> None:
    try:
        apps = get_apps(sort_by="popular")
        for app in apps:
            if app.get("item_type") == "app":
                app["versions"] = get_app_versions(app["id"])
        catalog_data = {
            "catalog_version": "2.1.0",
            "store_name": "MOMO store",
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "apps_count": len(apps),
            "apps": apps
        }
        with open(CATALOG_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(catalog_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error exporting catalog.json: {e}")
