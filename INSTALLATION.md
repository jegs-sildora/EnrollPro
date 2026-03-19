# Installation Manual: EnrollPro System

This guide provides step-by-step instructions for setting up and running the EnrollPro system locally.

## 1. Prerequisites

Ensure you have the following installed on your machine:

- **Node.js** (v18.x or later)
- **pnpm** (v8.x or later) - The project uses pnpm workspaces.
- **PostgreSQL** (v14 or later) - Used as the primary database.
- **Git** - For cloning the repository.

## 2. Getting Started

Clone the repository and navigate to the project root:

```bash
git clone <repository-url>
cd enrollpro
```

Install dependencies for the entire workspace:

```bash
pnpm install
```

## 3. Server Setup

Navigate to the `server` directory:

```bash
cd server
```

### 3.1 Environment Configuration

Create a `.env` file by copying the example:

```bash
cp .env.example .env
```

Open `.env` and configure the following:

- `DATABASE_URL`: Set your PostgreSQL connection string (e.g., `postgresql://user:password@localhost:5432/enrollpro`).
- `JWT_SECRET`: A secure random string for authentication.
- `RESEND_API_KEY`: (Optional) Your Resend API key for email notifications.
- `PORT`: Default is `5000`.
- `CLIENT_URL`: Default is `http://localhost:5173`.

### 3.2 Database Initialization

Ensure your PostgreSQL server is running, then run the migrations and generate the Prisma client:

```bash
pnpm run db:migrate
pnpm run db:generate
```

### 3.3 Initial Seeding

Populate the database with essential data (System Admin, School Years, etc.):

```bash
pnpm run db:seed
```

To add sample student data for testing:

```bash
pnpm run db:seed-students
```

## 4. Client Setup

Navigate to the `client` directory:

```bash
cd ../client
```

### 4.1 Environment Configuration

The client uses Vite. If there are specific environment variables (like `VITE_API_URL`), ensure they are set in a `.env` file in the `client` directory. By default, it communicates with `http://localhost:5000`.

## 5. Running the Application

You can run both the client and server simultaneously from the root directory:

```bash
# From the root directory
pnpm run dev
```

This will start:
- **Server:** `http://localhost:5000`
- **Client:** `http://localhost:5173`

## 6. Accessing the System

Once running, open your browser and navigate to `http://localhost:5173`.

### Default Admin Credentials
If you used the default seed data:
- **Email:** `admin@deped.edu.ph`
- **Password:** `Admin2026!`

## 7. Troubleshooting

- **Database Connection:** If the server fails to start, verify your `DATABASE_URL` in the `.env` file and ensure PostgreSQL is accepting connections.
- **Prisma Issues:** If you encounter types errors related to the database, try re-running `pnpm run db:generate`.
- **Node Version:** Ensure you are using a compatible Node.js version (`node -v`).

---
For further assistance, please contact the development team.
