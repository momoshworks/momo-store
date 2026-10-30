from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class AppBase(BaseModel):
    id: str = Field(..., description="Unique slug or identifier, e.g. ai-assistant")
    package_name: str = Field(..., description="Android package name, e.g. com.example.app")
    name: str = Field(..., description="Display title of the application")
    short_description: str = Field(..., description="One sentence summary")
    description: str = Field(..., description="Full description of features and usage")
    category: str = Field(default="أدوات عامة", description="Category of the app")
    icon_url: str = Field(default="/static/icons/default-app.svg")
    version_name: str = Field(default="1.0.0", description="Semantic version string")
    version_code: int = Field(default=1, description="Numeric version code for update checks")
    min_android_version: str = Field(default="Android 8.0+", description="Minimum Android OS supported")
    file_size_bytes: int = Field(default=0)
    file_size_formatted: str = Field(default="0 MB")
    download_url: str = Field(..., description="Direct download URL or /uploads/apks/ path")
    storage_type: str = Field(default="github_release", description="github_release or local_server")
    sha256: str = Field(..., description="SHA-256 cryptographic checksum")
    changelog: str = Field(default="الإصدار الأولي للتطبيق", description="What's new in this version")
    screenshots: List[str] = Field(default_factory=list)
    developer: str = Field(default="فريق التطوير")
    github_repo: Optional[str] = None
    featured: bool = Field(default=False)

class AppCreate(AppBase):
    pass

class AppUpdate(BaseModel):
    name: Optional[str] = None
    short_description: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    icon_url: Optional[str] = None
    version_name: Optional[str] = None
    version_code: Optional[int] = None
    min_android_version: Optional[str] = None
    file_size_bytes: Optional[int] = None
    file_size_formatted: Optional[str] = None
    download_url: Optional[str] = None
    storage_type: Optional[str] = None
    sha256: Optional[str] = None
    changelog: Optional[str] = None
    screenshots: Optional[List[str]] = None
    developer: Optional[str] = None
    github_repo: Optional[str] = None
    featured: Optional[bool] = None

class AppRecord(AppBase):
    downloads_count: int = 0
    rating: float = 5.0
    rating_count: int = 1
    created_at: str
    updated_at: str

class RateRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)

class UpdateCheckRequest(BaseModel):
    package_name: str
    installed_version_code: int

class UpdateCheckResponse(BaseModel):
    update_available: bool
    latest_version_name: str
    latest_version_code: int
    changelog: str
    download_url: str
    sha256: str
    file_size_formatted: str

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AdminLoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    message: str
