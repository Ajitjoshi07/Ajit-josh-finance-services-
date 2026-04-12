from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import ssl


class Base(DeclarativeBase):
    pass


def build_async_url(url: str) -> str:
    """Convert any postgres URL to asyncpg format, strip sslmode param"""
    if not url:
        raise ValueError("DATABASE_URL is not set")

    # Fix scheme
    url = url.replace("postgres://", "postgresql://")
    url = url.replace("postgresql+psycopg2://", "postgresql://")
    url = url.replace("postgresql://", "postgresql+asyncpg://")

    # Remove sslmode query param — asyncpg doesn't accept it
    import re
    url = re.sub(r'[?&]sslmode=[^&]*', '', url)
    url = re.sub(r'[?&]ssl=[^&]*', '', url)
    url = re.sub(r'\?$', '', url)  # remove trailing ?

    return url


def build_connect_args(url: str) -> dict:
    """Build asyncpg connect_args — use SSL if original URL had sslmode"""
    needs_ssl = 'sslmode' in url or 'render.com' in url or 'neon.tech' in url or 'supabase' in url

    args = {"server_settings": {"jit": "off"}}

    if needs_ssl:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        args["ssl"] = ssl_ctx

    return args


_db_url = settings.DATABASE_URL
_async_url = build_async_url(_db_url)
_connect_args = build_connect_args(_db_url)

engine = create_async_engine(
    _async_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=5,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=True,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
