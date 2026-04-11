#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Ajit Joshi Finance Services — Quick Start Script
# Run this from the project root directory
# ─────────────────────────────────────────────────────────────────────────────

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Ajit Joshi Finance Services — Quick Start  ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ─── Check dependencies ───────────────────────────────────────────────────────
echo -e "${YELLOW}Checking dependencies...${NC}"

command -v python3 >/dev/null 2>&1 || { echo -e "${RED}Python 3 not found. Please install Python 3.12+${NC}"; exit 1; }
command -v node >/dev/null 2>&1    || { echo -e "${RED}Node.js not found. Please install Node.js 20+${NC}"; exit 1; }
command -v psql >/dev/null 2>&1    || echo -e "${YELLOW}⚠  PostgreSQL not found locally — make sure it's running${NC}"
command -v redis-cli >/dev/null 2>&1 || echo -e "${YELLOW}⚠  Redis not found locally — make sure it's running${NC}"

echo -e "${GREEN}✓ Core dependencies present${NC}"
echo ""

# ─── Backend setup ────────────────────────────────────────────────────────────
echo -e "${YELLOW}Setting up backend...${NC}"
cd backend

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo -e "${GREEN}✓ .env created from .env.example — edit it to set your DATABASE_URL etc.${NC}"
fi

if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo -e "${GREEN}✓ Virtual environment created${NC}"
fi

source venv/bin/activate
pip install -r requirements.txt -q
echo -e "${GREEN}✓ Python dependencies installed${NC}"

# Seed database
echo -e "${YELLOW}Seeding database...${NC}"
python seed.py || echo -e "${YELLOW}⚠  Seed failed — ensure PostgreSQL is running and DATABASE_URL is correct in .env${NC}"

cd ..

# ─── Frontend setup ───────────────────────────────────────────────────────────
echo -e "${YELLOW}Setting up frontend...${NC}"
cd frontend

if [ ! -f ".env" ]; then
  cp .env.example .env
fi

npm install -q
echo -e "${GREEN}✓ Node dependencies installed${NC}"
cd ..

# ─── Launch services ──────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Starting services...${NC}"
echo ""

# Start backend in background
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
cd ..

sleep 2

# Start Celery worker in background
cd backend
source venv/bin/activate
celery -A app.core.celery_app worker --loglevel=warning &
CELERY_PID=$!
echo -e "${GREEN}✓ Celery worker started (PID: $CELERY_PID)${NC}"
cd ..

sleep 1

# Start frontend
cd frontend
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
cd ..

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Services Running                 ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Frontend:  http://localhost:3000             ║${NC}"
echo -e "${GREEN}║  Backend:   http://localhost:8000             ║${NC}"
echo -e "${GREEN}║  API Docs:  http://localhost:8000/api/docs    ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Admin:     admin@ajitjoshi.com / admin123    ║${NC}"
echo -e "${GREEN}║  Client:    client@demo.com / client123       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo "Press Ctrl+C to stop all services"

# Cleanup on exit
trap "kill $BACKEND_PID $CELERY_PID $FRONTEND_PID 2>/dev/null; echo 'Services stopped.'" EXIT

wait
