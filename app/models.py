from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime

class AppBase(BaseModel):
    id: str = Field(..., description="Unique slug or identifier, e.g. ai-assistant")
    package_name: str = Field(..., description="Android package name or product SKU")
    name: str = Field(..., description="Display title of the application or product")
    short_description: str = Field(..., description="One sentence summary")
    description: str = Field(..., description="Full description of features and usage")
    category: str = Field(default="برامج الهاتف", description="Category")
    icon_url: str = Field(default="./static/icons/default-app.svg")
    version_name: str = Field(default="1.0.0")
    version_code: int = Field(default=1)
    min_android_version: str = Field(default="Android 5.0+")
    file_size_bytes: int = Field(default=0)
    file_size_formatted: str = Field(default="0 MB")
    download_url: str = Field(default="#")
    storage_type: str = Field(default="github_release")
    sha256: str = Field(default="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    changelog: str = Field(default="الإصدار الأولي للتطبيق")
    screenshots: List[str] = Field(default_factory=list)
    developer: str = Field(default="MOMO Team")
    github_repo: Optional[str] = None
    featured: bool = Field(default=False)
    
    # E-Commerce fields
    item_type: str = Field(default="app", description="app or product")
    price: float = Field(default=0.0)
    old_price: float = Field(default=0.0)
    discount_percent: int = Field(default=0)
    colors: List[str] = Field(default_factory=list)
    sizes: List[str] = Field(default_factory=list)
    stock: int = Field(default=100)

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
    item_type: Optional[str] = None
    price: Optional[float] = None
    old_price: Optional[float] = None
    discount_percent: Optional[int] = None
    colors: Optional[List[str]] = None
    sizes: Optional[List[str]] = None
    stock: Optional[int] = None

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

# Order Models
class OrderItem(BaseModel):
    id: str
    name: str
    price: float
    quantity: int = 1
    selected_color: Optional[str] = None
    selected_size: Optional[str] = None
    icon_url: Optional[str] = None

class OrderCreate(BaseModel):
    customer_name: str
    phone: str
    address: str
    city: str = "القاهرة"
    items: List[OrderItem]
    subtotal: float
    discount: float = 0.0
    total: float
    payment_method: str = "vodafone_cash" # vodafone_cash, instapay, cod, card

class OrderStatusUpdate(BaseModel):
    status: str # pending, processing, shipped, delivered, cancelled
