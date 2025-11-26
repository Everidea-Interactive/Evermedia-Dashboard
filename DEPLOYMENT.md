# Deployment Guide

This guide covers multiple deployment strategies for the Evermedia Dashboard application.

## 📋 Prerequisites

- Supabase project set up and migrations applied
- Environment variables ready (see below)
- Domain name (optional but recommended)

> **Note**: If you have a domain from RumahWeb, see the [RumahWeb Domain Setup](#-rumahweb-domain-setup) section below for specific instructions.

## 🔐 Environment Variables

### Server Environment Variables

Create a `.env` file in the `server/` directory:

```env
NODE_ENV=production
PORT=4000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Client Environment Variables

Create a `.env.production` file in the `client/` directory:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_URL=https://your-backend-domain.com
```

**Important**: Replace `your-backend-domain.com` with your actual backend URL in production.

---

## 🚀 Option 1: Vercel Only (Simplest - Frontend + Backend)

**Recommended if you want everything in one place!**

You can deploy both frontend and backend to Vercel. See **[DEPLOYMENT_VERCEL.md](./DEPLOYMENT_VERCEL.md)** for detailed instructions.

**Quick Steps:**

1. Push code to GitHub
2. Import to Vercel (it will auto-detect `vercel.json`)
3. Add environment variables
4. Deploy!

**Pros:**

- ✅ Single platform for everything
- ✅ Free tier available
- ✅ Automatic HTTPS
- ✅ Easy custom domain setup
- ✅ Automatic deployments from GitHub

**Cons:**

- ⚠️ Serverless functions have timeout limits (10s free, 60s pro)
- ⚠️ Cold starts on first request
- ⚠️ Not ideal for long-running processes

---

## 🚀 Option 2: Platform-as-a-Service (PaaS) - Separate Services

### Frontend: Vercel

1. **Install Vercel CLI** (optional):

   ```bash
   npm i -g vercel
   ```

2. **Deploy**:

   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Configure:
     - **Framework Preset**: Vite
     - **Root Directory**: `client`
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
     - **Install Command**: `npm install`

3. **Environment Variables** (in Vercel dashboard):

   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_URL=https://your-backend-url.com
   VITE_TIKTOK_SCRAPER_API_URL=https://your-tiktok-scraper-api.onrender.com
   ```

4. **Deploy**: Click "Deploy"

### Backend: Railway

1. **Install Railway CLI** (optional):

   ```bash
   npm i -g @railway/cli
   ```

2. **Deploy**:

   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Configure:
     - **Root Directory**: `server`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`

3. **Environment Variables** (in Railway dashboard):

   ```
   NODE_ENV=production
   PORT=4000
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Generate Domain**: Railway will provide a public URL automatically

### Alternative Backend Options

**Render**:

- Similar to Railway
- Go to [render.com](https://render.com)
- Create a new "Web Service"
- Connect GitHub repo
- Set root directory to `server`
- Build: `npm install && npm run build`
- Start: `npm start`

**Fly.io**:

```bash
cd server
fly launch
# Follow prompts, then:
fly deploy
```

---

## ☁️ Option 3: Traditional VPS (Ubuntu/Debian)

### Server Setup

1. **SSH into your VPS**:

   ```bash
   ssh user@your-server-ip
   ```

2. **Install dependencies**:

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
   ```

3. **Clone repository**:

   ```bash
   git clone <your-repo-url>
   cd "Evermedia Dashboard"
   ```

4. **Build and run backend**:

   ```bash
   cd server
   npm install
   npm run build
   # Create .env file with production variables
   npm start
   ```

5. **Set up PM2** (process manager):

   ```bash
   sudo npm install -g pm2
   pm2 start dist/index.js --name evermedia-server
   pm2 save
   pm2 startup
   ```

6. **Build frontend**:

   ```bash
   cd ../client
   npm install
   npm run build
   ```

7. **Configure Nginx**:

   ```bash
   sudo nano /etc/nginx/sites-available/evermedia
   ```

   Add configuration:

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       # Frontend
       location / {
           root /home/user/Evermedia Dashboard/client/dist;
           try_files $uri $uri/ /index.html;
       }

       # Backend API
       location /api {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   Enable site:

   ```bash
   sudo ln -s /etc/nginx/sites-available/evermedia /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

8. **Set up SSL**:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

---

## 🌐 RumahWeb Domain Setup

If you have a domain from RumahWeb, here's how to configure it with different deployment options:

### Recommended Setup: Vercel Only (Simplest)

**Best option if you want everything in one place!** See [DEPLOYMENT_VERCEL.md](./DEPLOYMENT_VERCEL.md) for full instructions.

### Alternative Setup: Vercel + Railway/Render

This option separates frontend and backend for more control and better performance.

#### Step 1: Deploy Frontend to Vercel

1. Deploy your frontend to Vercel (see Option 1 above)
2. In Vercel dashboard, go to **Settings** → **Domains**
3. Add your RumahWeb domain (e.g., `app.yourdomain.com` or `yourdomain.com`)
4. Vercel will provide DNS records to add

#### Step 2: Deploy Backend to Railway or Render

1. Deploy backend to Railway or Render (see Option 1 above)
2. In Railway/Render dashboard, add your custom domain:
   - Railway: **Settings** → **Domains** → Add domain (e.g., `api.yourdomain.com`)
   - Render: **Settings** → **Custom Domains** → Add domain (e.g., `api.yourdomain.com`)
3. They will provide DNS records (usually a CNAME)

#### Step 3: Configure DNS in RumahWeb

1. Log in to your RumahWeb control panel
2. Go to **DNS Management** or **Zone Editor**
3. Add the following DNS records:

   **For Frontend (Vercel)**:

   ```
   Type: CNAME
   Name: @ (or app, or leave blank for root domain)
   Value: cname.vercel-dns.com (or the value Vercel provides)
   TTL: 3600
   ```

   **For Backend API**:

   ```
   Type: CNAME
   Name: api (or api.yourdomain.com)
   Value: [Railway/Render provided CNAME]
   TTL: 3600
   ```

   **Alternative: Using A Record (if CNAME not supported for root)**:

   ```
   Type: A
   Name: @
   Value: [Vercel IP addresses - check Vercel docs]
   TTL: 3600
   ```

4. Wait for DNS propagation (usually 5-30 minutes, can take up to 48 hours)

#### Step 4: Update Environment Variables

**Frontend (Vercel)**:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://api.yourdomain.com
VITE_TIKTOK_SCRAPER_API_URL=https://your-tiktok-scraper-api.onrender.com
```

**Backend (Railway/Render)**:

```
NODE_ENV=production
PORT=4000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=https://yourdomain.com,https://www.yourdomain.com
```

### Alternative: Single Domain Setup (VPS)

If you prefer to use a single domain with subdirectories or want full control:

1. **Deploy to VPS** (see Option 2 above)
2. **Configure Nginx** to serve both frontend and backend:

   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       # Frontend
       location / {
           root /var/www/evermedia/client/dist;
           try_files $uri $uri/ /index.html;
       }

       # Backend API
       location /api {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **Update DNS in RumahWeb**:

   ```
   Type: A
   Name: @
   Value: [Your VPS IP address]
   TTL: 3600

   Type: A
   Name: www
   Value: [Your VPS IP address]
   TTL: 3600
   ```

4. **Set SSL**:

   ```bash
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

5. **Update Frontend Environment**:
   ```
   VITE_API_URL=https://yourdomain.com
   ```

### DNS Record Types Explained

- **A Record**: Points domain to an IP address (use for VPS)
- **CNAME Record**: Points domain to another domain name (use for Vercel/Railway/Render)
- **@**: Represents root domain (yourdomain.com)
- **www**: Subdomain (www.yourdomain.com)
- **api**: Subdomain (api.yourdomain.com)

### Troubleshooting RumahWeb DNS

1. **DNS not propagating**: Wait 24-48 hours, clear DNS cache
2. **CNAME not working**: Some registrars don't allow CNAME on root domain (@), use subdomain instead
3. **SSL certificate issues**: Ensure DNS is fully propagated before requesting SSL
4. **Can't find DNS settings**: Look for "DNS Management", "Zone Editor", or "DNS Records" in RumahWeb panel

---

## 🔧 Post-Deployment Checklist

- [ ] Verify environment variables are set correctly
- [ ] Test API endpoints (`/api/health`)
- [ ] Test frontend loads correctly
- [ ] Verify authentication flow works
- [ ] Check CORS configuration allows frontend domain
- [ ] Set up monitoring (optional):
  - [Uptime Robot](https://uptimerobot.com) for uptime monitoring
  - [Sentry](https://sentry.io) for error tracking
- [ ] Configure backups for Supabase database
- [ ] Set up CI/CD pipeline (GitHub Actions recommended)

---

## 🔄 CI/CD Setup (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "20"
      - name: Deploy to Railway
        run: |
          # Add Railway deployment commands
          # or use Railway's GitHub integration
```

---

## 🐛 Troubleshooting

### CORS Errors

- Ensure `VITE_API_URL` matches your backend URL exactly
- Update CORS configuration in `server/src/index.ts` to include your frontend domain

### Environment Variables Not Loading

- Verify `.env` files are in correct directories
- Check variable names match exactly (case-sensitive)
- Restart server after changing environment variables

### Database Connection Issues

- Verify Supabase project is active
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Ensure migrations have been applied

### Build Failures

- Check Node.js version (requires 18+)
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npm run build`

---

## 📊 Monitoring Recommendations

1. **Application Monitoring**:

   - [PM2 Plus](https://pm2.io) for Node.js monitoring
   - [New Relic](https://newrelic.com) or [Datadog](https://datadoghq.com)

2. **Error Tracking**:

   - [Sentry](https://sentry.io) - Free tier available

3. **Uptime Monitoring**:

   - [Uptime Robot](https://uptimerobot.com) - Free tier available
   - [Pingdom](https://pingdom.com)

4. **Logs**:
   - Use PM2 logs: `pm2 logs`
   - Or cloud logging: Railway/Render provide built-in logs

---

## 🔒 Security Checklist

- [ ] Use HTTPS (SSL/TLS certificates)
- [ ] Never commit `.env` files
- [ ] Use strong Supabase service role key (keep secret)
- [ ] Enable Supabase Row Level Security (RLS) policies
- [ ] Configure CORS to only allow your frontend domain
- [ ] Set up rate limiting (consider `express-rate-limit`)
- [ ] Regular security updates for dependencies
- [ ] Use environment-specific configurations

---

## 💰 Cost Estimates

### Free Tier Options:

- **Vercel**: Free tier (hobby) - sufficient for small projects
- **Railway**: $5/month after free trial
- **Render**: Free tier available (with limitations)
- **Supabase**: Free tier available (500MB database)

### Paid Options:

- **VPS** (DigitalOcean/Linode): $5-10/month
- **AWS/GCP/Azure**: Pay-as-you-go (can be expensive)
- **Managed services**: $10-50/month depending on traffic

---

## 📚 Additional Resources

- [Vercel Deployment Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Supabase Documentation](https://supabase.com/docs)
- [PM2 Documentation](https://pm2.keymetrics.io/docs)

---

## 🆘 Need Help?

If you encounter issues during deployment:

1. Check the troubleshooting section above
2. Review server logs
3. Verify all environment variables are set correctly
4. Ensure database migrations are applied
5. Check network/firewall settings
