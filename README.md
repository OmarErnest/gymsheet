# Gym Journey 🏋️‍♂️

**Your personal fitness companion for tracking progress, hitting goals, and climbing the leaderboard.**

Gym Journey is a modern, mobile-responsive fitness application designed to help you organize your workouts, track your physical evolution, and stay motivated through a competitive community leaderboard.

---

## ✨ Features

- **🎯 Goal-Oriented Workouts**: Build custom routines with sets, reps, and specific exercises. Supercharge your consistency with recurring weekly goals.
- **🗺️ Interactive Body Map**: Track measurements for every muscle group using a visual map. Watch your progress in CM over time.
- **📈 Strength Analytics**: Visualize your performance with dynamic charts. Monitor your **Daily Average Weight** lifted across all exercises or focus on specific muscle groups.
- **🏆 Community Leaderboard**: Compete with other athletes. Earn **Gold, Silver, or Bronze** status based on your weekly consistency and lifting intensity.
- **🔗 Profile Personalization**: Top-ranked users (Top 10) can share their favorite training resources, Spotify playlists, or gear via a custom "Recommended Link" badge.
- **🌓 Adaptive UI**: Sleek dark and light modes with glassmorphism aesthetics, designed for a premium mobile-first experience.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (or SQLite for local development)

### Backend Setup (Django)
1. Navigate to the `/backend` directory.
2. Create a virtual environment: `python -m venv .venv`
3. Activate the environment:
   - Windows: `.venv\Scripts\activate`
   - Mac/Linux: `source .venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Apply database migrations: `python manage.py migrate`
6. Start the server: `python manage.py runserver`

### Frontend Setup (Vite + React)
1. Navigate to the `/frontend` directory.
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Access the application at `http://localhost:5173`

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Recharts, Lucide Icons
- **Backend**: Django, Django REST Framework
- **Database**: PostgreSQL / SQLite
- **Styling**: Vanilla CSS (Custom Glassmorphism Design System)

---

## 🤝 Community
The leaderboard refreshes weekly and uses consistency, logs, and your average lift weight to determine the rankings. Top performers get the privilege of sharing recommended resources with the community!

*Developed with passion for fitness and precision.*
