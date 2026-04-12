<div align="center">

# 🏦 Ajit Joshi Finance Services
### Full-Stack CA SaaS Platform — GST · TDS · ITR · Bookkeeping · AI Assistant

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**A production-grade Chartered Accountant management platform for Indian SMBs — handling GST compliance, TDS records, ITR preparation, and AI-powered tax advisory.**

[Live Demo](#live-demo) · [Features](#features) · [Tech Stack](#tech-stack) · [Quick Start](#quick-start) · [API Docs](#api-documentation)

</div>

---

## 🔴 Live Demo

> **URL:** `https://ajit-joshi-finance.onrender.com`
>
> | Role | Email | Password |
> |------|-------|----------|
> | Admin / CA | `admin@ajitjoshi.com` | `admin123` |
> | Client Demo | `client@demo.com` | `client123` |

---

## 📋 Overview

Ajit Joshi Finance Services is a **real-world production SaaS** built to digitise the end-to-end workflow of a Chartered Accountant practice. It replaces manual Excel-based work with an automated, role-based platform that handles:

- **GST Filing** — GSTR-1 / GSTR-3B monthly tracking with status management
- **TDS Management** — Section-wise deduction records (194C, 194J, 194H, 194I, 192…)
- **ITR Preparation** — Automated computation per Income Tax Act 1961 (New Regime Sec 115BAC)
- **Financial Reports** — ICAI-standard Manufacturing, Trading, P&L and Balance Sheet
- **Document OCR** — AI-powered extraction from invoices, bank statements, salary slips
- **AI CA Assistant** — Claude-powered chatbot for instant tax advisory
- **Multi-client** — Admin can manage unlimited clients with isolated data views
- **Excel Exports** — ICAI-formatted multi-sheet CA file for audit & filing

---

## ✨ Features

### 👨‍💼 Admin / CA Side
| Feature | Description |
|---------|-------------|
| **Client Management** | Create client accounts with credentials, manage activation status, reset passwords |
| **Per-Client Data Views** | Every module (GST, TDS, ITR, Reports, Bookkeeping, Export) has a client selector — no data mixing |
| **GST Status Control** | Change filing status (Pending → Draft → Filed → Late) for any month of any client |
| **Manual Entry Review** | Approve or reject entries submitted by clients with reason logging |
| **System Statistics** | Dashboard showing total clients, documents, pending OCR tasks |

### 👤 Client Side
| Feature | Description |
|---------|-------------|
| **Document Upload** | Drag-and-drop PDF/image upload with auto-OCR using Tesseract + Claude |
| **Manual Entry** | Enter transactions directly — sales, purchases, expenses, salary, bank, assets |
| **Trial Balance Entry** | Full ICAI chart of accounts (80+ accounts) in two-sided Dr/Cr format |
| **GST Dashboard** | Monthly chart, filing status, GSTIN verifier |
| **TDS Overview** | Quarter-wise summary with section reference table |
| **ITR Computation** | Automated tax calculation with slab breakdown |
| **ICAI Reports** | Manufacturing Account → Trading Account → P&L → Balance Sheet |
| **Export CA File** | Multi-sheet ICAI-formatted Excel with all accounts |
| **AI Assistant** | Claude-powered CA chatbot for GST, TDS, ITR, accounting queries |

### 🤖 AI & Automation
- **OCR Pipeline** — Tesseract + Claude vision for invoice data extraction
- **Auto Journal Entries** — Approved documents auto-create double-entry bookkeeping records
- **AI Chat Proxy** — Server-side Anthropic API proxy (API key never exposed to browser)
- **GSTIN Verifier** — Real-time GST registration validation

---

## 🛠️ Tech Stack

### Backend
| Technology | Version | Why Chosen |
|-----------|---------|-----------|
| **Python** | 3.11 | Ecosystem richness for finance/data, type hints, async support |
| **FastAPI** | 0.110 | Auto-generated OpenAPI docs, async-native, Pydantic validation, 3x faster than Flask |
| **SQLAlchemy** | 2.0 (async) | Async ORM with type safety, migration support, industry standard for Python |
| **PostgreSQL** | 16 | ACID compliance critical for financial data, JSON support, production-grade |
| **asyncpg** | 0.29 | Fastest PostgreSQL async driver for Python |
| **Alembic** | 1.13 | Schema migration management, rollback support |
| **httpx** | 0.27 | Async HTTP client for Anthropic API proxy |
| **openpyxl** | 3.1 | Excel generation with full formatting support (ICAI-style sheets) |
| **Tesseract / pytesseract** | 5.x | Open-source OCR engine for document text extraction |
| **Pydantic** | 2.x | Request/response validation with strict type enforcement |
| **python-jose** | 3.3 | JWT token signing for secure role-based authentication |
| **bcrypt** | 4.1 | Password hashing — industry standard |
| **Celery + Redis** | 5.3 | Background task queue for async OCR processing |

### Frontend
| Technology | Version | Why Chosen |
|-----------|---------|-----------|
| **React** | 18 | Component reusability, rich ecosystem, concurrent rendering |
| **Vite** | 5 | Sub-second HMR, ES module native bundling, fastest dev experience |
| **Tailwind CSS** | 3 | Utility-first — no CSS file maintenance, consistent design tokens |
| **TanStack Query** | 5 | Intelligent server-state caching, background refetching, eliminates Redux for API data |
| **Zustand** | 4 | Minimal global state for auth — no boilerplate vs Redux |
| **React Hook Form** | 7 | Performant forms with zero re-renders, built-in validation |
| **Recharts** | 2 | React-native charting library, SVG-based, accessible |
| **Axios** | 1.6 | HTTP client with interceptors for auto token injection & 401 redirect |
| **Lucide React** | 0.383 | Consistent SVG icon library |
| **React Hot Toast** | 2 | Non-blocking user feedback for mutations |

### Infrastructure
| Technology | Why Chosen |
|-----------|-----------|
| **Docker + Compose** | Reproducible environments, one-command local setup |
| **Render.com** | Free-tier hosting with managed PostgreSQL, auto-deploy from Git |
| **Redis** | Celery broker + result backend for async OCR tasks |
| **Nginx** | Production reverse proxy serving React SPA + API |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│  React 18 + Vite + Zustand (auth) + TanStack Query (data)  │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / REST
┌────────────────────────▼────────────────────────────────────┐
│               FastAPI (Python 3.11)                         │
│  ┌──────────┐ ┌───────┐ ┌───────┐ ┌──────────┐ ┌───────┐  │
│  │  /auth   │ │ /gst  │ │ /tds  │ │ /reports │ │ /ai   │  │
│  │  /docs   │ │ /itr  │ │/admin │ │ /export  │ │/chat  │  │
│  └──────────┘ └───────┘ └───────┘ └──────────┘ └───────┘  │
│         │              │                    │               │
│  ┌──────▼──────┐  ┌────▼──────┐    ┌───────▼──────┐       │
│  │  SQLAlchemy │  │  Celery   │    │  Anthropic   │       │
│  │  (async)   │  │  Worker   │    │  API (Claude)│       │
│  └──────┬──────┘  └────┬──────┘    └──────────────┘       │
└─────────┼───────────────┼───────────────────────────────────┘
          │               │
┌─────────▼──────┐ ┌──────▼──────┐
│  PostgreSQL 16 │ │   Redis     │
│  (Financial    │ │  (Celery    │
│   Data Store)  │ │   Broker)   │
└────────────────┘ └─────────────┘
```

### Key Design Decisions

**Why FastAPI over Django?**
FastAPI's async-native design allows handling concurrent OCR tasks and API calls without blocking. Django's ORM is synchronous by default. For a CA platform where multiple clients upload documents simultaneously, async is critical.

**Why PostgreSQL over MySQL?**
PostgreSQL's `NUMERIC` type provides exact decimal arithmetic — essential for financial calculations. MySQL's floating-point can introduce rounding errors in tax amounts.

**Why TanStack Query over Redux?**
Financial data in this app is server-state (not client-state). TanStack Query handles caching, background refetching, and invalidation without the boilerplate of Redux actions/reducers.

**Why Zustand over Context API?**
Zustand avoids the "prop drilling" problem and prevents unnecessary re-renders. The auth store is minimal (token + user + role helpers) — perfect fit.

---

## 📁 Project Structure

```
ajit-joshi-finance/
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   │   ├── auth.py           # Registration, login, JWT, admin user management
│   │   │   ├── gst.py            # GST summary, GSTR-1/3B, GSTIN verify, status update
│   │   │   ├── documents.py      # Upload, OCR trigger, download
│   │   │   ├── manual_entry.py   # Submit, approve, reject transactions
│   │   │   ├── export.py         # ICAI-format Excel exports
│   │   │   ├── other_routes.py   # TDS, ITR, Bookkeeping, Reports, Admin
│   │   │   └── ai_chat.py        # Anthropic API proxy (secure server-side)
│   │   ├── services/
│   │   │   ├── tax/
│   │   │   │   ├── gst_engine.py     # Monthly GST aggregation engine
│   │   │   │   ├── itr_engine.py     # ITR computation (slabs, cess, deductions)
│   │   │   │   └── gstn_verifier.py  # GSTIN validation
│   │   │   ├── ocr/
│   │   │   │   └── processor.py      # Tesseract + Claude vision OCR pipeline
│   │   │   └── reports/
│   │   │       └── financial_statements.py  # P&L, Balance Sheet, Trial Balance
│   │   ├── models/models.py      # SQLAlchemy ORM models
│   │   ├── schemas/schemas.py    # Pydantic request/response schemas
│   │   ├── core/
│   │   │   ├── config.py         # Settings (env vars)
│   │   │   └── security.py       # JWT, password hashing, role decorators
│   │   └── db/database.py        # Async engine, session, Base
│   ├── migrations/               # Alembic schema migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AllPages.jsx      # GST, TDS, ITR, Bookkeeping, Reports, AI Chat
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── DocumentsPage.jsx
│   │   │   ├── ManualEntryPage.jsx  # Entry form + Trial Balance (ICAI)
│   │   │   ├── AdminPage.jsx
│   │   │   ├── ExportPage.jsx
│   │   │   └── AuthPages.jsx
│   │   ├── services/api.js       # Axios instance + all API endpoint functions
│   │   ├── store/authStore.js    # Zustand auth state
│   │   └── components/
│   │       └── shared/Layout.jsx # Sidebar navigation + notification panel
│   └── Dockerfile
├── docker-compose.yml
├── render.yaml                   # Render.com deployment config
└── start.sh                      # Bootstrap script
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Git

### 1. Clone & Configure
```bash
git clone https://github.com/yourusername/ajit-joshi-finance.git
cd ajit-joshi-finance

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. Set Environment Variables
Edit `backend/.env`:
```env
SECRET_KEY=your-super-secret-key-min-32-chars
DATABASE_URL=postgresql://postgres:postgres@db:5432/ajit_finance_db
ASYNC_DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/ajit_finance_db
REDIS_URL=redis://redis:6379/0
ANTHROPIC_API_KEY=sk-ant-...        # Required for AI Assistant
STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=./uploads
```

### 3. Start with Docker Compose
```bash
docker compose up -d
```

This starts:
- `db` — PostgreSQL 16
- `redis` — Redis 7
- `backend` — FastAPI on port 8000
- `frontend` — Vite dev server on port 3000

### 4. Seed Initial Data
```bash
docker compose exec backend python seed.py
```

Creates admin account: `admin@ajitjoshi.com` / `admin123`

### 5. Open the App
- **Frontend:** http://localhost:3000
- **API Docs:** http://localhost:8000/api/docs

---

## 🔌 API Documentation

FastAPI auto-generates interactive Swagger UI at `/api/docs` and ReDoc at `/api/redoc`.

### Key Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login — returns JWT token + user object |
| POST | `/api/v1/auth/register` | Self-registration (client role) |
| POST | `/api/v1/auth/admin/create-client` | Admin creates client account |
| GET | `/api/v1/auth/me` | Get current user from token |

#### GST
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/gst/summary` | Monthly GST summary (12 months) |
| GET | `/api/v1/gst/gstr1` | GSTR-1 B2B/B2C breakdown |
| GET | `/api/v1/gst/gstr3b` | GSTR-3B net tax computation |
| PUT | `/api/v1/gst/update-status` | Update filing status (admin) |
| GET | `/api/v1/gst/verify-gstin/{gstin}` | Validate GSTIN |

#### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/reports/profit-loss` | P&L statement (ICAI) |
| GET | `/api/v1/reports/balance-sheet` | Balance Sheet (ICAI) |
| GET | `/api/v1/bookkeeping/trial-balance` | Trial Balance |

#### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/export/excel/complete` | Full ICAI CA file (multi-sheet Excel) |
| GET | `/api/v1/export/excel/gst` | GST summary Excel |
| GET | `/api/v1/export/excel/transactions` | Transaction register Excel |

#### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai/chat` | Proxy to Anthropic Claude API (server-side) |

---

## 🔐 Security

- **JWT Authentication** — RS256 signed tokens, 24-hour expiry
- **Role-Based Access Control** — `admin`, `ca`, `client` roles enforced at route level
- **Password Hashing** — bcrypt with salt rounds
- **API Key Security** — Anthropic key stored server-side, never exposed to browser
- **Token-based Export Auth** — Excel downloads use query-param token to avoid cookie issues

---

## 🌐 Deployment (Render.com)

The `render.yaml` file defines the complete multi-service deployment:

```yaml
services:
  - name: ajit-finance-backend
    type: web
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT

  - name: ajit-finance-frontend
    type: web
    env: node
    buildCommand: npm install && npm run build
    staticPublishPath: ./dist

databases:
  - name: ajit-finance-db
    databaseName: ajit_finance_db
    plan: free
```

**Set these environment variables in Render dashboard:**
- `ANTHROPIC_API_KEY`
- `SECRET_KEY`
- `DATABASE_URL` (auto-set by Render PostgreSQL)

---

## 📊 ICAI Compliance

All financial reports follow **ICAI (Institute of Chartered Accountants of India)** standards:

| Report | Standard |
|--------|---------|
| Manufacturing Account | AS-2 (Inventories) |
| Trading Account | Schedule III, Companies Act 2013 |
| Profit & Loss Account | AS-5, Schedule III |
| Balance Sheet | Schedule III, Companies Act 2013 |
| Trial Balance | Standard double-entry bookkeeping |
| GST Calculations | CGST Act 2017, IGST Act 2017 |
| TDS | Income Tax Act 1961, Sections 192–196 |
| ITR | Income Tax Act 1961, New Regime Sec 115BAC |

---

## 🧪 Development

```bash
# Backend only (without Docker)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend only
cd frontend
npm install
npm run dev

# Run database migrations
alembic upgrade head
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) file.

---

<div align="center">
Built with ❤️ for Indian CAs & SMBs | Ajit Joshi Finance Services
</div>
