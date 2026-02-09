"""
Script untuk membuat akun admin
Jalankan: python create_admin.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.db import SessionLocal, init_db
from app.database.models import User
from app.utils.auth import get_password_hash
from datetime import datetime


def create_admin_user():
    """Create admin user account"""
    print("\n🔧 Creating Admin User...\n")
    
    # Initialize database
    init_db()
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.username == "admin").first()
        if existing_admin:
            print("❌ Admin user already exists!")
            print(f"   Username: admin")
            print(f"   Email: {existing_admin.email}")
            print(f"   Created: {existing_admin.created_at}")
            return
        
        # Create admin user
        admin_user = User(
            username="admin",
            email="admin@iqrogesture.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Administrator",
            is_active=True
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print("✅ Admin user created successfully!\n")
        print("=" * 50)
        print("📋 Admin Account Details:")
        print("=" * 50)
        print(f"   Username    : admin")
        print(f"   Password    : admin123")
        print(f"   Email       : admin@iqrogesture.com")
        print(f"   Full Name   : Administrator")
        print(f"   User ID     : {admin_user.id}")
        print(f"   Created At  : {admin_user.created_at}")
        print("=" * 50)
        print("\n⚠️  IMPORTANT: Change password after first login!")
        print("🔗 Login at: http://localhost:5173\n")
        
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    create_admin_user()
