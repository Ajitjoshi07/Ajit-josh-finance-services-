"""
STANDALONE admin creator - no app imports needed.
Run directly: python fix_admin.py
Works with any PostgreSQL URL.
"""
import asyncio
import os
import re
import ssl
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode, ParseResult

async def main():
    # Install deps if needed
    import subprocess
    subprocess.run(["pip", "install", "asyncpg", "passlib[bcrypt]", "-q"], check=False)

    import asyncpg
    from passlib.context import CryptContext

    DATABASE_URL = os.environ.get("DATABASE_URL", "")
    if not DATABASE_URL:
        print("❌ DATABASE_URL not set")
        return

    print(f"DB: {DATABASE_URL[:40]}...")

    # Parse and clean URL for asyncpg
    url = DATABASE_URL.replace("postgres://", "postgresql://")
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    sslmode = params.get("sslmode", [""])[0]
    needs_ssl = sslmode in ("require", "verify-ca", "verify-full") or \
                "render.com" in (parsed.hostname or "") or \
                "neon.tech" in (parsed.hostname or "")

    # Remove incompatible params
    strip = {"sslmode", "channel_binding", "connect_timeout", "options"}
    clean_params = {k: v for k, v in params.items() if k not in strip}
    clean_query = urlencode(clean_params, doseq=True)
    clean = ParseResult("postgresql", parsed.netloc, parsed.path, "", clean_query, "")
    pg_url = urlunparse(clean)

    ssl_ctx = None
    if needs_ssl:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE

    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed = pwd.hash("Ajit07")

    print("Connecting...")
    conn = await asyncpg.connect(pg_url, ssl=ssl_ctx)

    try:
        # Check if users table exists
        exists = await conn.fetchval(
            "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename='users')"
        )
        if not exists:
            print("❌ users table does not exist! Tables not created yet.")
            print("   Make sure the backend deployed successfully first.")
            return

        # Check existing
        row = await conn.fetchrow("SELECT id, email, role FROM users WHERE email=$1", "admin@ajitjoshi.com")

        if row:
            await conn.execute(
                "UPDATE users SET hashed_password=$1, role='admin', is_active=true WHERE email=$2",
                hashed, "admin@ajitjoshi.com"
            )
            print(f"✅ Admin password UPDATED to 'Ajit07'")
            print(f"   ID: {row['id']}")
        else:
            # Get column info to check if id is UUID or integer
            col = await conn.fetchrow(
                "SELECT data_type FROM information_schema.columns WHERE table_name='users' AND column_name='id'"
            )
            id_type = col["data_type"] if col else "uuid"
            print(f"   ID column type: {id_type}")

            if "uuid" in id_type.lower():
                import uuid
                new_id = str(uuid.uuid4())
                await conn.execute("""
                    INSERT INTO users (id, email, hashed_password, full_name, role, is_active, is_verified)
                    VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
                """, new_id, "admin@ajitjoshi.com", hashed, "Ajit Joshi", "admin", True, True)
            else:
                await conn.execute("""
                    INSERT INTO users (email, hashed_password, full_name, role, is_active, is_verified)
                    VALUES ($1, $2, $3, $4, $5, $6)
                """, "admin@ajitjoshi.com", hashed, "Ajit Joshi", "admin", True, True)

            print(f"✅ Admin created!")

        print(f"\n📧 Email: admin@ajitjoshi.com")
        print(f"🔑 Password: Ajit07")
        print(f"✅ You can now login!")

    finally:
        await conn.close()

asyncio.run(main())
