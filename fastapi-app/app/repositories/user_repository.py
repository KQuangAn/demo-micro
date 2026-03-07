from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    @staticmethod
    def _hash_password(password: str) -> str:
        """Hash a password using bcrypt"""
        return pwd_context.hash(password)
    
    @staticmethod
    def _verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    async def create(self, user_data: UserCreate) -> User:
        """Create a new user"""
        db_user = User(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            hashed_password=self._hash_password(user_data.password),
            is_active=user_data.is_active,
        )
        self.session.add(db_user)
        await self.session.flush()
        await self.session.refresh(db_user)
        return db_user
    
    async def get_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        result = await self.session.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()
    
    async def get_all(
        self, 
        skip: int = 0, 
        limit: int = 100,
        is_active: Optional[bool] = None
    ) -> List[User]:
        """Get all users with pagination"""
        query = select(User)
        
        if is_active is not None:
            query = query.where(User.is_active == is_active)
        
        query = query.offset(skip).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def update(self, user_id: int, user_data: UserUpdate) -> Optional[User]:
        """Update a user"""
        update_data = user_data.model_dump(exclude_unset=True)
        
        # Hash password if provided
        if "password" in update_data:
            update_data["hashed_password"] = self._hash_password(update_data.pop("password"))
        
        if not update_data:
            # No fields to update, just return the user
            return await self.get_by_id(user_id)
        
        await self.session.execute(
            update(User)
            .where(User.id == user_id)
            .values(**update_data)
        )
        await self.session.flush()
        return await self.get_by_id(user_id)
    
    async def delete(self, user_id: int) -> bool:
        """Delete a user"""
        result = await self.session.execute(
            delete(User).where(User.id == user_id)
        )
        await self.session.flush()
        return result.rowcount > 0
    
    async def count(self, is_active: Optional[bool] = None) -> int:
        """Count users"""
        query = select(User)
        if is_active is not None:
            query = query.where(User.is_active == is_active)
        result = await self.session.execute(
            select(func.count()).select_from(query.subquery())
        )
        return result.scalar() or 0
