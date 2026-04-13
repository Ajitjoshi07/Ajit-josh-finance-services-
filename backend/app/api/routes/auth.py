import re
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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
        "is_verified": user.is_verified,
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

    # Validate PAN
    if 'pan' in clean:
        pan = clean['pan'].upper()
        if not re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]$', pan):
            raise HTTPException(400, f"Invalid PAN: {pan}. Format: ABCDE1234F")
        clean['pan'] = pan

    # Validate GSTIN
    if 'gstin' in clean and clean['gstin']:
        gstin = clean['gstin'].upper()
        if not re.match(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$', gstin):
            raise HTTPException(400, f"Invalid GSTIN: {gstin}")
        clean['gstin'] = gstin

    # Admin/CA don't need business profile — skip requirement
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
        profile = ClientProfile(user_id=current_user.id, business_name=clean.get('business_name', ''), **{k: v for k, v in clean.items() if k != 'business_name'})
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


@router.get("/init-admin")
async def init_admin(
    secret: str = "",
    db: AsyncSession = Depends(get_db)
):
    """One-time admin init via browser URL — no auth needed"""
    if secret != "AjitSetup2024":
        return {"error": "Add ?secret=AjitSetup2024 to the URL"}

    from passlib.context import CryptContext
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

    result = await db.execute(select(User).where(User.email == "admin@ajitjoshi.com"))
    existing = result.scalar_one_or_none()

    if existing:
        existing.hashed_password = pwd.hash("Ajit07")
        existing.role = "admin"
        existing.is_active = True
        existing.is_verified = True
        try:
            await db.commit()
        except Exception:
            await db.rollback()
            await db.commit()
        return {
            "status": "✅ SUCCESS - Password Updated",
            "email": "admin@ajitjoshi.com",
            "password": "Ajit07",
            "message": "Go login now!"
        }
    else:
        new_admin = User(
            email="admin@ajitjoshi.com",
            hashed_password=pwd.hash("Ajit07"),
            full_name="Ajit Joshi",
            role="admin",
            is_active=True,
            is_verified=True,
        )
        db.add(new_admin)
        try:
            await db.commit()
            await db.refresh(new_admin)
        except Exception as e:
            await db.rollback()
            return {"status": "❌ Error", "detail": str(e)}
        return {
            "status": "✅ SUCCESS - Admin Created",
            "email": "admin@ajitjoshi.com",
            "password": "Ajit07",
            "id": str(new_admin.id),
            "message": "Go login now!"
        }
