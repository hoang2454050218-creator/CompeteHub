# CompeteHub - Online Competition Platform

A full-stack web platform for hosting and participating in data science competitions, similar to Kaggle.

## Architecture

```
├── backend/        Express API server (TypeScript, Prisma, Socket.IO)
├── frontend/       React SPA (Vite, TailwindCSS, TanStack Query)
├── worker/         BullMQ scoring worker
├── nginx/          Reverse proxy configuration
└── docker-compose  Dev and production orchestration
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query |
| Backend | Express, TypeScript, Prisma, PostgreSQL, Redis, Socket.IO |
| Worker | BullMQ, csv-parse, Prisma |
| Storage | MinIO (S3-compatible) |
| Infra | Docker Compose, Nginx |

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

## Quick Start (Development)

1. **Clone and setup environment:**
   ```bash
   cp .env.example .env
   ```

2. **Start infrastructure services:**
   ```bash
   docker compose up -d postgres redis minio
   ```

3. **Install dependencies and setup database:**
   ```bash
   cd backend && npm install && npx prisma migrate dev && cd ..
   cd frontend && npm install && cd ..
   cd worker && npm install && cd ..
   ```

4. **Start all services:**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd frontend && npm run dev

   # Terminal 3 - Worker
   cd worker && npm run dev
   ```

5. **Open** http://localhost:5173

## Production Deployment

1. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with production values:
   # - Strong JWT secrets (use: openssl rand -hex 64)
   # - Real database credentials
   # - Redis password
   # - SMTP credentials
   # - OAuth client IDs
   # - MinIO credentials
   # - FRONTEND_URL, API_URL, OAUTH_CALLBACK_URL
   ```

2. **SSL certificates:**
   Place `fullchain.pem` and `privkey.pem` in `nginx/ssl/`.

3. **Deploy:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. **Seed admin user (first time):**
   ```bash
   docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
   ```

## API Documentation

In development, Swagger UI is available at http://localhost:3000/api/docs

## Testing

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test

# Worker
cd worker && npm test
```

## Database Backup

```bash
# Manual backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%Y%m%d).sql
```

## Project Structure

### Backend Modules
- **auth** - Registration, login, OAuth (Google/GitHub), JWT, password reset
- **competition** - CRUD, status management, search
- **dataset** - Upload, download, preview
- **enrollment** - Join/leave competitions
- **submission** - File upload, queue for scoring
- **leaderboard** - Real-time rankings, public/private split
- **discussion** - Forum threads, replies, voting
- **team** - Team management, invitations
- **notification** - Real-time notifications via Socket.IO
- **admin** - Dashboard, user management, competition review
