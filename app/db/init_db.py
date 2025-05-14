from sqlalchemy.orm import Session
from app.core.config import settings
from app.core import security
from app.models.user import User
from app.schemas.user import UserCreate

def init_db(db: Session) -> None:
    # Create super user if it doesn't exist
    user = db.query(User).filter(User.email == "admin@example.com").first()
    if not user:
        user_in = UserCreate(
            email="admin@example.com",
            password="admin",
            is_superuser=True,
            full_name="Initial Admin",
            username="admin"
        )
        user = User(
            email=user_in.email,
            hashed_password=security.get_password_hash(user_in.password),
            full_name=user_in.full_name,
            is_superuser=user_in.is_superuser,
            username=user_in.username
        )
        db.add(user)
        db.commit()
        db.refresh(user) 