import os, shutil, hashlib, uuid, csv, io
from datetime import date
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, cast, String
from sqlalchemy.orm import Session
from .database import Base, engine, get_db
from .models import User, RepositoryItem, RepositoryFile, AuditLog
from .schemas import LoginIn, TokenOut, ItemCreate, ItemUpdate, ItemOut
from .auth import hash_password, verify_password, create_token, current_user, require_admin

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="Bioeconomy Digital Repository API")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    admin_email = os.getenv("ADMIN_EMAIL", "admin@bioeconomycorporation.my")
    admin_password = os.getenv("ADMIN_PASSWORD", "ChangeAdminPassword123!")
    if not db.query(User).filter(User.email == admin_email).first():
        db.add(User(name="System Admin", email=admin_email, password_hash=hash_password(admin_password), role="super_admin"))
        db.commit()
    db.close()

@app.get("/api/health")
def health():
    return {"status": "ok"}
    
from pydantic import BaseModel

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


@app.post("/auth/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):

    existing = db.query(User).filter(User.email == data.email).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    user = User(
        name=data.name,
        email=data.email,
        password_hash=get_password_hash(data.password),
        role="user"
    )

    db.add(user)
    db.commit()

    return {
        "message": "Account created successfully"
    }
@app.post("/api/auth/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"access_token": create_token(user), "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}}

@app.get("/api/me")
def me(user: User = Depends(current_user)):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "department": user.department}

@app.get("/api/items")
def list_items(
    q: str | None = None,
    resource_type: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    query = db.query(RepositoryItem)

    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                RepositoryItem.dc_title.ilike(search),
                RepositoryItem.dc_subject.ilike(search),
                RepositoryItem.dc_description.ilike(search),
                RepositoryItem.dc_creator.ilike(search),
                RepositoryItem.department.ilike(search),
                RepositoryItem.resource_type.ilike(search)
            )
        )

    if resource_type:
        query = query.filter(RepositoryItem.resource_type == resource_type)

    if status:
        query = query.filter(RepositoryItem.status == status)

    items = query.order_by(RepositoryItem.created_at.desc()).all()

    results = []

    for item in items:
        files = db.query(RepositoryFile).filter(
            RepositoryFile.item_id == item.id
        ).all()

        item_data = {
            "id": item.id,
            "department": item.department,
            "resource_type": item.resource_type,
            "dc_title": item.dc_title,
            "dc_subject": item.dc_subject,
            "dc_description": item.dc_description,
            "dc_creator": item.dc_creator,
            "dc_publisher": item.dc_publisher,
            "dc_contributor": item.dc_contributor,
            "dc_date": str(item.dc_date) if item.dc_date else "",
            "dc_type": item.dc_type,
            "dc_format": item.dc_format,
            "dc_identifier": item.dc_identifier,
            "dc_source": item.dc_source,
            "dc_language": item.dc_language,
            "dc_relation": item.dc_relation,
            "dc_coverage": item.dc_coverage,
            "dc_rights": item.dc_rights,
            "visibility": item.visibility,
            "status": item.status,
            "files": [
    {
        "id": f.id,
        "filename": f.original_filename,
        "stored_filename": f.stored_filename,
        "filepath": f.file_path,
        "mime_type": f.mime_type,
        "size": f.file_size
    }
    for f in files
],
"file_url": files[0].file_path if files else ""
}
        results.append(item_data)

    return results
@app.post("/api/items", response_model=ItemOut)
def create_item(data: ItemCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = RepositoryItem(**data.model_dump(), created_by=user.id, updated_by=user.id)
    db.add(item)
    db.commit(); db.refresh(item)
    db.add(AuditLog(user_id=user.id, item_id=item.id, action="create", description=f"Created item {item.dc_identifier}"))
    db.commit(); db.refresh(item)
    return item

@app.get("/api/items/{item_id}", response_model=ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = db.get(RepositoryItem, item_id)
    if not item: raise HTTPException(404, "Item not found")
    return item

@app.put("/api/items/{item_id}", response_model=ItemOut)
def update_item(item_id: int, data: ItemUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = db.get(RepositoryItem, item_id)
    if not item: raise HTTPException(404, "Item not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    item.updated_by = user.id
    db.add(AuditLog(user_id=user.id, item_id=item.id, action="update", description="Updated metadata"))
    db.commit(); db.refresh(item)
    return item

@app.delete("/api/items/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin)
):
    item = db.query(RepositoryItem).filter(
        RepositoryItem.id == item_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Item not found"
        )

    # delete audit logs first
    db.query(AuditLog).filter(
        AuditLog.item_id == item_id
    ).delete()

    # delete attached files
    files = db.query(RepositoryFile).filter(
        RepositoryFile.item_id == item_id
    ).all()

    for file in files:
        try:
            file_path = os.path.join(UPLOAD_DIR, file.filename)

            if os.path.exists(file_path):
                os.remove(file_path)
        except:
            pass

        db.delete(file)

    # delete item
    db.delete(item)

    db.commit()

    return {
        "message": "Deposit deleted successfully"
    }
def delete_item(item_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    item = db.get(RepositoryItem, item_id)
    if not item: raise HTTPException(404, "Item not found")
    db.delete(item); db.commit()
    return {"deleted": True}

@app.post("/api/items/{item_id}/files")
def upload_file(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    item = db.get(RepositoryItem, item_id)

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    os.makedirs("uploads", exist_ok=True)

    ext = os.path.splitext(file.filename)[1]
    stored_name = f"{uuid.uuid4()}{ext}"

    save_path = os.path.join("uploads", stored_name)

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    repo_file = RepositoryFile(
        item_id=item.id,
        original_filename=file.filename,
        stored_filename=stored_name,
        file_path=f"/uploads/{stored_name}",
        mime_type=file.content_type,
        file_size=os.path.getsize(save_path),
        uploaded_by=user.id
    )

    db.add(repo_file)
    db.commit()
    db.refresh(repo_file)

    return {
        "message": "File uploaded successfully",
        "id": repo_file.id,
        "filename": repo_file.original_filename,
        "file_url": repo_file.file_path
    }

@app.get("/api/items/{item_id}/dublin-core")
def dublin_core(item_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = db.get(RepositoryItem, item_id)
    if not item: raise HTTPException(404, "Item not found")
    return {
        "dc:title": item.dc_title, "dc:subject": item.dc_subject, "dc:description": item.dc_description,
        "dc:creator": item.dc_creator, "dc:publisher": item.dc_publisher, "dc:contributor": item.dc_contributor,
        "dc:date": item.dc_date.isoformat() if item.dc_date else None, "dc:type": item.dc_type,
        "dc:format": item.dc_format, "dc:identifier": item.dc_identifier, "dc:source": item.dc_source,
        "dc:language": item.dc_language, "dc:relation": item.dc_relation, "dc:coverage": item.dc_coverage,
        "dc:rights": item.dc_rights
    }

@app.get("/api/export/items.csv")
def export_csv(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.query(RepositoryItem).order_by(RepositoryItem.created_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    fields = ["id","department","resource_type","dc_title","dc_subject","dc_description","dc_creator","dc_publisher","dc_contributor","dc_date","dc_type","dc_format","dc_identifier","dc_source","dc_language","dc_relation","dc_coverage","dc_rights","visibility","status"]
    writer.writerow(fields)
    for r in rows:
        writer.writerow([getattr(r, f) for f in fields])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=bioeconomy_repository_export.csv"})
