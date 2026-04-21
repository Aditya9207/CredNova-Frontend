# CredNova Frontend

The frontend for CredNova is a modern web application built with React, Vite, and Tailwind CSS. It provides a user-friendly interface for applicants to manage their profiles, upload bank statements, and view their credit scores, as well as a portal for bank employees to review applications.

## Prerequisites

- **Node.js**: 18.x or higher
- **npm** or **yarn**

## Installation & Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Copy the example environment file and update it with your Clerk credentials:
   ```bash
   cp .env.example .env
   # On Windows PowerShell:
   # cp .env.example .env
   ```
   Ensure `VITE_CLERK_PUBLISHABLE_KEY` is set correctly.

## Running the Application

Start the development server:

```bash
npm run dev
```

The application will typically be available at `http://localhost:5174` (or `http://localhost:5173` depending on port availability). Check the terminal output for the exact URL.

## Key Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the application for production.
- `npm run lint`: Runs ESLint to check for code quality issues.
- `npm run preview`: Previews the production build locally.

## Project Structure

- **`src/components/`**: Reusable UI components.
- **`src/pages/`**: Main page components (Marketing, Dashboard, Application Flow, etc.).
- **`src/hooks/`**: Custom React hooks for API calls and state management.
- **`src/lib/`**: Library configurations (Clerk, Axios, etc.).
- **`public/`**: Static assets.

## Frontend Technical Stack

- **Framework**: React 19 (Vite)
- **Styling**: Tailwind CSS
- **Authentication**: Clerk
- **Charts**: Recharts
- **Icons**: Lucide React, Ant Design Icons
- **State/Data Fetching**: TanStack Query (React Query)
