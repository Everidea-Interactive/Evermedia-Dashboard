# Evermedia Dashboard

A full-stack dashboard application for managing TikTok proxy accounts, campaigns, KPIs, and analytics.

## 🚀 Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 16
- **ORM**: Prisma
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer

### Frontend
- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM

### DevOps
- **Containerization**: Docker Compose
- **Database**: PostgreSQL container

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18 or higher
- **npm** or **yarn**
- **Docker** and **Docker Compose** (for database)
- **PostgreSQL** (if not using Docker)

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd "Evermedia Dashboard"
```

### 2. Install dependencies

Install dependencies for the root, server, and client:

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..

# Install client dependencies
cd client
npm install
cd ..
```

### 3. Configure environment variables

#### Server Configuration

Create a `.env` file in the `server/` directory:

```bash
cd server
cp .env.example .env  # If you have an example file
```

Required environment variables:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tiktok_dashboard"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
PORT=4000
```

#### Client Configuration (Optional)

Create a `.env` file in the `client/` directory if you need to override the default API URL:

```env
VITE_API_URL=http://localhost:4000
```

### 4. Start the database

Using Docker Compose (recommended):

```bash
docker-compose up -d
```

Or use your own PostgreSQL instance and update the `DATABASE_URL` in `server/.env`.

### 5. Run database migrations and seed data

From the repository root:

```bash
npm run migrate-seed
```

This will:
- Run Prisma migrations to set up the database schema
- Seed the database with initial users:
  - `admin@example.com` / `password123` (ADMIN role)
  - `manager@example.com` / `password123` (CAMPAIGN_MANAGER role)
  - `operator@example.com` / `password123` (OPERATOR role)
  - `viewer@example.com` / `password123` (VIEWER role)

## 🏃 Running the Application

### Development Mode

Run both server and client concurrently:

```bash
npm run dev
```

This will start:
- **Server**: http://localhost:4000
- **Client**: http://localhost:5173

### Run Server Only

```bash
npm run server
```

### Run Client Only

```bash
npm run client
```

### Production Build

Build both server and client:

```bash
npm run build
```

Start the production server:

```bash
cd server
npm start
```

## 📁 Project Structure

```
Evermedia Dashboard/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable React components
│   │   ├── context/       # React context providers
│   │   ├── layouts/       # Layout components
│   │   ├── lib/           # Utility libraries and API client
│   │   ├── pages/         # Page components
│   │   └── main.tsx       # Application entry point
│   ├── public/            # Static assets
│   └── dist/              # Build output (gitignored)
│
├── server/                 # Express backend application
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── middleware/    # Express middleware
│   │   ├── utils/         # Utility functions
│   │   ├── prisma.ts      # Prisma client instance
│   │   └── index.ts       # Server entry point
│   ├── prisma/
│   │   ├── schema.prisma  # Database schema
│   │   └── migrations/    # Database migrations
│   ├── uploads/           # File uploads directory
│   └── dist/              # Build output (gitignored)
│
├── docker-compose.yml     # Docker Compose configuration
├── package.json           # Root package.json with scripts
└── README.md              # This file
```

## 🔌 API Documentation

### Authentication

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "token": "jwt-token-here",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "role": "ADMIN"
  }
}
```

### Protected Routes

All routes except `/api/auth/login` require authentication. Include the JWT token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

### API Endpoints

#### Users (ADMIN only)
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

#### Accounts
- `GET /api/accounts` - List accounts (supports filters: `search`, `accountType`, `crossbrand`)
- `GET /api/accounts/:id` - Get account by ID
- `POST /api/accounts` - Create account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account
- `GET /api/accounts/:id/campaigns` - Get campaigns for an account

#### Campaigns
- `GET /api/campaigns` - List campaigns (supports filters: `status`, `category`, `dateFrom`, `dateTo`)
- `GET /api/campaigns/:id` - Get campaign by ID
- `POST /api/campaigns` - Create campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `GET /api/campaigns/:id/kpis` - Get KPIs for a campaign
- `GET /api/campaigns/:id/posts` - Get posts for a campaign
- `GET /api/campaigns/:id/dashboard/kpi` - Get KPI dashboard data
- `GET /api/campaigns/:id/dashboard/engagement` - Get engagement dashboard data

#### KPIs
- `GET /api/kpis` - List KPIs
- `GET /api/kpis/:id` - Get KPI by ID
- `POST /api/kpis` - Create KPI
- `PUT /api/kpis/:id` - Update KPI
- `DELETE /api/kpis/:id` - Delete KPI

#### Posts
- `GET /api/posts` - List posts
- `GET /api/posts/:id` - Get post by ID
- `POST /api/posts` - Create post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

#### Pics
- `GET /api/pics` - List pics
- `GET /api/pics/:id` - Get pic by ID
- `POST /api/pics` - Upload pic
- `PUT /api/pics/:id` - Update pic
- `DELETE /api/pics/:id` - Delete pic

## 📝 Features

- **User Management**: Role-based access control (ADMIN, CAMPAIGN_MANAGER, OPERATOR, VIEWER)
- **Account Management**: Manage TikTok proxy accounts with filtering and search
- **Campaign Management**: Create and manage campaigns with status tracking
- **KPI Tracking**: Monitor key performance indicators with target vs actual metrics
- **Post Analytics**: Track post performance with engagement metrics
- **Dashboard Views**: Visualize campaign performance and engagement data
- **File Uploads**: Upload and manage profile pictures and media

## 🔐 Security Notes

- **JWT Secret**: Always use a strong, random JWT_SECRET in production
- **Password Hashing**: Passwords are hashed using bcryptjs
- **Environment Variables**: Never commit `.env` files to version control
- **CORS**: Configure CORS appropriately for production

## 🧪 Development

### Database Migrations

Create a new migration:

```bash
cd server
npm run prisma:migrate -- --name migration_name
```

Generate Prisma client after schema changes:

```bash
cd server
npm run prisma:generate
```

### Linting

Lint the client code:

```bash
cd client
npm run lint
```

## 📦 Scripts

### Root Level
- `npm run dev` - Run both server and client in development mode
- `npm run server` - Run server only
- `npm run client` - Run client only
- `npm run build` - Build both server and client for production
- `npm run migrate-seed` - Run migrations and seed database

### Server
- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run db:seed` - Seed the database

### Client
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🤝 Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure code follows existing style guidelines
4. Test your changes thoroughly
5. Submit a pull request

## 📄 License

ISC

## 🐛 Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running (check Docker container: `docker ps`)
- Verify `DATABASE_URL` in `server/.env` is correct
- Check database credentials match Docker Compose configuration

### Port Already in Use

- Change the port in `server/.env` (PORT) or client Vite config
- Or stop the process using the port

### Prisma Client Not Generated

Run:
```bash
cd server
npm run prisma:generate
```

## 📧 Support

For issues and questions, please open an issue on the repository.
