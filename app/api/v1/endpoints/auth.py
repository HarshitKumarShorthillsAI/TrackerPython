from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import jwt

from app.api import deps
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.crud.crud_user import user as crud_user
from app.schemas.auth import Token, ForgotPassword, ResetPassword
from app.utils.email import send_password_reset_email

router = APIRouter()

@router.post("/login/access-token", response_model=Token)
async def login_access_token(
    db: Session = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """OAuth2 compatible token login, get an access token for future requests."""
    user = crud_user.authenticate(
        db, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=400, detail="Incorrect email or password"
        )
    elif not user.is_active:
        raise HTTPException(
            status_code=400, detail="Inactive user"
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(
    forgot_password_in: ForgotPassword,
    db: Session = Depends(deps.get_db)
) -> None:
    """
    Password recovery endpoint. Sends a password reset email if the user exists.
    Always returns 204 to prevent email enumeration.
    """
    user = crud_user.get_by_email(db, email=forgot_password_in.email)
    if user and user.is_active:
        # Create password reset token
        token_expires = timedelta(hours=24)
        token = create_access_token(
            user.id,
            expires_delta=token_expires,
            token_type="reset"
        )
        # Send password reset email
        try:
            send_password_reset_email(
                email_to=user.email,
                token=token
            )
        except Exception as e:
            print(f"Error sending password reset email: {e}")
            # Don't expose error details to client
            pass
    return None

@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    reset_password_in: ResetPassword,
    db: Session = Depends(deps.get_db)
) -> None:
    """Reset password using the token from the reset password email."""
    try:
        payload = jwt.decode(
            reset_password_in.token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        if not payload.get("sub") or payload.get("type") != "reset":
            raise HTTPException(
                status_code=400,
                detail="Invalid token"
            )
        user = crud_user.get(db, id=int(payload["sub"]))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=400,
                detail="Invalid token"
            )
        # Update password
        hashed_password = get_password_hash(reset_password_in.new_password)
        user.hashed_password = hashed_password
        db.commit()
    except jwt.JWTError:
        raise HTTPException(
            status_code=400,
            detail="Invalid token"
        )
    return None 