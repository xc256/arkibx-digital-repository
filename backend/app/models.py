from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, BigInteger, Boolean, func
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="viewer")
    department = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

class RepositoryItem(Base):
    __tablename__ = "repository_items"
    id = Column(Integer, primary_key=True)
    department = Column(String(255), nullable=True, index=True)
    resource_type = Column(String(50), nullable=False, index=True)
    dc_title = Column(Text, nullable=False, index=True)
    dc_subject = Column(Text, nullable=True)
    dc_description = Column(Text, nullable=True)
    dc_creator = Column(Text, nullable=True)
    dc_publisher = Column(Text, default="Bioeconomy Corporation")
    dc_contributor = Column(Text, nullable=True)
    dc_date = Column(Date, nullable=True, index=True)
    dc_type = Column(String(255), nullable=True)
    dc_format = Column(Text, nullable=True)
    dc_identifier = Column(String(255), unique=True, nullable=False, index=True)
    dc_source = Column(Text, nullable=True)
    dc_language = Column(String(50), nullable=True)
    dc_relation = Column(Text, nullable=True)
    dc_coverage = Column(Text, nullable=True)
    dc_rights = Column(Text, nullable=True)
    visibility = Column(String(50), default="internal")
    status = Column(String(50), default="draft", index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    files = relationship("RepositoryFile", back_populates="item", cascade="all, delete-orphan")

class RepositoryFile(Base):
    __tablename__ = "repository_files"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("repository_items.id", ondelete="CASCADE"), nullable=False)
    original_filename = Column(Text, nullable=False)
    stored_filename = Column(Text, nullable=False)
    file_path = Column(Text, nullable=False)
    mime_type = Column(String(255), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    checksum = Column(String(255), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    item = relationship("RepositoryItem", back_populates="files")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    item_id = Column(Integer, ForeignKey("repository_items.id"), nullable=True)
    action = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
