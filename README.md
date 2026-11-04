# CyberOps Workshop

A full-stack web application designed for cybersecurity training and hands-on workshops, featuring an interactive curriculum, cyber arsenal browser, schedules, and a Node.js/MySQL backend API.

---

## 📁 Project Structure

```text
CyberOps-Workshop/
├── client/                 # Frontend React + TypeScript application (Vite)
│   ├── src/
│   │   ├── components/     # UI components (Hero, Arsenal, Schedule, Navbar, etc.)
│   │   ├── data/           # Workshop and tool curriculum data
│   │   ├── App.tsx         # Root component
│   │   └── main.tsx        # React entrypoint
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Backend Node.js / Express API
│   ├── src/
│   │   ├── config/         # Database configuration & initialization (MySQL)
│   │   ├── routes/         # Express API routes (health, etc.)
│   │   └── index.js        # Server entrypoint
│   ├── .env.example        # Environment variables template
│   └── package.json
├── .gitignore              # Unified Git ignore rules
└── README.md
```

---

## ⚡ Tech Stack

- **Frontend (`client`)**:
  - [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
  - [Vite](https://vitejs.dev/) for fast development and bundling
- **Backend (`server`)**:
  - [Node.js](https://nodejs.org/) (ES Modules)
  - [Express](https://expressjs.com/)
  - [MySQL2](https://github.com/sidorares/node-mysql2) database driver
  - [CORS](https://github.com/expressjs/cors) middleware

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v20+ recommended, supports native `--env-file` and `--watch`)
- **npm** or another package manager
- **MySQL Server** (local or remote)

---

### 1. Backend Setup (`server`)

1. Open a terminal and navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to match your database and port configurations:
   ```env
   PORT=5000
   CLIENT_ORIGIN=http://localhost:5173

   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=cyber_ops
   ```

4. *(Optional)* Initialize the database:
   ```bash
   npm run db:init
   ```

5. Start the backend development server (with hot reload):
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:5000`. You can check the health endpoint at:
   - `GET http://localhost:5000/api/health`

---

### 2. Frontend Setup (`client`)

1. Open a separate terminal and navigate to the `client` directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 📜 Available Scripts

### `server`
- `npm run dev`: Starts the server with `--watch` and `--env-file=.env`.
- `npm start`: Starts the server in production mode.
- `npm run db:init`: Runs the database initialization script.

### `client`
- `npm run dev`: Starts Vite local dev server with HMR.
- `npm run build`: Type-checks and creates an optimized production build in `client/dist`.
- `npm run preview`: Previews the production build locally.

---

## 🛡️ License

This project is for educational and training purposes.

