from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import ssl
import re
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode, ParseResult


class Base(DeclarativeBase):
    pass


def build_async_url(url: str) -> tuple[str, dict]:
    """
    Convert any postgres URL to asyncpg-compatible format.
    Returns (clean_url, connect_args)
    
    Handles:
    - postgres:// → postgresql+asyncpg://
    - strips sslmode, channel_binding, connect_timeout params
    - passes SSL via connect_args not query string
    """
    if not url:
        raise ValueError("DATABASE_URL is not set")

    # Normalize scheme first
    url = url.strip()
    url = url.replace("postgres://", "postgresql://")
    url = url.replace("postgresql+psycopg2://", "postgresql://")

    # Parse the URL properly
    parsed = urlparse(url)

    # Parse query params and remove asyncpg-incompatible ones
    query_params = parse_qs(parsed.query, keep_blank_values=True)
    
    # These params are NOT supported by asyncpg — must be removed
    STRIP_PARAMS = {
        'sslmode', 'channel_binding', 'connect_timeout',
        'application_name', 'sslcert', 'sslkey', 'sslrootcert',
        'ssl', 'options'
    }
    
    # Check if SSL was requested before removing
    sslmode = query_params.get('sslmode', [''])[0]
    needs_ssl = (
        sslmode in ('require', 'verify-ca', 'verify-full', 'prefer') or
        'render.com' in (parsed.hostname or '') or
        'neon.tech' in (parsed.hostname or '') or
        'supabase.co' in (parsed.hostname or '') or
        'amazonaws.com' in (parsed.hostname or '')
    )

    # Remove incompatible params
    clean_params = {k: v for k, v in query_params.items() if k not in STRIP_PARAMS}
    clean_query = urlencode(clean_params, doseq=True) if clean_params else ''

    # Rebuild clean URL with asyncpg scheme
    clean = ParseResult(
        scheme='postgresql+asyncpg',
        netloc=parsed.netloc,
        path=parsed.path,
        params=parsed.params,
        query=clean_query,
        fragment=parsed.fragment,
    )
    async_url = urlunparse(clean)

    # Build connect_args
    connect_args = {"server_settings": {"jit": "off"}}
    if needs_ssl:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ssl_ctx

    return async_url, connect_args


_async_url, _connect_args = build_async_url(settings.DATABASE_URL)

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
