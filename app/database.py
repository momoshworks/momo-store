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
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_category ON apps(category);
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_package ON apps(package_name);
    """)
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
    d["featured"] = bool(d.get("featured", 0))
    return d

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
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO apps (
        id, package_name, name, short_description, description, category,
        icon_url, version_name, version_code, min_android_version,
        file_size_bytes, file_size_formatted, download_url, storage_type,
        sha256, changelog, screenshots, developer, github_repo,
        featured, downloads_count, rating, rating_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data["id"],
        data["package_name"],
        data["name"],
        data["short_description"],
        data["description"],
        data["category"],
        data["icon_url"],
        data["version_name"],
        data["version_code"],
        data.get("min_android_version", "Android 8.0+"),
        data.get("file_size_bytes", 0),
        data.get("file_size_formatted", "0 MB"),
        data["download_url"],
        data.get("storage_type", "github_release"),
        data["sha256"],
        data.get("changelog", "الإصدار الأولي"),
        screenshots_str,
        data.get("developer", "فريق التطوير"),
        data.get("github_repo"),
        1 if data.get("featured", False) else 0,
        data.get("downloads_count", 0),
        data.get("rating", 5.0),
        data.get("rating_count", 1),
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

def get_stats() -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*), SUM(downloads_count), AVG(rating) FROM apps")
    total_apps, total_downloads, avg_rating = cursor.fetchone()
    
    cursor.execute("SELECT category, COUNT(*) as cnt FROM apps GROUP BY category ORDER BY cnt DESC")
    categories = [{"name": r[0], "count": r[1]} for r in cursor.fetchall()]
    conn.close()
    
    return {
        "total_apps": total_apps or 0,
        "total_downloads": total_downloads or 0,
        "average_rating": round(avg_rating or 0.0, 1),
        "categories": categories
    }

def export_catalog_json() -> None:
    try:
        apps = get_apps(sort_by="popular")
        catalog_data = {
            "catalog_version": "1.0.0",
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "apps_count": len(apps),
            "apps": apps
        }
        with open(CATALOG_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(catalog_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error exporting catalog.json: {e}")
