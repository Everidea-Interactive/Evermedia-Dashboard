# Deploying to Vercel (Frontend + Backend)

This guide shows you how to deploy both your frontend and backend to Vercel using a single deployment.

## ✅ Prerequisites

- GitHub account (Vercel deploys from GitHub)
- Vercel account (free tier available)
- Supabase project set up

## 🚀 Quick Setup

### Step 1: Push to GitHub

Make sure your code is pushed to a GitHub repository.

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository
4. **Framework Preset**: Choose **"Vite"** (or "Other" if Vite is not available - your `vercel.json` will handle the configuration)
5. Vercel will auto-detect the configuration from `vercel.json`

### Step 3: Configure Environment Variables

In Vercel dashboard, go to **Settings** → **Environment Variables** and add:

**For Production:**

```
NODE_ENV=production
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
FRONTEND_URL=https://yourdomain.com
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_URL=https://yourdomain.com
```

**Important**:

- Replace `yourdomain.com` with your actual Vercel deployment URL (e.g., `evermedia-dashboard.vercel.app`) or custom domain
- **Do NOT include trailing slashes** in URLs (e.g., use `https://evermedia-dashboard.vercel.app` not `https://evermedia-dashboard.vercel.app/`)
- Both `FRONTEND_URL` and `VITE_API_URL` should be the same since frontend and API are on the same domain

### Step 4: Deploy

Click **"Deploy"** and wait for the build to complete.

## 🌐 Using Your RumahWeb Domain

1. In Vercel dashboard, go to **Settings** → **Domains**
2. Add your RumahWeb domain (e.g., `yourdomain.com`)
3. Vercel will provide DNS records to add
4. In RumahWeb control panel, add the DNS records:

   - **Type**: CNAME
   - **Name**: @ (or leave blank for root domain)
   - **Value**: [Vercel provided CNAME value]
   - **TTL**: 3600

5. Wait for DNS propagation (5-30 minutes)

## 📝 Project Structure

Your project should have:

```
Evermedia Dashboard/
├── api/
│   └── index.ts          # Vercel serverless function wrapper
├── client/               # React frontend
├── server/               # Express backend
├── vercel.json          # Vercel configuration
└── package.json
```

## 🔧 How It Works

- **Frontend**: Built from `client/` directory, served as static files
- **Backend**: Express app wrapped in `api/index.ts` as a serverless function
- **Routing**: All `/api/*` requests go to the serverless function, everything else serves the React app

## ⚙️ Local Development

For local development, you can still run:

```bash
# Run both frontend and backend
npm run dev

# Or separately
npm run server  # Backend on port 4000
npm run client  # Frontend on port 5173
```

The server will detect it's not running on Vercel and start normally.

## 🐛 Troubleshooting

### Build Failures

- Ensure all dependencies are in `package.json` files
- Check that TypeScript compiles without errors
- Verify environment variables are set in Vercel

### API Routes Not Working

- Check that `api/index.ts` exists and exports correctly
- Verify `vercel.json` routing configuration
- Check Vercel function logs in dashboard

### CORS Errors

- Ensure `FRONTEND_URL` environment variable matches your domain
- Check that CORS configuration in `server/src/index.ts` includes your domain

## 💡 Vercel Limitations

- **Function timeout**: 10 seconds (Hobby), 60 seconds (Pro)
- **Cold starts**: First request may be slower
- **File uploads**: Consider using Supabase Storage instead of local filesystem

## 🔄 Updating Deployment

Every push to your main branch will automatically trigger a new deployment. You can also manually redeploy from the Vercel dashboard.

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
