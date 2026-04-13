import re
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.db.database import get_db
from app.models.models import User, ClientProfile
from app.schemas.schemas import UserCreate, UserLogin, UserOut, Token
from app.core.security import verify_password, get_password_hash, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


def user_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role,
        "is_active": user.is_active,
        "is_verified": getattr(user, 'is_verified', True),
    }


@router.post("/register", status_code=201)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        phone=getattr(user_data, 'phone', None),
        role=getattr(user_data, 'role', 'client'),
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": user_to_dict(user)}


@router.post("/login")
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(401, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(403, "Account is deactivated")
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": user_to_dict(user)}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return user_to_dict(current_user)


@router.get("/my-profile")
async def get_my_profile(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ClientProfile).where(ClientProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    return {
        "user": user_to_dict(current_user),
        "profile": {
            "id": profile.id, "pan": profile.pan, "gstin": profile.gstin,
            "business_name": profile.business_name, "business_type": profile.business_type,
            "address": profile.address, "state": profile.state, "pincode": profile.pincode,
            "registration_date": str(profile.registration_date) if profile.registration_date else None,
            "current_financial_year": profile.current_financial_year,
        } if profile else None
    }


@router.put("/my-profile")
async def update_my_profile(data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ClientProfile).where(ClientProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()

    allowed = ['business_name','business_type','pan','gstin','address','state','pincode','registration_date','current_financial_year']
    clean = {}
    for k in allowed:
        v = data.get(k)
        if v is not None and str(v).strip():
            clean[k] = str(v).strip() if isinstance(v, str) else v

    if 'pan' in clean:
        pan = clean['pan'].upper()
        if not re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]$', pan):
            raise HTTPException(400, f"Invalid PAN: {pan}. Format: ABCDE1234F")
        clean['pan'] = pan

    if 'gstin' in clean and clean['gstin']:
        gstin = clean['gstin'].upper()
        if not re.match(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$', gstin):
            raise HTTPException(400, f"Invalid GSTIN: {gstin}")
        clean['gstin'] = gstin

    if current_user.role in ('admin', 'ca'):
        if not profile and clean.get('business_name'):
            profile = ClientProfile(user_id=current_user.id, **clean)
            db.add(profile)
        elif profile:
            for k, v in clean.items():
                setattr(profile, k, v)
        await db.flush()
        return {"message": "Profile updated"}

    if not profile:
        if not clean.get('business_name'):
            raise HTTPException(400, "Business name is required")
        if not clean.get('pan'):
            raise HTTPException(400, "PAN number is required")
        profile = ClientProfile(user_id=current_user.id, **clean)
        db.add(profile)
    else:
        for k, v in clean.items():
            setattr(profile, k, v)

    try:
        await db.flush()
        await db.refresh(profile)
        await db.commit()
    except Exception as e:
        await db.rollback()
        err = str(e).lower()
        if 'pan' in err:
            raise HTTPException(400, "This PAN is already registered")
        if 'gstin' in err:
            raise HTTPException(400, "This GSTIN is already registered")
        raise HTTPException(500, f"Save failed: {str(e)}")

    return {"message": "Profile saved successfully", "profile_id": profile.id}


@router.put("/change-password")
async def change_password(old_password: str, new_password: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not verify_password(old_password, current_user.hashed_password):
        raise HTTPException(400, "Old password is incorrect")
    current_user.hashed_password = get_password_hash(new_password)
    await db.flush()
    return {"message": "Password changed"}


@router.post("/admin/create-client", status_code=201)
async def admin_create_client(user_data: UserCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role not in ('admin', 'ca'):
        raise HTTPException(403, "Admin only")
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        phone=getattr(user_data, 'phone', None),
        role="client", is_active=True, is_verified=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return {"message": "Client created", "user_id": str(user.id), "email": user.email, "temp_password": user_data.password}


# ── DB INSPECTION + ADMIN INIT ──────────────────────────────────────────────

@router.get("/db-inspect")
async def db_inspect(secret: str = "", db: AsyncSession = Depends(get_db)):
    """Inspect DB columns — helps debug schema mismatches"""
    if secret != "AjitSetup2024":
        return {"error": "Add ?secret=AjitSetup2024"}

    # Get all columns in users table
    cols = await db.execute(text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name='users' ORDER BY ordinal_position"
    ))
    user_cols = [{"column": r[0], "type": r[1]} for r in cols.fetchall()]

    # Get all tables
    tables = await db.execute(text(
        "SELECT tablename FROM pg_tables WHERE schemaname='public'"
    ))
    all_tables = [r[0] for r in tables.fetchall()]

    # Get row count
    try:
        count = await db.execute(text("SELECT COUNT(*) FROM users"))
        user_count = count.scalar()
    except Exception:
        user_count = "error"

    return {
        "tables": all_tables,
        "users_columns": user_cols,
        "user_count": user_count,
    }


@router.get("/init-admin")
async def init_admin(secret: str = "", db: AsyncSession = Depends(get_db)):
    """Create admin using raw SQL — bypasses ORM column name issues"""
    if secret != "AjitSetup2024":
        return {"error": "Add ?secret=AjitSetup2024 to the URL"}

    from passlib.context import CryptContext
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed = pwd.hash("Ajit07")

    # First inspect what columns actually exist
    cols_result = await db.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='users' ORDER BY ordinal_position"
    ))
    existing_cols = [r[0] for r in cols_result.fetchall()]

    if not existing_cols:
        return {"error": "users table does not exist yet. Backend may still be initializing."}

    # Check if admin exists using raw SQL
    check = await db.execute(text("SELECT id FROM users WHERE email='admin@ajitjoshi.com'"))
    existing = check.fetchone()

    # Find password column name (could be hashed_password or password_hash)
    pwd_col = None
    for candidate in ['hashed_password', 'password_hash', 'password', 'pwd']:
        if candidate in existing_cols:
            pwd_col = candidate
            break

    if not pwd_col:
        return {
            "error": "Cannot find password column",
            "existing_columns": existing_cols,
            "hint": "Check db-inspect endpoint"
        }

    # Find name column
    name_col = None
    for candidate in ['full_name', 'name', 'username', 'display_name']:
        if candidate in existing_cols:
            name_col = candidate
            break

    if existing:
        # Update
        await db.execute(text(
            f"UPDATE users SET {pwd_col}=:pwd, role='admin', is_active=true "
            f"WHERE email='admin@ajitjoshi.com'"
        ), {"pwd": hashed})
        await db.commit()
        return {
            "status": "✅ SUCCESS - Password Updated",
            "email": "admin@ajitjoshi.com",
            "password": "Ajit07",
            "columns_found": existing_cols,
            "message": "Go login now at your frontend!"
        }
    else:
        # Insert
        new_id = str(uuid.uuid4())
        cols_to_insert = ["id", "email", pwd_col, "role", "is_active"]
        vals = [f"'{new_id}'::uuid", f"'admin@ajitjoshi.com'", f"'{hashed}'", "'admin'", "true"]

        if name_col:
            cols_to_insert.append(name_col)
            vals.append("'Ajit Joshi'")
        if "is_verified" in existing_cols:
            cols_to_insert.append("is_verified")
            vals.append("true")

        sql = f"INSERT INTO users ({','.join(cols_to_insert)}) VALUES ({','.join(vals)})"
        try:
            await db.execute(text(sql))
            await db.commit()
            return {
                "status": "✅ SUCCESS - Admin Created",
                "email": "admin@ajitjoshi.com",
                "password": "Ajit07",
                "columns_used": cols_to_insert,
                "message": "Go login now at your frontend!"
            }
        except Exception as e:
            await db.rollback()
            return {
                "status": "❌ Insert failed",
                "error": str(e),
                "sql_attempted": sql,
                "existing_columns": existing_cols
            }
@router.get("/db-inspect")
async def db_inspect(secret: str = "", db: AsyncSession = Depends(get_db)):
    if secret != "AjitSetup2024":
        return {"error": "Add ?secret=AjitSetup2024"}
    from sqlalchemy import text
    cols = await db.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"))
    user_cols = [{"column": r[0], "type": r[1]} for r in cols.fetchall()]
    tables = await db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'"))
    all_tables = [r[0] for r in tables.fetchall()]
    try:
        count = await db.execute(text("SELECT COUNT(*) FROM users"))
        user_count = count.scalar()
    except Exception:
        user_count = "error"
    return {"tables": all_tables, "users_columns": user_cols, "user_count": user_count}


@router.get("/init-admin")
async def init_admin(secret: str = "", db: AsyncSession = Depends(get_db)):
    if secret != "AjitSetup2024":
        return {"error": "Add ?secret=AjitSetup2024 to the URL"}
    import uuid as _uuid
    from passlib.context import CryptContext
    from sqlalchemy import text
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed = pwd.hash("Ajit07")
    cols_result = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"))
    existing_cols = [r[0] for r in cols_result.fetchall()]
    if not existing_cols:
        return {"error": "users table does not exist yet"}
    check = await db.execute(text("SELECT id FROM users WHERE email='admin@ajitjoshi.com'"))
    existing = check.fetchone()
    pwd_col = next((c for c in ['hashed_password','password_hash','password','pwd'] if c in existing_cols), None)
    if not pwd_col:
        return {"error": "Cannot find password column", "existing_columns": existing_cols}
    name_col = next((c for c in ['full_name','name','username','display_name'] if c in existing_cols), None)
    if existing:
        await db.execute(text(f"UPDATE users SET {pwd_col}=:pwd, role='admin', is_active=true WHERE email='admin@ajitjoshi.com'"), {"pwd": hashed})
        await db.commit()
        return {"status": "SUCCESS - Password Updated", "email": "admin@ajitjoshi.com", "password": "Ajit07", "message": "Login now!"}
    else:
        new_id = str(_uuid.uuid4())
        c = ["id","email",pwd_col,"role","is_active"]
        v = [f"'{new_id}'::uuid",f"'admin@ajitjoshi.com'",f"'{hashed}'","'admin'","true"]
        if name_col: c.append(name_col); v.append("'Ajit Joshi'")
        if "is_verified" in existing_cols: c.append("is_verified"); v.append("true")
        sql = f"INSERT INTO users ({','.join(c)}) VALUES ({','.join(v)})"
        try:
            await db.execute(text(sql))
            await db.commit()
            return {"status": "SUCCESS - Admin Created", "email": "admin@ajitjoshi.com", "password": "Ajit07", "columns_used": c, "message": "Login now!"}
        except Exception as e:
            await db.rollback()
            return {"status": "Error", "error": str(e), "existing_columns": existing_cols}
