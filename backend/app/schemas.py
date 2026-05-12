from datetime import date, datetime
from pydantic import BaseModel, EmailStr
from typing import Optional, List

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class ItemBase(BaseModel):
    department: Optional[str] = None
    resource_type: str
    dc_title: str
    dc_subject: Optional[str] = None
    dc_description: Optional[str] = None
    dc_creator: Optional[str] = None
    dc_publisher: Optional[str] = "Bioeconomy Corporation"
    dc_contributor: Optional[str] = None
    dc_date: Optional[date] = None
    dc_type: Optional[str] = None
    dc_format: Optional[str] = None
    dc_identifier: str
    dc_source: Optional[str] = None
    dc_language: Optional[str] = None
    dc_relation: Optional[str] = None
    dc_coverage: Optional[str] = None
    dc_rights: Optional[str] = None
    visibility: Optional[str] = "internal"
    status: Optional[str] = "draft"

class ItemCreate(ItemBase):
    pass

class ItemUpdate(ItemBase):
    resource_type: Optional[str] = None
    dc_title: Optional[str] = None
    dc_identifier: Optional[str] = None

class FileOut(BaseModel):
    id: int
    original_filename: str
    file_path: str
    mime_type: Optional[str]
    file_size: Optional[int]
    checksum: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

class ItemOut(ItemBase):
    id: int
    created_at: datetime
    updated_at: datetime
    files: List[FileOut] = []
    class Config:
        from_attributes = True
