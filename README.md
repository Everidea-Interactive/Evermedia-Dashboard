# Evermedia Dashboard

A full-stack dashboard application for managing TikTok proxy accounts, campaigns, KPIs, and analytics.

## 🚀 Tech Stack

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Database Client**: Supabase JS
- **Authentication**: Supabase Auth

### Frontend

- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM

### DevOps

- **Database**: Supabase (Managed PostgreSQL)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18 or higher
- **npm** or **yarn**
- **Supabase account** (free tier available at https://supabase.com)

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

Required environment variables (copy from `server/.env.example`):

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
PORT=4000
```

Get these values from your Supabase project dashboard → Settings → API

#### Client Configuration

Create a `.env` file in the `client/` directory (copy from `client/.env.example`):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_URL=http://localhost:4000
VITE_TIKTOK_SCRAPER_API_URL=https://your-tiktok-scraper-api.onrender.com
```

**Note**: The `VITE_TIKTOK_SCRAPER_API_URL` should point to your deployed TikTok scraper API on Render.com. If you haven't deployed it yet, see the [TikTok Scraper Integration](#-tiktok-scraper-integration) section below.

### 4. Set up Supabase database

1. Create a Supabase project at https://supabase.com
2. Go to SQL Editor in your Supabase dashboard
3. Run the migration SQL from `server/supabase/migrations/20250120000000_init_schema.sql`

### 5. Seed the database

From the server directory:

```bash
cd server
npm run db:seed
```

This will seed the database with initial users:

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
│   │   ├── supabase.ts    # Supabase client instance
│   │   └── index.ts       # Server entry point
│   ├── supabase/
│   │   └── migrations/   # Supabase SQL migrations
│   ├── uploads/           # File uploads directory
│   └── dist/              # Build output (gitignored)
│
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
  "token": "supabase-access-token-here",
  "user": {
    "id": "uuid-here",
    "email": "admin@example.com",
    "role": "ADMIN"
  }
}
```

### Protected Routes

All routes except `/api/auth/login` require authentication. Include the Supabase access token in the Authorization header:

```http
Authorization: Bearer <your-supabase-access-token>
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
- **TikTok Scraper Integration**: Automatically update engagement stats from TikTok posts

## 🎬 TikTok Scraper Integration

The dashboard includes integration with the TikTok scraper API to automatically update engagement statistics (views, likes, comments, shares, bookmarks) for posts in campaigns.

### Setup

1. **Deploy TikTok Scraper API**: The TikTok scraper is already deployed on Render.com. If you need to deploy your own instance, see the `TiktokScrapper/` directory README.

2. **Configure Environment Variable**: Add the TikTok scraper API URL to your client `.env` file:

   ```env
   VITE_TIKTOK_SCRAPER_API_URL=https://your-tiktok-scraper-api.onrender.com
   ```

3. **Update Engagement Stats**:
   - Navigate to any campaign detail page
   - Click the "Update Engagement Stats" button in the Posts overview section
   - The system will automatically:
     - Fetch all posts with TikTok URLs in the campaign
     - Scrape engagement data from TikTok (with automatic retry on errors)
     - Update each post's engagement statistics
     - Refresh campaign KPIs and engagement metrics

### Features

- **Batch Processing**: Updates all posts in a campaign simultaneously
- **Error Handling**: Automatic retry logic (up to 3 retries) for failed URLs
- **Progress Tracking**: Real-time progress indicator during updates
- **Smart Filtering**: Only processes posts with valid TikTok URLs
- **Automatic Refresh**: Campaign KPIs and engagement metrics are automatically recalculated

### Automated Daily Refresh (server-side)

- Server endpoint: `POST /api/internal/engagement-refresh`
- Auth: set `CRON_SECRET` in server env and send `x-cron-secret: <value>` header (leave unset only for local testing).
- Env: set `TIKTOK_SCRAPER_API_URL` on the server (can reuse the client value).
- Example trigger (Supabase Scheduled Function or GitHub Actions) at 1 AM WIB (18:00 UTC):

  ```bash
  curl -X POST https://<your-api-host>/api/internal/engagement-refresh \
    -H "Content-Type: application/json" \
    -H "x-cron-secret: $CRON_SECRET" \
    -d '{}'
  ```

The job fetches all posts with TikTok URLs, calls the scraper in batches, updates engagement metrics, and recalculates affected KPIs. Schedule your external cron to hit this endpoint daily at the desired time.

### Supabase Edge Function scheduler (example)

Run the daily refresh from Supabase without GitHub/Render:

1. Create a new Edge Function (e.g., `refresh-engagements`):
   ```bash
   supabase functions new refresh-engagements
   ```
2. Replace the function code with a simple forwarder:
   ```ts
   // supabase/functions/refresh-engagements/index.ts
   import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

   const API_URL = Deno.env.get('API_URL'); // e.g., https://your-api.example.com
   const CRON_SECRET = Deno.env.get('CRON_SECRET');

   serve(async () => {
     if (!API_URL) return new Response('Missing API_URL', { status: 500 });

     const res = await fetch(`${API_URL}/api/internal/engagement-refresh`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'x-cron-secret': CRON_SECRET ?? '',
       },
       body: JSON.stringify({}),
     });

     return new Response(await res.text(), { status: res.status, headers: res.headers });
   });
   ```
3. Deploy the function:
   ```bash
   supabase functions deploy refresh-engagements
   ```
4. Set function secrets in Supabase Dashboard → Functions → refresh-engagements → Configure: `API_URL`, `CRON_SECRET`.
5. Add a schedule (Project Settings → Edge Functions → Schedules): set cron to `0 18 * * *` (runs at 1 AM WIB / 18:00 UTC) and target `refresh-engagements`.

This keeps the cron close to your DB and off the client. Ensure `CRON_SECRET` matches the API’s expected header.

### Usage

1. Ensure posts have valid TikTok URLs in the `contentLink` field
2. Click "Update Engagement Stats" button on the campaign detail page
3. Wait for the process to complete (progress is shown)
4. View updated engagement statistics in the posts table

## 🔐 Security Notes

- **Service Role Key**: Keep your `SUPABASE_SERVICE_ROLE_KEY` secret - never expose it client-side
- **Anon Key**: The `VITE_SUPABASE_ANON_KEY` is safe for client-side use
- **Environment Variables**: Never commit `.env` files to version control
- **CORS**: Configure CORS appropriately for production
- **Row Level Security**: Consider enabling RLS policies in Supabase for additional security

## 🧪 Development

### Database Migrations

Create a new migration SQL file in `server/supabase/migrations/` and run it in the Supabase SQL Editor.

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

### Server

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm run db:seed` - Seed the database with initial data

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

- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `server/.env` are correct
- Check that your Supabase project is active
- Ensure you've run the SQL migration in Supabase SQL Editor

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
