# GymSheet — Django + React

Mobile-first spreadsheet + gym tracker built with Django REST Framework and React/Vite.

## What is included

- Green spreadsheet-inspired UI.
- Mobile-first layout with modern bottom navigation.
- Light/dark mode.
- English/Spanish translation across the main app screens.
- PIN login by default, password login also supported.
- Admin approval for new users.
- Home vertical calendar: 1 month back and 1 week ahead.
- Goals/routines with repeat options and up to 10 exercises per goal.
- Exercises with YouTube links and clipboard paste button.
- Exercise logs with daily weight tracking.
- Profile dashboard with filters, progress graph, exercise creation, goal creation, body measurements, and sticky notes per body part.
- Global leaderboard that refreshes weekly and uses average weight lifted in the current week.
- PostgreSQL-ready backend with SQLite fallback for quick local development.
- Docker Compose and Jenkinsfile included.

## Run Project

### 1. First Time Setup

If this is your **very first time** running the project on your computer, you need to set up the environments, install dependencies, and create the database.

Open **Windows PowerShell** from the project root and run:

```powershell
# 1. Allow running scripts in PowerShell (only needed once per computer)
Set-ExecutionPolicy Unrestricted -Scope CurrentUser

# 2. Setup Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
copy .env.example .env
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo

# 3. Setup Frontend
cd ..\frontend
npm install
copy .env.example .env
```

### 2. Running the App ("dependecies installed previously")

Whenever you want to start the app, you need two terminal windows:

**Terminal 1: Start Backend**
Open PowerShell from the project root:
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py runserver 0.0.0.0:8000
```

**Terminal 2: Start Frontend**
Open a **new** PowerShell window from the project root:
```powershell
cd frontend
Set-ExecutionPolicy Unrestricted -Scope CurrentUser
npm run dev
```

Open:

```txt
http://127.0.0.1:5173
```

## Demo accounts

Admin panel:

```txt
http://127.0.0.1:8000/admin/
```

Admin login:

```txt
admin@gym.sheet
Admin123456!
```

Demo users:

```txt
dummy@gym.sheet
omare@gym.sheet
copito@gym.sheet
josema@gym.sheet
```

Demo PIN for all demo users:

```txt
123456
```

## Database options

For quick laptop testing, the backend uses SQLite by default.

For production or online data, use managed PostgreSQL. Update `backend/.env`:

```env
USE_SQLITE=false
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DBNAME
```

## Docker

Windows PowerShell:

```powershell
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
docker compose up --build
```
## Database Schema ([dbdiagram.io](https://dbdiagram.io/d/69f1f7e3ddb9320fdc8ba2d9))


