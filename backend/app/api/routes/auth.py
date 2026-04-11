from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.db.database import get_db
from app.models.models import User, ClientProfile
from app.schemas.schemas import UserCreate, UserLogin, UserOut, Token, ClientProfileCreate
from app.core.security import (
    verify_password, get_password_hash, create_access_token, get_current_user, require_admin
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token, status_code=201)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/my-profile")
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "phone": current_user.phone,
            "role": current_user.role,
            "is_active": current_user.is_active,
        },
        "profile": {
            "id": profile.id,
            "pan": profile.pan,
            "gstin": profile.gstin,
            "business_name": profile.business_name,
            "business_type": profile.business_type,
            "address": profile.address,
            "state": profile.state,
            "pincode": profile.pincode,
            "registration_date": str(profile.registration_date) if profile.registration_date else None,
            "current_financial_year": profile.current_financial_year,
            "gstn_status": profile.gstn_status,
            "risk_score": profile.risk_score,
        } if profile else None
    }


@router.put("/my-profile")
async def update_my_profile(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create or update client profile — handles both new and existing"""
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    allowed = [
        'business_name', 'business_type', 'pan', 'gstin',
        'address', 'state', 'pincode', 'registration_date', 'current_financial_year'
    ]

    # Clean and validate data
    clean = {}
    for k in allowed:
        v = data.get(k)
        if v is not None and str(v).strip() != '':
            clean[k] = str(v).strip() if isinstance(v, str) else v

    # Validate PAN format
    if 'pan' in clean:
        import re
        pan = clean['pan'].upper()
        if not re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]$', pan):
            raise HTTPException(400, f"Invalid PAN format: {pan}. Must be like ABCDE1234F")
        clean['pan'] = pan

    # Validate GSTIN if provided
    if 'gstin' in clean and clean['gstin']:
        import re
        gstin = clean['gstin'].upper()
        if not re.match(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$', gstin):
            raise HTTPException(400, f"Invalid GSTIN format: {gstin}")
        clean['gstin'] = gstin

    if not profile:
        # Create new profile
        if 'business_name' not in clean:
            raise HTTPException(400, "Business name is required")
        if 'pan' not in clean:
            raise HTTPException(400, "PAN number is required")
        profile = ClientProfile(user_id=current_user.id, **clean)
        db.add(profile)
    else:
        # Update existing
        for k, v in clean.items():
            setattr(profile, k, v)

    try:
        await db.flush()
        await db.refresh(profile)
        await db.commit()
    except Exception as e:
        await db.rollback()
        err = str(e)
        if 'pan' in err.lower():
            raise HTTPException(400, "This PAN is already registered to another account")
        if 'gstin' in err.lower():
            raise HTTPException(400, "This GSTIN is already registered to another account")
        raise HTTPException(500, f"Failed to save profile: {err}")

    return {"message": "Profile saved successfully", "profile_id": profile.id}


@router.put("/change-password")
async def change_password(
    old_password: str,
    new_password: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(old_password, current_user.hashed_password):
        raise HTTPException(400, "Old password is incorrect")
    current_user.hashed_password = get_password_hash(new_password)
    await db.flush()
    return {"message": "Password changed successfully"}


@router.post("/admin/create-client", status_code=201)
async def admin_create_client(
    user_data: UserCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        phone=user_data.phone,
        role="client",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return {
        "message": "Client created successfully",
        "user_id": user.id,
        "email": user.email,
        "temp_password": user_data.password
    }
