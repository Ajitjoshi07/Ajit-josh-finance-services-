# Ajit Joshi Finance Services

A full-stack AI-powered CA SaaS platform for GST filing, TDS, ITR preparation, bookkeeping, OCR document processing, and financial reporting.

---

## Tech Stack

| Layer        | Technology                                 |
|--------------|--------------------------------------------|
| Backend      | Python 3.12 + FastAPI + SQLAlchemy         |
| Frontend     | React 18 + Vite + Tailwind CSS             |
| Database     | PostgreSQL 16                              |
| Cache/Queue  | Redis 7 + Celery                          |
| OCR          | Tesseract + OpenCV + Pillow               |
| AI Chatbot   | Anthropic Claude API                       |
| Auth         | JWT (python-jose + passlib bcrypt)         |
| Deploy       | Docker Compose (local) → Render.com (prod) |

---

## Project Structure

```
ajit-joshi-finance/
├── backend/
│   ├── app/
│   │   ├── api/routes/         # auth, documents, gst, tds, itr, etc.
│   │   ├── core/               # config, security, celery
│   │   ├── db/                 # database connection
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── ocr/            # Tesseract + OpenCV pipeline
│   │   │   ├── tax/            # GST, TDS, ITR engines + GSTN verifier
│   │   │   └── reports/        # P&L, Balance Sheet, Trial Balance
│   │   └── utils/              # financial year helpers
│   ├── migrations/             # Alembic migration stubs
│   ├── main.py                 # FastAPI app entry point
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/shared/  # Layout, Sidebar
│   │   ├── pages/              # Dashboard, GST, TDS, ITR, Documents, etc.
│   │   ├── services/api.js     # Axios API client
│   │   ├── store/authStore.js  # Zustand auth state
│   │   └── styles/globals.css  # Tailwind + custom styles
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
├── docker-compose.yml
├── render.yaml
└── README.md
```

---

## Local Setup (Without Docker)

### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL 16 (running locally)
- Redis (running locally)
- Tesseract OCR

### 1. Install Tesseract OCR

**Ubuntu/Debian:**
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-hin tesseract-ocr-mar
```

**macOS:**
```bash
brew install tesseract tesseract-lang
```

**Windows:**
Download from: https://github.com/UB-Mannheim/tesseract/wiki

### 2. PostgreSQL Setup
```bash
# Create database
psql -U postgres
CREATE DATABASE ajit_finance_db;
\q
```

### 3. Redis Setup
```bash
# Ubuntu
sudo apt-get install redis-server
sudo systemctl start redis

# macOS
brew install redis
brew services start redis
```

### 4. Backend Setup
```bash
cd backend

# Copy and configure environment
cp .env.example .env
# Edit .env — set your DATABASE_URL, SECRET_KEY, etc.

# Create virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be live at: http://localhost:8000  
API docs at: http://localhost:8000/api/docs

### 5. Start Celery Worker (in a new terminal)
```bash
cd backend
source venv/bin/activate
celery -A app.core.celery_app worker --loglevel=info
```

### 6. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Copy env
cp .env.example .env

# Start dev server
npm run dev
```

Frontend will be live at: http://localhost:3000

---

## Local Setup (With Docker — Recommended)

### Prerequisites
- Docker Desktop (with Compose)

### Run everything with one command:
```bash
# Clone the repo
git clone https://github.com/Ajitjoshi07/ajit-joshi-finance.git
cd ajit-joshi-finance

# Copy backend env
cp backend/.env.example backend/.env

# Start all services
docker compose up --build
```

Services started:
- Frontend:  http://localhost:3000
- Backend:   http://localhost:8000
- API Docs:  http://localhost:8000/api/docs
- PostgreSQL: localhost:5432
- Redis:     localhost:6379

### Stop all services:
```bash
docker compose down
```

### View logs:
```bash
docker compose logs -f backend
docker compose logs -f celery_worker
```

---

## First-Time Setup (Create Admin User)

After starting the backend, create your first admin user:

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ajitjoshi.com",
    "password": "admin123",
    "full_name": "Ajit Joshi",
    "role": "admin"
  }'
```

Or use the Register page in the UI (role defaults to "client").  
To upgrade a user to admin, use the Admin panel → Users after logging in.

---

## Key Features

### Document Processing Pipeline
1. Client uploads PDF/image/Excel
2. File hash checked for duplicates
3. OCR extraction via Tesseract (English + Hindi + Marathi)
4. OpenCV preprocessing: denoise → sharpen → deskew
5. Key fields extracted: invoice number, GSTIN, amounts, dates
6. Financial year + month auto-mapped (April–March logic)
7. Transaction record auto-created if confidence ≥ 50%

### GST Module
- Monthly GST summary (Output GST - Input GST = Net Payable)
- GSTR-1 report (B2B + B2C invoices)
- GSTR-3B report (outward + inward supplies)
- GSTIN verification tool

### Tax Engines
- **TDS**: Section-wise (194C, 194J, 194H, 194I, 194A, 194B), quarterly reports
- **ITR**: New tax regime slabs, deductions (80C), net tax computation
- **GST**: Monthly output/input reconciliation

### Financial Statements
- Trial Balance (checks if balanced)
- Profit & Loss Statement
- Balance Sheet (Assets = Liabilities + Capital validation)

### AI Chatbot
- Powered by Claude API
- Answers GST, TDS, ITR questions in context

---

## API Documentation

After starting the backend, visit:
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/register | Register user |
| POST | /api/v1/auth/login | Login, get JWT |
| GET | /api/v1/auth/me | Current user |
| POST | /api/v1/documents/upload | Upload document |
| GET | /api/v1/documents | List documents |
| GET | /api/v1/gst/summary | Monthly GST summary |
| GET | /api/v1/gst/gstr1 | GSTR-1 report |
| GET | /api/v1/gst/gstr3b | GSTR-3B report |
| GET | /api/v1/gst/verify-gstin/{gstin} | Verify GSTIN |
| GET | /api/v1/tds/quarterly-summary | TDS quarterly report |
| GET | /api/v1/itr/summary | ITR computation |
| GET | /api/v1/bookkeeping/trial-balance | Trial balance |
| GET | /api/v1/reports/profit-loss | P&L statement |
| GET | /api/v1/reports/balance-sheet | Balance sheet |
| GET | /api/v1/clients | List all clients (CA/Admin) |
| GET | /api/v1/admin/stats | System stats (Admin) |

---

## Deploying to Render.com

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit — Ajit Joshi Finance Services"
git remote add origin https://github.com/Ajitjoshi07/ajit-joshi-finance.git
git push -u origin main
```

### Step 2: Connect to Render
1. Go to https://render.com → New → Blueprint
2. Connect your GitHub repo: `Ajitjoshi07/ajit-joshi-finance`
3. Render will auto-detect `render.yaml` and create all services

### Step 3: Set Environment Variables on Render
In the Render dashboard for the **backend** service, set:
```
SECRET_KEY         = <generate strong random key>
ANTHROPIC_API_KEY  = <your key>
GSTN_API_KEY       = <your key if available>
```

### Step 4: PostgreSQL + Redis on Render
- PostgreSQL: Auto-created by render.yaml (free tier)
- Redis: Create a new Redis service in Render dashboard, copy the connection string to `REDIS_URL`

### Step 5: Update Frontend API URL
In the Render frontend service settings, set:
```
VITE_API_BASE_URL = https://your-backend-service.onrender.com
```

---

## Security Checklist

- [x] JWT authentication with bcrypt password hashing
- [x] Role-based access control (admin / ca / client)
- [x] Input validation via Pydantic schemas
- [x] File type + size validation on upload
- [x] File hash-based duplicate detection
- [x] CORS configured for allowed origins only
- [x] SQL injection prevention via SQLAlchemy ORM
- [x] Environment variables for all secrets
- [ ] HTTPS (handled by Render.com in production)
- [ ] Rate limiting (add slowapi middleware)
- [ ] Audit logging (add per-action logging)

---

## Environment Variables Reference

### Backend (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | JWT signing key (32+ chars) | Required |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `ASYNC_DATABASE_URL` | Async PostgreSQL URL | Required |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379/0 |
| `ANTHROPIC_API_KEY` | For AI chatbot | Optional |
| `GSTN_API_KEY` | For GSTIN verification | Optional (mock used if empty) |
| `SMTP_HOST` | Email server | smtp.gmail.com |
| `SMTP_USER` | Email sender | Optional |
| `ALLOWED_ORIGINS` | CORS origins | http://localhost:3000 |

---

## License

MIT License — Built for Ajit Joshi Finance Services  
GitHub: https://github.com/Ajitjoshi07
