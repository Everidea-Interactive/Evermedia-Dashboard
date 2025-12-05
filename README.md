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

The server provides an endpoint for automated daily refresh of engagement statistics. This endpoint requires authentication via a secret header to prevent unauthorized access.

**Server endpoint**: `POST /api/internal/engagement-refresh`

> **Quick Setup**: Set `CRON_SECRET` and `TIKTOK_SCRAPER_API_URL` in your deployment platform (Vercel/Railway/Render). See detailed instructions below.

#### Required Environment Variables

You need to set these environment variables in your deployment platform (Vercel, Railway, Render, etc.):

**1. `CRON_SECRET`** (Required for production)

- **Purpose**: Secret token used to authenticate automated requests to the refresh endpoint
- **Where to set**:
  - **Vercel**: Dashboard → Your Project → Settings → Environment Variables → Add New
  - **Railway/Render**: Project Settings → Environment Variables → Add Variable
- **Value**: Generate a strong random string (e.g., `openssl rand -hex 32` or use a password generator)
- **Example**: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
- **Important**:
  - Must match exactly with the value set in your Supabase Edge Function secrets (see below)
  - Leave unset only for local testing (server will allow requests but warn)
  - Use different values for production vs development environments

**2. `TIKTOK_SCRAPER_API_URL`** (Required)

- **Purpose**: URL of your TikTok scraper API service. This tells your **server** where to find the scraper API when it needs to fetch engagement data.
- **Where to set**: In your **server deployment platform** (Vercel, Railway, Render, etc.) - same location as `CRON_SECRET` above
  - **Vercel**: Dashboard → Your Project → Settings → Environment Variables
  - **Railway/Render**: Project Settings → Environment Variables
- **Value**: The URL where your TikTok scraper API is hosted (e.g., `https://your-tiktok-scraper.onrender.com`)
  - ⚠️ **Important Clarification**:
    - The scraper API might be hosted on **Render** (or any other platform)
    - But you **set this variable in YOUR server** (Vercel), NOT on Render
    - You're telling your Vercel server: "When you need to scrape TikTok data, call this Render URL"
    - Think of it like a phone number: the scraper lives on Render, but your Vercel server needs to know that "phone number" to call it
- **Example**: `https://tiktok-scraper-api.onrender.com`
- **Why needed**:

  - When the automated daily refresh runs server-side, your Vercel API needs to fetch engagement data
  - It does this by making HTTP requests to the TikTok scraper API
  - Without this URL, your server doesn't know where to send those requests

  **Request Flow:**

  ```
  Supabase Edge Function (scheduled daily)
    ↓ (calls with CRON_SECRET)
  Your Vercel API (/api/internal/engagement-refresh)
    ↓ (uses TIKTOK_SCRAPER_API_URL to call)
  TikTok Scraper API (hosted on Render)
    ↓ (returns engagement data)
  Your Vercel API (updates database)
  ```

  You set `TIKTOK_SCRAPER_API_URL` in **Vercel** so your Vercel API knows where the scraper is (even if the scraper itself is hosted on Render).

- **Note**: Can reuse the same value as `VITE_TIKTOK_SCRAPER_API_URL` from client config (they can point to the same scraper service)

#### Setting Up in Vercel (Step-by-Step)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New** and add each variable:

   **Variable 1:**

   - **Key**: `CRON_SECRET`
   - **Value**: Your generated secret (e.g., `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
   - **Environment**: Select **Production** (and optionally Preview/Development if needed)
   - Click **Save**

   **Variable 2:**

   - **Key**: `TIKTOK_SCRAPER_API_URL`
   - **Value**: Your TikTok scraper API URL
   - **Environment**: Select **Production** (and optionally Preview/Development if needed)
   - Click **Save**

5. **Redeploy** your project (or wait for next auto-deploy) for changes to take effect

#### Testing the Endpoint

You can test the endpoint manually (for local development, leave `CRON_SECRET` unset):

```bash
curl -X POST https://<your-api-host>/api/internal/engagement-refresh \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET_VALUE" \
  -d '{}'
```

**For PowerShell (Windows):**

```powershell
curl.exe -X POST https://<your-api-host>/api/internal/engagement-refresh -H "Content-Type: application/json" -H "x-cron-secret: YOUR_CRON_SECRET_VALUE" -d '{}'
```

#### What It Does

The job fetches all posts with TikTok URLs, calls the scraper in batches, updates engagement metrics, and recalculates affected KPIs. Schedule your external cron (Supabase Edge Function, GitHub Actions, etc.) to hit this endpoint daily at the desired time.

### Supabase Edge Function scheduler (example)

Run the daily refresh from Supabase without GitHub/Render:

1. Create a new Edge Function (e.g., `refresh-engagements`):
   ```bash
   supabase functions new refresh-engagements
   ```
2. Replace the function code with a simple forwarder:

   ```ts
   // supabase/functions/refresh-engagements/index.ts
   import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

   const API_URL = Deno.env.get("API_URL"); // e.g., https://your-api.example.com
   const CRON_SECRET = Deno.env.get("CRON_SECRET");

   serve(async (req) => {
     try {
       if (!API_URL) {
         return new Response(JSON.stringify({ error: "Missing API_URL" }), {
           status: 500,
           headers: { "Content-Type": "application/json" },
         });
       }

       const res = await fetch(`${API_URL}/api/internal/engagement-refresh`, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           "x-cron-secret": CRON_SECRET ?? "",
         },
         body: JSON.stringify({}),
       });

       const text = await res.text();
       return new Response(text, {
         status: res.status,
         headers: { "Content-Type": "application/json" },
       });
     } catch (error) {
       return new Response(JSON.stringify({ error: error.message }), {
         status: 500,
         headers: { "Content-Type": "application/json" },
       });
     }
   });
   ```

3. Deploy the function:
   ```bash
   supabase functions deploy refresh-engagements
   ```
4. **Set function secrets** in Supabase Dashboard:

   - Go to **Functions** → **refresh-engagements** → **Configure** → **Secrets**
   - Add **`API_URL`**: Your Vercel/backend URL (e.g., `https://your-app.vercel.app` - **no trailing slash**)
   - Add **`CRON_SECRET`**: **Must match exactly** the `CRON_SECRET` value you set in Vercel (see [Required Environment Variables](#required-environment-variables) above)
   - Click **Save**

5. **Add a schedule** (Project Settings → Edge Functions → Schedules):
   - Set cron to `0 18 * * *` (runs at 1 AM WIB / 18:00 UTC)
   - Target: `refresh-engagements`
   - Click **Save**

**Important**: The `CRON_SECRET` value in Supabase Edge Function secrets **must match exactly** the `CRON_SECRET` value in your Vercel environment variables. Copy-paste the value to avoid typos.

**Note on CORS**: Internal routes (`/api/internal/*`) bypass CORS restrictions since they're server-to-server calls. This prevents any CORS-related issues with Supabase Edge Functions.

This keeps the cron close to your DB and off the client.

#### Troubleshooting Edge Function Issues

If you're getting **404 Unauthorized** or **401 Unauthorized** errors:

1. **Check Edge Function Code**: Ensure the function properly accepts the `req` parameter: `serve(async (req) => { ... })` and that you've deployed the updated code.

2. **Verify Environment Variables Match Exactly**:

   - **In Vercel** (Settings → Environment Variables): Set `CRON_SECRET` (this is your server environment)
   - **In Supabase** (Functions → refresh-engagements → Configure → Secrets): Set both:
     - `API_URL` = your Vercel API URL (e.g., `https://your-app.vercel.app` - **no trailing slash**)
     - `CRON_SECRET` = **exact same value** as in Vercel (copy-paste to avoid typos)

   ⚠️ **Common Issues**:

   - Extra spaces or newlines in the secret value
   - Trailing slash in `API_URL` (should be `https://app.vercel.app` not `https://app.vercel.app/`)
   - Case sensitivity (though headers are case-insensitive, values must match exactly)

3. **Test the Edge Function in Supabase**:

   **Option A: Using Supabase Dashboard (Easiest)**

   1. Go to Supabase Dashboard → **Edge Functions** → **refresh-engagements**
   2. Click **"Invoke Function"** button (or go to **Logs** tab and click **"Invoke"**)
   3. Leave the payload empty `{}` or don't change anything
   4. Click **"Invoke"**
   5. Check the response:
      - ✅ **200 OK**: Function executed successfully
      - ❌ **401 Unauthorized**: `CRON_SECRET` mismatch (check both Vercel and Supabase secrets)
      - ❌ **500 Error**: Check the error message (might be `API_URL` issue or server error)
   6. View logs in the **Logs** tab to see detailed execution info

   **Option B: Using curl command**

   **For PowerShell (Windows):**

   ```powershell
   # Replace <your-project-ref> with your Supabase project reference
   # Replace <your-anon-key> with your Supabase anon key (from Settings → API)
   curl.exe -X POST https://<your-project-ref>.supabase.co/functions/v1/refresh-engagements `
     -H "Authorization: Bearer <your-anon-key>" `
     -H "Content-Type: application/json" `
     -d '{}'
   ```

   **Or as a single line (PowerShell):**

   ```powershell
   curl.exe -X POST https://<your-project-ref>.supabase.co/functions/v1/refresh-engagements -H "Authorization: Bearer <your-anon-key>" -H "Content-Type: application/json" -d '{}'
   ```

   **For Bash/Linux/Mac:**

   ```bash
   # Replace <your-project-ref> with your Supabase project reference
   # Replace <your-anon-key> with your Supabase anon key (from Settings → API)
   curl -X POST https://<your-project-ref>.supabase.co/functions/v1/refresh-engagements \
     -H "Authorization: Bearer <your-anon-key>" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

   **Option C: Using Supabase CLI (Easiest - No Auth Needed)**

   ```bash
   # This skips JWT verification, perfect for testing
   supabase functions invoke refresh-engagements --no-verify-jwt
   ```

   **Note**: If you get "Invalid JWT" error with curl, you're likely using the wrong key format. The anon key should be a JWT token starting with `eyJ...`, not a publishable key starting with `sb_publishable_...`. Alternatively, use Option A (Dashboard) or Option C (CLI) which don't require manual JWT handling.

   **Finding Your Values:**

   - **Project Reference**: Found in Supabase Dashboard → Settings → API → Project URL
     - Example: If URL is `https://abcdefghijklmnop.supabase.co`, your ref is `abcdefghijklmnop`
   - **Anon Key**: Found in Supabase Dashboard → Settings → API → Project API keys → `anon` `public` key
     - ⚠️ **Important**: Use the JWT token (starts with `eyJ...`), NOT the publishable key (`sb_publishable_...`)
     - The anon key looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk5ODc2MCwiZXhwIjoxOTU0NTc0NzYwfQ...`
   - **Vercel API URL**: Found in Vercel Dashboard → Your Project → Settings → Domains (or use the default `.vercel.app` URL)

   **What to Check After Testing:**

   - **Supabase Logs**: Dashboard → Edge Functions → refresh-engagements → **Logs** tab

     - Look for any errors in the function execution
     - Check if the fetch to your API succeeded
     - Response status and body will be shown

   - **Vercel Logs**: Vercel Dashboard → Your Project → **Logs**
     - Look for `[cron-auth]` messages
     - Should see either "Authorization failed" (if secret mismatch) or the engagement refresh process starting
     - If you see "Authorization failed", check the log details for header length comparison
     - Successful requests will show the engagement refresh process with post updates

   **Expected Responses:**

   - ✅ **Success (200)**: `{"updated": X, "total": Y, "failures": [], ...}`
   - ❌ **401 Unauthorized**: `{"error": "Unauthorized"}` - Check `CRON_SECRET` values match
   - ❌ **500 Server Error**: Check error message - might be missing `API_URL` or `TIKTOK_SCRAPER_API_URL` in Vercel
   - ❌ **404 Not Found**: Check `API_URL` is correct and endpoint exists

   **Debugging 401 Unauthorized Errors:**

   If you're getting `{"error": "Unauthorized"}`, follow these steps:

   1. **Check Vercel Logs** (Most Important):

      - Go to Vercel Dashboard → Your Project → **Logs**
      - Look for `[cron-auth] Authorization failed` messages
      - The enhanced logs will show:
        - `cronSecretLength` & `headerLength`: Compare these - if different, values don't match
        - `cronSecretFirst3` & `cronSecretLast3`: First/last 3 chars of Vercel secret
        - `headerFirst3` & `headerLast3`: First/last 3 chars of received header
        - `allRelevantHeaders`: All headers containing 'cron', 'secret', or 'x-'
        - `userAgent`: Should show `SupabaseEdgeRuntime` if coming from Edge Function
        - `origin`: The origin of the request
      - **Key Checks**:
        - If `headerLength` is 0: Edge Function isn't sending the header (check Edge Function code)
        - If lengths match but first/last chars differ: Values are different (check for hidden characters)
        - If `userAgent` doesn't show Supabase: Request might be coming from wrong source

   2. **Use Debug Endpoint** (Temporary - for testing):

      ```powershell
      # Test what your Vercel API is receiving
      curl.exe -X GET https://<your-vercel-url>/api/internal/debug-auth -H "x-cron-secret: YOUR_SECRET_HERE"
      ```

      This will show you what headers are being received and compared.

   3. **Verify Values Match Exactly**:

      - **Vercel**: Settings → Environment Variables → `CRON_SECRET`
      - **Supabase**: Functions → refresh-engagements → Configure → Secrets → `CRON_SECRET`
      - Copy from Vercel and paste into Supabase (don't type manually)
      - Check for:
        - No extra spaces before/after
        - No newlines
        - Exact same characters

   4. **Redeploy After Changes**:
      - After updating Supabase secrets: No redeploy needed (secrets are live)
      - After updating Vercel env vars: Trigger a new deployment or wait for auto-deploy
      - After updating Edge Function code: `supabase functions deploy refresh-engagements`

4. **Check Vercel Logs**:

   - Go to Vercel Dashboard → Your Project → Logs
   - Look for `[cron-auth]` messages when the Edge Function runs
   - The logs will show if the header was received and its length (without exposing the secret)

5. **Verify API_URL Format**:

   - If deployed to Vercel, use: `https://your-project.vercel.app` (no `/api` suffix)
   - The Edge Function will append `/api/internal/engagement-refresh` automatically
   - Make sure there's **no trailing slash** in `API_URL`

6. **Redeploy After Changes**:
   - After updating Edge Function code: `supabase functions deploy refresh-engagements`
   - After changing Vercel env vars: Trigger a new deployment (or wait for auto-deploy)

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
