# app/api/endpoints/auth.py
from datetime import timedelta
# Add Request import
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database.database import get_db
from app.database.auth import verify_password, get_password_hash, create_access_token
from app.structure.structure import Project
from app.structure.structure import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.api.dependencies import get_current_user
from app.database.config import settings

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=Token)
@limiter.limit("5/minute")
async def register(
    request: Request,  # Add proper typing here
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """Register a new user."""
    # Check if user already exists
    existing_user = db.query(User).filter(
        User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)

    user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        is_active=True
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Create access token
    access_token_expires = timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(
    request: Request,  # Add proper typing here too
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """Authenticate user and return access token."""
    user = db.query(User).filter(User.email == login_data.email).first()

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    # Create access token
    access_token_expires = timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user information."""
    # Count user's projects
    projects_count = db.query(Project).filter(
        Project.user_id == current_user.id).count()

    user_response = UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        projects_count=projects_count
    )

    return user_response
